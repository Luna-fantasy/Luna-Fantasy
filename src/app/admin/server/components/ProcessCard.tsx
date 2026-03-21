'use client';

import StatusDot from '../../components/StatusDot';

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

interface ProcessCardProps {
  process: Process;
  onRestart: (name: string) => void;
  onStop: (name: string) => void;
  onStart: (name: string) => void;
  onViewLogs: (name: string) => void;
  acting: boolean;
}

function formatUptime(ms: number): string {
  if (ms <= 0) return '--';
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${mins}m`;
}

function formatMemory(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ProcessCard({ process: p, onRestart, onStop, onStart, onViewLogs, acting }: ProcessCardProps) {
  const isOnline = p.status === 'online';
  const memoryMB = p.memory / 1024 / 1024;
  const memoryPercent = Math.min((memoryMB / 512) * 100, 100); // assume 512MB max for bar

  return (
    <div className="admin-process-card">
      <div className="admin-process-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <StatusDot color={isOnline ? 'green' : 'red'} pulse={isOnline} />
          <span className="admin-process-name">{p.name}</span>
        </div>
        <span className={`admin-badge ${isOnline ? 'admin-badge-success' : 'admin-badge-error'}`}>
          {p.status.toUpperCase()}
        </span>
      </div>

      <div className="admin-process-stats">
        <div>
          <div className="admin-process-stat-label">CPU</div>
          <div className="admin-process-stat-value">{p.cpu}%</div>
        </div>
        <div>
          <div className="admin-process-stat-label">Memory</div>
          <div className="admin-process-stat-value">{formatMemory(p.memory)}</div>
          <div className="admin-memory-bar">
            <div className="admin-memory-bar-fill" style={{ width: `${memoryPercent}%` }} />
          </div>
        </div>
        <div>
          <div className="admin-process-stat-label">Uptime</div>
          <div className="admin-process-stat-value">{formatUptime(p.uptime)}</div>
        </div>
        <div>
          <div className="admin-process-stat-label">Restarts</div>
          <div className="admin-process-stat-value">{p.restarts}</div>
        </div>
      </div>

      <div className="admin-process-actions">
        {isOnline ? (
          <>
            <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => onRestart(p.name)} disabled={acting}>
              🔄 Restart
            </button>
            <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => onStop(p.name)} disabled={acting}>
              ⛔ Stop
            </button>
          </>
        ) : (
          <button className="admin-btn admin-btn-success admin-btn-sm" onClick={() => onStart(p.name)} disabled={acting}>
            ▶️ Start
          </button>
        )}
        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => onViewLogs(p.name)} disabled={acting}>
          📋 View Logs
        </button>
      </div>
    </div>
  );
}
