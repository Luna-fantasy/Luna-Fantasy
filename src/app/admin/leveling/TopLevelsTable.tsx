'use client';

import ContextMenu from '../_components/ContextMenu';
import { usePeek } from '../_components/PeekProvider';
import { onButtonKey } from '../_components/a11y';
import type { TopLeveled } from '@/lib/admin/leveling';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export default function TopLevelsTable({ rows }: { rows: TopLeveled[] }) {
  const { openPeek } = usePeek();

  return (
    <section className="av-surface av-holders">
      <header className="av-flows-head">
        <div>
          <h3>Top Leveled</h3>
          <p>25 highest levels · right-click for actions.</p>
        </div>
      </header>
      {rows.length === 0 ? (
        <div className="av-flows-empty">No leveled users.</div>
      ) : (
        <ol className="av-holders-list">
          {rows.map((r, i) => (
            <ContextMenu
              key={r.discordId}
              items={[
                { label: 'Peek', icon: '◇', run: () => openPeek(r.discordId) },
                { label: 'Open profile', icon: '›', run: () => { window.location.href = `/admin/users/${r.discordId}`; } },
                'separator' as const,
                { label: 'Copy Discord ID', icon: '⧉', run: () => navigator.clipboard?.writeText(r.discordId) },
                { label: 'View audit trail', icon: '⌕', run: () => { window.location.href = `/admin/audit?targetDiscordId=${r.discordId}`; } },
              ]}
            >
              <li className="av-holders-row av-level-row" onClick={() => openPeek(r.discordId)} onKeyDown={onButtonKey(() => openPeek(r.discordId))} role="button" tabIndex={0}>
                <span className="av-holders-rank">#{i + 1}</span>
                <div className="av-holders-avatar">
                  {r.image ? <img src={r.image} alt="" /> : <span>{(r.globalName ?? r.username ?? '?').slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="av-holders-ident">
                  <div className="av-holders-name">{r.globalName ?? r.username ?? r.discordId}</div>
                  <div className="av-holders-id">{r.discordId}</div>
                </div>
                <div className="av-level-meta">
                  <span>{fmt(r.messages)} msgs</span>
                  <span>{r.voiceMinutes > 0 ? `${fmt(r.voiceMinutes)} min voice` : 'No voice'}</span>
                </div>
                <div className="av-holders-value">
                  <strong>Lv {r.level}</strong>
                  <small>{fmt(r.xp)} XP</small>
                </div>
              </li>
            </ContextMenu>
          ))}
        </ol>
      )}
    </section>
  );
}
