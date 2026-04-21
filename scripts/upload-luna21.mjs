// One-off script: upload Luna-21.png to R2
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import { readFileSync as readEnv } from 'fs';
const envLines = readEnv('.env.local', 'utf8').split(/\r?\n/);
for (const line of envLines) {
  const eq = line.indexOf('=');
  if (eq > 0 && !line.startsWith('#')) {
    process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const file = readFileSync('../LunaButlerMain/images/misc/Luna-21.png');
console.log(`Uploading Luna-21.png (${(file.length / 1024).toFixed(0)} KB)...`);

await client.send(new PutObjectCommand({
  Bucket: process.env.R2_BUCKET_NAME,
  Key: 'butler/misc/Luna-21.png',
  Body: file,
  ContentType: 'image/png',
  CacheControl: 'public, max-age=31536000',
}));

console.log('Done: https://assets.lunarian.app/butler/misc/Luna-21.png');
