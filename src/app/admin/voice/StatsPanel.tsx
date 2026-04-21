'use client';

import { useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { useTimezone } from '../_components/TimezoneProvider';
import { usePeek } from '../_components/PeekProvider';
import type { StatsBundle, StatsRoom, VoiceMusic } from './types';

type Action = 'lock' | 'unlock' | 'delete' | 'rename';

interface Props {
  music?: VoiceMusic;
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function manageRoom(channelId: string, action: Action, newName?: string): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/voice/manage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ roomId: channelId, action, value: newName }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
}

export default function StatsPanel({ music }: Props) {
  const toast = useToast();
  const pending = usePendingAction();
  const { openPeek } = usePeek();
  const { fmtRel, absolute } = useTimezone();

  const [data, setData] = useState<StatsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupBusy, setLookupBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/voice/stats', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setData(body as StatsBundle);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const runAction = (room: StatsRoom, action: Action, extra?: { newName?: string }) => {
    pending.queue({
      label: `${action} · ${room.name}`,
      detail: 'Queued for bot · applied on next aura cycle',
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        try {
          await manageRoom(room._id, action, extra?.newName);
          toast.show({ tone: 'success', title: 'Queued', message: `${action} ${room.name}` });
          window.setTimeout(load, 1200);
        } catch (e) {
          toast.show({ tone: 'error', title: 'Action failed', message: (e as Error).message });
        }
      },
    });
  };

  const doLookup = async () => {
    const id = lookupId.trim().replace(/[^\d]/g, '');
    if (!id) return;
    setLookupBusy(true);
    try {
      const res = await fetch(`/api/admin/voice/user?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setLookupResult(body);
    } catch (e) {
      toast.show({ tone: 'error', title: 'Lookup failed', message: (e as Error).message });
      setLookupResult(null);
    } finally {
      setLookupBusy(false);
    }
  };

  const exportCsv = () => window.open('/api/admin/voice/export?format=csv', '_blank');
  const exportJson = () => window.open('/api/admin/voice/export?format=json', '_blank');

  return (
    <section className="av-voice-panel">
      <div className="av-commands-controls">
        <button type="button" className="av-btn av-btn-ghost" onClick={load} disabled={loading}>↻ Refresh</button>
        <div style={{ flex: 1 }} />
        <button type="button" className="av-btn av-btn-ghost" onClick={exportCsv}>Export CSV ↓</button>
        <button type="button" className="av-btn av-btn-ghost" onClick={exportJson}>Export JSON ↓</button>
      </div>

      {error && <div className="av-inbox-transcript-empty"><strong>Stats unavailable.</strong> {error}<button type="button" className="av-btn av-btn-ghost" onClick={load} style={{ marginTop: 8 }}>Retry</button></div>}

      {data?.totals && (
        <div className="av-voice-stat-summary">
          <div><strong>{data.totals.activeRooms ?? 0}</strong><span>Active rooms</span></div>
          <div><strong>{(data.totals.totalUniqueVisitors ?? 0).toLocaleString()}</strong><span>Unique visitors</span></div>
          <div><strong>{data.totals.peakAcrossAll ?? 0}</strong><span>Peak concurrent</span></div>
        </div>
      )}

      <article className="av-commands-card">
        <header className="av-commands-card-head">
          <h4 className="av-sage-card-title">Active rooms</h4>
          {loading && <span className="av-sage-activity-time">Loading…</span>}
        </header>
        {!loading && (data?.rooms ?? []).length === 0 && <div className="av-commands-empty">The halls are quiet — no voice rooms active in Lunvor.</div>}
        <div className="av-voice-rooms">
          {(data?.rooms ?? []).map((room) => (
            <div key={room._id} className={`av-voice-room${room.isLocked ? ' av-voice-room--locked' : ''}`}>
              <div className="av-voice-room-head">
                <strong>{room.name}</strong>
                <span className="av-voice-room-type" data-type={room.type}>{room.type}</span>
                {room.aura && <span className="av-voice-room-aura" data-tier={room.aura.tier}>{room.aura.tier} · {room.aura.score}</span>}
              </div>
              <div className="av-voice-room-meta">
                <button type="button" className="av-inbox-userlink" onClick={() => openPeek(room.ownerId)}>
                  {room.ownerName ?? room.ownerId}
                </button>
                {room.stats && <span>· {room.stats.uniqueVisitors ?? 0} uniq · peak {room.stats.peakMembers ?? 0}</span>}
                {room.createdAt && <span title={absolute(room.createdAt)}>· opened {fmtRel(room.createdAt)}</span>}
              </div>
              <div className="av-voice-room-actions">
                {room.isLocked
                  ? <button type="button" className="av-btn av-btn-ghost" onClick={() => runAction(room, 'unlock')}>Unlock</button>
                  : <button type="button" className="av-btn av-btn-ghost" onClick={() => runAction(room, 'lock')}>Lock</button>}
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => {
                    const newName = window.prompt('Rename room to?', room.name);
                    if (newName && newName !== room.name) runAction(room, 'rename', { newName });
                  }}
                >Rename</button>
                <button type="button" className="av-btn av-btn-primary av-btn-danger" onClick={() => runAction(room, 'delete')}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </article>

      {data?.hallOfRecords && (
        <article className="av-commands-card">
          <header className="av-commands-card-head"><h4 className="av-sage-card-title">Hall of records</h4></header>
          <div className="av-commands-row-grid">
            <div>
              <label className="av-games-field-label">Top by peak aura</label>
              <div className="av-voice-hall-list">
                {(data.hallOfRecords.byAura ?? []).slice(0, 5).map((r, i) => (
                  <div key={r._id} className="av-voice-hall-row">
                    <span>#{i + 1}</span>
                    <strong>{r.name}</strong>
                    <span>{r.aura?.score ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="av-games-field-label">Top by visitors</label>
              <div className="av-voice-hall-list">
                {(data.hallOfRecords.byVisitors ?? []).slice(0, 5).map((r, i) => (
                  <div key={r._id} className="av-voice-hall-row">
                    <span>#{i + 1}</span>
                    <strong>{r.name}</strong>
                    <span>{r.stats?.uniqueVisitors ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      )}

      {music && (
        <article className="av-commands-card">
          <header className="av-commands-card-head">
            <h4 className="av-sage-card-title">Music library</h4>
            <span className={`av-process-badge${music.enabled ? '' : ' av-process-badge--warn'}`}>
              {music.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </header>
          {music.tracks.length === 0 ? (
            <div className="av-commands-empty">No tracks in the library yet.</div>
          ) : (
            <>
              <div className="av-voice-stat-summary" style={{ padding: '8px 0' }}>
                <div><strong>{music.tracks.length}</strong><span>Tracks</span></div>
                <div><strong>{formatSize(music.tracks.reduce((s, t) => s + (t.sizeBytes ?? 0), 0))}</strong><span>Total size</span></div>
              </div>
              <div className="av-voice-hall-list" style={{ padding: '0 4px 8px' }}>
                {music.tracks.map((t, i) => (
                  <div key={t.key} className="av-voice-hall-row">
                    <span>#{i + 1}</span>
                    <strong>{t.title}</strong>
                    <span>{formatSize(t.sizeBytes ?? 0)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </article>
      )}

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">User lookup</h4></header>
        <div className="av-voice-lookup">
          <input
            className="av-shopf-input av-shopf-input--mono"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="Paste a Discord ID"
            inputMode="numeric"
          />
          <button type="button" className="av-btn av-btn-primary" onClick={doLookup} disabled={lookupBusy || !lookupId.trim()}>Look up</button>
        </div>
        {lookupResult && (
          <pre className="av-sage-activity-body">{JSON.stringify(lookupResult, null, 2)}</pre>
        )}
      </article>
    </section>
  );
}
