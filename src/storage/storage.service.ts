import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { lookup } from 'dns/promises';
import { promises as fsp } from 'fs';
import { isIP } from 'net';
import type {} from 'multer';
import { tmpdir } from 'os';
import { basename, extname, join } from 'path';
import sharp = require('sharp');
import { promisify } from 'util';

const DEFAULT_TARGET_KB = 2048;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const REMOTE_IMAGE_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_QUALITY = 92;
const DEFAULT_MIN_QUALITY = 84;
const WEBP_OPTIONS = {
  effort: 6,
  smartSubsample: true,
};
const HEIF_CONVERT_COMMAND = 'heif-convert';
const SIPS_PATH = '/usr/bin/sips';

const run = promisify(execFile);
type UploadedFile = Express.Multer.File;
type ImageStorageProvider = 'supabase' | 'cloudinary';

export function getImageStorageProvider(value?: string): ImageStorageProvider {
  return value === 'cloudinary' ? 'cloudinary' : 'supabase';
}

export function signCloudinaryParams(params: Record<string, string>, apiSecret: string) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
}

export function isCloudinaryUrl(imageUrl: string) {
  try {
    return new URL(imageUrl).hostname === 'res.cloudinary.com';
  } catch {
    return false;
  }
}

export function cloudinaryPublicIdFromUrl(imageUrl: string, cloudName?: string): string | null {
  try {
    const url = new URL(imageUrl);
    if (url.hostname !== 'res.cloudinary.com') return null;
    if (cloudName && url.pathname.split('/')[1] !== cloudName) return null;

    const marker = '/image/upload/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const parts = url.pathname
      .slice(markerIndex + marker.length)
      .split('/')
      .filter(Boolean);
    const versionIndex = parts.findIndex((part) => /^v\d+$/.test(part));
    const publicPath = (versionIndex === -1 ? parts : parts.slice(versionIndex + 1)).join('/');
    return publicPath.replace(/\.[^/.]+$/, '') || null;
  } catch {
    return null;
  }
}

export function isSupabasePublicStorageUrl(imageUrl: string, supabaseUrl = '') {
  try {
    const url = new URL(imageUrl);
    const configuredHost = supabaseUrl ? new URL(supabaseUrl).hostname : '';
    return (
      url.pathname.startsWith('/storage/v1/object/public/') &&
      (url.hostname.endsWith('.supabase.co') || url.hostname === configuredHost)
    );
  } catch {
    return false;
  }
}

function readNumberConfig(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clampQuality(value: number) {
  return Math.min(100, Math.max(1, Math.round(value)));
}

function buildQualitySteps(maxQuality: number, minQuality: number) {
  const max = clampQuality(maxQuality);
  const min = Math.min(max, clampQuality(minQuality));
  const steps: number[] = [];

  for (let quality = max; quality >= min; quality -= 2) steps.push(quality);

  if (steps.at(-1) !== min) steps.push(min);
  return steps;
}

function isSupportedSupabaseSecret(key: string) {
  return key.startsWith('eyJ') || key.startsWith('sb_secret_');
}

function isHeicImage(file: UploadedFile) {
  const extension = extname(file.originalname).toLowerCase();
  return (
    ['.heic', '.heif', '.heics', '.heifs'].includes(extension) ||
    /image\/hei[cf]/i.test(file.mimetype)
  );
}

function isPrivateIp(address: string) {
  if (address === '127.0.0.1' || address === '0.0.0.0' || address === '::1') return true;
  if (address.startsWith('10.') || address.startsWith('192.168.')) return true;

  const parts = address.split('.').map(Number);
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part))) {
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
  }

  const lower = address.toLowerCase();
  return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
}

function extensionFromUrl(url: URL) {
  const extension = extname(url.pathname).toLowerCase();
  return extension || '.jpg';
}

function basenameFromUrl(url: URL) {
  const name = basename(decodeURIComponent(url.pathname));
  return name || `remote-image${extensionFromUrl(url)}`;
}

function safePublicIdBaseName(name: string) {
  return basename(name, extname(name)).replace(/[^a-zA-Z0-9_.-]+/g, '_') || 'image';
}

@Injectable()
export class StorageService {
  private readonly provider: ImageStorageProvider;
  private readonly supabaseUrl: string;
  private readonly supabaseKey: string;
  private readonly bucket: string;
  private readonly cloudinaryCloudName: string;
  private readonly cloudinaryApiKey: string;
  private readonly cloudinaryApiSecret: string;
  private readonly targetBytes: number;
  private readonly qualitySteps: number[];

  constructor(private config: ConfigService) {
    this.provider = getImageStorageProvider(config.get('IMAGE_STORAGE_PROVIDER'));
    this.supabaseUrl = config.get('SUPABASE_URL', '');
    this.supabaseKey = config.get('SUPABASE_SERVICE_KEY', '');
    this.bucket = config.get('SUPABASE_BUCKET', 'cafe-images');
    this.cloudinaryCloudName = config.get('CLOUDINARY_CLOUD_NAME', '');
    this.cloudinaryApiKey = config.get('CLOUDINARY_API_KEY', '');
    this.cloudinaryApiSecret = config.get('CLOUDINARY_API_SECRET', '');
    this.targetBytes =
      readNumberConfig(config.get('IMAGE_MAX_OUTPUT_KB'), DEFAULT_TARGET_KB) * 1024;
    this.qualitySteps = buildQualitySteps(
      readNumberConfig(config.get('IMAGE_WEBP_MAX_QUALITY'), DEFAULT_MAX_QUALITY),
      readNumberConfig(config.get('IMAGE_WEBP_MIN_QUALITY'), DEFAULT_MIN_QUALITY),
    );

    if (this.supabaseKey && !isSupportedSupabaseSecret(this.supabaseKey)) {
      throw new Error(
        'SUPABASE_SERVICE_KEY must be a Supabase secret key. ' +
          'Use a new sb_secret_ key or a legacy service_role JWT from Supabase Project Settings → API Keys.',
      );
    }
  }

  private async createHeicPngFallback(file: UploadedFile): Promise<{
    buffer: Buffer;
    cleanup: () => Promise<void>;
  }> {
    const extension = extname(file.originalname).toLowerCase() || '.heic';
    const tempBase = join(
      tmpdir(),
      `cafe-image-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const inputPath = `${tempBase}${extension}`;
    const outputPath = `${tempBase}.png`;
    const fallbackErrors: string[] = [];

    await fsp.writeFile(inputPath, file.buffer);

    const cleanup = async () => {
      await Promise.all([fsp.rm(inputPath, { force: true }), fsp.rm(outputPath, { force: true })]);
    };

    try {
      await run(HEIF_CONVERT_COMMAND, [inputPath, outputPath]);
      return { buffer: await fsp.readFile(outputPath), cleanup };
    } catch (error) {
      fallbackErrors.push(`heif-convert fallback failed: ${(error as Error).message}`);
      await fsp.rm(outputPath, { force: true });
    }

    try {
      await run(SIPS_PATH, ['-s', 'format', 'png', inputPath, '--out', outputPath]);
      return { buffer: await fsp.readFile(outputPath), cleanup };
    } catch (error) {
      fallbackErrors.push(`sips fallback failed: ${(error as Error).message}`);
      await cleanup();
    }

    throw new Error(fallbackErrors.join('; '));
  }

  private async getSharpInput(file: UploadedFile): Promise<{
    buffer: Buffer;
    cleanup?: () => Promise<void>;
  }> {
    if (!isHeicImage(file)) return { buffer: file.buffer };

    try {
      await sharp(file.buffer)
        .rotate()
        .webp({ ...WEBP_OPTIONS, quality: this.qualitySteps[0] })
        .toBuffer();
      return { buffer: file.buffer };
    } catch {
      return this.createHeicPngFallback(file);
    }
  }

  private async convertToBestWebp(file: UploadedFile): Promise<Buffer> {
    const { buffer, cleanup } = await this.getSharpInput(file);
    const candidates: Buffer[] = [];

    try {
      for (const quality of this.qualitySteps) {
        const candidate = await sharp(buffer)
          .rotate()
          .webp({ ...WEBP_OPTIONS, quality })
          .toBuffer();

        candidates.push(candidate);
        if (candidate.byteLength <= this.targetBytes) break;
      }

      return (
        candidates.find((candidate) => candidate.byteLength <= this.targetBytes) ??
        candidates.at(-1)
      );
    } finally {
      await cleanup?.();
    }
  }

  private async assertSafeRemoteUrl(imageUrl: string): Promise<URL> {
    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      throw new Error('Invalid URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only http/https image URLs are supported');
    }
    if (parsed.username || parsed.password) {
      throw new Error('Image URL must not contain credentials');
    }

    const addresses = isIP(parsed.hostname)
      ? [{ address: parsed.hostname }]
      : await lookup(parsed.hostname, { all: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
      throw new Error('Private or local image URLs are not allowed');
    }

    return parsed;
  }

  async uploadImageFromUrl(imageUrl: string, folder: string = 'cafes'): Promise<string> {
    const parsedUrl = await this.assertSafeRemoteUrl(imageUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REMOTE_IMAGE_TIMEOUT_MS);

    try {
      const response = await fetch(parsedUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
      });

      if (response.status >= 300 && response.status < 400) {
        throw new Error('Source image redirects are not supported');
      }
      if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);

      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
      if (!contentType.startsWith('image/')) throw new Error('Source is not an image');

      const contentLength = Number(response.headers.get('content-length') ?? 0);
      if (contentLength > MAX_SOURCE_BYTES) throw new Error('Source image is larger than 25MB');

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_SOURCE_BYTES) throw new Error('Source image is larger than 25MB');

      return this.uploadImage(
        {
          originalname: basenameFromUrl(parsedUrl),
          mimetype: contentType,
          buffer,
        } as UploadedFile,
        folder,
      );
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'Source image request timed out'
          : (error as Error).message;
      throw new Error(message);
    } finally {
      clearTimeout(timeout);
    }
  }

  async uploadImage(file: UploadedFile, folder: string = 'cafes'): Promise<string> {
    if (this.provider === 'cloudinary') return this.uploadImageToCloudinary(file, folder);
    return this.uploadImageToSupabase(file, folder);
  }

  private async uploadImageToSupabase(file: UploadedFile, folder: string): Promise<string> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new InternalServerErrorException('Supabase is not configured');
    }

    let webpBuffer: Buffer;
    try {
      webpBuffer = await this.convertToBestWebp(file);
    } catch (error) {
      throw new InternalServerErrorException(
        `Image conversion failed: ${(error as Error).message}`,
      );
    }

    const baseName = basename(file.originalname, extname(file.originalname)).replace(/\s/g, '_');
    const fileName = `${folder}/${Date.now()}-${baseName}.webp`;

    const response = await fetch(
      `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${fileName}`,
      {
        method: 'POST',
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': 'image/webp',
        },
        body: webpBuffer as any,
      },
    );

    if (!response.ok) {
      const raw = await response.text();
      let parsed: { statusCode?: string; error?: string; message?: string } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        /* not JSON */
      }

      if (
        response.status === 401 ||
        response.status === 403 ||
        parsed.message?.includes('JWS') ||
        parsed.message?.includes('JWT')
      ) {
        throw new InternalServerErrorException(
          'Supabase Storage auth failed (check SUPABASE_SERVICE_KEY and SUPABASE_URL in .env). ' +
            `Supabase said: ${parsed.message ?? raw}`,
        );
      }

      throw new InternalServerErrorException(`Image upload failed: ${parsed.message ?? raw}`);
    }

    return `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${fileName}`;
  }

  private async uploadImageToCloudinary(file: UploadedFile, folder: string): Promise<string> {
    if (!this.cloudinaryCloudName || !this.cloudinaryApiKey || !this.cloudinaryApiSecret) {
      throw new InternalServerErrorException('Cloudinary is not configured');
    }

    let webpBuffer: Buffer;
    try {
      webpBuffer = await this.convertToBestWebp(file);
    } catch (error) {
      throw new InternalServerErrorException(
        `Image conversion failed: ${(error as Error).message}`,
      );
    }

    const timestamp = String(Math.floor(Date.now() / 1000));
    const publicId = `${timestamp}-${safePublicIdBaseName(file.originalname)}`;
    const signedParams = { folder, public_id: publicId, timestamp };
    const body = new FormData();
    body.set('file', new Blob([webpBuffer as any], { type: 'image/webp' }), `${publicId}.webp`);
    body.set('api_key', this.cloudinaryApiKey);
    body.set('folder', folder);
    body.set('public_id', publicId);
    body.set('timestamp', timestamp);
    body.set('signature', signCloudinaryParams(signedParams, this.cloudinaryApiSecret));

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudinaryCloudName}/image/upload`,
      { method: 'POST', body },
    );
    const raw = await response.text();

    let parsed: { secure_url?: string; error?: { message?: string } } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* not JSON */
    }

    if (!response.ok || !parsed.secure_url) {
      throw new InternalServerErrorException(
        `Cloudinary upload failed: ${parsed.error?.message ?? raw}`,
      );
    }

    return parsed.secure_url;
  }

  async deleteImage(imageUrl: string): Promise<void> {
    if (isCloudinaryUrl(imageUrl)) return this.deleteCloudinaryImage(imageUrl);
    if (this.provider !== 'supabase') return;
    if (!this.supabaseUrl || !this.supabaseKey) return;

    const publicPrefix = `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/`;
    if (!imageUrl.startsWith(publicPrefix)) return;

    const path = imageUrl.slice(publicPrefix.length);

    await fetch(`${this.supabaseUrl}/storage/v1/object/${this.bucket}/${path}`, {
      method: 'DELETE',
      headers: {
        apikey: this.supabaseKey,
        Authorization: `Bearer ${this.supabaseKey}`,
      },
    });
  }

  private async deleteCloudinaryImage(imageUrl: string): Promise<void> {
    if (!this.cloudinaryCloudName || !this.cloudinaryApiKey || !this.cloudinaryApiSecret) return;

    const publicId = cloudinaryPublicIdFromUrl(imageUrl, this.cloudinaryCloudName);
    if (!publicId) return;

    const timestamp = String(Math.floor(Date.now() / 1000));
    const signedParams = { public_id: publicId, timestamp };
    const body = new FormData();
    body.set('api_key', this.cloudinaryApiKey);
    body.set('public_id', publicId);
    body.set('timestamp', timestamp);
    body.set('signature', signCloudinaryParams(signedParams, this.cloudinaryApiSecret));

    await fetch(`https://api.cloudinary.com/v1_1/${this.cloudinaryCloudName}/image/destroy`, {
      method: 'POST',
      body,
    });
  }
}
