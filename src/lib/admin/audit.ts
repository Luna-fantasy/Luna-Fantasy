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

/**
 * Fetch paginated audit log with optional filters.
 */
export async function getAuditLog(options: {
  page?: number;
  limit?: number;
  action?: string;
  adminDiscordId?: string;
  targetDiscordId?: string;
} = {}): Promise<{ entries: AuditEntry[]; total: number }> {
  const { page = 1, limit = 50, action, adminDiscordId, targetDiscordId } = options;
  const col = await getCollection();

  const filter: Record<string, unknown> = {};
  if (action) filter.action = action;
  if (adminDiscordId) filter.adminDiscordId = adminDiscordId;
  if (targetDiscordId) filter.targetDiscordId = targetDiscordId;

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
