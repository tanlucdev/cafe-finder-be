import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { readFile, writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import {
  isCloudinaryUrl,
  isSupabasePublicStorageUrl,
  signCloudinaryParams,
} from '../src/storage/storage.service';

type ImageField = 'Cafe.images' | 'Cafe.coverImage' | 'Cafe.menuImage' | 'BlogPost.heroImage';
type ReportItem = {
  recordType: 'Cafe' | 'BlogPost';
  recordId: string;
  field: ImageField;
  oldUrl: string;
  newUrl: string | null;
  status: 'migrated' | 'dry-run' | 'skipped-cloudinary' | 'skipped-non-supabase' | 'error';
  error?: string;
};
type UploadFn = (url: string, folder: string) => Promise<string>;

const dryRun = process.argv.includes('--dry-run');
const fromReport = process.argv.find((arg) => arg.startsWith('--from-report='))?.split('=')[1];
const report: ReportItem[] = [];

function shouldMigrateUrl(url: string | null | undefined, supabaseUrl = '') {
  if (!url) return false;
  return !isCloudinaryUrl(url) && isSupabasePublicStorageUrl(url, supabaseUrl);
}

function pushSkipped(
  recordType: ReportItem['recordType'],
  recordId: string,
  field: ImageField,
  url: string | null | undefined,
  supabaseUrl = '',
) {
  if (!url) return;
  report.push({
    recordType,
    recordId,
    field,
    oldUrl: url,
    newUrl: null,
    status: isCloudinaryUrl(url) ? 'skipped-cloudinary' : 'skipped-non-supabase',
  });
}

export async function mapImageUrls(
  urls: string[],
  field: ImageField,
  recordType: ReportItem['recordType'],
  recordId: string,
  folder: string,
  options: { dryRun: boolean; supabaseUrl?: string; upload: UploadFn; cache?: Map<string, string> },
) {
  const cache = options.cache ?? new Map<string, string>();
  let changed = false;
  const mapped: string[] = [];

  for (const url of urls) {
    if (!shouldMigrateUrl(url, options.supabaseUrl)) {
      pushSkipped(recordType, recordId, field, url, options.supabaseUrl);
      mapped.push(url);
      continue;
    }

    if (options.dryRun) {
      report.push({ recordType, recordId, field, oldUrl: url, newUrl: null, status: 'dry-run' });
      mapped.push(url);
      continue;
    }

    try {
      const newUrl = cache.get(url) ?? (await options.upload(url, folder));
      cache.set(url, newUrl);
      report.push({ recordType, recordId, field, oldUrl: url, newUrl, status: 'migrated' });
      mapped.push(newUrl);
      changed ||= newUrl !== url;
    } catch (error) {
      report.push({
        recordType,
        recordId,
        field,
        oldUrl: url,
        newUrl: null,
        status: 'error',
        error: (error as Error).message,
      });
      mapped.push(url);
    }
  }

  return { urls: mapped, changed };
}

async function mapOptionalUrl(
  url: string | null | undefined,
  field: ImageField,
  recordType: ReportItem['recordType'],
  recordId: string,
  folder: string,
  options: { dryRun: boolean; supabaseUrl?: string; upload: UploadFn; cache: Map<string, string> },
) {
  if (!url || !shouldMigrateUrl(url, options.supabaseUrl)) {
    pushSkipped(recordType, recordId, field, url, options.supabaseUrl);
    return { url: url ?? null, changed: false };
  }

  const mapped = await mapImageUrls([url], field, recordType, recordId, folder, options);
  return { url: mapped.urls[0], changed: mapped.changed };
}

async function main() {
  const prisma = new PrismaClient();
  const config = new ConfigService();
  const supabaseUrl = config.get('SUPABASE_URL', '');
  const cache = new Map<string, string>();
  const upload: UploadFn = (url, folder) => uploadOriginalUrlToCloudinary(url, folder, config);

  try {
    if (fromReport) {
      await repairFromReport(prisma, fromReport, upload, cache);
    } else {
      const cafes = await prisma.cafe.findMany({
        select: { id: true, images: true, coverImage: true, menuImage: true },
        orderBy: { id: 'asc' },
      });

      for (const cafe of cafes) {
        const images = await mapImageUrls(
          cafe.images,
          'Cafe.images',
          'Cafe',
          cafe.id,
          `cafes/${cafe.id}`,
          {
            dryRun,
            supabaseUrl,
            upload,
            cache,
          },
        );
        const cover = await mapOptionalUrl(
          cafe.coverImage,
          'Cafe.coverImage',
          'Cafe',
          cafe.id,
          `cafes/${cafe.id}`,
          { dryRun, supabaseUrl, upload, cache },
        );
        const menu = await mapOptionalUrl(
          cafe.menuImage,
          'Cafe.menuImage',
          'Cafe',
          cafe.id,
          `cafes/${cafe.id}/menu`,
          {
            dryRun,
            supabaseUrl,
            upload,
            cache,
          },
        );

        if (!dryRun && (images.changed || cover.changed || menu.changed)) {
          await prisma.cafe.update({
            where: { id: cafe.id },
            data: { images: images.urls, coverImage: cover.url, menuImage: menu.url },
          });
        }
      }

      const posts = await prisma.blogPost.findMany({
        select: { id: true, heroImage: true },
        orderBy: { id: 'asc' },
      });

      for (const post of posts) {
        const hero = await mapOptionalUrl(
          post.heroImage,
          'BlogPost.heroImage',
          'BlogPost',
          post.id,
          `blogs/${post.id}`,
          {
            dryRun,
            supabaseUrl,
            upload,
            cache,
          },
        );

        if (!dryRun && hero.changed) {
          await prisma.blogPost.update({ where: { id: post.id }, data: { heroImage: hero.url } });
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  const summary = report.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
  const output = join(
    process.cwd(),
    `image-migration-report-${dryRun ? 'dry-run' : 'run'}-${Date.now()}.json`,
  );
  await writeFile(output, JSON.stringify({ dryRun, summary, items: report }, null, 2));
  console.log(JSON.stringify({ report: output, summary }, null, 2));
}

function publicIdFromSourceUrl(imageUrl: string) {
  const url = new URL(imageUrl);
  const fileName = basename(decodeURIComponent(url.pathname));
  const baseName = basename(fileName, extname(fileName));
  return `${Math.floor(Date.now() / 1000)}-${baseName.replace(/[^a-zA-Z0-9_.-]+/g, '_') || 'image'}`;
}

async function uploadOriginalUrlToCloudinary(
  imageUrl: string,
  folder: string,
  config: ConfigService,
) {
  const cloudName = config.get('CLOUDINARY_CLOUD_NAME', '');
  const apiKey = config.get('CLOUDINARY_API_KEY', '');
  const apiSecret = config.get('CLOUDINARY_API_SECRET', '');
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary is not configured');

  const timestamp = String(Math.floor(Date.now() / 1000));
  const publicId = publicIdFromSourceUrl(imageUrl);
  const signedParams = { folder, public_id: publicId, timestamp };
  const body = new FormData();
  body.set('file', imageUrl);
  body.set('api_key', apiKey);
  body.set('folder', folder);
  body.set('public_id', publicId);
  body.set('timestamp', timestamp);
  body.set('signature', signCloudinaryParams(signedParams, apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body,
  });
  const raw = await response.text();
  let parsed: { secure_url?: string; error?: { message?: string } } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* not JSON */
  }
  if (!response.ok || !parsed.secure_url) {
    throw new Error(`Cloudinary upload failed: ${parsed.error?.message ?? raw}`);
  }
  return parsed.secure_url;
}

async function repairFromReport(
  prisma: PrismaClient,
  reportPath: string,
  upload: UploadFn,
  cache: Map<string, string>,
) {
  const previous = JSON.parse(await readFile(reportPath, 'utf8')) as { items: ReportItem[] };
  const items = previous.items.filter((item) => item.status === 'migrated' && item.newUrl);
  const cafes = new Map<string, { images: Map<string, string>; fields: Record<string, string> }>();
  const posts = new Map<string, Record<string, string>>();

  for (const item of items) {
    try {
      const folder =
        item.field === 'Cafe.menuImage'
          ? `cafes/${item.recordId}/menu`
          : item.recordType === 'Cafe'
            ? `cafes/${item.recordId}`
            : `blogs/${item.recordId}`;
      const newUrl = dryRun
        ? null
        : (cache.get(item.oldUrl) ?? (await upload(item.oldUrl, folder)));
      if (newUrl) cache.set(item.oldUrl, newUrl);
      report.push({
        ...item,
        oldUrl: item.newUrl!,
        newUrl,
        status: dryRun ? 'dry-run' : 'migrated',
      });

      if (!newUrl) continue;

      if (item.recordType === 'Cafe') {
        const entry = cafes.get(item.recordId) ?? {
          images: new Map<string, string>(),
          fields: {} as Record<string, string>,
        };
        if (item.field === 'Cafe.images') entry.images.set(item.newUrl!, newUrl);
        if (item.field === 'Cafe.coverImage') entry.fields.coverImage = newUrl;
        if (item.field === 'Cafe.menuImage') entry.fields.menuImage = newUrl;
        cafes.set(item.recordId, entry);
      } else {
        posts.set(item.recordId, { heroImage: newUrl });
      }
    } catch (error) {
      report.push({ ...item, status: 'error', error: (error as Error).message });
    }
  }

  if (dryRun) return;

  for (const [id, entry] of cafes) {
    const cafe = await prisma.cafe.findUnique({
      where: { id },
      select: { images: true },
    });
    if (!cafe) continue;
    await prisma.cafe.update({
      where: { id },
      data: {
        images: cafe.images.map((url) => entry.images.get(url) ?? url),
        ...entry.fields,
      },
    });
  }

  for (const [id, data] of posts) {
    await prisma.blogPost.update({ where: { id }, data });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
