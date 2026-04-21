'use client';

import { useEffect, useState } from 'react';
import { useTimezone } from '../_components/TimezoneProvider';

interface ActivityEntry {
  _id: string;
  adminDiscordId: string;
  adminUsername: string;
  action: string;
  timestamp: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, any>;
}

export default function ActivityPanel() {
  const { fmtRel, absolute } = useTimezone();

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/sage-live-chat/activity-log?limit=50', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setEntries(Array.isArray(body?.entries) ? body.entries : Array.isArray(body) ? body : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <section className="av-sage-panel">
      {loading && <div className="av-inbox-transcript-loading">Loading activity…</div>}
      {error && <div className="av-inbox-transcript-empty"><strong>Activity unavailable.</strong> {error}<button type="button" className="av-btn av-btn-ghost" onClick={load} style={{ marginTop: 8 }}>Retry</button></div>}
      {!loading && !error && entries.length === 0 && (
        <div className="av-commands-empty">The chronicle is blank — Sage has not recorded any deeds yet.</div>
      )}
      <div className="av-sage-activity-list">
        {entries.map((e) => {
          const open = expanded.has(e._id);
          return (
            <article key={e._id} className="av-commands-card av-sage-activity-card">
              <button
                type="button"
                className="av-sage-activity-head"
                onClick={() => toggle(e._id)}
              >
                <span className="av-audit-expand-icon">{open ? '▾' : '▸'}</span>
                <span className="av-audit-badge av-audit-badge-config">{e.action}</span>
                <strong className="av-sage-activity-admin">{e.adminUsername ?? e.adminDiscordId}</strong>
                <span className="av-sage-activity-time" title={absolute(e.timestamp)}>{fmtRel(e.timestamp)}</span>
              </button>
              {open && (
                <div className="av-sage-activity-body">
                  <pre>{JSON.stringify({ before: e.before, after: e.after, metadata: e.metadata }, null, 2)}</pre>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
