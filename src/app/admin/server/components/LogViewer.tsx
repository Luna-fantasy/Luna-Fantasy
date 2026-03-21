'use client';

import { useEffect, useRef } from 'react';
import AdminLightbox from '../../components/AdminLightbox';

interface LogViewerProps {
  processName: string;
  logs: string;
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

function colorLogLine(line: string): string {
  if (/error|ERR|Error/i.test(line)) return 'admin-log-line-error';
  if (/warn|WARN|Warning/i.test(line)) return 'admin-log-line-warn';
  return 'admin-log-line-info';
}

export default function LogViewer({ processName, logs, loading, onClose, onRefresh }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Auto-refresh logs every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      onRefresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [onRefresh]);

  return (
    <AdminLightbox isOpen={true} onClose={onClose} size="xl" showClose={false}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 className="admin-modal-title" style={{ margin: 0 }}>Logs: {processName}</h3>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#4ade80' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#4ade80',
              display: 'inline-block',
              animation: 'admin-live-pulse 1.5s ease-in-out infinite',
            }} />
            Live
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={onRefresh} title="Refresh now">&#x21bb;</button>
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={onClose}>&times;</button>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading"><div className="admin-spinner" />Loading logs...</div>
      ) : (
        <div className="admin-log-viewer" ref={scrollRef}>
          {logs ? (
            logs.split('\n').map((line, i) => (
              <div key={i} className={`admin-log-line ${colorLogLine(line)}`}>{line}</div>
            ))
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>No logs available</div>
          )}
        </div>
      )}
    </AdminLightbox>
  );
}
