import Link from 'next/link';
import clientPromise from '@/lib/mongodb';

interface StatusRow {
  label: string;
  count: number;
  tone: 'pending' | 'accepted' | 'rejected';
  color: string;
}

interface TypeRow {
  type: string;
  pending: number;
}

async function getApplicationsQueue(): Promise<{
  rows: StatusRow[];
  total: number;
  byType: TypeRow[];
  recentPending: { type: string; username: string; createdAt: string }[];
}> {
  const client = await clientPromise;
  const db = client.db('Database');

  try {
    const [statusRows, typeRows, recent] = await Promise.all([
      db.collection('applications').aggregate([
        { $group: { _id: { $ifNull: ['$status', 'pending'] }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('applications').aggregate([
        { $match: { $or: [{ status: 'pending' }, { status: null }, { status: { $exists: false } }] } },
        { $group: { _id: { $ifNull: ['$type', 'staff'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray(),
      db.collection('applications')
        .find({ $or: [{ status: 'pending' }, { status: null }, { status: { $exists: false } }] })
        .project({ type: 1, username: 1, createdAt: 1, submittedAt: 1 })
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray(),
    ]);

    const byStatus = new Map<string, number>();
    for (const r of statusRows as any[]) byStatus.set(String(r._id), r.count);

    const pending  = (byStatus.get('pending') ?? 0) + (byStatus.get('null') ?? 0);
    const accepted = byStatus.get('accepted') ?? 0;
    const rejected = byStatus.get('rejected') ?? 0;

    const rows: StatusRow[] = [
      { label: 'Pending review', count: pending,  tone: 'pending',  color: '#fbbf24' },
      { label: 'Accepted',       count: accepted, tone: 'accepted', color: '#22c55e' },
      { label: 'Rejected',       count: rejected, tone: 'rejected', color: '#f43f5e' },
    ];

    const byType: TypeRow[] = (typeRows as any[]).map((r) => ({
      type: String(r._id ?? 'staff'),
      pending: r.count,
    }));

    const recentPending = (recent as any[]).map((r) => ({
      type: String(r.type ?? 'staff'),
      username: String(r.username ?? 'unknown'),
      createdAt: new Date(r.createdAt ?? r.submittedAt ?? Date.now()).toISOString(),
    }));

    return { rows, total: pending + accepted + rejected, byType, recentPending };
  } catch {
    return { rows: [], total: 0, byType: [], recentPending: [] };
  }
}

function fmtRel(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

function Donut({ rows, total }: { rows: StatusRow[]; total: number }) {
  const size = 140;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="av-apps-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="av-apps-donut">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
        {rows.map((r) => {
          const frac = total > 0 ? r.count / total : 0;
          const dash = frac * circumference;
          const gap = circumference - dash;
          const seg = (
            <circle
              key={r.tone}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={r.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ filter: `drop-shadow(0 0 6px ${r.color}55)` }}
            />
          );
          offset += dash;
          return seg;
        })}
        <text x="50%" y="46%" textAnchor="middle" className="av-apps-donut-num">{total}</text>
        <text x="50%" y="62%" textAnchor="middle" className="av-apps-donut-label">total</text>
      </svg>
    </div>
  );
}

const TYPE_GLYPH: Record<string, string> = {
  staff: '⚙',
  wizard: '✦',
  passport: '✉',
  healer: '✚',
};

function typeLabel(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default async function ApplicationsQueue() {
  const { rows, total, byType, recentPending } = await getApplicationsQueue();
  const pending = rows.find((r) => r.tone === 'pending')?.count ?? 0;

  return (
    <section className="av-surface av-apps-queue">
      <header className="av-apps-head">
        <div>
          <h3>Applications Queue</h3>
          <p>Staff applications by status.</p>
        </div>
        <Link href="/admin/inbox?kind=application" className="av-apps-cta" title="Open Staff Inbox">
          Review pending →
        </Link>
      </header>

      {total === 0 ? (
        <div className="av-flows-empty">No applications yet — the inbox is quiet.</div>
      ) : (
        <div className="av-apps-body">
          <Donut rows={rows} total={total} />

          <div className="av-apps-stats">
            <ul className="av-apps-rows">
              {rows.map((r) => (
                <li key={r.tone} className="av-apps-row">
                  <span className="av-apps-dot" style={{ background: r.color, boxShadow: `0 0 10px ${r.color}80` }} />
                  <span className="av-apps-row-label">{r.label}</span>
                  <span className="av-apps-row-count">{r.count}</span>
                  <span className="av-apps-row-pct">
                    {total > 0 ? `${Math.round((r.count / total) * 100)}%` : '0%'}
                  </span>
                </li>
              ))}
            </ul>

            {byType.length > 0 && pending > 0 && (
              <div className="av-apps-types">
                <div className="av-apps-types-head">Pending by type</div>
                <div className="av-apps-types-chips">
                  {byType.map((t) => (
                    <span key={t.type} className="av-apps-type-chip" title={`${t.pending} pending ${t.type}`}>
                      <span className="av-apps-type-glyph" aria-hidden="true">{TYPE_GLYPH[t.type] ?? '•'}</span>
                      <span>{typeLabel(t.type)}</span>
                      <strong>{t.pending}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {recentPending.length > 0 && (
              <div className="av-apps-recent">
                <div className="av-apps-recent-head">Next in queue</div>
                <ul>
                  {recentPending.map((r, i) => (
                    <li key={i}>
                      <span className="av-apps-recent-glyph" aria-hidden="true">{TYPE_GLYPH[r.type] ?? '•'}</span>
                      <span className="av-apps-recent-user">{r.username}</span>
                      <span className="av-apps-recent-type">{typeLabel(r.type)}</span>
                      <span className="av-apps-recent-time">{fmtRel(r.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
