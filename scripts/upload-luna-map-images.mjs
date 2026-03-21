// Upload all Luna Map images to R2
// Usage: cd Luna-Fantasy-Main && node scripts/upload-luna-map-images.mjs

import { readFileSync } from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { resolve } from 'path';

// Load .env.local
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
  console.error('Missing R2 credentials'); process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const BUCKET = process.env.R2_BUCKET_NAME ?? 'assets';
const PUBLIC_URL = process.env.R2_PUBLIC_URL ?? 'https://assets.lunarian.app';
const JESTER = resolve('../LunaJesterMain');

const UPLOADS = [
  // Chapter story images
  { key: 'jester/games/chapter1_betrayal.png', file: `${JESTER}/images/games/chapter1_betrayal.png` },
  { key: 'jester/games/chapter2_regret.png', file: `${JESTER}/images/games/chapter2_regret.png` },
  { key: 'jester/games/chapter3_portal.png', file: `${JESTER}/images/games/chapter3_portal.png` },
  { key: 'jester/games/chapter4_throne.png', file: `${JESTER}/images/games/chapter4_throne.png` },
  // Character icons
  { key: 'jester/icons/luna_mastermind.png', file: `${JESTER}/images/icons/luna_mastermind.png` },
  { key: 'jester/icons/luna_sentinel.png', file: `${JESTER}/images/icons/luna_sentinel.png` },
  { key: 'jester/icons/luna_guardian.png', file: `${JESTER}/images/icons/luna_guardian.png` },
  { key: 'jester/icons/luna_knight.png', file: `${JESTER}/images/icons/luna_knight.png` },
  { key: 'jester/icons/luna_noble.png', file: `${JESTER}/images/icons/luna_noble.png` },
  { key: 'jester/icons/lunarian.png', file: `${JESTER}/images/icons/lunarian.png` },
  { key: 'jester/icons/luna_healer.png', file: `${JESTER}/images/icons/luna_healer.png` },
  { key: 'jester/icons/luna_thief.png', file: `${JESTER}/images/icons/luna_thief.png` },
  { key: 'jester/icons/luna_seer.png', file: `${JESTER}/images/icons/luna_seer.png` },
  { key: 'jester/icons/luna_siren.png', file: `${JESTER}/images/icons/luna_siren.png` },
  { key: 'jester/icons/luna_wizard.png', file: `${JESTER}/images/icons/luna_wizard.png` },
  { key: 'jester/icons/luna_butler.png', file: `${JESTER}/images/icons/luna_butler.png` },
  { key: 'jester/icons/luna_herald.png', file: `${JESTER}/images/icons/luna_herald.png` },
  { key: 'jester/icons/luna_wisp.png', file: `${JESTER}/images/icons/luna_wisp.png` },
  { key: 'jester/icons/luna_jester.png', file: `${JESTER}/images/icons/luna_jester.png` },
  { key: 'jester/icons/luna_vulmir.png', file: `${JESTER}/images/icons/luna_vulmir.png` },
  { key: 'jester/icons/luna_sage.png', file: `${JESTER}/images/icons/luna_sage.png` },
  { key: 'jester/icons/meluna.png', file: `${JESTER}/images/icons/meluna.png` },
  { key: 'jester/icons/seluna.png', file: `${JESTER}/images/icons/seluna.png` },
  { key: 'jester/icons/Avelle-Adar.png', file: `${JESTER}/images/icons/Avelle-Adar.png` },
  // Shop images
  { key: 'jester/shops/brimor.png', file: `${JESTER}/images/shops/brimor.png` },
  { key: 'jester/shops/zoldar_mooncarver.png', file: `${JESTER}/images/shops/zoldar_mooncarver.png` },
  { key: 'jester/shops/broker.png', file: `${JESTER}/images/shops/broker.png` },
  { key: 'jester/shops/kael_vandar.png', file: `${JESTER}/images/shops/kael_vandar.png` },
  // Game backgrounds
  { key: 'jester/backgrounds/Map_Video/LunaFantasy.jpg', file: `${JESTER}/images/backgrounds/Map_Video/LunaFantasy.jpg` },
  { key: 'jester/backgrounds/Map_Video/GrandFantasy.png', file: `${JESTER}/images/backgrounds/Map_Video/GrandFantasy.png` },
  { key: 'jester/backgrounds/Map_Video/FactionWar.png', file: `${JESTER}/images/backgrounds/Map_Video/FactionWar.png` },
];

let success = 0;
for (const { key, file } of UPLOADS) {
  try {
    const buffer = readFileSync(file);
    const ct = file.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: ct }));
    console.log(`OK: ${PUBLIC_URL}/${key} (${(buffer.length / 1024).toFixed(0)} KB)`);
    success++;
  } catch (err) {
    console.error(`FAIL: ${key} —`, err.message);
  }
}
console.log(`\nDone: ${success}/${UPLOADS.length} uploaded.`);
