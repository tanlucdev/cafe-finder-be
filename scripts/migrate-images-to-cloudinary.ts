import 'dotenv/config';
import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { basename, dirname, extname, join } from 'path';
import { PrismaClient, type Prisma } from '@prisma/client';
import sharp = require('sharp');
import { signCloudinaryParams } from '../src/storage/storage.service';

type FieldName = 'coverImage' | 'images' | 'menuImage' | 'menuImages' | 'heroImage';
type RecordKind = 'cafe' | 'submission' | 'blogPost';
type ImageRef = {
  kind: RecordKind;
  id: string;
  field: FieldName;
  index: number | null;
  oldUrl: string;
};
type ManifestItem = ImageRef & {
  sha256: string;
  bytes: number;
  width: number | null;
  height: number | null;
  filename: string;
  publicId: string;
  backupPath: string;
};
type DbBackup = {
  createdAt: string;
  cafes: Array<{
    id: string;
    coverImage: string | null;
    images: string[];
    menuImage: string | null;
    menuImages: string[];
  }>;
  submissions: Array<{ id: string; payload: Prisma.JsonValue }>;
  blogPosts: Array<{ id: string; heroImage: string | null }>;
};
type AssetMap = Record<string, string>;
type UploadFn = (url: string, folder: string) => Promise<string>;

const prisma = new PrismaClient();
const mode = flag('mode') ?? (process.argv.includes('--dry-run') ? 'prepare' : 'rehearse');
const outDir = flag('out') ?? join(process.cwd(), 'cloudinary-migration');
const manifestPath = flag('manifest') ?? join(outDir, 'migration_manifest.json');
const assetMapPath = flag('asset-map') ?? join(outDir, 'asset_map.json');
const backupPath = flag('backup') ?? join(outDir, 'db_backup_before_cloudinary_migration.json');
const batchSize = Number(flag('batch-size') ?? 25);
const fetchTimeoutMs = 30_000;

function flag(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function requireWriteDb() {
  if (!process.argv.includes('--write-db')) throw new Error('Refusing DB write without --write-db');
}

function requireNewCloudName() {
  if (!process.env.NEW_CLOUDINARY_CLOUD_NAME) throw new Error('Missing NEW_CLOUDINARY_CLOUD_NAME');
}

function payloadObject(value: unknown) {
  return typeof value === 'object' && value && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isNewCloudinaryUrl(value: string) {
  const cloud = process.env.NEW_CLOUDINARY_CLOUD_NAME;
  if (!cloud) return false;
  try {
    const url = new URL(value);
    return url.hostname === 'res.cloudinary.com' && url.pathname.startsWith(`/${cloud}/`);
  } catch {
    return false;
  }
}

function shouldMigrate(value: string) {
  if (!isHttpUrl(value) || isNewCloudinaryUrl(value)) return false;
  const url = new URL(value);
  return (
    url.hostname === 'res.cloudinary.com' || url.pathname.startsWith('/storage/v1/object/public/')
  );
}

function safeFilename(url: string) {
  const raw = basename(decodeURIComponent(new URL(url).pathname)) || 'image';
  const ext = extname(raw);
  const name = basename(raw, ext).replace(/[^a-zA-Z0-9_.-]+/g, '-');
  return `${name || 'image'}${ext || '.jpg'}`;
}

function publicIdFor(ref: ImageRef, sha256: string, filename: string) {
  const folder =
    ref.kind === 'cafe'
      ? `cafes/${ref.id}`
      : ref.kind === 'submission'
        ? `submissions/${ref.id}`
        : `blog-posts/${ref.id}`;
  return `${folder}/${sha256.slice(0, 12)}-${basename(filename, extname(filename))}`;
}

function addRef(refs: ImageRef[], kind: RecordKind, id: string, field: FieldName, value: unknown) {
  if (typeof value === 'string' && value && shouldMigrate(value)) {
    refs.push({ kind, id, field, index: null, oldUrl: value });
  }
}

function addArrayRefs(
  refs: ImageRef[],
  kind: RecordKind,
  id: string,
  field: FieldName,
  value: unknown,
) {
  stringArray(value).forEach((url, index) => {
    if (shouldMigrate(url)) refs.push({ kind, id, field, index, oldUrl: url });
  });
}

export function collectRefs(backup: DbBackup) {
  const refs: ImageRef[] = [];
  for (const cafe of backup.cafes) {
    addRef(refs, 'cafe', cafe.id, 'coverImage', cafe.coverImage);
    addArrayRefs(refs, 'cafe', cafe.id, 'images', cafe.images);
    addRef(refs, 'cafe', cafe.id, 'menuImage', cafe.menuImage);
    addArrayRefs(refs, 'cafe', cafe.id, 'menuImages', cafe.menuImages);
  }
  for (const submission of backup.submissions) {
    const payload = payloadObject(submission.payload);
    addRef(refs, 'submission', submission.id, 'coverImage', payload.coverImage);
    addArrayRefs(refs, 'submission', submission.id, 'images', payload.images);
    addRef(refs, 'submission', submission.id, 'menuImage', payload.menuImage);
    addArrayRefs(refs, 'submission', submission.id, 'menuImages', payload.menuImages);
  }
  for (const blogPost of backup.blogPosts) {
    addRef(refs, 'blogPost', blogPost.id, 'heroImage', blogPost.heroImage);
  }
  return refs;
}

function uniqueRefs(refs: ImageRef[]) {
  return Array.from(new Map(refs.map((ref) => [ref.oldUrl, ref])).values());
}

async function loadBackup(): Promise<DbBackup> {
  const [cafes, submissions, blogPosts] = await Promise.all([
    prisma.cafe.findMany({
      select: { id: true, coverImage: true, images: true, menuImage: true, menuImages: true },
      orderBy: { id: 'asc' },
    }),
    prisma.cafeSubmission.findMany({ select: { id: true, payload: true }, orderBy: { id: 'asc' } }),
    prisma.blogPost.findMany({ select: { id: true, heroImage: true }, orderBy: { id: 'asc' } }),
  ]);
  return { createdAt: new Date().toISOString(), cafes, submissions, blogPosts };
}

async function download(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(fetchTimeoutMs) });
  if (!response.ok) throw new Error(`Download failed ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function prepare() {
  requireNewCloudName();
  await mkdir(join(outDir, 'originals'), { recursive: true });
  const backup = await loadBackup();
  await writeJson(backupPath, backup);

  const manifest: ManifestItem[] = [];
  for (const ref of uniqueRefs(collectRefs(backup))) {
    const buffer = await download(ref.oldUrl);
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const meta = await sharp(buffer).metadata();
    const filename = safeFilename(ref.oldUrl);
    const backupAssetPath = join(outDir, 'originals', `${sha256.slice(0, 12)}-${filename}`);
    await writeFile(backupAssetPath, buffer);
    manifest.push({
      ...ref,
      sha256,
      bytes: buffer.byteLength,
      width: meta.width ?? null,
      height: meta.height ?? null,
      filename,
      publicId: publicIdFor(ref, sha256, filename),
      backupPath: backupAssetPath,
    });
  }
  await writeJson(manifestPath, manifest);
  console.log(JSON.stringify({ backupPath, manifestPath, assets: manifest.length }, null, 2));
}

async function uploadAll() {
  requireNewCloudName();
  const manifest = await readJson<ManifestItem[]>(manifestPath);
  const assetMap = await readOptionalJson<AssetMap>(assetMapPath, {});
  for (const item of manifest) {
    if (assetMap[item.oldUrl]) continue;
    assetMap[item.oldUrl] = await uploadToNewCloudinary(item);
    await writeJson(assetMapPath, assetMap);
  }
  await writeJson(join(outDir, 'rollback_map.json'), invert(assetMap));
  console.log(JSON.stringify({ assetMapPath, uploaded: Object.keys(assetMap).length }, null, 2));
}

async function uploadToNewCloudinary(item: ManifestItem) {
  const cloud = process.env.NEW_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.NEW_CLOUDINARY_API_KEY;
  const apiSecret = process.env.NEW_CLOUDINARY_API_SECRET;
  if (!cloud || !apiKey || !apiSecret) throw new Error('Missing NEW_CLOUDINARY_* env');

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signedParams = { public_id: item.publicId, timestamp };
  const body = new FormData();
  body.set('file', new Blob([new Uint8Array(await readFile(item.backupPath))]));
  body.set('api_key', apiKey);
  body.set('public_id', item.publicId);
  body.set('timestamp', timestamp);
  body.set('signature', signCloudinaryParams(signedParams, apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(fetchTimeoutMs),
  });
  const raw = await response.text();
  const parsed = JSON.parse(raw || '{}') as { secure_url?: string; error?: { message?: string } };
  if (!response.ok || !parsed.secure_url) {
    throw new Error(`Cloudinary upload failed: ${parsed.error?.message ?? raw}`);
  }
  return parsed.secure_url;
}

function replaceExact(value: unknown, map: AssetMap) {
  return typeof value === 'string' ? (map[value] ?? value) : value;
}

function replaceArray(value: unknown, map: AssetMap) {
  return stringArray(value).map((url) => map[url] ?? url);
}

function replaceSubmissionPayload(payloadValue: Prisma.JsonValue, map: AssetMap) {
  if (typeof payloadValue !== 'object' || !payloadValue || Array.isArray(payloadValue))
    return payloadValue;

  const payload = { ...(payloadValue as Record<string, unknown>) };
  for (const field of ['coverImage', 'menuImage'] as const) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      payload[field] = replaceExact(payload[field], map);
    }
  }
  for (const field of ['images', 'menuImages'] as const) {
    if (Array.isArray(payload[field])) payload[field] = replaceArray(payload[field], map);
  }
  return payload as Prisma.JsonValue;
}

export function mappedBackup(backup: DbBackup, map: AssetMap): DbBackup {
  return {
    ...backup,
    cafes: backup.cafes.map((cafe) => ({
      ...cafe,
      coverImage: replaceExact(cafe.coverImage, map) as string | null,
      images: replaceArray(cafe.images, map),
      menuImage: replaceExact(cafe.menuImage, map) as string | null,
      menuImages: replaceArray(cafe.menuImages, map),
    })),
    submissions: backup.submissions.map((submission) => {
      return { ...submission, payload: replaceSubmissionPayload(submission.payload, map) };
    }),
    blogPosts: backup.blogPosts.map((blogPost) => ({
      ...blogPost,
      heroImage: replaceExact(blogPost.heroImage, map) as string | null,
    })),
  };
}

function validateMapping(backup: DbBackup, map: AssetMap) {
  const refs = collectRefs(backup);
  const unmapped = refs.filter((ref) => !map[ref.oldUrl]);
  if (unmapped.length) throw new Error(`unmapped=${unmapped.length}`);

  const next = mappedBackup(backup, map);
  validateShape(backup, next);
  const oldRemaining = collectRefs(next).filter((ref) => shouldMigrate(ref.oldUrl));
  if (oldRemaining.length) throw new Error(`old URLs remain=${oldRemaining.length}`);
  return next;
}

function validateShape(backup: DbBackup, next: DbBackup) {
  if (next.cafes.length !== backup.cafes.length) throw new Error('cafe count changed');
  if (next.blogPosts.length !== backup.blogPosts.length) throw new Error('blog post count changed');
  for (let i = 0; i < backup.cafes.length; i += 1) {
    if (backup.cafes[i].images.length !== next.cafes[i].images.length)
      throw new Error('images length changed');
    if (backup.cafes[i].menuImages.length !== next.cafes[i].menuImages.length)
      throw new Error('menuImages length changed');
  }
}

async function rehearse() {
  requireNewCloudName();
  const backup = await readJson<DbBackup>(backupPath);
  const map = await readJson<AssetMap>(assetMapPath);
  const next = validateMapping(backup, map);
  await Promise.all(Object.values(map).map(assertHttp200));
  const output = join(outDir, 'rehearsal_result.json');
  await writeJson(output, {
    ok: true,
    cafeCount: next.cafes.length,
    mapped: Object.keys(map).length,
  });
  console.log(JSON.stringify({ output, ok: true }, null, 2));
}

async function applyDb(mapPath = assetMapPath, rollback = false) {
  requireNewCloudName();
  requireWriteDb();
  const backup = await loadBackup();
  const map = await readJson<AssetMap>(mapPath);
  const next = rollback ? mappedBackup(backup, map) : validateMapping(backup, map);
  if (rollback) validateShape(backup, next);
  for (let i = 0; i < next.cafes.length; i += batchSize) {
    for (const cafe of next.cafes.slice(i, i + batchSize)) {
      await prisma.cafe.update({
        where: { id: cafe.id },
        data: {
          coverImage: cafe.coverImage,
          images: cafe.images,
          menuImage: cafe.menuImage,
          menuImages: cafe.menuImages,
        },
      });
    }
  }
  for (const submission of next.submissions) {
    await prisma.cafeSubmission.update({
      where: { id: submission.id },
      data: { payload: submission.payload as Prisma.InputJsonValue },
    });
  }
  for (const blogPost of next.blogPosts) {
    await prisma.blogPost.update({
      where: { id: blogPost.id },
      data: { heroImage: blogPost.heroImage },
    });
  }
  await writeJson(join(outDir, 'rollback_map.json'), invert(map));
  console.log(JSON.stringify({ applied: true, mapped: Object.keys(map).length }, null, 2));
}

async function assertHttp200(url: string) {
  let response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(fetchTimeoutMs) });
  if (response.status === 405)
    response = await fetch(url, { signal: AbortSignal.timeout(fetchTimeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
}

function invert(map: AssetMap) {
  return Object.fromEntries(Object.entries(map).map(([oldUrl, newUrl]) => [newUrl, oldUrl]));
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function readOptionalJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return await readJson<T>(path);
  } catch {
    return fallback;
  }
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function mapImageUrls(
  urls: string[],
  _field: string,
  _recordType: string,
  _recordId: string,
  folder: string,
  options: { dryRun: boolean; upload: UploadFn; cache?: Map<string, string> },
) {
  const cache = options.cache ?? new Map<string, string>();
  let changed = false;
  const mapped = [];
  for (const url of urls) {
    if (!shouldMigrate(url)) {
      mapped.push(url);
      continue;
    }
    if (options.dryRun) {
      mapped.push(url);
      continue;
    }
    const newUrl = cache.get(url) ?? (await options.upload(url, folder));
    cache.set(url, newUrl);
    mapped.push(newUrl);
    changed ||= newUrl !== url;
  }
  return { urls: mapped, changed };
}

async function main() {
  try {
    if (mode === 'prepare') await prepare();
    else if (mode === 'upload') await uploadAll();
    else if (mode === 'rehearse') await rehearse();
    else if (mode === 'apply') await applyDb();
    else if (mode === 'rollback')
      await applyDb(flag('rollback-map') ?? join(outDir, 'rollback_map.json'), true);
    else throw new Error(`Unknown --mode=${mode}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
