'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';

const PRESETS = [
  { label: '1 hour', ms: 3_600_000 },
  { label: '6 hours', ms: 21_600_000 },
  { label: '12 hours', ms: 43_200_000 },
  { label: '24 hours', ms: 86_400_000 },
  { label: '48 hours', ms: 172_800_000 },
  { label: '72 hours', ms: 259_200_000 },
];

const DEFAULT_DURATION = 86_400_000;

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function saveSection(section: string, value: any): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/config/jester', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ section, value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export default function TradingConfigPanel() {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [saved, setSaved] = useState(DEFAULT_DURATION);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config/jester', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const tc = body.sections?.trade_config ?? {};
      const dur = typeof tc.auction_duration_ms === 'number' ? tc.auction_duration_ms : DEFAULT_DURATION;
      setSaved(dur);
      setDuration(dur);
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const dirty = duration !== saved;

  const save = () => {
    if (!dirty) return;
    const before = saved;
    pending.queue({
      label: 'Save auction duration',
      detail: `New auctions will run for ${formatDuration(duration)}. Existing auctions unaffected.`,
      delayMs: 4500,
      run: async () => {
        try {
          await saveSection('trade', duration);
          setSaved(duration);
          toast.show({ tone: 'success', title: 'Saved', message: `Auction duration: ${formatDuration(duration)}` });
          undo.push({
            label: 'Restore previous auction duration',
            detail: formatDuration(before),
            revert: async () => {
              await saveSection('trade', before);
              setSaved(before);
              setDuration(before);
              toast.show({ tone: 'success', title: 'Reverted', message: `Restored to ${formatDuration(before)}` });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const setPreset = (ms: number) => setDuration(ms);

  const hours = Math.round(duration / 3600_000 * 10) / 10;

  return (
    <article className="av-surface av-trading-config">
      <header className="av-flows-head">
        <div>
          <h3>Auction duration</h3>
          <p>How long a card/stone auction stays open after creation. Affects all new auctions from Jester vendors.</p>
        </div>
        <div className="av-flows-actions">
          {dirty && <button type="button" className="av-btn av-btn-ghost" onClick={() => setDuration(saved)}>Discard</button>}
          <button type="button" className="av-btn av-btn-primary" onClick={save} disabled={!dirty || loading}>
            {dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </header>

      {loading && <div className="av-commands-empty">Loading…</div>}

      {!loading && (
        <div className="av-trading-config-body">
          <div className="av-trading-presets">
            {PRESETS.map((p) => (
              <button
                key={p.ms}
                type="button"
                className={`av-btn ${duration === p.ms ? 'av-btn-primary' : 'av-btn-ghost'}`}
                onClick={() => setPreset(p.ms)}
              >{p.label}</button>
            ))}
          </div>

          <div className="av-trading-custom">
            <span className="av-games-field-sublabel">Custom (hours)</span>
            <input
              type="number"
              min={0.016}
              step={0.5}
              className="av-shopf-input"
              value={hours}
              onChange={(e) => {
                const h = Number(e.target.value);
                if (isFinite(h) && h > 0) setDuration(Math.round(h * 3600_000));
              }}
            />
            <strong className="av-trading-current">= {formatDuration(duration)} ({duration.toLocaleString()} ms)</strong>
          </div>
        </div>
      )}
    </article>
  );
}
