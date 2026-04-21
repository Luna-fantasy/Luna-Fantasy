import type { EconomyFlows, FlowBucket } from '@/lib/admin/economy-flows';

/**
 * LunariFlows — two-sided proportional bar showing Lunari sources vs sinks.
 * Not a true Sankey (doesn't draw source-to-sink ribbons since each txn is
 * either inflow OR outflow), but conveys the same intuition: where does the
 * money come from, where does it go, in what proportions.
 */

const TONE_CYCLE = ['#00d4ff', '#8b5cf6', '#fbbf24', '#22c55e', '#ef4444', '#f472b6', '#60a5fa'];

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function ColumnBar({ title, items, total }: { title: string; items: FlowBucket[]; total: number }) {
  return (
    <div className="av-flows-col">
      <div className="av-flows-col-head">
        <span className="av-flows-col-title">{title}</span>
        <span className="av-flows-col-total">{fmt(total)}</span>
      </div>
      <div className="av-flows-stack" role="img" aria-label={`${title} breakdown`}>
        {items.map((b, i) => (
          <div
            key={b.label}
            className="av-flows-seg"
            title={`${b.label}: ${b.amount.toLocaleString()} (${((b.amount / total) * 100).toFixed(1)}%)`}
            style={{
              flex: `${Math.max(0.001, b.amount / total)} 0 0`,
              background: TONE_CYCLE[i % TONE_CYCLE.length],
            }}
          />
        ))}
      </div>
      <ul className="av-flows-legend">
        {items.map((b, i) => (
          <li key={b.label}>
            <span className="av-flows-dot" style={{ background: TONE_CYCLE[i % TONE_CYCLE.length] }} />
            <span className="av-flows-label">{b.label}</span>
            <span className="av-flows-amount">{fmt(b.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LunariFlows({ flows }: { flows: EconomyFlows }) {
  const sourceTotal = flows.sources.reduce((a, b) => a + b.amount, 0);
  const sinkTotal = flows.sinks.reduce((a, b) => a + b.amount, 0);
  const net = sourceTotal - sinkTotal;
  const netTone = net >= 0 ? 'positive' : 'negative';

  return (
    <section className="av-surface av-flows">
      <header className="av-flows-head">
        <div>
          <h3>Lunari Flows · 30d</h3>
          <p>Where money enters the economy vs where it exits.</p>
        </div>
        <div className={`av-flows-net av-flows-net--${netTone}`}>
          <span>Net</span>
          <strong>{net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}</strong>
        </div>
      </header>
      {sourceTotal === 0 && sinkTotal === 0 ? (
        <div className="av-flows-empty">No transactions in the last 7 days.</div>
      ) : (
        <div className="av-flows-grid">
          <ColumnBar title="Sources (in)" items={flows.sources} total={sourceTotal || 1} />
          <div className="av-flows-gap" aria-hidden="true">⟶</div>
          <ColumnBar title="Sinks (out)" items={flows.sinks} total={sinkTotal || 1} />
        </div>
      )}
    </section>
  );
}
