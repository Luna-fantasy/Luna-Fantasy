'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePeek } from '../_components/PeekProvider';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import { onButtonKey, useFocusTrap } from '../_components/a11y';
import { RARITY_TONES, type CardDef } from '@/lib/admin/cards-v2-types';
import { deleteCard, reAddCard } from './CardEditDialog';

interface Holder {
  discordId: string;
  username: string | null;
  globalName: string | null;
  image: string | null;
  count: number;
}

interface Props {
  card: CardDef;
  onClose: () => void;
  onEdit?: (card: CardDef) => void;
  onDeleted?: () => void | Promise<void>;
}

export default function CardDetailDrawer({ card, onClose, onEdit, onDeleted }: Props) {
  const { openPeek } = usePeek();
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();
  const [mounted, setMounted] = useState(false);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestDelete = async () => {
    const ok = await pending.queue({
      label: `Delete ${card.rarity} card: ${card.name}`,
      detail: `${card.copiesOwned.toLocaleString()} copies in player hands will remain.`,
      delayMs: 6000,
      tone: 'danger',
      run: async () => {
        try {
          await deleteCard(card);
          toast.show({ tone: 'success', title: 'Deleted', message: card.name });
          undo.push({
            label: `Restore: ${card.name}`,
            detail: card.rarity,
            revert: async () => {
              await reAddCard(card);
              toast.show({ tone: 'success', title: 'Restored', message: card.name });
              await onDeleted?.();
            },
          });
          await onDeleted?.();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Delete failed', message: (e as Error).message });
        }
      },
    });
    if (ok !== false) onClose();
  };

  useEffect(() => setMounted(true), []);
  const dialogRef = useRef<HTMLElement>(null);
  useFocusTrap(dialogRef, mounted, onClose);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/v2/cards/holders?name=${encodeURIComponent(card.name)}&rarity=${card.rarity}&limit=50`, { cache: 'no-store' })
      .then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => !cancelled && setHolders(data.holders ?? []))
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [card]);

  if (!mounted) return null;

  const tone = RARITY_TONES[card.rarity];

  return createPortal(
    <>
      <div className="av-peek-scrim" onClick={onClose} />
      <aside ref={dialogRef} className="av-peek av-carddet" role="dialog" aria-modal="true" aria-label={`${card.name} details`} style={{ ['--rarity-tone' as any]: tone }}>
        <button type="button" className="av-peek-close" onClick={onClose} aria-label="Close">×</button>

        <div className="av-carddet-hero">
          <div className="av-carddet-img">
            {card.imageUrl
              ? <img src={card.imageUrl} alt={card.name} />
              : <div className="av-card-tile-placeholder av-carddet-placeholder">{card.name.slice(0, 1)}</div>}
          </div>
          <div className="av-carddet-meta">
            <div className="av-carddet-rarity" style={{ color: tone, borderColor: `color-mix(in srgb, ${tone} 40%, transparent)` }}>
              {card.rarity}
            </div>
            <h2 className="av-carddet-name">{card.name}</h2>
            <div className="av-carddet-stats">
              <div><span>Attack</span><strong>⚔ {card.attack}</strong></div>
              <div><span>Drop rate</span><strong>{card.dropPct.toFixed(card.dropPct < 1 ? 2 : 1)}%</strong></div>
              <div><span>Weight</span><strong>{card.weight}</strong></div>
            </div>
            <div className="av-carddet-ownership">
              <div><span>Copies</span><strong>{card.copiesOwned.toLocaleString()}</strong></div>
              <div><span>Holders</span><strong>{card.ownerCount.toLocaleString()}</strong></div>
              <div><span>Avg/holder</span><strong>{card.ownerCount > 0 ? (card.copiesOwned / card.ownerCount).toFixed(1) : '—'}</strong></div>
            </div>
          </div>
        </div>

        <section className="av-carddet-section">
          <h3>Holders {holders.length > 0 && `· showing top ${holders.length}`}</h3>
          {loading && <div className="av-flows-empty">Loading holders…</div>}
          {error && <div className="av-health-error" style={{ margin: '8px 0' }}>{error}</div>}
          {!loading && !error && holders.length === 0 && (
            <div className="av-flows-empty">No one owns this card yet.</div>
          )}
          {!loading && holders.length > 0 && (
            <ol className="av-holders-list av-carddet-holders">
              {holders.map((h, i) => (
                <li
                  key={h.discordId}
                  className="av-holders-row"
                  onClick={() => openPeek(h.discordId)}
                  onKeyDown={onButtonKey(() => openPeek(h.discordId))}
                  role="button"
                  tabIndex={0}
                >
                  <span className="av-holders-rank">#{i + 1}</span>
                  <div className="av-holders-avatar">
                    {h.image ? <img src={h.image} alt="" /> : <span>{(h.globalName ?? h.username ?? '?').slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className="av-holders-ident">
                    <div className="av-holders-name">{h.globalName ?? h.username ?? h.discordId}</div>
                    <div className="av-holders-id">{h.discordId}</div>
                  </div>
                  <div className="av-holders-value">
                    <strong>×{h.count}</strong>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <footer className="av-peek-foot">
          <button type="button" className="av-btn av-btn-primary" onClick={() => onEdit?.(card)}>
            Edit
          </button>
          <button type="button" className="av-btn av-btn-danger" onClick={requestDelete}>
            Delete
          </button>
          {card.imageUrl && (
            <Link href={card.imageUrl} target="_blank" rel="noreferrer" className="av-btn av-btn-ghost">
              Image
            </Link>
          )}
        </footer>
      </aside>
    </>,
    document.body,
  );
}
