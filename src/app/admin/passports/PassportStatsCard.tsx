import type { PassportStats } from '@/lib/admin/passports';

const FACTION_TONES: Record<string, string> = {
  lunarians: '#00d4ff',
  sentinel:  '#fbbf24',
  mastermind:'#a855f7',
  underworld:'#ef4444',
  siren:     '#06b6d4',
  seer:      '#94a3b8',
  wizard:    '#818cf8',
  thief:     '#64748b',
  knight:    '#93c5fd',
  guardian:  '#3b82f6',
};

export default function PassportStatsCard({ stats }: { stats: PassportStats }) {
  const factionEntries = Object.entries(stats.byFaction);
  const total = stats.total || 1;

  return (
    <section className="av-surface av-pstats">
      <header className="av-flows-head">
        <div>
          <h3>Registry · {stats.total.toLocaleString()} passports minted</h3>
          <p>Breakdown by staff role and faction.</p>
        </div>
      </header>

      <div className="av-pstats-staff">
        <div className="av-pstats-staff-card av-pstats-staff-card--mastermind">
          <span>Mastermind</span>
          <strong>{stats.staff.mastermind}</strong>
        </div>
        <div className="av-pstats-staff-card av-pstats-staff-card--sentinel">
          <span>Sentinel</span>
          <strong>{stats.staff.sentinel}</strong>
        </div>
        <div className="av-pstats-staff-card av-pstats-staff-card--guardian">
          <span>Guardian</span>
          <strong>{stats.staff.guardian}</strong>
        </div>
      </div>

      {factionEntries.length > 0 && (
        <div className="av-pstats-factions">
          <div className="av-pstats-bar">
            {factionEntries.map(([name, count]) => (
              <span
                key={name}
                className="av-pstats-bar-seg"
                title={`${name}: ${count} (${((count / total) * 100).toFixed(1)}%)`}
                style={{
                  flex: `${count / total} 0 0`,
                  background: FACTION_TONES[name.toLowerCase()] ?? 'var(--accent-primary)',
                }}
              />
            ))}
          </div>
          <ul className="av-pstats-legend">
            {factionEntries.map(([name, count]) => (
              <li key={name}>
                <span
                  className="av-flows-dot"
                  style={{ background: FACTION_TONES[name.toLowerCase()] ?? 'var(--accent-primary)' }}
                />
                <span>{name}</span>
                <span>{count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
