'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../_components/Toast';

interface ScheduledEvent {
  id: string;
  type: 'challenge_scheduled' | 'challenge_closing' | 'seluna_rotation' | 'chat_event';
  title: string;
  subtitle?: string;
  at: string;
  status: string;
  color: string;
}

const TYPE_LABELS: Record<string, string> = {
  challenge_scheduled: 'Challenge starts',
  challenge_closing: 'Challenge closes',
  seluna_rotation: 'Seluna rotation',
  chat_event: 'Chat event',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return 'Past due';
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export default function ScheduleClient() {
  const toast = useToast();
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/schedule', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setEvents(body.events ?? []);
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return events;
    return events.filter((e) => e.type === typeFilter);
  }, [events, typeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ScheduledEvent[]>();
    for (const e of filtered) {
      const key = dayKey(e.at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;
    return counts;
  }, [events]);

  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="av-schedule-page">
      <div className="av-voice-stat-summary">
        <div><strong>{events.length}</strong><span>Events in 30d</span></div>
        {(['challenge_scheduled', 'challenge_closing', 'seluna_rotation', 'chat_event'] as const).map((t) => (
          <div key={t}><strong>{typeCounts[t] ?? 0}</strong><span>{TYPE_LABELS[t]}</span></div>
        ))}
      </div>

      <div className="av-commands-controls">
        <div className="av-inbox-chipset">
          <button type="button" className={`av-inbox-chip${typeFilter === 'all' ? ' av-inbox-chip--active' : ''}`} onClick={() => setTypeFilter('all')}>All</button>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <button key={key} type="button" className={`av-inbox-chip${typeFilter === key ? ' av-inbox-chip--active' : ''}`} onClick={() => setTypeFilter(key)}>
              {label} {typeCounts[key] ? `(${typeCounts[key]})` : ''}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" className="av-btn av-btn-ghost" onClick={load} disabled={loading}>{loading ? '…' : '↻ Refresh'}</button>
      </div>

      {loading && <div className="av-commands-empty">Loading timeline…</div>}
      {!loading && grouped.length === 0 && <div className="av-commands-empty">Nothing on the schedule for the next 30 days.</div>}

      <div className="av-schedule-timeline">
        {grouped.map(([day, dayEvents]) => {
          const d = new Date(day + 'T00:00:00');
          const isToday = day === todayKey;
          return (
            <div key={day} className={`av-schedule-day${isToday ? ' av-schedule-day--today' : ''}`}>
              <div className="av-schedule-day-head">
                <strong>{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
                {isToday && <span className="av-badges-kind av-badges-kind--auto">Today</span>}
                <span className="av-text-muted" style={{ fontSize: 'var(--av-text-xs)' }}>{dayEvents.length} event{dayEvents.length === 1 ? '' : 's'}</span>
              </div>
              <div className="av-schedule-events">
                {dayEvents.map((e) => (
                  <div key={e.id} className="av-schedule-event" style={{ borderLeftColor: e.color }}>
                    <div className="av-schedule-event-time">
                      <strong>{formatTime(e.at)}</strong>
                      <span className="av-text-muted" style={{ fontSize: 'var(--av-text-xs)' }}>{formatUntil(e.at)}</span>
                    </div>
                    <div className="av-schedule-event-body">
                      <div className="av-schedule-event-title">
                        <span className="av-schedule-event-glyph" style={{ background: `${e.color}22`, color: e.color }}>●</span>
                        <strong>{e.title}</strong>
                      </div>
                      <div className="av-text-muted" style={{ fontSize: 'var(--av-text-xs)' }}>
                        {TYPE_LABELS[e.type]}{e.subtitle ? ` · ${e.subtitle}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
