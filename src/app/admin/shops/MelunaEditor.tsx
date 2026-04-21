'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';

interface Stone {
  name: string;
  weight: number;
  sell_price: number;
  imageUrl?: string;
  emoji_id?: string;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

function fmtPct(chance: number): string {
  return `${Math.round(chance * 100)}%`;
}

export default function MelunaEditor({ tone }: { tone: string }) {
  const toast = useToast();
  const pending = usePendingAction();

  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState<number>(2000);
  const [refundAmount, setRefundAmount] = useState<number>(1000);
  const [refundChance, setRefundChance] = useState<number>(0.5);
  const [stones, setStones] = useState<Stone[]>([]);
  const [image, setImage] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shops/meluna', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setPrice(body.price ?? 2000);
      setRefundAmount(body.refund_amount ?? 1000);
      setRefundChance(body.refund_chance ?? 0.5);
      setStones(Array.isArray(body.stones) ? body.stones : []);
      setImage(body.image ?? '');
      setUpdatedAt(body.updatedAt ?? null);
      setDirty(false);
      setLoadError(null);
    } catch (e) {
      const msg = (e as Error).message;
      setLoadError(msg);
      toast.show({ tone: 'error', title: 'Load failed', message: msg });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const save = () => {
    pending.queue({
      label: 'Save Meluna stone box',
      detail: `${stones.length} stones · ${price.toLocaleString()} Lunari per box`,
      delayMs: 4500,
      run: async () => {
        try {
          const token = await fetchCsrf();
          const res = await fetch('/api/admin/shops/meluna', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
            credentials: 'include',
            body: JSON.stringify({
              price,
              refund_amount: refundAmount,
              refund_chance: refundChance,
              stones,
              image,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error ?? `HTTP ${res.status}`);
          }
          toast.show({ tone: 'success', title: 'Saved', message: 'Meluna stone box updated.' });
          await load();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const addStone = () => {
    setStones((ss) => [...ss, { name: `New stone ${ss.length + 1}`, weight: 0, sell_price: 0 }]);
    setDirty(true);
  };

  const updateStone = (i: number, patch: Partial<Stone>) => {
    setStones((ss) => ss.map((s, idx) => idx === i ? { ...s, ...patch } : s));
    setDirty(true);
  };

  const removeStone = (i: number) => {
    setStones((ss) => ss.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const totalWeight = stones.reduce((a, b) => a + (Number(b.weight) || 0), 0);

  if (loading) return <div className="av-commands-empty">Loading Meluna…</div>;

  return (
    <section className="av-special-editor" style={{ ['--vendor-tone' as any]: tone }}>
      <article className="av-surface av-special-editor-panel">
        <header className="av-flows-head">
          <div>
            <h3>Meluna — Moon Stone Vendor</h3>
            <p>
              Players pay Lunari to open a random stone box. Dice-roll pulls one stone weighted by drop rate; misses refund partial Lunari.
              {updatedAt && <> · Last update: {new Date(updatedAt).toLocaleString()}</>}
            </p>
          </div>
          {dirty && (
            <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={save}>
              Save changes
            </button>
          )}
        </header>

        {loadError ? (
          <div className="av-flows-empty" style={{ marginTop: 8 }}>
            <span>Couldn't load Meluna — {loadError}</span>
            <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => void load()}>↻ Retry</button>
          </div>
        ) : (
          <>
            {/* Price / refund row */}
            <div className="av-meluna-meta-grid">
              <label className="av-meluna-field">
                <span>Box price (Lunari)</span>
                <input
                  type="number"
                  min={1}
                  max={10_000_000}
                  className="av-audit-input av-audit-input--sm"
                  value={price}
                  onChange={(e) => { setPrice(Number(e.target.value) || 1); setDirty(true); }}
                />
              </label>
              <label className="av-meluna-field">
                <span>Refund on miss (Lunari)</span>
                <input
                  type="number"
                  min={0}
                  max={10_000_000}
                  className="av-audit-input av-audit-input--sm"
                  value={refundAmount}
                  onChange={(e) => { setRefundAmount(Number(e.target.value) || 0); setDirty(true); }}
                />
              </label>
              <label className="av-meluna-field">
                <span>Miss chance ({fmtPct(refundChance)})</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={refundChance}
                  onChange={(e) => { setRefundChance(Number(e.target.value)); setDirty(true); }}
                />
              </label>
            </div>

            {/* Stones list */}
            <div style={{ marginTop: 16 }}>
              <header className="av-flows-head" style={{ marginBottom: 8 }}>
                <div>
                  <h4 style={{ margin: 0 }}>Stones · {stones.length}</h4>
                  <p style={{ margin: '4px 0 0' }}>
                    Total drop weight: <strong>{totalWeight}</strong>. Each stone's drop rate = weight / total.
                  </p>
                </div>
                <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={addStone}>+ Add stone</button>
              </header>

              {stones.length === 0 ? (
                <div className="av-flows-empty">
                  No stones configured — <button type="button" className="av-shop-empty-add" onClick={addStone}>add the first one</button>.
                </div>
              ) : (
                <div className="av-meluna-grid">
                  {stones.map((s, i) => {
                    const dropPct = totalWeight > 0 ? (Number(s.weight) / totalWeight) * 100 : 0;
                    return (
                      <div key={i} className="av-meluna-card">
                        <div className="av-meluna-card-head">
                          <div className="av-meluna-card-preview">
                            {s.imageUrl
                              ? <img src={s.imageUrl} alt={s.name} onError={(e) => (e.currentTarget.style.opacity = '0.25')} />
                              : <span>💎</span>}
                          </div>
                          <input
                            className="av-audit-input av-audit-input--sm"
                            placeholder="Stone name"
                            value={s.name}
                            onChange={(e) => updateStone(i, { name: e.target.value })}
                          />
                          <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => removeStone(i)} title="Remove stone">×</button>
                        </div>
                        <div className="av-meluna-row">
                          <label>
                            <span>Weight</span>
                            <input
                              type="number"
                              min={0}
                              max={1000}
                              className="av-audit-input av-audit-input--sm"
                              value={s.weight}
                              onChange={(e) => updateStone(i, { weight: Number(e.target.value) || 0 })}
                            />
                          </label>
                          <label>
                            <span>Sell price</span>
                            <input
                              type="number"
                              min={0}
                              max={10_000_000}
                              className="av-audit-input av-audit-input--sm"
                              value={s.sell_price}
                              onChange={(e) => updateStone(i, { sell_price: Number(e.target.value) || 0 })}
                            />
                          </label>
                        </div>
                        <label>
                          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Image URL</span>
                          <input
                            className="av-audit-input av-audit-input--sm"
                            placeholder="https://assets.lunarian.app/stones/…"
                            value={s.imageUrl ?? ''}
                            onChange={(e) => updateStone(i, { imageUrl: e.target.value })}
                          />
                        </label>
                        <div className="av-meluna-drop-pct" title={`Weight ${s.weight} of ${totalWeight}`}>
                          Drop chance: <strong>{dropPct.toFixed(2)}%</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </article>
    </section>
  );
}
