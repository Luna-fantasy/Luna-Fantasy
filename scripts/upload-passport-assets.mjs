// One-time script: upload passport system assets to R2
// Usage: cd Luna-Fantasy-Main && node scripts/upload-passport-assets.mjs

import { readFileSync } from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { resolve } from 'path';
import { homedir } from 'os';

// Load .env.local manually
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

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN } = process.env;
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

const DESKTOP = resolve(homedir(), 'Desktop');

const UPLOADS = [
  {
    key: 'butler/backgrounds/Passport.jpeg',
    file: `${DESKTOP}/Passport.jpeg`,
    contentType: 'image/jpeg',
  },
  {
    key: 'butler/backgrounds/PassportVIP.jpeg',
    file: `${DESKTOP}/passportVIP.jpeg`,
    contentType: 'image/jpeg',
  },
  {
    key: 'butler/vendors/VaelorStorm.png',
    file: `${DESKTOP}/VaelorStorm.png`,
    contentType: 'image/png',
  },
];

const uploadedUrls = [];

for (const { key, file, contentType } of UPLOADS) {
  try {
    const buffer = readFileSync(file);
    await client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    const url = `${PUBLIC_URL}/${key}`;
    uploadedUrls.push(url);
    console.log(`Uploaded: ${url} (${(buffer.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error(`Failed: ${key} -`, err.message);
  }
}

// Purge Cloudflare CDN cache so the new files are served immediately
if (CLOUDFLARE_ZONE_ID && CLOUDFLARE_API_TOKEN && uploadedUrls.length > 0) {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files: uploadedUrls }),
    });
    if (res.ok) {
      console.log('\nCDN cache purged for uploaded URLs');
    } else {
      console.warn('\nCDN purge returned', res.status);
    }
  } catch (err) {
    console.warn('\nCDN purge failed:', err.message);
  }
}

console.log('\nDone. All passport assets uploaded.');
