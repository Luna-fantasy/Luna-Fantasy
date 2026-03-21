'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ProcessCard from './components/ProcessCard';
import LogViewer from './components/LogViewer';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import type { Process } from './types';

const ACTION_LABELS: Record<string, string> = {
  restart: 'Restarted',
  stop: 'Stopped',
  start: 'Started',
};

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h ${m}m`;
  return `${h}h ${m}m`;
}

type ConnectionState = 'loading' | 'online' | 'offline' | 'auth-error';

export default function ServerPage() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('loading');
  const [agentUptime, setAgentUptime] = useState<number>(0);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: string; name: string } | null>(null);
  const [logProcess, setLogProcess] = useState<string | null>(null);
  const { toast } = useToast();
  const abortRef = useRef<AbortController | null>(null);

  const fetchStatus = useCallback(async () => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Fetch health first — if it fails, skip status to avoid long hang
      const healthRes = await fetch('/api/admin/server/health', { signal: controller.signal });

      if (healthRes.status === 401 || healthRes.status === 403) {
        setConnectionState('auth-error');
        return;
      }

      if (!healthRes.ok) {
        setConnectionState('offline');
        return;
      }

      const health = await healthRes.json();
      setAgentUptime(health.uptime || 0);
      setConnectionState('online');

      // Only fetch process list if agent is online
      const statusRes = await fetch('/api/admin/server/status', { signal: controller.signal });
      if (statusRes.ok) {
        const data = await statusRes.json();
        setProcesses(data.processes || []);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setConnectionState('offline');
      }
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchStatus]);

  async function handleAction(action: 'restart' | 'stop' | 'start', name: string) {
    setActingOn(name);
    setConfirmAction(null);
    try {
      const res = await fetch(`/api/admin/server/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        toast(`${ACTION_LABELS[action] || action} ${name}`, 'success');
        setTimeout(fetchStatus, 2000);
      } else {
        const data = await res.json();
        toast(data.error || `${action} failed`, 'error');
      }
    } catch {
      toast(`Failed to ${action} ${name}`, 'error');
    } finally {
      setActingOn(null);
    }
  }

  // Memoize log refresh to prevent LogViewer interval resets
  const logProcessRef = useRef<string | null>(null);
  logProcessRef.current = logProcess;

  const handleRefreshLogs = useCallback(async () => {
    const name = logProcessRef.current;
    if (!name) return;
    try {
      const res = await fetch(`/api/admin/server/logs?name=${encodeURIComponent(name)}&lines=200`);
      if (res.ok) {
        const data = await res.json();
        return data.logs || 'No logs available';
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  const onlineCount = processes.filter((p) => p.status === 'online').length;
  const offlineCount = processes.filter((p) => p.status !== 'online').length;

  return (
    <>
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="admin-page-title"><span className="emoji-float">🖥️</span> Server Management</h1>
            <p className="admin-page-subtitle">VPS bot process management via PM2</p>
          </div>
          {connectionState === 'online' && (
            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={fetchStatus} title="Refresh now">
              &#x21bb; Refresh
            </button>
          )}
        </div>
      </div>

      {/* Connection banner */}
      {connectionState === 'auth-error' ? (
        <div className="admin-connection-banner admin-connection-banner-disconnected">
          Not authorized. You must be logged in as a Mastermind to manage the server.
        </div>
      ) : connectionState === 'online' ? (
        <div className="admin-connection-banner admin-connection-banner-connected">
          VPS Agent connected (uptime: {formatUptime(agentUptime)})
        </div>
      ) : connectionState === 'offline' ? (
        <div className="admin-connection-banner admin-connection-banner-disconnected">
          VPS Agent unreachable. Ensure luna-agent is running on the VPS.
        </div>
      ) : null}

      {/* Summary bar */}
      {connectionState === 'online' && processes.length > 0 && (
        <div className="admin-server-summary">
          <div className="admin-server-summary-item">
            <span className="admin-server-summary-value">{processes.length}</span>
            <span className="admin-server-summary-label">Total</span>
          </div>
          <div className="admin-server-summary-item admin-server-summary-online">
            <span className="admin-server-summary-value">{onlineCount}</span>
            <span className="admin-server-summary-label">Online</span>
          </div>
          {offlineCount > 0 && (
            <div className="admin-server-summary-item admin-server-summary-offline">
              <span className="admin-server-summary-value">{offlineCount}</span>
              <span className="admin-server-summary-label">Offline</span>
            </div>
          )}
        </div>
      )}

      {connectionState === 'loading' ? (
        <div className="admin-loading"><div className="admin-spinner" />Loading processes...</div>
      ) : connectionState === 'auth-error' ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">🔒</div>
          <p>Authentication required</p>
          <p className="admin-empty-hint">Sign in with a Mastermind account to access server management.</p>
        </div>
      ) : connectionState === 'offline' ? (
        <div className="admin-server-offline">
          <div className="admin-server-offline-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          </div>
          <p className="admin-server-offline-title">Cannot reach VPS Agent</p>
          <p className="admin-server-offline-hint">
            The agent at the configured VPS address is not responding.<br />
            Check that luna-agent is running and the firewall allows connections.
          </p>
          <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={fetchStatus} style={{ marginTop: '16px' }}>
            &#x21bb; Retry Connection
          </button>
        </div>
      ) : processes.length === 0 ? (
        <div className="admin-empty">
          <p>No PM2 processes found</p>
        </div>
      ) : (
        <div className="admin-process-grid">
          {processes.map((p, i) => (
            <div key={p.name} className="admin-process-card-wrapper" style={{ animationDelay: `${i * 60}ms` }}>
              <ProcessCard
                process={p}
                onRestart={(name) => setConfirmAction({ action: 'restart', name })}
                onStop={(name) => setConfirmAction({ action: 'stop', name })}
                onStart={(name) => handleAction('start', name)}
                onViewLogs={(name) => setLogProcess(name)}
                acting={actingOn === p.name}
              />
            </div>
          ))}
        </div>
      )}

      {confirmAction && (
        <ConfirmModal
          title={`${confirmAction.action.charAt(0).toUpperCase() + confirmAction.action.slice(1)} Process`}
          message={`Are you sure you want to ${confirmAction.action} "${confirmAction.name}"?`}
          confirmLabel={confirmAction.action.charAt(0).toUpperCase() + confirmAction.action.slice(1)}
          variant={confirmAction.action === 'stop' ? 'danger' : 'primary'}
          onConfirm={() => handleAction(confirmAction.action as any, confirmAction.name)}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {logProcess && (
        <LogViewer
          processName={logProcess}
          onClose={() => setLogProcess(null)}
          onFetchLogs={handleRefreshLogs}
        />
      )}
    </>
  );
}
