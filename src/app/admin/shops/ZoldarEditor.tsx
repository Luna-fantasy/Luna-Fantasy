'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';

interface TicketPackage {
  id: string;
  amount: number;
  price: number;
  imageUrl?: string;
  description?: string;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

export default function ZoldarEditor({ tone }: { tone: string }) {
  const toast = useToast();
  const pending = usePendingAction();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<TicketPackage[]>([]);
  const [image, setImage] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shops/zoldar', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setPackages(body.packages ?? []);
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
      label: 'Save Zoldar ticket shop',
      detail: `${packages.length} packages · bot picks up within ~60s`,
      delayMs: 4500,
      run: async () => {
        try {
          const token = await fetchCsrf();
          const res = await fetch('/api/admin/shops/zoldar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
            credentials: 'include',
            body: JSON.stringify({ packages, image }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error ?? `HTTP ${res.status}`);
          }
          toast.show({ tone: 'success', title: 'Saved', message: 'Zoldar packages updated.' });
          await load();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const addPackage = () => {
    setPackages((ps) => [...ps, {
      id: `pkg_${Date.now()}`,
      amount: 10,
      price: 1000,
    }]);
    setDirty(true);
  };

  const updatePackage = (i: number, patch: Partial<TicketPackage>) => {
    setPackages((ps) => ps.map((p, idx) => idx === i ? { ...p, ...patch } : p));
    setDirty(true);
  };

  const removePackage = (i: number) => {
    setPackages((ps) => ps.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  if (loading) return <div className="av-commands-empty">Loading Zoldar…</div>;

  return (
    <section className="av-special-editor" style={{ ['--vendor-tone' as any]: tone }}>
      <article className="av-surface av-special-editor-panel">
        <header className="av-flows-head">
          <div>
            <h3>Zoldar — Ticket shop</h3>
            <p>
              Ticket bundles sold by Zoldar Mooncarver. Players pay Lunari, receive tickets for gated games.
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
          <div className="av-flows-empty av-zoldar-load-err" style={{ marginTop: 8 }}>
            <span>Couldn't load packages — {loadError}</span>
            <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => void load()}>↻ Retry</button>
          </div>
        ) : packages.length === 0 ? (
          <div className="av-flows-empty" style={{ marginTop: 8 }}>
            No ticket packages yet — <button type="button" className="av-shop-empty-add" onClick={addPackage}>add the first one</button>.
          </div>
        ) : (
          <div className="av-zoldar-grid">
            {packages.map((p, i) => (
              <div key={`${p.id}-${i}`} className="av-zoldar-card">
                <div className="av-zoldar-head">
                  <input
                    className="av-audit-input av-audit-input--sm"
                    placeholder="Package ID"
                    value={p.id}
                    onChange={(e) => updatePackage(i, { id: e.target.value.replace(/[^a-z0-9_-]/gi, '') })}
                  />
                  <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => removePackage(i)}>×</button>
                </div>
                <div className="av-zoldar-row">
                  <label>
                    <span>Tickets</span>
                    <input
                      type="number"
                      min={1}
                      className="av-audit-input av-audit-input--sm"
                      value={p.amount}
                      onChange={(e) => updatePackage(i, { amount: Number(e.target.value) || 1 })}
                    />
                  </label>
                  <label>
                    <span>Price (Lunari)</span>
                    <input
                      type="number"
                      min={1}
                      className="av-audit-input av-audit-input--sm"
                      value={p.price}
                      onChange={(e) => updatePackage(i, { price: Number(e.target.value) || 1 })}
                    />
                  </label>
                </div>
                <label>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Description</span>
                  <input
                    className="av-audit-input av-audit-input--sm"
                    placeholder="Shown to players (optional)"
                    value={p.description ?? ''}
                    onChange={(e) => updatePackage(i, { description: e.target.value })}
                  />
                </label>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                  {p.amount > 0 ? `${Math.round(p.price / p.amount).toLocaleString()} Lunari / ticket` : '—'}
                </div>
              </div>
            ))}
          </div>
        )}

        {packages.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={addPackage}>+ Add package</button>
          </div>
        )}
      </article>
    </section>
  );
}
