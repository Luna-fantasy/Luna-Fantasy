'use client';

import { useState } from 'react';
import { useToast } from '../_components/Toast';

interface RarityWeight {
  rarity: string;
  percentage: number;
}

interface Tier {
  id: string;
  label: string;
  price: number;
  rarities: RarityWeight[];
  enabled: boolean;
  order: number;
}

const RARITY_TONES: Record<string, string> = {
  common:    '#00FF99',
  rare:      '#0077FF',
  epic:      '#B066FF',
  unique:    '#FF3366',
  legendary: '#FFD54F',
  secret:    '#c084fc',
  forbidden: '#ef4444',
};

function fmt(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export default function LuckboxEditor({ tone, tiers, onSave }: {
  tone: string;
  tiers: Tier[];
  onSave: (next: Tier[]) => Promise<void>;
}) {
  const toast = useToast();
  const [working, setWorking] = useState<Tier[]>(tiers);
  const [busy, setBusy] = useState(false);

  const updateTier = (i: number, patch: Partial<Tier>) => {
    setWorking((ts) => ts.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  };

  const updateRarity = (i: number, ri: number, patch: Partial<RarityWeight>) => {
    setWorking((ts) => ts.map((t, idx) => idx !== i ? t : ({
      ...t,
      rarities: t.rarities.map((r, rIdx) => rIdx === ri ? { ...r, ...patch } : r),
    })));
  };

  const addRarity = (i: number) => {
    setWorking((ts) => ts.map((t, idx) => idx !== i ? t : ({
      ...t,
      rarities: [...t.rarities, { rarity: 'common', percentage: 0 }],
    })));
  };

  const removeRarity = (i: number, ri: number) => {
    setWorking((ts) => ts.map((t, idx) => idx !== i ? t : ({
      ...t,
      rarities: t.rarities.filter((_, rIdx) => rIdx !== ri),
    })));
  };

  const addTier = () => {
    setWorking((ts) => [
      ...ts,
      {
        id: `tier_${Date.now().toString(36)}`,
        label: 'New tier',
        price: 1000,
        rarities: [{ rarity: 'common', percentage: 100 }],
        enabled: true,
        order: ts.length,
      },
    ]);
  };

  const removeTier = (i: number) => {
    const tier = working[i];
    if (!tier) return;
    setWorking((ts) => ts.filter((_, idx) => idx !== i));
    toast.show({
      tone: 'info',
      title: 'Tier removed',
      message: `${tier.label || tier.id} — click Save to persist, Reset to undo.`,
    });
  };

  const dirty = JSON.stringify(working) !== JSON.stringify(tiers);

  const save = async () => {
    setBusy(true);
    try {
      await onSave(working);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="av-luckbox" style={{ ['--vendor-tone' as any]: tone }}>
      <header className="av-shop-inv-head">
        <div>
          <h3>Luckbox tiers · {working.length}</h3>
          <p>Each tier defines a pull price and the rarity composition. Players spend Lunari to roll one card per pull.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="av-shop-add-btn" onClick={addTier} disabled={busy}>
            + New tier
          </button>
          {dirty && (
            <button type="button" className="av-shop-add-btn" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save tier changes'}
            </button>
          )}
        </div>
      </header>

      <div className="av-luckbox-grid">
        {working.map((tier, i) => {
          const total = tier.rarities.reduce((a, b) => a + (b.percentage ?? 0), 0);
          return (
            <article
              key={tier.id ?? i}
              className={`av-luckbox-tier${tier.enabled ? '' : ' av-luckbox-tier--off'}`}
              style={{ ['--tier-tone' as any]: RARITY_TONES[tier.id?.toLowerCase()] ?? tone }}
            >
              <header className="av-luckbox-tier-head">
                <input
                  className="av-luckbox-label"
                  value={tier.label ?? ''}
                  onChange={(e) => updateTier(i, { label: e.target.value })}
                  placeholder="Tier label"
                />
                <button
                  type="button"
                  className={`av-se-toggle${tier.enabled ? ' av-se-toggle--on' : ''}`}
                  onClick={() => updateTier(i, { enabled: !tier.enabled })}
                  aria-pressed={tier.enabled}
                >
                  <span className="av-se-toggle-knob" />
                  <span className="av-se-toggle-text">{tier.enabled ? 'On' : 'Off'}</span>
                </button>
                <button
                  type="button"
                  className="av-shop-item-action av-shop-item-action--danger"
                  onClick={() => removeTier(i)}
                  aria-label={`Delete tier ${tier.label || tier.id}`}
                  title="Delete tier"
                >
                  🗑
                </button>
              </header>

              <div className="av-luckbox-row">
                <label className="av-shopf-field">
                  <span>Price <small>· Lunari</small></span>
                  <input
                    className="av-shopf-input av-shopf-input--num"
                    type="number"
                    min={0}
                    value={tier.price}
                    onChange={(e) => updateTier(i, { price: Number(e.target.value) })}
                  />
                </label>
                <label className="av-shopf-field">
                  <span>Order</span>
                  <input
                    className="av-shopf-input av-shopf-input--num"
                    type="number"
                    value={tier.order ?? i}
                    onChange={(e) => updateTier(i, { order: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="av-luckbox-rarities">
                <div className="av-luckbox-rarities-head">
                  <span>Rarity composition</span>
                  <span className={`av-luckbox-total${total === 100 ? ' av-luckbox-total--ok' : ' av-luckbox-total--bad'}`}>
                    Total {total}% {total !== 100 && '· should be 100'}
                  </span>
                </div>
                {tier.rarities.map((r, ri) => (
                  <div key={ri} className="av-luckbox-rarity">
                    <select
                      className="av-shopf-input av-shopf-input--sm"
                      value={r.rarity}
                      onChange={(e) => updateRarity(i, ri, { rarity: e.target.value })}
                      style={{ borderColor: RARITY_TONES[r.rarity] }}
                    >
                      {Object.keys(RARITY_TONES).map((rar) => <option key={rar} value={rar}>{rar.toUpperCase()}</option>)}
                    </select>
                    <input
                      className="av-shopf-input av-shopf-input--num av-shopf-input--sm"
                      type="number"
                      min={0}
                      max={100}
                      value={r.percentage}
                      onChange={(e) => updateRarity(i, ri, { percentage: Number(e.target.value) })}
                    />
                    <span className="av-luckbox-pct">%</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={r.percentage}
                      onChange={(e) => updateRarity(i, ri, { percentage: Number(e.target.value) })}
                      className="av-luckbox-slider"
                      style={{ accentColor: RARITY_TONES[r.rarity] }}
                    />
                    <button type="button" className="av-shop-item-action av-shop-item-action--danger" onClick={() => removeRarity(i, ri)}>×</button>
                  </div>
                ))}
                <button type="button" className="av-se-add" onClick={() => addRarity(i)}>+ Rarity</button>
              </div>
            </article>
          );
        })}
      </div>

      {dirty && (
        <div className="av-luckbox-savebar">
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setWorking(tiers)} disabled={busy}>Reset</button>
          <button type="button" className="av-btn av-btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save all tier changes'}
          </button>
        </div>
      )}
    </section>
  );
}
