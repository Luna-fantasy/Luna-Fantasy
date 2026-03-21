'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AdminLightbox from '../../components/AdminLightbox';
import StatusDot from '../../components/StatusDot';

interface LogViewerProps {
  processName: string;
  onClose: () => void;
  onFetchLogs: () => Promise<string | null>;
}

function colorLogLine(line: string): string {
  if (/error|ERR|Error/i.test(line)) return 'admin-log-line-error';
  if (/warn|WARN|Warning/i.test(line)) return 'admin-log-line-warn';
  return 'admin-log-line-info';
}

export default function LogViewer({ processName, onClose, onFetchLogs }: LogViewerProps) {
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const doFetch = useCallback(async () => {
    const result = await onFetchLogs();
    if (result !== null) {
      setLogs(result);
    }
    setLoading(false);
  }, [onFetchLogs]);

  // Initial fetch
  useEffect(() => {
    doFetch();
  }, [doFetch]);

  // Auto-refresh every 3 seconds (stable ref — no interval reset)
  useEffect(() => {
    const interval = setInterval(doFetch, 3000);
    return () => clearInterval(interval);
  }, [doFetch]);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(logs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  const logLines = logs ? logs.split('\n') : [];

  return (
    <AdminLightbox isOpen={true} onClose={onClose} size="xl" showClose={false}>
      {/* Terminal title bar */}
      <div className="admin-log-titlebar">
        <div className="admin-log-titlebar-left">
          <StatusDot color="green" pulse />
          <span className="admin-log-titlebar-name">{processName}</span>
          <span className="admin-log-live-badge">
            <span className="admin-log-live-dot" />
            Live
          </span>
        </div>
        <div className="admin-log-titlebar-right">
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={handleCopy}
            title="Copy logs"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={doFetch} title="Refresh now">&#x21bb;</button>
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={onClose}>&times;</button>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading"><div className="admin-spinner" />Loading logs...</div>
      ) : (
        <div className="admin-log-viewer" ref={scrollRef}>
          {logLines.length > 0 ? (
            logLines.map((line, i) => (
              <div key={i} className={`admin-log-line ${colorLogLine(line)}`}>
                <span className="admin-log-line-number">{i + 1}</span>
                <span className="admin-log-line-text">{line}</span>
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>No logs available</div>
          )}
        </div>
      )}
    </AdminLightbox>
  );
}
