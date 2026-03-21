/**
 * Migration script: Download images from VPS image servers and upload to Cloudflare R2.
 *
 * Usage:
 *   npx tsx tools/migrate-images-to-r2.ts            # full migration
 *   npx tsx tools/migrate-images-to-r2.ts --dry-run   # preview only, no uploads
 *
 * Loads R2 credentials from .env.local in the project root.
 * Falls back to local bot image directories when VPS is unreachable.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = 5;

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const BUTLER_IMAGES = resolve(PROJECT_ROOT, '..', 'LunaButlerMain', 'images');
const JESTER_IMAGES = resolve(PROJECT_ROOT, '..', 'LunaJesterMain', 'images');

const BUTLER_PORT = 3002;
const JESTER_PORT = 3003;
const VPS_HOST = '2.56.165.113';

// ---------------------------------------------------------------------------
// Load .env.local (no dotenv dependency)
// ---------------------------------------------------------------------------

function loadEnvLocal(): void {
  const envPath = join(PROJECT_ROOT, '.env.local');
  if (!existsSync(envPath)) {
    console.error(`Missing .env.local at ${envPath}`);
    process.exit(1);
  }
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    // strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

// ---------------------------------------------------------------------------
// R2 client (mirrors src/lib/admin/r2.ts)
// ---------------------------------------------------------------------------

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? 'assets';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? 'https://assets.lunarian.app';

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Missing R2 credentials in .env.local. Need: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ---------------------------------------------------------------------------
// Mime type helper
// ---------------------------------------------------------------------------

function contentType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mov': 'video/quicktime',
    '.mp4': 'video/mp4',
  };
  return map[ext] ?? 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// Image manifest
// ---------------------------------------------------------------------------

interface ImageEntry {
  /** R2 key (path in the bucket) */
  r2Key: string;
  /** VPS URL to download from */
  vpsUrl: string;
  /** Local fallback path (in bot images directory) */
  localPath: string;
}

const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'] as const;
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

function butlerEntry(subdir: string, filename: string): ImageEntry {
  return {
    r2Key: `butler/${subdir}/${filename}`,
    vpsUrl: `http://${VPS_HOST}:${BUTLER_PORT}/images/${subdir}/${filename}`,
    localPath: join(BUTLER_IMAGES, subdir, filename),
  };
}

function jesterEntry(subdir: string, filename: string): ImageEntry {
  return {
    r2Key: `jester/${subdir}/${filename}`,
    vpsUrl: `http://${VPS_HOST}:${JESTER_PORT}/images/${subdir}/${filename}`,
    localPath: join(JESTER_IMAGES, subdir, filename),
  };
}

function buildManifest(): ImageEntry[] {
  const entries: ImageEntry[] = [];

  // --- Butler: leaderboard ---
  for (const f of [
    'Leaderboard-for-Level.png',
    'Leaderboard-for-Level-GRID.png',
    'Leaderboard-for-Money.png',
    'Leaderboard-for-Money-GRID.png',
  ]) {
    entries.push(butlerEntry('leaderboard', f));
  }

  // --- Butler: applications ---
  for (const f of ['Application.png', 'Application-Wizard.png']) {
    entries.push(butlerEntry('applications', f));
  }

  // --- Butler: tickets ---
  for (const f of ['Support-Ticket.png', 'Reports-Ticket.png']) {
    entries.push(butlerEntry('tickets', f));
  }

  // --- Butler: misc ---
  for (const f of [
    'line.png',
    'Avelle-Adar.png',
    'banner.png',
    'Luna-21.jpg',
    '1st.png',
    'Lunari-Coin.png',
    'steal-image.png',
    'Mells_Selvair.png',
    'BalootBG.png',
    'Card_Symbol.png',
    'Message_Symbol.png',
    'Stone_Symbol.png',
    'Voice_Symbol.png',
    'level-icon.png',
    'Loan.png',
    'Loan-GRID.png',
    '1MillionAchievement.png',
    '1YearAchievement.png',
    '500GamesAchievement.png',
    'AchievementUNLOCKED.png',
    'AllCardsAchievement.png',
    'AllStonesAchievement.png',
    'FirstRoleAchievement.png',
    'HonorAchievement.png',
    'LaLunaAchievement.png',
    'TextAchievement.png',
    'VoiceAchievement.png',
  ]) {
    entries.push(butlerEntry('misc', f));
  }

  // --- Butler: profiles ---
  for (const f of [
    'Alchemist_Desk.jpeg',
    'Atlantic_Passage.png',
    'Bank_Vault.png',
    'Bloodforged_Decay.jpeg',
    'Calm_Bath.png',
    'Crystall_Palace.png',
    'Dark_Gate.png',
    'Dark_Wizard.jpeg',
    'Ethereal_Home.png',
    'Floating_Monolith.png',
    'Fountain_Of_Beauty.png',
    'Golden_Garden.png',
    'Library.png',
    'Lovers_hideaway.png',
    'Mastermind.png',
    'Molten_Road.png',
    'Mushroom_Paradise.png',
    'Neon_Bazaar_Alley.png',
    'Observatory.png',
    'Opulent_Palace.png',
    'Rocky_terrain.png',
    'Romantic_Canal.png',
    'Rose_Garden.png',
    'Royal_Hall.png',
    'Royal_Palace.png',
    'Runic_Ruins.jpeg',
    'Silverbeach_gate.jpeg',
    'Spaceway.png',
    'TheVoid.png',
    'Tranquil_Hideaway.jpeg',
  ]) {
    entries.push(butlerEntry('profiles', f));
  }

  // --- Butler: BalootCards (52 standard playing cards) ---
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      entries.push(butlerEntry('BalootCards', `${rank}-${suit}.png`));
    }
  }

  // --- Jester: icons ---
  for (const f of [
    'Avelle-Adar.png',
    'Bank.png',
    'leaderboard_icon.webp',
    'luna_butler.png',
    'luna_guardian.png',
    'luna_healer.png',
    'luna_herald.png',
    'luna_jester.png',
    'luna_knight.png',
    'luna_mastermind.png',
    'luna_noble.png',
    'luna_sage.png',
    'luna_seer.png',
    'luna_sentinel.png',
    'luna_siren.png',
    'luna_thief.png',
    'luna_vulmir.png',
    'luna_wisp.png',
    'luna_wizard.png',
    'lunarian.png',
    'meluna.png',
    'rules_image.png',
    'seluna.png',
    'server_info.jpg',
  ]) {
    entries.push(jesterEntry('icons', f));
  }

  // --- Jester: shops ---
  for (const f of [
    'brimor.png',
    'broker.png',
    'kael_vandar.png',
    'luckbox_shop.png',
    'luckbox_shop_alt.png',
    'zoldar_mooncarver.png',
  ]) {
    entries.push(jesterEntry('shops', f));
  }

  // --- Jester: games ---
  for (const f of [
    'Broker.png',
    'Guardian.png',
    'Imp.png',
    'Knight.png',
    'Mercenary.png',
    'auction_hall.png',
    'blood_moon_board.png',
    'blood_moon_start.png',
    'chapter1_betrayal.png',
    'chapter2_regret.png',
    'chapter3_portal.png',
    'chapter4_throne.png',
    'luna_bomber_start.png',
    'luna_currency_games.png',
    'luna_healer_mafia.png',
    'luna_vampire.png',
    'lunarian_male.png',
    'roulette_circle.png',
    'roulette_image.png',
    'rps_image.png',
    'rps_paper.png',
    'rps_rock.png',
    'rps_scissors.png',
    'rps_versus_bg.png',
    'winner_card.png',
  ]) {
    entries.push(jesterEntry('games', f));
  }

  // --- Jester: backgrounds ---
  for (const f of [
    'GrandFantasyBG.png',
    'LunaFantasyBG.png',
    'LunaFantasyVerdict.png',
    'book_background.png',
    'fantasy_leaderboard.png',
    'founders_thank_you.jpg',
    'luna_map_main.png',
    'map_video.gif',
    'pairs_book.png',
  ]) {
    entries.push(jesterEntry('backgrounds', f));
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Download helpers
// ---------------------------------------------------------------------------

async function downloadFromVps(url: string, timeoutMs = 10_000): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}

function loadFromLocal(localPath: string): Buffer | null {
  try {
    if (!existsSync(localPath)) return null;
    return readFileSync(localPath);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Upload helper
// ---------------------------------------------------------------------------

async function uploadToR2(key: string, buffer: Buffer, ct: string): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: ct,
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

async function existsInR2(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Batch processor
// ---------------------------------------------------------------------------

interface MigrationResult {
  key: string;
  status: 'uploaded' | 'skipped-exists' | 'skipped-dry-run' | 'failed';
  url?: string;
  source?: 'vps' | 'local';
  error?: string;
  sizeKB?: number;
}

async function migrateOne(entry: ImageEntry): Promise<MigrationResult> {
  const { r2Key, vpsUrl, localPath } = entry;
  const filename = r2Key.split('/').pop()!;

  // Try VPS first, then local fallback
  let buffer = await downloadFromVps(vpsUrl);
  let source: 'vps' | 'local' = 'vps';

  if (!buffer) {
    buffer = loadFromLocal(localPath);
    source = 'local';
  }

  if (!buffer) {
    return { key: r2Key, status: 'failed', error: 'Not found on VPS or locally' };
  }

  const sizeKB = Math.round(buffer.length / 1024);

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would upload: ${r2Key} (${sizeKB} KB from ${source})`);
    return { key: r2Key, status: 'skipped-dry-run', source, sizeKB };
  }

  try {
    const url = await uploadToR2(r2Key, buffer, contentType(filename));
    return { key: r2Key, status: 'uploaded', url, source, sizeKB };
  } catch (err: any) {
    return { key: r2Key, status: 'failed', error: err.message ?? String(err) };
  }
}

async function runBatch<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Luna Image Migration to R2 ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no uploads)' : 'LIVE'}`);
  console.log(`Bucket: ${R2_BUCKET_NAME}`);
  console.log(`Public URL: ${R2_PUBLIC_URL}`);
  console.log();

  const manifest = buildManifest();
  console.log(`Total images in manifest: ${manifest.length}`);
  console.log();

  const results: MigrationResult[] = [];

  await runBatch(manifest, CONCURRENCY, async (entry) => {
    const result = await migrateOne(entry);
    results.push(result);

    const icon =
      result.status === 'uploaded' ? '  OK' :
      result.status === 'skipped-dry-run' ? '  --' :
      result.status === 'skipped-exists' ? '  ==' :
      '  !!';

    if (result.status === 'uploaded') {
      console.log(`${icon} ${result.key} (${result.sizeKB} KB, ${result.source})`);
    } else if (result.status === 'failed') {
      console.log(`${icon} ${result.key} FAILED: ${result.error}`);
    }
  });

  // Summary
  console.log();
  console.log('=== Migration Summary ===');

  const uploaded = results.filter(r => r.status === 'uploaded');
  const failed = results.filter(r => r.status === 'failed');
  const dryRun = results.filter(r => r.status === 'skipped-dry-run');
  const skipped = results.filter(r => r.status === 'skipped-exists');

  console.log(`Uploaded:    ${uploaded.length}`);
  if (dryRun.length > 0) console.log(`Dry run:     ${dryRun.length}`);
  if (skipped.length > 0) console.log(`Already in R2: ${skipped.length}`);
  console.log(`Failed:      ${failed.length}`);
  console.log(`Total:       ${results.length}`);

  if (uploaded.length > 0) {
    const totalKB = uploaded.reduce((sum, r) => sum + (r.sizeKB ?? 0), 0);
    const fromVps = uploaded.filter(r => r.source === 'vps').length;
    const fromLocal = uploaded.filter(r => r.source === 'local').length;
    console.log(`Total size:  ${(totalKB / 1024).toFixed(1)} MB`);
    console.log(`From VPS:    ${fromVps}`);
    console.log(`From local:  ${fromLocal}`);
  }

  if (failed.length > 0) {
    console.log();
    console.log('=== Failed Uploads ===');
    for (const f of failed) {
      console.log(`  ${f.key}: ${f.error}`);
    }
  }

  console.log();
  if (DRY_RUN) {
    console.log('Dry run complete. Run without --dry-run to perform actual migration.');
  } else if (failed.length === 0) {
    console.log('Migration complete. All images uploaded successfully.');
  } else {
    console.log(`Migration complete with ${failed.length} failure(s). Review errors above.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
