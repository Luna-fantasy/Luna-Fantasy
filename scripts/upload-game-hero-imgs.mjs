// One-shot: upload the Luna Fantasy + Faction War hero images to all the
// R2 keys the site + bot read from.
//
//   ~/Desktop/LunaFantasyHero.png →
//     backgrounds/LunaFantasyHero.png        (website /luna-fantasy hero)
//     jester/backgrounds/Map_Video/LunaFantasy.jpg  (Luna Map → Luna Fantasy)
//
//   ~/Desktop/FactionwarHero.png →
//     backgrounds/FactionWarHero.png         (website /faction-war hero)
//     jester/backgrounds/Map_Video/FactionWar.png   (Luna Map → Faction War)

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

const DESKTOP = 'C:/Users/Admin/Desktop';

const UPLOADS = [
    {
        src: 'LunaFantasyHero.png',
        targets: [
            { key: 'backgrounds/LunaFantasyHero.png',           contentType: 'image/png' },
            { key: 'jester/backgrounds/Map_Video/LunaFantasy.jpg', contentType: 'image/jpeg' },
        ],
    },
    {
        src: 'FactionwarHero.png',
        targets: [
            { key: 'backgrounds/FactionWarHero.png',            contentType: 'image/png' },
            { key: 'jester/backgrounds/Map_Video/FactionWar.png', contentType: 'image/png' },
        ],
    },
];

let count = 0, failed = 0;
for (const { src, targets } of UPLOADS) {
    let buf;
    try {
        buf = readFileSync(`${DESKTOP}/${src}`);
    } catch (err) {
        console.error(`✗ ${src} — read failed:`, err.message);
        failed++;
        continue;
    }
    for (const { key, contentType } of targets) {
        try {
            await s3.send(new PutObjectCommand({
                Bucket: BUCKET,
                Key: key,
                Body: buf,
                ContentType: contentType,
                CacheControl: 'public, max-age=31536000, immutable',
            }));
            console.log(`✓ ${src.padEnd(20)} → ${PUBLIC}/${key}`);
            count++;
        } catch (err) {
            console.error(`✗ ${key} — ${err.message}`);
            failed++;
        }
    }
}
console.log(`\nuploaded=${count} failed=${failed}`);
