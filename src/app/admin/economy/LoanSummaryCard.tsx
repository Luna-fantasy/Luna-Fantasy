import Link from 'next/link';
import type { LoanSummary } from '@/lib/admin/top-holders';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export default function LoanSummaryCard({ summary }: { summary: LoanSummary }) {
  const tiers = Object.keys(summary.byTier).map(Number).sort((a, b) => a - b);
  return (
    <section className="av-surface av-loans">
      <header className="av-flows-head">
        <div>
          <h3>Loan Activity</h3>
          <p>Active loans across all tiers.</p>
        </div>
        <div className="av-flows-net">
          <span>Active</span>
          <strong>{summary.activeCount.toLocaleString()}</strong>
        </div>
      </header>

      <div className="av-loans-stats">
        <div className="av-loans-stat">
          <span>Outstanding</span>
          <strong>{fmt(summary.outstandingValue)}</strong>
        </div>
        <div className="av-loans-stat">
          <span>Overdue</span>
          <strong className={summary.overdueCount > 0 ? 'av-loans-danger' : undefined}>
            {summary.overdueCount.toLocaleString()}
          </strong>
        </div>
        <div className="av-loans-stat">
          <span>Avg Rate</span>
          <strong>{(summary.avgInterestRate * 100).toFixed(1)}%</strong>
        </div>
      </div>

      {tiers.length === 0 ? (
        <div className="av-flows-empty">No active loans.</div>
      ) : (
        <ul className="av-loans-tiers">
          {tiers.map((t) => (
            <li key={t} className="av-loans-tier">
              <span className="av-loans-tier-label">Tier {t}</span>
              <div className="av-loans-tier-bar">
                <span style={{
                  width: `${(summary.byTier[t].value / summary.outstandingValue) * 100}%`,
                }} />
              </div>
              <span className="av-loans-tier-count">{summary.byTier[t].count}</span>
              <span className="av-loans-tier-value">{fmt(summary.byTier[t].value)}</span>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 12 }}>
        <Link href="/admin/audit?actions=loan_payout,loan_payment" className="av-btn av-btn-ghost">
          Loan audit trail
        </Link>
      </div>
    </section>
  );
}
