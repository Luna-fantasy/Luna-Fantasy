import type { LevelBucket } from '@/lib/admin/leveling';

const TONE_CYCLE = ['#64748b', '#3b82f6', '#06b6d4', '#22c55e', '#fbbf24', '#f97316', '#a855f7'];

export default function LevelDistribution({ buckets }: { buckets: LevelBucket[] }) {
  const total = buckets.reduce((a, b) => a + b.count, 0);
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <section className="av-surface av-ldist">
      <header className="av-flows-head">
        <div>
          <h3>Level Distribution</h3>
          <p>How the population spreads across level brackets.</p>
        </div>
        <div className="av-flows-net">
          <span>Total</span>
          <strong>{total.toLocaleString()}</strong>
        </div>
      </header>

      <div className="av-ldist-grid">
        {buckets.map((b, i) => {
          const pct = total > 0 ? (b.count / total) * 100 : 0;
          const height = (b.count / max) * 100;
          return (
            <div key={b.label} className="av-ldist-bucket" title={`${b.count.toLocaleString()} users (${pct.toFixed(1)}%)`}>
              <div className="av-ldist-bar" style={{ height: `${height}%`, background: TONE_CYCLE[i % TONE_CYCLE.length] }} />
              <div className="av-ldist-count">{b.count.toLocaleString()}</div>
              <div className="av-ldist-label">{b.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
