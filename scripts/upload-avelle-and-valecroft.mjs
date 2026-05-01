// One-shot: side-load Avelle Adar's new banker portrait to every R2 path
// the bot + dashboard read from. The dashboard's drag-and-drop refused the
// upload silently (likely the route's body-parser limit) so we publish
// straight to R2 with the keys the consumers already expect.
//
//   ~/Desktop/NewAvelleShop.png →
//     butler/Avelle-Adar.png         (dashboard persona)
//     butler/vendors/AvelleAdar.png  (banking vendor portrait — convention
//                                     matches RealEstateCassian.png path)
//     characters/avelle-adar.png     (Luna Map merchant card)

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

const SRC = 'C:/Users/Admin/Desktop/NewAvelleShop.png';
const buf = readFileSync(SRC);
console.log(`Uploading ${SRC} (${(buf.length / 1024 / 1024).toFixed(1)} MB) to 3 R2 keys`);

const KEYS = [
    'butler/Avelle-Adar.png',
    'butler/vendors/AvelleAdar.png',
    'characters/avelle-adar.png',
];

for (const key of KEYS) {
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buf,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000, immutable',
    }));
    console.log(`✓ ${PUBLIC}/${key}`);
}

console.log(`\ncache-bust suffix to use in configs: ?v=${Date.now()}`);
