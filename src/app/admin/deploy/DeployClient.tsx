'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { useTimezone } from '../_components/TimezoneProvider';
import { onButtonKey } from '../_components/a11y';
import Icon from '../_components/Icon';
import Skeleton from '../_components/Skeleton';
import DeployStepper from './DeployStepper';

interface DeployRecord {
  _id: string;
  project: string;
  status: string;
  triggeredBy: string;
  triggeredAt: string;
  completedAt?: string;
  duration?: number;
}

interface DeployStatus {
  deployId: string;
  project: string;
  status: string;
  steps: Array<{ name: string; status: 'pending' | 'running' | 'done' | 'error'; error?: string }>;
  startedAt: string;
  completedAt?: string;
}

const PROJECTS = [
  { id: 'butler', name: 'Luna Butler', desc: 'Economy, leveling, profiles', tone: 'butler' },
  { id: 'jester', name: 'Luna Jester', desc: 'Cards, games, vendors',        tone: 'jester' },
  { id: 'oracle', name: 'Luna Oracle', desc: 'Staff announcements + voice',  tone: 'oracle' },
  { id: 'sage',   name: 'Luna Sage',   desc: 'AI assistant',                 tone: 'sage'   },
];

function readCsrfCookie(): string {
  const m = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function formatDuration(startIso: string, endIso?: string): string {
  const ms = (endIso ? new Date(endIso).getTime() : Date.now()) - new Date(startIso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

const INITIAL_STEPS: DeployStatus['steps'] = [
  { name: 'Git Push', status: 'pending' },
  { name: 'VPS Pull', status: 'pending' },
  { name: 'Install',  status: 'pending' },
  { name: 'Build',    status: 'pending' },
  { name: 'Restart',  status: 'pending' },
  { name: 'Verify',   status: 'pending' },
];

export default function DeployClient() {
  const toast = useToast();
  const pending = usePendingAction();
  const tz = useTimezone();

  const [selected, setSelected] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [current, setCurrent] = useState<DeployStatus | null>(null);
  const [history, setHistory] = useState<DeployRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const pollFailRef = useRef(0);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/deploy', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.deploys || []);
      }
    } catch {
      toast.show({ tone: 'error', title: 'History', message: 'Failed to fetch deploy history' });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Poll deploy status
  useEffect(() => {
    if (!deploying || !selected) return;

    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current > 150) {
        setDeploying(false);
        toast.show({ tone: 'error', title: 'Deploy timed out', message: 'Check VPS status manually.' });
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      try {
        const res = await fetch(`/api/admin/deploy/status?project=${selected}`, { cache: 'no-store' });
        if (!res.ok) return;
        pollFailRef.current = 0;
        const data = await res.json();
        if (!data?.status) return;
        setCurrent(data);
        if (data.status === 'success' || data.status === 'failed') {
          setDeploying(false);
          toast.show({
            tone: data.status === 'success' ? 'success' : 'error',
            title: data.status === 'success' ? 'Deploy succeeded' : 'Deploy failed',
            message: PROJECTS.find((p) => p.id === data.project)?.name ?? data.project,
          });
          fetchHistory();
        }
      } catch {
        pollFailRef.current += 1;
        if (pollFailRef.current >= 3) {
          toast.show({ tone: 'error', title: 'Status unreachable', message: 'Cannot reach deploy-status API.' });
          pollFailRef.current = 0;
        }
      }
    }, 2000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [deploying, selected, toast, fetchHistory]);

  const triggerDeploy = useCallback(async (projectId: string) => {
    const proj = PROJECTS.find((p) => p.id === projectId);
    if (!proj) return;

    const ok = await pending.queue({
      label: `Deploy ${proj.name}`,
      detail: `Pulls latest, installs, builds, restarts PM2 process. ${proj.name} will be offline for ~30 seconds.`,
      delayMs: 5000,
      tone: 'default',
      run: async () => {
        setDeploying(true);
        pollCountRef.current = 0;
        pollFailRef.current = 0;
        setCurrent({
          deployId: 'pending',
          project: projectId,
          status: 'running',
          steps: INITIAL_STEPS.map((s) => ({ ...s })),
          startedAt: new Date().toISOString(),
        });
        try {
          const res = await fetch('/api/admin/deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': readCsrfCookie() },
            credentials: 'include',
            body: JSON.stringify({ project: projectId }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.show({ tone: 'error', title: 'Trigger failed', message: data.error ?? `HTTP ${res.status}` });
            setDeploying(false);
            setCurrent(null);
          }
        } catch (e) {
          toast.show({ tone: 'error', title: 'Trigger failed', message: (e as Error).message });
          setDeploying(false);
          setCurrent(null);
        }
      },
    });
    if (ok === false) {
      toast.show({ tone: 'warn', title: 'Cancelled', message: `${proj.name} deploy cancelled` });
    }
  }, [pending, toast]);

  return (
    <div className="av-deploy">
      {/* Project picker */}
      <section className="av-surface av-deploy-projects">
        <header className="av-surface-head">
          <h2><Icon name="rocket" /> Pick a bot</h2>
        </header>
        <div className="av-deploy-grid">
          {PROJECTS.map((p) => {
            const last = history.find((h) => h.project === p.id);
            const active = selected === p.id;
            const tone = last?.status === 'success' ? 'success'
                       : last?.status === 'failed' ? 'error'
                       : 'muted';
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                data-active={active}
                data-tone={p.tone}
                className="av-deploy-card"
                onClick={() => !deploying && setSelected(p.id)}
                onKeyDown={onButtonKey(() => !deploying && setSelected(p.id))}
              >
                <div className="av-deploy-card-name">{p.name}</div>
                <div className="av-deploy-card-desc">{p.desc}</div>
                <div className="av-deploy-card-meta">
                  {last ? (
                    <>
                      <span className="av-inbox-status-badge" data-tone={tone}>{last.status}</span>
                      <span className="av-deploy-card-when">{tz.fmtRel(last.triggeredAt)}</span>
                    </>
                  ) : (
                    <span className="av-deploy-card-when">No deploys yet</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {selected && !deploying && (
          <div className="av-deploy-cta">
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => triggerDeploy(selected)}
            >
              <Icon name="rocket" /> Deploy {PROJECTS.find((p) => p.id === selected)?.name}
            </button>
          </div>
        )}
      </section>

      {/* Active deploy progress */}
      {current && (
        <section className="av-surface av-deploy-active">
          <header className="av-surface-head">
            <h2>
              Deploying <strong>{PROJECTS.find((p) => p.id === current.project)?.name}</strong>
            </h2>
            <span className="av-deploy-elapsed">Started {formatDuration(current.startedAt)} ago</span>
          </header>
          <DeployStepper steps={current.steps} />
          {current.status === 'failed' && (
            <div className="av-deploy-alert" data-tone="error">
              Deployment failed. Inspect the step that errored and check the server monitor.
            </div>
          )}
          {current.status === 'success' && (
            <div className="av-deploy-alert" data-tone="success">
              Deployment completed successfully.
            </div>
          )}
        </section>
      )}

      {/* History */}
      <section className="av-surface av-deploy-history">
        <header className="av-surface-head">
          <h2>Deploy history</h2>
        </header>
        {loading ? (
          <Skeleton variant="row" count={5} />
        ) : history.length === 0 ? (
          <div className="av-deploy-empty">No deploy history yet — pick a bot above to kick one off.</div>
        ) : (
          <div className="av-deploy-history-wrap">
            <table className="av-table av-deploy-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Triggered by</th>
                  <th>When</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {history.map((d) => {
                  const tone = d.status === 'success' ? 'success'
                             : d.status === 'failed' ? 'error'
                             : 'muted';
                  return (
                    <tr key={d._id}>
                      <td className="av-deploy-cell-proj">
                        {PROJECTS.find((p) => p.id === d.project)?.name ?? d.project}
                      </td>
                      <td>
                        <span className="av-inbox-status-badge" data-tone={tone}>{d.status}</span>
                      </td>
                      <td>{d.triggeredBy}</td>
                      <td className="av-deploy-cell-when">{tz.absolute(d.triggeredAt)}</td>
                      <td>{d.completedAt ? formatDuration(d.triggeredAt, d.completedAt) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
