import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? 'assets';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? 'https://assets.lunarian.app';

function getClient(): S3Client {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env.local');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

export interface R2Object {
  key: string;
  size: number;
  lastModified: Date;
  url: string;
}

export async function listObjects(prefix?: string, maxKeys = 100): Promise<{ objects: R2Object[]; truncated: boolean }> {
  const client = getClient();
  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
    Prefix: prefix ?? undefined,
    MaxKeys: maxKeys,
  });
  const response = await client.send(command);

  const objects: R2Object[] = (response.Contents ?? []).map((obj) => ({
    key: obj.Key ?? '',
    size: obj.Size ?? 0,
    lastModified: obj.LastModified ?? new Date(),
    url: `${R2_PUBLIC_URL}/${obj.Key}`,
  }));

  return { objects, truncated: response.IsTruncated ?? false };
}

export interface BrowseResult {
  folders: string[];
  objects: R2Object[];
  truncated: boolean;
}

export async function listPrefixes(prefix?: string, maxKeys = 200): Promise<BrowseResult> {
  const client = getClient();
  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
    Prefix: prefix ?? undefined,
    Delimiter: '/',
    MaxKeys: maxKeys,
  });
  const response = await client.send(command);

  const folders = (response.CommonPrefixes ?? [])
    .map((cp) => cp.Prefix ?? '')
    .filter(Boolean);

  const objects: R2Object[] = (response.Contents ?? []).map((obj) => ({
    key: obj.Key ?? '',
    size: obj.Size ?? 0,
    lastModified: obj.LastModified ?? new Date(),
    url: `${R2_PUBLIC_URL}/${obj.Key}`,
  }));

  return { folders, objects, truncated: response.IsTruncated ?? false };
}

export async function uploadObject(key: string, buffer: Buffer, contentType: string): Promise<string> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await client.send(command);
  return `${R2_PUBLIC_URL}/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  const client = getClient();
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  await client.send(command);
}
