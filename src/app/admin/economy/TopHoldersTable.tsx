'use client';

import Sparkline from '../_components/Sparkline';
import ContextMenu from '../_components/ContextMenu';
import { usePeek } from '../_components/PeekProvider';
import { onButtonKey } from '../_components/a11y';
import type { TopHolder } from '@/lib/admin/top-holders';

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export default function TopHoldersTable({ rows }: { rows: TopHolder[] }) {
  const { openPeek } = usePeek();

  return (
    <section className="av-surface av-holders">
      <header className="av-flows-head">
        <div>
          <h3>Top Holders</h3>
          <p>25 highest balances &middot; right-click for actions.</p>
        </div>
      </header>
      {rows.length === 0 ? (
        <div className="av-flows-empty">No holders.</div>
      ) : (
        <ol className="av-holders-list">
          {rows.map((h, i) => (
            <ContextMenu
              key={h.discordId}
              items={[
                { label: 'Peek', icon: '◇', run: () => openPeek(h.discordId) },
                { label: 'Open profile', icon: '›', run: () => { window.location.href = `/admin/users/${h.discordId}`; } },
                'separator' as const,
                { label: 'Copy Discord ID', icon: '⧉', run: () => navigator.clipboard?.writeText(h.discordId) },
                { label: 'View audit trail', icon: '⌕', run: () => { window.location.href = `/admin/audit?targetDiscordId=${h.discordId}`; } },
              ]}
            >
              <li className="av-holders-row" onClick={() => openPeek(h.discordId)} onKeyDown={onButtonKey(() => openPeek(h.discordId))} role="button" tabIndex={0}>
                <span className="av-holders-rank">#{i + 1}</span>
                <div className="av-holders-avatar">
                  {h.image ? <img src={h.image} alt="" /> : <span>{(h.globalName ?? h.username ?? '?').slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="av-holders-ident">
                  <div className="av-holders-name">{h.globalName ?? h.username ?? h.discordId}</div>
                  <div className="av-holders-id">{h.discordId}</div>
                </div>
                <div className="av-holders-spark">
                  <Sparkline data={h.sparkline} width={120} height={28} tone="var(--accent-primary)" />
                </div>
                <div className="av-holders-value">
                  <strong>{fmt(h.balance)}</strong>
                  <small>{h.sharePct.toFixed(2)}%</small>
                </div>
              </li>
            </ContextMenu>
          ))}
        </ol>
      )}
    </section>
  );
}
