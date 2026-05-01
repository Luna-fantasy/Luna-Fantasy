// Re-do: side-load the CORRECT merchant portraits from Desktop (not Downloads).
//   ~/Desktop/NewBrimorShop.png → characters/brimor.png
//   ~/Desktop/NewAvelleShop.png → characters/avelle-adar.png + butler/Avelle-Adar.png + butler/vendors/AvelleAdar.png
//   ~/Desktop/selunda.png       → characters/seluna.png

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

const UPLOADS = [
    { src: 'C:/Users/Admin/Desktop/NewBrimorShop.png', keys: ['characters/brimor.png'] },
    { src: 'C:/Users/Admin/Desktop/NewAvelleShop.png', keys: ['characters/avelle-adar.png', 'butler/Avelle-Adar.png', 'butler/vendors/AvelleAdar.png'] },
    { src: 'C:/Users/Admin/Desktop/selunda.png',       keys: ['characters/seluna.png'] },
];

for (const { src, keys } of UPLOADS) {
    const buf = readFileSync(src);
    console.log(`\n${src} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
    for (const key of keys) {
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: buf,
            ContentType: 'image/png',
            CacheControl: 'public, max-age=31536000, immutable',
        }));
        console.log(`  ✓ ${PUBLIC}/${key}`);
    }
}
console.log(`\ncache-bust suffix: ?v=${Date.now()}`);
