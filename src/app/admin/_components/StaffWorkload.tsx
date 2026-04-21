import clientPromise from '@/lib/mongodb';

interface StaffLoad {
  assignee: string;
  open: number;
  inProgress: number;
}

async function getStaffLoad(): Promise<StaffLoad[]> {
  const client = await clientPromise;
  const db = client.db('Database');

  const pipeline = [
    { $match: { status: { $in: ['open', 'in_progress', 'pending'] } } },
    { $group: {
      _id: { assignee: { $ifNull: ['$assignee', 'Unassigned'] }, status: '$status' },
      count: { $sum: 1 },
    } },
  ];

  const byStaff = new Map<string, StaffLoad>();
  for (const col of ['tickets', 'applications']) {
    try {
      const rows = await db.collection(col).aggregate(pipeline).toArray();
      for (const r of rows) {
        const name = String((r._id as any).assignee ?? 'Unassigned');
        const status = String((r._id as any).status ?? '');
        const prev = byStaff.get(name) ?? { assignee: name, open: 0, inProgress: 0 };
        if (status === 'in_progress') prev.inProgress += r.count;
        else prev.open += r.count;
        byStaff.set(name, prev);
      }
    } catch { /* collection may not exist — ignore */ }
  }

  return Array.from(byStaff.values()).sort((a, b) => (b.open + b.inProgress) - (a.open + a.inProgress));
}

export default async function StaffWorkload() {
  const load = await getStaffLoad();
  const max = Math.max(1, ...load.map((l) => l.open + l.inProgress));

  return (
    <section className="av-surface av-workload">
      <header className="av-flows-head">
        <div>
          <h3>Staff Workload</h3>
          <p>Open tickets &amp; applications by assignee.</p>
        </div>
      </header>
      {load.length === 0 ? (
        <div className="av-flows-empty">No open work right now.</div>
      ) : (
        <ul className="av-workload-list">
          {load.map((s) => {
            const total = s.open + s.inProgress;
            return (
              <li key={s.assignee} className="av-workload-row">
                <span className="av-workload-name">{s.assignee}</span>
                <div className="av-workload-bar">
                  <span className="av-workload-bar-ip" style={{ width: `${(s.inProgress / max) * 100}%` }} />
                  <span className="av-workload-bar-open" style={{ width: `${(s.open / max) * 100}%` }} />
                </div>
                <span className="av-workload-count">{total}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
