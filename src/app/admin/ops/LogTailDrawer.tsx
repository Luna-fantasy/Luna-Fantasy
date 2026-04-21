'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  /** PM2 process name. null = drawer closed. */
  processName: string | null;
  displayName: string;
  onClose: () => void;
}

interface LogsResponse {
  out?: string;
  err?: string;
  lines?: string[];
}

/**
 * Live log tail panel — slides in from the right when the admin clicks a
 * bot row. Polls /api/admin/server/logs?name=<pm2name>&lines=500 every 5s
 * while open. Auto-sticks-to-bottom unless the admin scrolls up manually.
 */
export default function LogTailDrawer({ processName, displayName, onClose }: Props) {
  const [raw, setRaw] = useState<string>('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stickBottom, setStickBottom] = useState(true);
  const preRef = useRef<HTMLPreElement | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!processName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/server/logs?name=${encodeURIComponent(processName)}&lines=500`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const data: LogsResponse = await res.json();
      // Agent may return `lines[]` OR concatenated `out`/`err` strings —
      // normalize to a single string with newlines. Prefer the most
      // informative payload shape available.
      const text = Array.isArray(data.lines)
        ? data.lines.join('\n')
        : [data.out, data.err].filter(Boolean).join('\n');
      setRaw(text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [processName]);

  useEffect(() => {
    if (!processName) return;
    void fetchLogs();
    const id = window.setInterval(() => { void fetchLogs(); }, 5000);
    return () => window.clearInterval(id);
  }, [processName, fetchLogs]);

  // Esc to close
  useEffect(() => {
    if (!processName) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [processName, onClose]);

  // Auto-scroll to bottom when new content arrives, unless the user has
  // scrolled up. The `stickBottom` flag only flips off when the admin
  // scrolls off the bottom, and back on when they scroll back to within
  // 40 px of it.
  useEffect(() => {
    if (!stickBottom || !preRef.current) return;
    preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [raw, stickBottom]);

  const onScroll = useCallback(() => {
    const el = preRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setStickBottom(nearBottom);
  }, []);

  const filtered = useMemo(() => {
    if (!filter.trim()) return raw;
    const needle = filter.toLowerCase();
    return raw
      .split('\n')
      .filter((ln) => ln.toLowerCase().includes(needle))
      .join('\n');
  }, [raw, filter]);

  if (!processName) return null;

  return (
    <>
      <div className="av-log-drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="av-log-drawer" role="dialog" aria-modal="true" aria-label={`Logs for ${displayName}`}>
        <header className="av-log-drawer-head">
          <div>
            <strong>{displayName}</strong>
            <span className="av-log-drawer-name">{processName}</span>
          </div>
          <div className="av-log-drawer-controls">
            <input
              type="text"
              className="av-audit-input av-audit-input--sm"
              placeholder="Filter (plain text)"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button
              type="button"
              className="av-btn av-btn-ghost av-btn-sm"
              onClick={() => void fetchLogs()}
              disabled={loading}
              title="Refresh now"
            >
              {loading ? '…' : '↻'}
            </button>
            <button
              type="button"
              className="av-btn av-btn-ghost av-btn-sm"
              onClick={() => {
                setStickBottom(true);
                if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
              }}
              title="Jump to bottom"
            >↓</button>
            <button
              type="button"
              className="av-peek-close"
              onClick={onClose}
              aria-label="Close log drawer"
            >✕</button>
          </div>
        </header>

        {error && (
          <div className="av-ops-banner av-ops-banner--err av-log-drawer-error">
            {error}
          </div>
        )}

        <pre ref={preRef} className="av-log-drawer-body" onScroll={onScroll}>
          {filtered || <span className="av-log-drawer-empty">(no log lines yet)</span>}
        </pre>

        <footer className="av-log-drawer-foot">
          <span>
            {loading ? 'fetching…' : `auto-refresh every 5s${stickBottom ? '' : ' · scroll lock off'}`}
          </span>
          <span>{filter ? `${filtered.split('\n').length} matching lines` : `${raw.split('\n').length} lines`}</span>
        </footer>
      </aside>
    </>
  );
}
