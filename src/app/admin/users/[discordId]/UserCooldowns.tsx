'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminDelete, adminGet } from '@/lib/admin/http';
import { useToast } from '../../_components/Toast';
import { usePendingAction } from '../../_components/PendingActionProvider';

interface Cooldown {
  key: string;
  action: string;
  label: string;
  triggeredAt: number;
  expiresAt: number;
  remainingMs: number;
  durationMs: number;
  active: boolean;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Ready';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function UserCooldowns({ discordId }: { discordId: string }) {
  const toast = useToast();
  const pending = usePendingAction();
  const [cooldowns, setCooldowns] = useState<Cooldown[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await adminGet<{ cooldowns?: Cooldown[] }>(`/api/admin/users/${discordId}/cooldowns`);
      setCooldowns(body?.cooldowns ?? []);
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [discordId, toast]);

  useEffect(() => { void load(); }, [load]);

  const clearOne = (cd: Cooldown) => {
    pending.queue({
      label: `Clear ${cd.label} cooldown`,
      detail: `User will be able to use /${cd.action} immediately`,
      delayMs: 4500,
      tone: 'danger',
      run: async () => {
        try {
          await adminDelete(`/api/admin/users/${discordId}/cooldowns`, { body: { key: cd.key } });
          toast.show({ tone: 'success', title: 'Cleared', message: cd.label });
          void load();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Clear failed', message: (e as Error).message });
        }
      },
    });
  };

  const clearAll = () => {
    const activeCount = cooldowns.filter(c => c.active).length;
    if (activeCount === 0) {
      toast.show({ tone: 'info', title: 'Nothing to clear', message: 'No active cooldowns.' });
      return;
    }
    pending.queue({
      label: `Clear all cooldowns (${activeCount})`,
      detail: 'User will be able to use all commands immediately',
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        try {
          const body = await adminDelete<{ deletedCount?: number }>(`/api/admin/users/${discordId}/cooldowns`, { body: {} });
          const deleted = body?.deletedCount ?? 0;
          toast.show({ tone: 'success', title: 'All cleared', message: `${deleted} cooldown${deleted === 1 ? '' : 's'}` });
          void load();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Clear failed', message: (e as Error).message });
        }
      },
    });
  };

  const visible = showInactive ? cooldowns : cooldowns.filter(c => c.active);
  const activeCount = cooldowns.filter(c => c.active).length;

  return (
    <section className="av-surface">
      <header className="av-flows-head">
        <div>
          <h3>Cooldowns</h3>
          <p>Rate-limits preventing this user from re-using commands. Clear any to let them retry immediately.</p>
        </div>
        <div className="av-flows-actions" style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="av-btn av-btn-ghost" onClick={load} disabled={loading}>
            {loading ? '…' : '↻'}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--av-text-sm)' }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show expired
          </label>
          {activeCount > 0 && (
            <button type="button" className="av-btn av-btn-primary av-btn-danger" onClick={clearAll}>
              Clear all ({activeCount})
            </button>
          )}
        </div>
      </header>

      {loading && <div className="av-flows-empty">Loading cooldowns…</div>}
      {!loading && visible.length === 0 && (
        <div className="av-flows-empty">
          {showInactive ? 'No cooldowns on record.' : 'No active cooldowns — user can use all commands.'}
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="av-cooldown-grid">
          {visible.map((cd) => {
            const progress = cd.durationMs > 0 ? Math.max(0, Math.min(100, ((cd.durationMs - cd.remainingMs) / cd.durationMs) * 100)) : 100;
            return (
              <div key={cd.key} className={`av-cooldown-card${cd.active ? '' : ' av-cooldown-card--expired'}`}>
                <div className="av-cooldown-head">
                  <strong>{cd.label}</strong>
                  <span className="av-cooldown-state">{cd.active ? formatRemaining(cd.remainingMs) : 'Expired'}</span>
                </div>
                <div className="av-cooldown-progress">
                  <div className="av-cooldown-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="av-cooldown-meta">
                  <span className="av-cooldown-action">/{cd.action}</span>
                  <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => clearOne(cd)}>
                    Clear
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
