// One-shot: upload the three game-canvas backgrounds from Desktop to R2.
//
//   ~/Desktop/LunaFantasyBG.png  → backgrounds/LunaFantasyBG.png
//   ~/Desktop/GrandFantasyBG.png → backgrounds/GrandFantasyBG.png
//   ~/Desktop/FactionWarBG.png   → backgrounds/FactionWarBG.png
//                                   AND LunaPairs/LunaPairs_BG.png (legacy default)
//
// Each file is 1536x1024 (3:2). The Jester game canvases are 1800x1200 and
// the bot draws the BG with drawImage(bg, 0, 0, w, h) — same aspect, so
// rendering is "as is" with no crop or zoom.

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
    { src: 'LunaFantasyBG.png',  keys: ['backgrounds/LunaFantasyBG.png'] },
    { src: 'GrandFantasyBG.png', keys: ['backgrounds/GrandFantasyBG.png'] },
    // FactionWar legacy URL is LunaPairs/LunaPairs_BG.png. Mirror under both
    // keys so any cached references keep working.
    { src: 'FactionWarBG.png',   keys: ['backgrounds/FactionWarBG.png', 'LunaPairs/LunaPairs_BG.png'] },
];

let count = 0, failed = 0;
for (const { src, keys } of UPLOADS) {
    let buf;
    try {
        buf = readFileSync(`${DESKTOP}/${src}`);
    } catch (err) {
        console.error(`✗ ${src} — read failed:`, err.message);
        failed++;
        continue;
    }
    for (const key of keys) {
        try {
            await s3.send(new PutObjectCommand({
                Bucket: BUCKET,
                Key: key,
                Body: buf,
                ContentType: 'image/png',
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
