'use client';

import { useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { useTimezone } from '../_components/TimezoneProvider';

interface MemoryRecord {
  userId: string;
  username?: string;
  factIndex: number;
  fact: string;
  setBy?: string;
  setAt?: string;
  expiresAt?: string;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function deleteMemory(userId: string, factIndex: number): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/sage-live-chat/memories', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ userId, factIndex }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
}

export default function MemoriesPanel() {
  const toast = useToast();
  const pending = usePendingAction();
  const { fmtRel, absolute } = useTimezone();

  const [list, setList] = useState<MemoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/sage-live-chat/memories', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const arr: any[] = Array.isArray(body) ? body : [];
      const flat: MemoryRecord[] = arr.flatMap((d) =>
        Array.isArray(d?.facts)
          ? d.facts.map((f: any, factIndex: number) => ({
              userId: String(d.userId),
              username: d.username,
              factIndex,
              fact: String(f?.text ?? ''),
              setBy: f?.setBy,
              setAt: typeof f?.setAt === 'string' ? f.setAt : f?.setAt ? new Date(f.setAt).toISOString() : undefined,
              expiresAt: typeof f?.expiresAt === 'string' ? f.expiresAt : f?.expiresAt ? new Date(f.expiresAt).toISOString() : undefined,
            }))
          : [],
      );
      setList(flat);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const remove = (m: MemoryRecord) => {
    pending.queue({
      label: `Delete memory · ${m.username ?? m.userId}`,
      detail: m.fact.slice(0, 80),
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        try {
          await deleteMemory(m.userId, m.factIndex);
          setList((l) => l.filter((x) => !(x.userId === m.userId && x.factIndex === m.factIndex)));
          toast.show({ tone: 'success', title: 'Deleted', message: m.username ?? m.userId });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Delete failed', message: (e as Error).message });
        }
      },
    });
  };

  return (
    <section className="av-sage-panel">
      {loading && <div className="av-inbox-transcript-loading">Loading memories…</div>}
      {error && <div className="av-inbox-transcript-empty"><strong>Memories unavailable.</strong> {error}<button type="button" className="av-btn av-btn-ghost" onClick={load} style={{ marginTop: 8 }}>Retry</button></div>}
      {!loading && !error && list.length === 0 && (
        <div className="av-commands-empty">Sage&apos;s memory vault is empty — no facts recorded yet.</div>
      )}

      <div className="av-sage-memory-list">
        {list.map((m) => (
          <article key={`${m.userId}:${m.factIndex}`} className="av-commands-card av-sage-memory-card">
            <header className="av-commands-card-head">
              <div className="av-sage-memory-head-body">
                <strong>{m.username ?? m.userId}</strong>
                <code>{m.userId}</code>
              </div>
              <button type="button" className="av-commands-delete" onClick={() => remove(m)} title="Delete memory">🗑</button>
            </header>
            <p className="av-sage-memory-fact">{m.fact}</p>
            <footer className="av-sage-memory-foot">
              {m.setBy && <span>set by <code>{m.setBy}</code></span>}
              {m.setAt && <span title={absolute(m.setAt)}>{fmtRel(m.setAt)}</span>}
              {m.expiresAt && <span title={absolute(m.expiresAt)}>expires {fmtRel(m.expiresAt)}</span>}
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
