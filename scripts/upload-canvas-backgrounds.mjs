// One-time script: upload missing canvas backgrounds + steal-failed image to R2
// Usage: cd Luna-Fantasy-Main && node scripts/upload-canvas-backgrounds.mjs

import { readFileSync } from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { resolve } from 'path';

// Load .env.local manually (no dotenv dependency needed)
const envContent = readFileSync(resolve('.env.local'), 'utf8');
for (const raw of envContent.split('\n')) {
  const line = raw.replace(/\r$/, '');
  const eq = line.indexOf('=');
  if (eq < 1) continue;
  const key = line.substring(0, eq);
  const val = line.substring(eq + 1).replace(/^["']|["']$/g, '').trim();
  if (/^[A-Z_][A-Z0-9_]*$/.test(key)) {
    process.env[key] = val;
  }
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Missing R2 credentials in .env.local');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME ?? 'assets';
const PUBLIC_URL = process.env.R2_PUBLIC_URL ?? 'https://assets.lunarian.app';

const BUTLER = resolve('../LunaButlerMain');
const JESTER = resolve('../LunaJesterMain');

const UPLOADS = [
  { key: 'canvas-backgrounds/butler/level_up_card.png', file: `${BUTLER}/images/misc/banner.png` },
  { key: 'canvas-backgrounds/butler/luna21_card.png', file: `${BUTLER}/images/misc/Luna-21.jpg` },
  { key: 'canvas-backgrounds/jester/winner_image.png', file: `${JESTER}/images/games/winner_card.png` },
  { key: 'canvas-backgrounds/jester/book_image.png', file: `${JESTER}/images/backgrounds/book_background.png` },
  { key: 'canvas-backgrounds/jester/chest_image.png', file: `${JESTER}/images/chest/background.png` },
  { key: 'canvas-backgrounds/butler/rank_card.png', file: `${BUTLER}/images/profiles/Calm_Bath.png` },
  { key: 'canvas-backgrounds/butler/profile_card.png', file: `${BUTLER}/images/profiles/Calm_Bath.png` },
  // Steal fail image (reuse success image until a dedicated one is created)
  { key: 'butler/misc/steal-failed.png', file: `${BUTLER}/images/misc/steal-image.png` },
];

for (const { key, file } of UPLOADS) {
  try {
    const buffer = readFileSync(file);
    const contentType = file.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    await client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    console.log(`Uploaded: ${PUBLIC_URL}/${key} (${(buffer.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error(`Failed: ${key} —`, err.message);
  }
}

console.log('\nDone. All canvas backgrounds uploaded.');
