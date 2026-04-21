'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Surface from '../_components/Surface';
import Icon from '../_components/Icon';
import StatCard from '../_components/StatCard';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import LogTailDrawer from './LogTailDrawer';

type TabId = 'bots' | 'server' | 'deploy';

const TABS: { id: TabId; label: string; icon: 'bot' | 'server' | 'rocket' }[] = [
  { id: 'bots',   label: 'Bots',   icon: 'bot' },
  { id: 'server', label: 'Server', icon: 'server' },
  { id: 'deploy', label: 'Deploy', icon: 'rocket' },
];

interface PmProcess {
  name: string;
  pm_id?: number;
  status?: string;
  pm2_env?: { status?: string; pm_uptime?: number; env?: string };
  uptime?: number;
  memory?: number;
  cpu?: number;
  restarts?: number;
}

interface AgentHealth {
  online: boolean;
  uptime?: number;
  hostname?: string;
  version?: string;
}

interface DeployRecord {
  _id: string;
  project: string;
  status: string;
  triggeredBy: string;
  triggeredAt: string;
  completedAt?: string | null;
  duration?: number | null;
  steps?: Array<{ name: string; status: string; error?: string }>;
}

const FRIENDLY: Record<string, string> = {
  butler: 'Luna Butler', 'luna-butler': 'Luna Butler', lunabutler: 'Luna Butler', lunabutlermain: 'Luna Butler',
  jester: 'Luna Jester', 'luna-jester': 'Luna Jester', lunajester: 'Luna Jester', lunajestermain: 'Luna Jester',
  oracle: 'Luna Oracle', 'luna-oracle': 'Luna Oracle', lunaoracle: 'Luna Oracle',
  sage: 'Luna Sage', 'luna-sage': 'Luna Sage', lunasage: 'Luna Sage',
  'luna-agent': 'VPS Agent',
};

const DEPLOY_PROJECTS = [
  { id: 'butler', name: 'Luna Butler', desc: 'Economy, leveling, profiles' },
  { id: 'jester', name: 'Luna Jester', desc: 'Cards, games, vendors' },
  { id: 'oracle', name: 'Luna Oracle', desc: 'Staff announcements' },
  { id: 'sage',   name: 'Luna Sage',   desc: 'AI assistant' },
];

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

function fmtUptime(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return '—';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtAgentUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h ${m}m`;
  return `${h}h ${m}m`;
}

function fmtRel(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

function fmtDuration(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function OpsClient() {
  const [tab, setTab] = useState<TabId>('bots');
  const [processes, setProcesses] = useState<PmProcess[]>([]);
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [connState, setConnState] = useState<'loading' | 'online' | 'offline' | 'auth-error'>('loading');
  const [deploys, setDeploys] = useState<DeployRecord[]>([]);
  const [loadingDeploys, setLoadingDeploys] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchStatus = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const hr = await fetch('/api/admin/server/health', { signal: ctrl.signal, cache: 'no-store' });
      if (hr.status === 401 || hr.status === 403) { setConnState('auth-error'); return; }
      if (!hr.ok) { setConnState('offline'); return; }
      const hData = await hr.json();
      setHealth(hData);
      setConnState('online');

      const sr = await fetch('/api/admin/server/status', { signal: ctrl.signal, cache: 'no-store' });
      if (sr.ok) setProcesses((await sr.json()).processes ?? []);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setConnState('offline');
    }
  }, []);

  const fetchDeploys = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/deploy', { cache: 'no-store' });
      if (r.ok) setDeploys((await r.json()).deploys ?? []);
    } catch {
      /* silent */
    } finally {
      setLoadingDeploys(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    void fetchDeploys();
    const id = window.setInterval(fetchStatus, 20_000);
    return () => { window.clearInterval(id); abortRef.current?.abort(); };
  }, [fetchStatus, fetchDeploys]);

  const online = processes.filter((p) => (p.pm2_env?.status ?? p.status) === 'online').length;
  const totalMem = processes.reduce((s, p) => s + (p.memory ?? 0), 0);

  return (
    <>
      <div className="av-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            data-active={tab === t.id}
            className="av-tab"
            onClick={() => setTab(t.id)}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {connState === 'auth-error' && (
        <div className="av-ops-banner av-ops-banner--err">🔒 Not authorized. Sign in as a Mastermind to manage the server.</div>
      )}
      {connState === 'offline' && (
        <div className="av-ops-banner av-ops-banner--err">
          VPS Agent unreachable. Ensure <code>luna-agent</code> is running.
          <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => void fetchStatus()}>Retry</button>
        </div>
      )}

      {tab === 'bots' && (
        <BotsView
          processes={processes}
          online={online}
          totalMem={totalMem}
          loading={connState === 'loading'}
          onAction={() => void fetchStatus()}
        />
      )}
      {tab === 'server' && (
        <ServerView
          health={health}
          processes={processes}
          online={online}
          totalMem={totalMem}
        />
      )}
      {tab === 'deploy' && (
        <DeployView
          deploys={deploys}
          loading={loadingDeploys}
          onDeployed={() => void fetchDeploys()}
        />
      )}
    </>
  );
}

function BotsView({
  processes, online, totalMem, loading, onAction,
}: {
  processes: PmProcess[]; online: number; totalMem: number; loading: boolean; onAction: () => void;
}) {
  const toast = useToast();
  const pending = usePendingAction();
  const [actingOn, setActingOn] = useState<string | null>(null);
  // Log drawer — one-at-a-time. Stores the PM2 process name, not the friendly label.
  const [viewingLogs, setViewingLogs] = useState<{ name: string; display: string } | null>(null);

  async function run(action: 'restart' | 'stop' | 'start', name: string) {
    const tone = action === 'stop' ? 'danger' : 'default';
    const label = `${action[0].toUpperCase() + action.slice(1)} ${name}`;
    // Stop gets a longer countdown + louder copy since it takes a bot offline.
    const isStop = action === 'stop';
    await pending.queue({
      label,
      detail: isStop
        ? `Takes ${name} offline immediately — players lose connection until started again`
        : `PM2 will ${action} the ${name} process`,
      delayMs: isStop ? 6000 : 4000,
      tone,
      run: async () => {
        setActingOn(name);
        try {
          const token = await fetchCsrf();
          const res = await fetch(`/api/admin/server/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
            credentials: 'include',
            body: JSON.stringify({ name }),
          });
          if (!res.ok) {
            const b = await res.json().catch(() => ({}));
            throw new Error(b?.error || `HTTP ${res.status}`);
          }
          toast.show({ tone: 'success', title: 'Done', message: `${label} · refreshing in 2s` });
          window.setTimeout(onAction, 2000);
        } catch (e) {
          toast.show({ tone: 'error', title: `${label} failed`, message: (e as Error).message });
        } finally {
          setActingOn(null);
        }
      },
    });
  }

  if (loading) {
    return <Surface title="Bot Fleet" icon="bot" meta="Loading…"><div className="av-flows-empty">Checking PM2…</div></Surface>;
  }

  return (
    <>
      <div className="av-stat-grid">
        <StatCard label="Bots Online"   icon="bot"    tone="green"  value={`${online} / ${processes.length}`} meta={online === processes.length ? 'All systems nominal' : 'Check offline procs'} />
        <StatCard label="Total Memory"  icon="server" tone="purple" value={`${(totalMem / 1024 / 1024).toFixed(0)} MB`} meta="Across all PM2 procs" />
        <StatCard label="Avg CPU"       icon="trending" tone="cyan" value={`${(processes.reduce((s, p) => s + (p.cpu ?? 0), 0) / Math.max(1, processes.length)).toFixed(1)}%`} meta="Current instant" />
        <StatCard label="PM2 Procs"     icon="bot"    tone="gold"   value={String(processes.length)} meta={`${processes.length - online} offline`} />
      </div>

      <Surface title="Bot Fleet" icon="bot" meta="PM2 managed · auto-refresh 20s">
        {processes.length === 0 ? (
          <div className="av-flows-empty">No PM2 processes reported.</div>
        ) : (
          <div className="av-process-grid">
            {processes.map((p) => {
              const status = (p.pm2_env?.status ?? p.status ?? 'unknown').toLowerCase();
              const name = FRIENDLY[p.name?.toLowerCase()] ?? p.name;
              const uptimeMs = p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : (p.uptime ?? 0);
              const isActing = actingOn === p.name;
              return (
                <div key={p.name} className="av-process" data-state={status}>
                  <div className="av-process-head">
                    <div className="av-process-name">{name}</div>
                    <span className="av-process-state">
                      <span className="av-process-state-dot" />
                      {status}
                    </span>
                  </div>
                  <div className="av-process-metrics">
                    <div className="av-process-metric">
                      <div className="av-process-metric-label">Uptime</div>
                      <div className="av-process-metric-value">{status === 'online' ? fmtUptime(uptimeMs) : '—'}</div>
                    </div>
                    <div className="av-process-metric">
                      <div className="av-process-metric-label">CPU</div>
                      <div className="av-process-metric-value">{(p.cpu ?? 0).toFixed(1)}%</div>
                    </div>
                    <div className="av-process-metric">
                      <div className="av-process-metric-label">Memory</div>
                      <div className="av-process-metric-value">{p.memory ? `${Math.round(p.memory / 1024 / 1024)} MB` : '—'}</div>
                    </div>
                    <div className="av-process-metric">
                      <div className="av-process-metric-label">Restarts</div>
                      <div className="av-process-metric-value">{p.restarts ?? 0}</div>
                    </div>
                  </div>
                  <div className="av-process-actions">
                    {status === 'online' ? (
                      <>
                        <button type="button" className="av-process-action" disabled={isActing} onClick={() => void run('restart', p.name)}>Restart</button>
                        <button type="button" className="av-process-action av-process-action--danger" disabled={isActing} onClick={() => void run('stop', p.name)}>Stop</button>
                      </>
                    ) : (
                      <button type="button" className="av-process-action" disabled={isActing} onClick={() => void run('start', p.name)}>Start</button>
                    )}
                    <button
                      type="button"
                      className="av-process-action av-process-action--ghost"
                      onClick={() => setViewingLogs({ name: p.name, display: name })}
                      title="Tail live logs (auto-refresh 5s)"
                    >Logs</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Surface>

      <LogTailDrawer
        processName={viewingLogs?.name ?? null}
        displayName={viewingLogs?.display ?? ''}
        onClose={() => setViewingLogs(null)}
      />
    </>
  );
}

function ServerView({ health, processes, online, totalMem }: { health: AgentHealth | null; processes: PmProcess[]; online: number; totalMem: number; }) {
  return (
    <>
      <div className="av-stat-grid">
        <StatCard label="VPS Agent"    icon="server"   tone={health?.online ? 'green' : 'red'} value={health?.online ? 'Online' : 'Offline'} meta={health?.online ? fmtAgentUptime(health.uptime ?? 0) : 'Unreachable'} />
        <StatCard label="PM2 Procs"    icon="bot"      tone="cyan"   value={`${processes.length}`} meta={`${online} online · ${processes.length - online} offline`} />
        <StatCard label="Total Memory" icon="server"   tone="purple" value={`${(totalMem / 1024 / 1024).toFixed(0)} MB`} meta="Across all procs" />
        <StatCard label="Avg Uptime"   icon="trending" tone="gold"   value={fmtUptime(processes.reduce((s, p) => s + (p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0), 0) / Math.max(1, processes.length))} meta="Median across fleet" />
      </div>

      <Surface title="VPS Snapshot" icon="server" meta={health?.hostname ? `${health.hostname}` : 'luna-agent'}>
        <div className="av-ops-metric-grid">
          <OpsMetric label="Agent uptime" value={health?.uptime ? fmtAgentUptime(health.uptime) : '—'} />
          <OpsMetric label="Agent version" value={health?.version ?? '—'} />
          <OpsMetric label="Hostname" value={health?.hostname ?? '—'} />
          <OpsMetric label="Connection" value={health?.online ? 'connected' : 'disconnected'} />
        </div>
      </Surface>
    </>
  );
}

function DeployView({ deploys, loading, onDeployed }: { deploys: DeployRecord[]; loading: boolean; onDeployed: () => void; }) {
  const toast = useToast();
  const pending = usePendingAction();
  const [deploying, setDeploying] = useState<string | null>(null);

  const last24 = deploys.filter((d) => Date.now() - new Date(d.triggeredAt).getTime() < 86_400_000);
  const successCount = last24.filter((d) => d.status === 'success' || d.status === 'ok').length;
  const failedCount = last24.filter((d) => d.status === 'failed').length;
  const avgDur = deploys.filter((d) => d.duration).reduce((s, d) => s + (d.duration ?? 0), 0) / Math.max(1, deploys.filter((d) => d.duration).length);
  const successRate = deploys.length > 0 ? Math.round((deploys.filter((d) => d.status === 'success' || d.status === 'ok').length / deploys.length) * 100) : 0;

  async function trigger(projectId: string, projectName: string) {
    await pending.queue({
      label: `Deploy ${projectName}`,
      detail: 'VPS will pull latest, install, build, restart PM2',
      delayMs: 5000,
      run: async () => {
        setDeploying(projectId);
        try {
          const token = await fetchCsrf();
          const res = await fetch('/api/admin/deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
            credentials: 'include',
            body: JSON.stringify({ project: projectId }),
          });
          if (!res.ok) {
            const b = await res.json().catch(() => ({}));
            throw new Error(b?.error || `HTTP ${res.status}`);
          }
          const data = await res.json();
          toast.show({ tone: 'success', title: 'Deploy triggered', message: `${projectName} · ${data.status ?? 'started'}` });
          onDeployed();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Deploy failed', message: (e as Error).message });
        } finally {
          setDeploying(null);
        }
      },
    });
  }

  return (
    <>
      <div className="av-stat-grid">
        <StatCard label="Last 24h"     icon="rocket"   tone="cyan"   value={String(last24.length)}  meta={`${successCount} success · ${failedCount} failed`} />
        <StatCard label="Avg Duration" icon="trending" tone="purple" value={avgDur ? fmtDuration(avgDur) : '—'} meta="across recent deploys" />
        <StatCard label="Success Rate" icon="shield"   tone="green"  value={`${successRate}%`} meta={`${deploys.length} total`} />
        <StatCard label="Rate Limit"   icon="settings" tone="gold"   value="3 / 5min" meta="Per Mastermind" />
      </div>

      <Surface title="Trigger Deploy" icon="rocket" meta="VPS agent + git push">
        <div className="av-ops-deploy-grid">
          {DEPLOY_PROJECTS.map((p) => {
            const last = deploys.find((d) => d.project === p.id);
            const isDeploying = deploying === p.id;
            return (
              <div key={p.id} className="av-ops-deploy-card">
                <div className="av-ops-deploy-name">{p.name}</div>
                <div className="av-ops-deploy-desc">{p.desc}</div>
                <div className="av-ops-deploy-last">
                  {last ? (
                    <>
                      <span className={`av-ops-deploy-pill av-ops-deploy-pill--${last.status === 'success' || last.status === 'ok' ? 'ok' : last.status === 'failed' ? 'err' : 'mid'}`}>
                        {last.status}
                      </span>
                      <span>{fmtRel(last.triggeredAt)}</span>
                    </>
                  ) : (
                    <span className="av-ops-deploy-none">No deploys yet</span>
                  )}
                </div>
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  disabled={isDeploying}
                  onClick={() => void trigger(p.id, p.name)}
                >
                  {isDeploying ? 'Deploying…' : 'Deploy'}
                </button>
              </div>
            );
          })}
        </div>
      </Surface>

      <Surface title="Deploy History" icon="rocket" meta={loading ? 'Loading…' : `Last ${deploys.length}`}>
        {loading ? (
          <div className="av-flows-empty">Loading history…</div>
        ) : deploys.length === 0 ? (
          <div className="av-flows-empty">No deploys recorded yet.</div>
        ) : (
          <div className="av-list">
            {deploys.map((d) => {
              const ok = d.status === 'success' || d.status === 'ok';
              const tone = ok ? 'var(--av-success)' : d.status === 'failed' ? 'var(--av-danger)' : 'var(--av-warning)';
              return (
                <div className="av-list-row" key={d._id}>
                  <div className="av-list-avatar" style={{ background: `color-mix(in srgb, ${tone} 25%, transparent)`, color: tone, borderColor: `color-mix(in srgb, ${tone} 50%, transparent)` }}>
                    {d.project.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="av-list-name" style={{ textTransform: 'capitalize' }}>{d.project}</div>
                    <div className="av-list-sub">{d.triggeredBy} · {fmtDuration(d.duration)}</div>
                  </div>
                  <span className="av-list-amount" style={{ color: tone, background: `color-mix(in srgb, ${tone} 12%, transparent)` }}>{d.status}</span>
                  <span className="av-list-time">{fmtRel(d.triggeredAt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Surface>
    </>
  );
}

function OpsMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="av-ops-metric">
      <div className="av-ops-metric-label">{label}</div>
      <div className="av-ops-metric-value">{value}</div>
    </div>
  );
}
