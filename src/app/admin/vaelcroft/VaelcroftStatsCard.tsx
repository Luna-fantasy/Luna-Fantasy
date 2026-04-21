import type { VaelcroftStats } from '@/lib/admin/vaelcroft-types';

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export default function VaelcroftStatsCard({ stats }: { stats: VaelcroftStats }) {
  const sold = stats.properties_total > 0
    ? Math.round((stats.properties_sold / stats.properties_total) * 100)
    : 0;

  return (
    <section className="av-surface" style={{ padding: 24, marginBottom: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <Stat label="Properties in Catalog" value={fmt(stats.properties_total)} hint={`${sold}% sold`} />
        <Stat label="Active for Sale" value={fmt(stats.properties_active_for_sale)} hint="Not yet owned" />
        <Stat label="Items in Catalog" value={fmt(stats.items_total)} hint="Furniture + horses + swords" />
        <Stat label="Active Eclipses" value={fmt(stats.active_eclipses)} hint="Damaged, awaiting repair" tone={stats.active_eclipses > 0 ? 'warn' : 'ok'} />
        <Stat label="Pending Foreclosures" value={fmt(stats.pending_foreclosures)} hint="Past grace deadline" tone={stats.pending_foreclosures > 0 ? 'danger' : 'ok'} />
        <Stat label="Lunari Sunk (30d)" value={fmt(stats.lunari_sunk_last_30d)} hint="Paid to the bank reserve" />
      </div>
    </section>
  );
}

function Stat({ label, value, hint, tone = 'ok' }: {
  label: string; value: string; hint?: string; tone?: 'ok' | 'warn' | 'danger';
}) {
  const color = tone === 'danger' ? '#ff6b6b' : tone === 'warn' ? '#f7b500' : 'inherit';
  return (
    <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.03)' }}>
      <div style={{ fontSize: 12, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, marginTop: 6, color }}>{value}</div>
      {hint && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
