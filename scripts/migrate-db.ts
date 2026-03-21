/**
 * Migration script: restructure system collection into dedicated collections.
 *
 * Migration A: system debt_* → debt collection
 * Migration B: system loans + investment entries → bank collection
 * Migration C: tickets support records → tickets_support collection
 *
 * All migrations are ADDITIVE — they copy data, never delete originals.
 * Run with: npx tsx scripts/migrate-db.ts
 */

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually (no dotenv dependency needed)
const envPath = resolve(__dirname, '../.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error('Could not read .env.local — set MONGODB_URI manually.');
}

const DB_URI = process.env.MONGODB_URI;
if (!DB_URI) {
  console.error('Error: MONGODB_URI environment variable is required.');
  console.error('Set it in .env.local or export it before running this script.');
  process.exit(1);
}

const DB_NAME = 'Database';

async function main() {
  const client = new MongoClient(DB_URI!);
  await client.connect();
  console.log('Connected to MongoDB Atlas.');

  const db = client.db(DB_NAME);

  // Migration A: debt
  await migrateDebt(db);

  // Migration B: loans + investments → bank
  await migrateBank(db);

  // Migration C: support tickets → tickets_support
  await migrateTickets(db);

  await client.close();
  console.log('\nAll migrations complete. Old data remains untouched in system/tickets.');
}

async function migrateDebt(db: any) {
  console.log('\n--- Migration A: system debt_* → debt collection ---');

  const systemCol = db.collection('system');
  const debtCol = db.collection('debt');

  const debtDocs = await systemCol.find({ _id: { $regex: /^debt_/ } }).toArray();
  console.log(`Found ${debtDocs.length} debt records in system collection.`);

  let inserted = 0;
  let skipped = 0;

  for (const doc of debtDocs) {
    const userId = String(doc._id).replace('debt_', '');
    const amount = doc.value ?? (typeof doc.data === 'string' ? parseFloat(doc.data) : doc.data) ?? 0;

    if (!amount || amount <= 0) {
      skipped++;
      continue;
    }

    // Check if already migrated
    const existing = await debtCol.findOne({ _id: userId });
    if (existing) {
      console.log(`  Skip ${userId} — already exists in debt collection.`);
      skipped++;
      continue;
    }

    await debtCol.insertOne({
      _id: userId as any,
      amount,
      updatedAt: new Date(),
    });
    inserted++;
  }

  console.log(`Inserted: ${inserted}, Skipped: ${skipped}`);
}

async function migrateBank(db: any) {
  console.log('\n--- Migration B: system loans_*/investment_* → bank collection ---');

  const systemCol = db.collection('system');
  const bankCol = db.collection('bank');

  // Gather all loan and investment docs
  const loanDocs = await systemCol.find({ _id: { $regex: /^loans_/ } }).toArray();
  const investDocs = await systemCol.find({ _id: { $regex: /^investment_/ } }).toArray();

  console.log(`Found ${loanDocs.length} loan records, ${investDocs.length} investment records.`);

  // Build a map userId → { loans, investment }
  const userMap = new Map<string, { loans: any[]; investment: any | null }>();

  for (const doc of loanDocs) {
    const userId = String(doc._id).replace('loans_', '');
    const loans = doc.value ?? (typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data) ?? [];
    if (!Array.isArray(loans)) continue;

    if (!userMap.has(userId)) userMap.set(userId, { loans: [], investment: null });
    userMap.get(userId)!.loans = loans;
  }

  for (const doc of investDocs) {
    const userId = String(doc._id).replace('investment_', '');
    const investment = doc.value ?? (typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data) ?? null;

    if (!userMap.has(userId)) userMap.set(userId, { loans: [], investment: null });
    userMap.get(userId)!.investment = investment;
  }

  let inserted = 0;
  let skipped = 0;

  for (const [userId, data] of userMap) {
    // Skip if no meaningful data
    if (data.loans.length === 0 && !data.investment) {
      skipped++;
      continue;
    }

    // Check if already migrated
    const existing = await bankCol.findOne({ _id: userId });
    if (existing) {
      console.log(`  Skip ${userId} — already exists in bank collection.`);
      skipped++;
      continue;
    }

    await bankCol.insertOne({
      _id: userId as any,
      loans: data.loans,
      investment: data.investment,
      updatedAt: new Date(),
    });
    inserted++;
  }

  console.log(`Inserted: ${inserted}, Skipped: ${skipped}`);
}

async function migrateTickets(db: any) {
  console.log('\n--- Migration C: tickets support records → tickets_support ---');

  const ticketsCol = db.collection('tickets');
  const supportCol = db.collection('tickets_support');

  const supportDocs = await ticketsCol.find({
    $or: [
      { _id: { $regex: /^ticket_/ } },
      { _id: { $regex: /^userticket_/ } },
    ],
  }).toArray();

  console.log(`Found ${supportDocs.length} support ticket records.`);

  let inserted = 0;
  let skipped = 0;

  for (const doc of supportDocs) {
    const existing = await supportCol.findOne({ _id: doc._id });
    if (existing) {
      skipped++;
      continue;
    }

    await supportCol.insertOne(doc);
    inserted++;
  }

  console.log(`Inserted: ${inserted}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
