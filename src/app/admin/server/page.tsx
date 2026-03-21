'use client';

import { useState, useEffect, useCallback } from 'react';
import ProcessCard from './components/ProcessCard';
import LogViewer from './components/LogViewer';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';

interface Process {
  name: string;
  pm_id: number;
  status: string;
  cpu: number;
  memory: number;
  uptime: number;
  restarts: number;
  pid: number;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function ServerPage() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [agentUptime, setAgentUptime] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ action: string; name: string } | null>(null);
  const [logProcess, setLogProcess] = useState<string | null>(null);
  const [logs, setLogs] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);
  const { toast } = useToast();

  const fetchStatus = useCallback(async () => {
    try {
      const [healthRes, statusRes] = await Promise.all([
        fetch('/api/admin/server/health'),
        fetch('/api/admin/server/status'),
      ]);

      if (healthRes.ok) {
        const health = await healthRes.json();
        setAgentOnline(true);
        setAgentUptime(health.uptime || 0);
      } else {
        setAgentOnline(false);
      }

      if (statusRes.ok) {
        const data = await statusRes.json();
        setProcesses(data.processes || []);
      }
    } catch {
      setAgentOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  async function handleAction(action: 'restart' | 'stop' | 'start', name: string) {
    setActing(true);
    setConfirmAction(null);
    try {
      const res = await fetch(`/api/admin/server/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        toast(`${action.charAt(0).toUpperCase() + action.slice(1)}ed ${name}`, 'success');
        setTimeout(fetchStatus, 2000);
      } else {
        const data = await res.json();
        toast(data.error || `${action} failed`, 'error');
      }
    } catch {
      toast(`Failed to ${action} ${name}`, 'error');
    } finally {
      setActing(false);
    }
  }

  const fetchLogs = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/admin/server/logs?name=${encodeURIComponent(name)}&lines=200`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || 'No logs available');
      } else {
        setLogs('Failed to fetch logs');
      }
    } catch {
      setLogs('Failed to fetch logs');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  async function handleViewLogs(name: string) {
    setLogProcess(name);
    setLogsLoading(true);
    setLogs('');
    fetchLogs(name);
  }

  function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h ${m}m`;
    return `${h}h ${m}m`;
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">🖥️</span> Server Management</h1>
        <p className="admin-page-subtitle">VPS bot process management via PM2</p>
      </div>

      {/* Connection banner */}
      {agentOnline !== null && (
        <div className={`admin-connection-banner ${agentOnline ? 'admin-connection-banner-connected' : 'admin-connection-banner-disconnected'}`}>
          <span style={{ fontSize: '16px' }}>{agentOnline ? '\u2713' : '\u2717'}</span>
          {agentOnline
            ? `VPS Agent connected (uptime: ${formatUptime(agentUptime)})`
            : 'VPS Agent unreachable. Ensure luna-agent is running on the VPS.'}
        </div>
      )}

      {loading ? (
        <div className="admin-loading"><div className="admin-spinner" />Loading processes...</div>
      ) : !agentOnline ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">&times;</div>
          <p>Cannot connect to VPS agent. Check that the agent is running and VPS_AGENT_KEY is configured.</p>
        </div>
      ) : processes.length === 0 ? (
        <div className="admin-empty">
          <p>No PM2 processes found</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {processes.map((p) => (
            <ProcessCard
              key={p.name}
              process={p}
              onRestart={(name) => setConfirmAction({ action: 'restart', name })}
              onStop={(name) => setConfirmAction({ action: 'stop', name })}
              onStart={(name) => handleAction('start', name)}
              onViewLogs={handleViewLogs}
              acting={acting}
            />
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
          logs={logs}
          loading={logsLoading}
          onClose={() => setLogProcess(null)}
          onRefresh={() => fetchLogs(logProcess)}
        />
      )}
    </>
  );
}
