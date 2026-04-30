// One-time: upload the 5 Valecroft merchant portraits from Desktop to R2.
// Usage: cd Luna-Fantasy-Main && node scripts/upload-valecroft-merchants.mjs

import { readFileSync } from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { resolve } from 'path';

const envContent = readFileSync(resolve('.env.local'), 'utf8');
for (const raw of envContent.split('\n')) {
  const line = raw.replace(/\r$/, '');
  const eq = line.indexOf('=');
  if (eq < 1) continue;
  const key = line.substring(0, eq);
  const val = line.substring(eq + 1).replace(/^["']|["']$/g, '').trim();
  if (/^[A-Z_][A-Z0-9_]*$/.test(key)) process.env[key] = val;
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Missing R2 credentials in .env.local');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const BUCKET     = process.env.R2_BUCKET_NAME ?? 'assets';
const PUBLIC_URL = process.env.R2_PUBLIC_URL ?? 'https://assets.lunarian.app';
const DESKTOP    = 'C:/Users/Admin/Desktop';

const UPLOADS = [
  { key: 'butler/vendors/RealEstateCassian.png', file: `${DESKTOP}/RealEstateCassian.png`, ct: 'image/png' },
  { key: 'butler/vendors/ArtifactsAlice.png',    file: `${DESKTOP}/ArtifactsAlice.png`,    ct: 'image/png' },
  { key: 'butler/vendors/BlacksmithVesper.png',  file: `${DESKTOP}/BlacksmithVesper.png`,  ct: 'image/png' },
  { key: 'butler/vendors/StableDarian.jpeg',     file: `${DESKTOP}/StableDarian.jpeg`,     ct: 'image/jpeg' },
  { key: 'butler/vendors/FenceDante.png',        file: `${DESKTOP}/FenceDante.png`,        ct: 'image/png' },
];

for (const { key, file, ct } of UPLOADS) {
  try {
    const buffer = readFileSync(file);
    await client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: ct,
      // Cache-control matches the project's R2 caching architecture (auto-purge handled separately).
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    console.log(`Uploaded: ${PUBLIC_URL}/${key} (${(buffer.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error(`Failed: ${key} — ${err.message}`);
  }
}

console.log('\nDone.');
