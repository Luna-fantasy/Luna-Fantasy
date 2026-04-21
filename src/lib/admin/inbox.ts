import clientPromise from '@/lib/mongodb';
import { getBotConfigDoc } from '@/lib/admin/bot-configs';

export type InboxKind = 'ticket' | 'application';
export type InboxStatus = 'open' | 'closed' | 'pending' | 'accepted' | 'rejected';
export type InboxTone = 'cyan' | 'gold' | 'green' | 'muted' | 'red';

export interface UnifiedInboxItem {
  _id: string;
  kind: InboxKind;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  categoryId: string;
  categoryTitle: string | null;
  status: InboxStatus;
  tone: InboxTone;
  createdAt: string;        // ISO
  updatedAt: string | null; // ISO — closedAt/acceptedAt/rejectedAt

  // Ticket-only
  threadId?: string;
  ticketNumber?: number;
  closedBy?: string;

  // Application-only
  appId?: string;
  votes?: { likes: string[]; dislikes: string[] };
  answers?: Record<string, string>;
  rejectionReason?: string;
  acceptedBy?: string;
  rejectedBy?: string;
}

export interface InboxFilters {
  q?: string;
  kind?: 'all' | InboxKind;
  status?: 'all' | InboxStatus;
  categoryId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface InboxResult {
  items: UnifiedInboxItem[];
  total: number;
  byStatus: Record<InboxStatus, number>;
}

export interface InboxCategory {
  id: string;
  kind: InboxKind;
  title: string;
}

const TONE_BY_STATUS: Record<InboxStatus, InboxTone> = {
  open: 'cyan',
  pending: 'gold',
  accepted: 'green',
  closed: 'muted',
  rejected: 'red',
};

function titleCase(id: string): string {
  return id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function resolveUsers(db: any, userIds: string[]): Promise<Map<string, { name: string | null; avatar: string | null }>> {
  const unique = Array.from(new Set(userIds)).filter(Boolean);
  if (unique.length === 0) return new Map();
  const users = await db.collection('discord_users').find({ _id: { $in: unique as any[] } }).toArray();
  const map = new Map<string, { name: string | null; avatar: string | null }>();
  for (const u of users) {
    const id = String((u as any)._id);
    const avatar = (u as any).avatar
      ? `https://cdn.discordapp.com/avatars/${id}/${(u as any).avatar}.png?size=64`
      : null;
    map.set(id, {
      name: (u as any).globalName ?? (u as any).username ?? null,
      avatar,
    });
  }
  return map;
}

/**
 * Fetch unified inbox items from tickets_support + applications.
 * Filters apply across both; results are merged and sorted by createdAt desc.
 */
export async function getInbox(filters: InboxFilters = {}): Promise<InboxResult> {
  const {
    q = '',
    kind = 'all',
    status = 'all',
    categoryId = '',
    userId = '',
    dateFrom = '',
    dateTo = '',
    limit = 50,
    offset = 0,
  } = filters;

  const client = await clientPromise;
  const db = client.db('Database');

  const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
  const toMs   = dateTo   ? new Date(dateTo).getTime()   : null;

  const qLower = q.trim().toLowerCase();

  // Status → per-collection filters
  const wantTickets = kind === 'all' || kind === 'ticket';
  const wantApps    = kind === 'all' || kind === 'application';

  // Tickets query (only real ticket docs — have threadId + ticketNumber)
  const ticketsQuery: Record<string, any> = {
    threadId: { $exists: true },
    ticketNumber: { $exists: true },
  };
  if (wantTickets && status !== 'all') {
    if (status === 'open' || status === 'closed') {
      ticketsQuery.status = status;
    } else {
      // pending/accepted/rejected don't apply to tickets — skip
      ticketsQuery._id = { $exists: false };
    }
  }
  if (userId)     ticketsQuery.userId = userId;
  if (categoryId) ticketsQuery.categoryId = categoryId;
  if (fromMs)     ticketsQuery.createdAt = { ...(ticketsQuery.createdAt ?? {}), $gte: fromMs };
  if (toMs)       ticketsQuery.createdAt = { ...(ticketsQuery.createdAt ?? {}), $lte: toMs };

  // Applications query
  const appsQuery: Record<string, any> = {
    status: { $exists: true },
    id: { $exists: true },
  };
  if (wantApps && status !== 'all') {
    if (status === 'pending' || status === 'accepted' || status === 'rejected') {
      appsQuery.status = status;
    } else {
      appsQuery._id = { $exists: false };
    }
  }
  if (userId)     appsQuery.userId = userId;
  if (categoryId) appsQuery.categoryId = categoryId;
  if (fromMs)     appsQuery.createdAt = { ...(appsQuery.createdAt ?? {}), $gte: fromMs };
  if (toMs)       appsQuery.createdAt = { ...(appsQuery.createdAt ?? {}), $lte: toMs };

  // Fetch in parallel
  const [ticketsRaw, appsRaw, ticketsCfg, appsCfg] = await Promise.all([
    wantTickets ? db.collection('tickets_support').find(ticketsQuery).toArray() : Promise.resolve([]),
    wantApps    ? db.collection('applications').find(appsQuery).toArray()       : Promise.resolve([]),
    getBotConfigDoc('butler_tickets'),
    getBotConfigDoc('butler_applications'),
  ]);

  const ticketCats = (ticketsCfg?.data?.categories ?? {}) as Record<string, { title?: string }>;
  const appCats    = (appsCfg?.data?.categories    ?? {}) as Record<string, { title?: string }>;

  const catTitle = (kindArg: InboxKind, id: string): string => {
    const src = kindArg === 'ticket' ? ticketCats : appCats;
    return src[id]?.title ?? titleCase(id || 'unknown');
  };

  // Collect all userIds for bulk resolve
  const userIds: string[] = [];
  for (const t of ticketsRaw) userIds.push(String((t as any).userId ?? ''));
  for (const a of appsRaw)    userIds.push(String((a as any).userId ?? ''));
  const userMap = await resolveUsers(db, userIds);

  // Normalize
  const items: UnifiedInboxItem[] = [];

  for (const t of ticketsRaw) {
    const doc: any = t;
    const uid = String(doc.userId ?? '');
    const user = userMap.get(uid) ?? { name: null, avatar: null };
    const s: InboxStatus = doc.status === 'closed' ? 'closed' : 'open';
    items.push({
      _id: String(doc._id),
      kind: 'ticket',
      userId: uid,
      userName: user.name,
      userAvatar: user.avatar,
      categoryId: String(doc.categoryId ?? ''),
      categoryTitle: catTitle('ticket', String(doc.categoryId ?? '')),
      status: s,
      tone: TONE_BY_STATUS[s],
      createdAt: new Date(Number(doc.createdAt ?? 0)).toISOString(),
      updatedAt: doc.closedAt ? new Date(Number(doc.closedAt)).toISOString() : null,
      threadId: String(doc.threadId ?? ''),
      ticketNumber: Number(doc.ticketNumber ?? 0),
      closedBy: doc.closedBy ? String(doc.closedBy) : undefined,
    });
  }

  for (const a of appsRaw) {
    const doc: any = a;
    const uid = String(doc.userId ?? '');
    const user = userMap.get(uid) ?? { name: null, avatar: null };
    const s: InboxStatus = doc.status === 'accepted' ? 'accepted' : doc.status === 'rejected' ? 'rejected' : 'pending';
    const updated = s === 'accepted' ? doc.acceptedAt : s === 'rejected' ? doc.rejectedAt : null;
    items.push({
      _id: String(doc._id),
      kind: 'application',
      userId: uid,
      userName: user.name,
      userAvatar: user.avatar,
      categoryId: String(doc.categoryId ?? ''),
      categoryTitle: catTitle('application', String(doc.categoryId ?? '')),
      status: s,
      tone: TONE_BY_STATUS[s],
      createdAt: new Date(Number(doc.createdAt ?? 0)).toISOString(),
      updatedAt: updated ? new Date(Number(updated)).toISOString() : null,
      appId: String(doc.id ?? doc._id),
      votes: {
        likes:    Array.isArray(doc.votes?.likes)    ? doc.votes.likes.map(String)    : [],
        dislikes: Array.isArray(doc.votes?.dislikes) ? doc.votes.dislikes.map(String) : [],
      },
      answers: (doc.answers && typeof doc.answers === 'object') ? doc.answers as Record<string, string> : {},
      rejectionReason: doc.rejectionReason ? String(doc.rejectionReason) : undefined,
      acceptedBy: doc.acceptedBy ? String(doc.acceptedBy) : undefined,
      rejectedBy: doc.rejectedBy ? String(doc.rejectedBy) : undefined,
    });
  }

  // Free-text filter across userName, categoryTitle, id, rejectionReason
  const filtered = qLower
    ? items.filter((i) => {
        const hay = [
          i.userName ?? '', i.userId, i.categoryTitle ?? '', i._id,
          i.rejectionReason ?? '',
          i.answers ? Object.values(i.answers).join(' ') : '',
        ].join(' ').toLowerCase();
        return hay.includes(qLower);
      })
    : items;

  // Sort newest first
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const byStatus: Record<InboxStatus, number> = { open: 0, closed: 0, pending: 0, accepted: 0, rejected: 0 };
  for (const i of filtered) byStatus[i.status] += 1;

  const total = filtered.length;
  const page  = filtered.slice(offset, offset + limit);

  return { items: page, total, byStatus };
}

export async function getInboxCategories(): Promise<InboxCategory[]> {
  const [ticketsCfg, appsCfg] = await Promise.all([
    getBotConfigDoc('butler_tickets'),
    getBotConfigDoc('butler_applications'),
  ]);
  const out: InboxCategory[] = [];
  const tCats = (ticketsCfg?.data?.categories ?? {}) as Record<string, { title?: string }>;
  for (const id of Object.keys(tCats)) out.push({ id, kind: 'ticket', title: tCats[id]?.title ?? titleCase(id) });
  const aCats = (appsCfg?.data?.categories ?? {}) as Record<string, { title?: string }>;
  for (const id of Object.keys(aCats)) out.push({ id, kind: 'application', title: aCats[id]?.title ?? titleCase(id) });
  // Include 'passport' as a fallback application category (commonly used, not always in config)
  if (!out.some((c) => c.kind === 'application' && c.id === 'passport')) {
    out.push({ id: 'passport', kind: 'application', title: 'Passport' });
  }
  return out;
}

export async function getVotesRequired(): Promise<number> {
  const cfg = await getBotConfigDoc('butler_applications');
  return Math.max(1, Number(cfg?.data?.votes_required ?? 3));
}
