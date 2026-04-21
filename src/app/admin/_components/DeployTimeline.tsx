import clientPromise from '@/lib/mongodb';

interface DeployEvent {
  _id: string;
  action: string;
  who: string;
  target?: string;
  timestamp: string;
}

async function getRecentDeployEvents(): Promise<DeployEvent[]> {
  const client = await clientPromise;
  const col = client.db('Database').collection('admin_audit_log');
  const rows = await col.find({
    action: { $in: ['deploy_trigger', 'pm2_restart', 'pm2_start', 'pm2_stop', 'r2_upload', 'r2_delete', 'canvas_layout_update'] },
  })
    .project({ action: 1, adminUsername: 1, targetDiscordId: 1, metadata: 1, timestamp: 1 })
    .sort({ timestamp: -1 })
    .limit(20)
    .toArray();
  return rows.map((r: any) => ({
    _id: String(r._id),
    action: r.action,
    who: r.adminUsername ?? '—',
    target: r.metadata?.bot ?? r.metadata?.project ?? r.metadata?.key ?? r.targetDiscordId,
    timestamp: new Date(r.timestamp).toISOString(),
  }));
}

function actionTone(action: string): string {
  if (action === 'pm2_stop' || action === 'r2_delete') return 'destructive';
  if (action === 'pm2_start' || action === 'pm2_restart' || action === 'deploy_trigger') return 'ops';
  if (action === 'r2_upload') return 'content';
  if (action === 'canvas_layout_update') return 'content';
  return 'config';
}

function fmtRel(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

export default async function DeployTimeline() {
  const events = await getRecentDeployEvents();
  return (
    <section className="av-surface av-deploy">
      <header className="av-flows-head">
        <div>
          <h3>Deploy Timeline</h3>
          <p>Recent deploys, PM2 restarts, and content uploads.</p>
        </div>
      </header>
      {events.length === 0 ? (
        <div className="av-flows-empty">No infra events yet.</div>
      ) : (
        <ol className="av-deploy-list">
          {events.map((e) => (
            <li key={e._id} className={`av-deploy-item av-deploy-item--${actionTone(e.action)}`}>
              <span className="av-deploy-dot" aria-hidden="true" />
              <div className="av-deploy-meta">
                <div>
                  <span className={`av-audit-badge av-audit-badge-${actionTone(e.action)}`}>{e.action}</span>
                  {e.target && <span className="av-deploy-target"><code>{e.target}</code></span>}
                </div>
                <div className="av-deploy-sub">
                  <strong>{e.who}</strong>
                  <span>{fmtRel(e.timestamp)}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
