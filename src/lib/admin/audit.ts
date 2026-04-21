import clientPromise from '@/lib/mongodb';
import type { AuditEntry } from '@/types/admin';

const DB_NAME = 'Database';
const COLLECTION = 'admin_audit_log';

async function getCollection() {
  const client = await clientPromise;
  return client.db(DB_NAME).collection<AuditEntry>(COLLECTION);
}

/**
 * Log an admin action. Append-only — no delete API exists.
 */
export async function logAdminAction(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  const col = await getCollection();
  await col.insertOne({
    ...entry,
    timestamp: new Date(),
  } as AuditEntry);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Fetch paginated audit log with optional filters.
 * Supports action (exact), actions[] (any-of), admin/target id (exact),
 * q (free-text regex across action, metadata.reason, adminUsername),
 * dateFrom/dateTo, amountMin/amountMax.
 */
export async function getAuditLog(options: {
  page?: number;
  limit?: number;
  action?: string;
  actions?: string[];
  adminDiscordId?: string;
  targetDiscordId?: string;
  q?: string;
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
} = {}): Promise<{ entries: AuditEntry[]; total: number }> {
  const {
    page = 1, limit = 50,
    action, actions, adminDiscordId, targetDiscordId,
    q, dateFrom, dateTo, amountMin, amountMax,
  } = options;
  const col = await getCollection();

  const filter: Record<string, unknown> = {};
  if (action) filter.action = action;
  if (actions && actions.length > 0) filter.action = { $in: actions };
  if (adminDiscordId) filter.adminDiscordId = adminDiscordId;
  if (targetDiscordId) filter.targetDiscordId = targetDiscordId;

  if (q && q.trim()) {
    const needle = escapeRegex(q.trim().slice(0, 120));
    const rx = new RegExp(needle, 'i');
    filter.$or = [
      { action: rx },
      { adminUsername: rx },
      { 'metadata.reason': rx },
      { targetDiscordId: rx },
      { adminDiscordId: rx },
    ];
  }

  if (dateFrom || dateTo) {
    const ts: Record<string, Date> = {};
    if (dateFrom) ts.$gte = dateFrom;
    if (dateTo) ts.$lte = dateTo;
    filter.timestamp = ts;
  }

  if (amountMin != null || amountMax != null) {
    const amt: Record<string, number> = {};
    if (amountMin != null) amt.$gte = amountMin;
    if (amountMax != null) amt.$lte = amountMax;
    filter['metadata.amount'] = amt;
  }

  const [entries, total] = await Promise.all([
    col
      .find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    col.countDocuments(filter),
  ]);

  return { entries: entries as AuditEntry[], total };
}

/**
 * Returns the distinct set of action strings in the audit log,
 * for use in a filter dropdown.
 */
export async function getDistinctAuditActions(): Promise<string[]> {
  const col = await getCollection();
  const values = await col.distinct('action');
  return (values as string[]).filter(Boolean).sort();
}

/**
 * Ensure indexes exist for efficient querying.
 * Call once on startup or during deployment.
 */
export async function ensureAuditIndexes(): Promise<void> {
  const col = await getCollection();
  await Promise.all([
    col.createIndex({ timestamp: -1 }),
    col.createIndex({ adminDiscordId: 1 }),
    col.createIndex({ targetDiscordId: 1 }),
    col.createIndex({ action: 1 }),
  ]);
}
