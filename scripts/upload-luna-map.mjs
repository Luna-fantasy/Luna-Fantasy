// One-shot: upload the Luna Map artwork to R2.
// Direct R2 upload bypasses the dashboard body-parser limit (the
// dashboard silently rejects multipart bodies above its threshold,
// which is why /admin upload "did nothing" for this 37 MB asset).
//
//   ~/Downloads/image00715.png → backgrounds/Map_Video/map.png

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const env = readFileSync(resolve('.env.local'), 'utf8');
for (const raw of env.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const k = line.substring(0, eq);
    const v = line.substring(eq + 1).replace(/^["']|["']$/g, '').trim();
    if (/^[A-Z_][A-Z0-9_]*$/.test(k)) process.env[k] = v;
}
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;
const BUCKET = R2_BUCKET_NAME ?? 'assets';
const PUBLIC = R2_PUBLIC_URL ?? 'https://assets.lunarian.app';

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const SRC = 'C:/Users/Admin/Downloads/image00715.png';
const KEY = 'backgrounds/Map_Video/map.png';

const buf = readFileSync(SRC);
console.log(`Uploading ${SRC} (${(buf.length / 1024 / 1024).toFixed(1)} MB) → ${KEY}`);

await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: KEY,
    Body: buf,
    ContentType: 'image/png',
    CacheControl: 'public, max-age=31536000, immutable',
}));

console.log(`✓ uploaded → ${PUBLIC}/${KEY}`);
console.log(`  cache-bust URL: ${PUBLIC}/${KEY}?v=${Date.now()}`);
