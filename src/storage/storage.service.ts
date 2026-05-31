import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
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

@Injectable()
export class StorageService {
  private readonly supabaseUrl: string;
  private readonly supabaseKey: string;
  private readonly bucket: string;
  private readonly targetBytes: number;
  private readonly qualitySteps: number[];

  constructor(private config: ConfigService) {
    this.supabaseUrl = config.get('SUPABASE_URL', '');
    this.supabaseKey = config.get('SUPABASE_SERVICE_KEY', '');
    this.bucket = config.get('SUPABASE_BUCKET', 'cafe-images');
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
          originalname: `remote-image${extensionFromUrl(parsedUrl)}`,
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

  async deleteImage(imageUrl: string): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseKey) return;

    const path = imageUrl.replace(
      `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/`,
      '',
    );

    await fetch(`${this.supabaseUrl}/storage/v1/object/${this.bucket}/${path}`, {
      method: 'DELETE',
      headers: {
        apikey: this.supabaseKey,
        Authorization: `Bearer ${this.supabaseKey}`,
      },
    });
  }
}
