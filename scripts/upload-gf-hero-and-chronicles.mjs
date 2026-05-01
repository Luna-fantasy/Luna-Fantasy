// One-shot uploads:
//   ~/Desktop/GrandFantasyHero.jpg →
//     backgrounds/GrandFantasyHero.jpeg              (website /grand-fantasy hero)
//     jester/backgrounds/Map_Video/GrandFantasy.png  (Luna Map → Grand Fantasy)
//   ~/Desktop/"Chronicles img.png" → handled in-tree (replaces public/story/champion.png)

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

const SRC = 'C:/Users/Admin/Desktop/GrandFantasyHero.jpg';
const buf = readFileSync(SRC);
console.log(`Uploading ${SRC} (${(buf.length / 1024).toFixed(0)} KB) to 2 R2 keys`);

const TARGETS = [
    { key: 'backgrounds/GrandFantasyHero.jpeg',                contentType: 'image/jpeg' },
    { key: 'jester/backgrounds/Map_Video/GrandFantasy.png',    contentType: 'image/png'  },
];

for (const { key, contentType } of TARGETS) {
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buf,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
    }));
    console.log(`✓ ${PUBLIC}/${key}`);
}

console.log(`\ncache-bust suffix to use in configs: ?v=${Date.now()}`);
