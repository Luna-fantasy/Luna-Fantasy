'use client';

import ContextMenu from '../_components/ContextMenu';
import { usePeek } from '../_components/PeekProvider';
import { useTimezone } from '../_components/TimezoneProvider';
import { onButtonKey } from '../_components/a11y';
import type { RecentLevelUp } from '@/lib/admin/leveling';

export default function RecentLevelChanges({ rows }: { rows: RecentLevelUp[] }) {
  const { openPeek } = usePeek();
  const { fmtRel, absolute } = useTimezone();

  return (
    <section className="av-surface av-holders">
      <header className="av-flows-head">
        <div>
          <h3>Recent Level Changes</h3>
          <p>Admin-driven level modifications pulled from the audit log.</p>
        </div>
      </header>
      {rows.length === 0 ? (
        <div className="av-flows-empty">No recent level changes.</div>
      ) : (
        <ol className="av-holders-list">
          {rows.map((r, i) => (
            <ContextMenu
              key={i}
              items={[
                { label: 'Peek target', icon: '◇', run: () => openPeek(r.discordId) },
                { label: 'Open profile', icon: '›', run: () => { window.location.href = `/admin/users/${r.discordId}`; } },
                'separator' as const,
                { label: 'Copy Discord ID', icon: '⧉', run: () => navigator.clipboard?.writeText(r.discordId) },
              ]}
            >
              <li className="av-holders-row" onClick={() => openPeek(r.discordId)} onKeyDown={onButtonKey(() => openPeek(r.discordId))} role="button" tabIndex={0}>
                <div className="av-holders-avatar">
                  {r.image ? <img src={r.image} alt="" /> : <span>{(r.globalName ?? r.username ?? '?').slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="av-holders-ident">
                  <div className="av-holders-name">{r.globalName ?? r.username ?? r.discordId}</div>
                  <div className="av-holders-id">by {r.admin}</div>
                </div>
                <div className={`av-audit-badge av-audit-badge-${r.amount >= 0 ? 'grant' : 'destructive'}`}>
                  {r.amount >= 0 ? '+' : ''}{r.amount}
                </div>
                <div className="av-holders-value">
                  <strong>Lv {r.level}</strong>
                  <small title={absolute(r.timestamp)}>{fmtRel(r.timestamp)}</small>
                </div>
              </li>
            </ContextMenu>
          ))}
        </ol>
      )}
    </section>
  );
}
