import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promises as fsp } from 'fs';
import type {} from 'multer';
import { tmpdir } from 'os';
import { basename, extname, join } from 'path';
import sharp = require('sharp');
import { promisify } from 'util';

const TARGET_BYTES = 800 * 1024;
const QUALITY_STEPS = [80, 76, 72, 68, 64, 60];
const WEBP_OPTIONS = {
  effort: 6,
  smartSubsample: true,
};
const HEIF_CONVERT_COMMAND = 'heif-convert';
const SIPS_PATH = '/usr/bin/sips';

const run = promisify(execFile);
type UploadedFile = Express.Multer.File;

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

@Injectable()
export class StorageService {
  private readonly supabaseUrl: string;
  private readonly supabaseKey: string;
  private readonly bucket: string;

  constructor(private config: ConfigService) {
    this.supabaseUrl = config.get('SUPABASE_URL', '');
    this.supabaseKey = config.get('SUPABASE_SERVICE_KEY', '');
    this.bucket = config.get('SUPABASE_BUCKET', 'cafe-images');

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
        .webp({ ...WEBP_OPTIONS, quality: QUALITY_STEPS[0] })
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
      for (const quality of QUALITY_STEPS) {
        const candidate = await sharp(buffer)
          .rotate()
          .webp({ ...WEBP_OPTIONS, quality })
          .toBuffer();

        candidates.push(candidate);
        if (candidate.byteLength <= TARGET_BYTES) break;
      }

      return (
        candidates.find((candidate) => candidate.byteLength <= TARGET_BYTES) ?? candidates.at(-1)
      );
    } finally {
      await cleanup?.();
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
