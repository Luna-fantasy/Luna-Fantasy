'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import DeployStepper from './components/DeployStepper';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';

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
  steps: Array<{ name: string; status: string; error?: string }>;
  startedAt: string;
  completedAt?: string;
}

const PROJECTS = [
  { id: 'butler', name: 'Luna Butler', desc: 'Economy, leveling, profiles' },
  { id: 'jester', name: 'Luna Jester', desc: 'Cards, games, vendors' },
  { id: 'oracle', name: 'Luna Oracle', desc: 'Staff announcements' },
  { id: 'sage', name: 'Luna Sage', desc: 'AI assistant' },
];

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function formatDuration(start: string, end?: string): string {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function DeployPage() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [confirmDeploy, setConfirmDeploy] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [currentDeploy, setCurrentDeploy] = useState<DeployStatus | null>(null);
  const [history, setHistory] = useState<DeployRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);
  const pollFailCountRef = useRef(0);
  const { toast } = useToast();

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/deploy');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.deploys || []);
      }
    } catch {
      toast('Failed to fetch deploy history', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Poll deploy status
  useEffect(() => {
    if (!deploying || !selectedProject) return;

    pollRef.current = setInterval(async () => {
      pollCountRef.current++;
      if (pollCountRef.current > 150) {
        setDeploying(false);
        toast('Deploy timed out — check VPS status manually', 'error');
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }

      try {
        const res = await fetch(`/api/admin/deploy/status?project=${selectedProject}`);
        if (res.ok) {
          pollFailCountRef.current = 0;
          const data = await res.json();
          if (data.status) {
            setCurrentDeploy(data);
            if (data.status === 'success' || data.status === 'failed') {
              setDeploying(false);
              if (data.status === 'success') {
                toast('Deploy completed successfully!', 'success');
              } else {
                toast('Deploy failed. Check the error details.', 'error');
              }
              fetchHistory();
            }
          }
        }
      } catch {
        pollFailCountRef.current++;
        if (pollFailCountRef.current >= 3) {
          toast('Failed to reach deploy status API', 'error');
          pollFailCountRef.current = 0;
        }
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [deploying, selectedProject, toast, fetchHistory]);

  async function triggerDeploy() {
    if (!selectedProject) return;
    setConfirmDeploy(false);
    setDeploying(true);
    pollCountRef.current = 0;
    pollFailCountRef.current = 0;
    setCurrentDeploy({
      deployId: 'pending',
      project: selectedProject,
      status: 'running',
      steps: [
        { name: 'Git Push', status: 'pending' },
        { name: 'VPS Pull', status: 'pending' },
        { name: 'Install', status: 'pending' },
        { name: 'Build', status: 'pending' },
        { name: 'Restart', status: 'pending' },
        { name: 'Verify', status: 'pending' },
      ],
      startedAt: new Date().toISOString(),
    });

    try {
      const res = await fetch('/api/admin/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ project: selectedProject }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast(data.error || 'Failed to trigger deploy', 'error');
        setDeploying(false);
        setCurrentDeploy(null);
      }
    } catch {
      toast('Failed to trigger deploy', 'error');
      setDeploying(false);
      setCurrentDeploy(null);
    }
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">🚀</span> Deploy Pipeline</h1>
        <p className="admin-page-subtitle">Automated deployment to VPS with real-time progress</p>
      </div>

      {/* Project selector */}
      <div className="admin-config-grid" style={{ marginBottom: '32px' }}>
        {PROJECTS.map((proj) => {
          const lastDeploy = history.find((h) => h.project === proj.id);
          return (
            <div
              key={proj.id}
              className={`admin-deploy-card ${selectedProject === proj.id ? 'admin-deploy-card-active' : ''}`}
              onClick={() => !deploying && setSelectedProject(proj.id)}
            >
              <div className="admin-deploy-card-name">{proj.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>{proj.desc}</div>
              <div className="admin-deploy-card-status">
                {lastDeploy ? (
                  <>
                    <span className={`admin-badge ${lastDeploy.status === 'success' ? 'admin-badge-success' : lastDeploy.status === 'failed' ? 'admin-badge-error' : 'admin-badge-muted'}`}>
                      {lastDeploy.status}
                    </span>
                    <span style={{ marginLeft: '6px' }}>
                      {new Date(lastDeploy.triggeredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                  </>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>No deploys</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Deploy button */}
      {selectedProject && !deploying && (
        <div style={{ marginBottom: '24px' }}>
          <button
            className="admin-btn admin-btn-primary admin-btn-lg"
            onClick={() => setConfirmDeploy(true)}
          >
            <span className="emoji-bounce-hover">🚀</span> Deploy {PROJECTS.find((p) => p.id === selectedProject)?.name}
          </button>
        </div>
      )}

      {/* Active deploy stepper */}
      {currentDeploy && (
        <div className="admin-card" style={{ marginBottom: '24px' }}>
          <h3 className="admin-card-title" style={{ marginBottom: '4px' }}>
            Deploying: {PROJECTS.find((p) => p.id === currentDeploy.project)?.name}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Started {formatDuration(currentDeploy.startedAt)} ago
          </p>
          <DeployStepper steps={currentDeploy.steps as any} />

          {currentDeploy.status === 'failed' && (
            <div className="admin-alert admin-alert-error" style={{ marginTop: '16px' }}>
              The deployment failed. Check the error above and contact the developer if needed.
            </div>
          )}
          {currentDeploy.status === 'success' && (
            <div className="admin-alert admin-alert-success" style={{ marginTop: '16px' }}>
              Deployment completed successfully!
            </div>
          )}
        </div>
      )}

      {/* Deploy history */}
      <div className="admin-card">
        <h3 className="admin-card-title" style={{ marginBottom: '16px' }}>Deploy History</h3>
        {loading ? (
          <div className="admin-loading"><div className="admin-spinner" />Loading...</div>
        ) : history.length === 0 ? (
          <div className="admin-empty" style={{ padding: '24px' }}><p>No deploy history</p></div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Triggered By</th>
                  <th>Date</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {history.map((d) => (
                  <tr key={d._id}>
                    <td style={{ fontWeight: 500 }}>{d.project}</td>
                    <td>
                      <span className={`admin-badge ${d.status === 'success' ? 'admin-badge-success' : d.status === 'failed' ? 'admin-badge-error' : 'admin-badge-muted'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td>{d.triggeredBy}</td>
                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {new Date(d.triggeredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                      {new Date(d.triggeredAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>{d.completedAt ? formatDuration(d.triggeredAt, d.completedAt) : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDeploy && selectedProject && (
        <ConfirmModal
          title="Confirm Deploy"
          message={`This will deploy ${PROJECTS.find((p) => p.id === selectedProject)?.name} to the VPS. The bot will restart during this process.`}
          confirmLabel="Deploy Now"
          variant="primary"
          onConfirm={triggerDeploy}
          onCancel={() => setConfirmDeploy(false)}
        />
      )}
    </>
  );
}
