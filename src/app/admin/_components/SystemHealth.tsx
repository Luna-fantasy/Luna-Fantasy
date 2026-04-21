'use client';

import { useEffect, useState } from 'react';

interface PmProcess {
  name: string;
  pm2_env?: { status?: string; pm_uptime?: number };
  status?: string;
  uptime?: number;
  memory?: number;
  cpu?: number;
}

interface Snapshot {
  processes: PmProcess[];
  fetchedAt: number;
}

const FRIENDLY_NAMES: Record<string, string> = {
  butler: 'Butler',
  'luna-butler': 'Butler',
  jester: 'Jester',
  'luna-jester': 'Jester',
  oracle: 'Oracle',
  'luna-oracle': 'Oracle',
  sage: 'Sage',
  'luna-sage': 'Sage',
};

function fmtUptime(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return '—';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SystemHealth() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch('/api/admin/server/status', { cache: 'no-store' });
        if (!res.ok) throw new Error(res.status === 502 ? 'VPS agent unreachable' : `HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setSnap({ processes: data.processes ?? [], fetchedAt: Date.now() });
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchOnce();
    const t = window.setInterval(fetchOnce, 20_000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, []);

  if (loading && !snap) {
    return <div className="av-flows-empty">Checking VPS agent…</div>;
  }

  if (error) {
    return (
      <div className="av-health-error">
        <span className="av-health-dot av-health-dot--err" />
        <div>
          <strong>VPS agent unreachable</strong>
          <small>{error}</small>
        </div>
      </div>
    );
  }

  const processes = snap?.processes ?? [];
  if (processes.length === 0) {
    return <div className="av-flows-empty">No processes reported by PM2.</div>;
  }

  return (
    <div className="av-health-grid">
      {processes.slice(0, 8).map((p, i) => {
        const status = p.pm2_env?.status ?? p.status ?? 'unknown';
        const uptime = p.pm2_env?.pm_uptime
          ? Date.now() - p.pm2_env.pm_uptime
          : (p.uptime ?? 0);
        const label = FRIENDLY_NAMES[p.name?.toLowerCase()] ?? p.name;
        const tone = status === 'online' ? 'ok' : status === 'stopped' ? 'err' : 'warn';
        return (
          <div key={`${p.name}-${i}`} className={`av-health-tile av-health-tile--${tone}`}>
            <div className="av-health-tile-head">
              <span className="av-health-tile-name">{label}</span>
              <span className={`av-health-dot av-health-dot--${tone}`} />
            </div>
            <div className="av-health-tile-meta">
              <span>{fmtUptime(uptime)}</span>
              {typeof p.memory === 'number' && <span>{Math.round(p.memory / 1024 / 1024)}M</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
