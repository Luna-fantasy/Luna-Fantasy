'use client';

import { useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import ChannelPicker from '../_components/ChannelPicker';

export interface DocSnapshot {
  id: string;
  data: any;
}

interface Props {
  docs: DocSnapshot[];
}

interface LogTarget {
  bot: 'butler' | 'jester' | 'oracle';
  docId: string;
  path: string[];
  label: string;
  help: string;
}

const TARGETS: LogTarget[] = [
  { bot: 'butler', docId: 'butler_channels',     path: ['lunari_log_channel_id'],            label: 'Butler · Lunari transactions', help: 'Every daily reward, transfer, loan, and shop purchase posts here.' },
  { bot: 'butler', docId: 'butler_tickets',      path: ['logs_channel_id'],                  label: 'Butler · Ticket events',        help: 'Every ticket opened / reopened / closed is logged here.' },
  { bot: 'butler', docId: 'butler_applications', path: ['logs_channel_id'],                  label: 'Butler · Application events',   help: 'Every staff/wizard/passport application submission.' },
  { bot: 'jester', docId: 'jester_channels',     path: ['log_channels', 'lunari'],           label: 'Jester · Lunari operations',    help: 'Game wins, shop purchases, trades.' },
  { bot: 'jester', docId: 'jester_channels',     path: ['log_channels', 'cards'],            label: 'Jester · Card transactions',    help: 'Pulls, luckboxes, sells, auctions, swaps, gifts.' },
  { bot: 'jester', docId: 'jester_channels',     path: ['log_channels', 'stones'],           label: 'Jester · Stone transactions',   help: 'Chest opens, stone sells, auctions, swaps, gifts.' },
  { bot: 'oracle', docId: 'oracle_vc_setup',     path: ['logChannelId'],                     label: 'Oracle · Voice room events',    help: 'Created / deleted / renamed / locked / unlocked rooms.' },
];

const BOT_META: Record<'butler' | 'jester' | 'oracle' | 'sage', { label: string; glyph: string; tone: string; subtitle: string }> = {
  butler: { label: 'Butler',  glyph: '☾', tone: '#06b6d4', subtitle: 'Economy & staff' },
  jester: { label: 'Jester',  glyph: '◈', tone: '#a855f7', subtitle: 'Items & games' },
  oracle: { label: 'Oracle',  glyph: '✦', tone: '#fbbf24', subtitle: 'Voice' },
  sage:   { label: 'Sage',    glyph: '✧', tone: '#22c55e', subtitle: 'AI' },
};

function getAtPath(obj: any, path: string[]): any {
  let cur = obj;
  for (const seg of path) { if (cur == null) return undefined; cur = cur[seg]; }
  return cur;
}
function setAtPath(obj: any, path: string[], value: any): any {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  const base = (obj && typeof obj === 'object') ? { ...obj } : {};
  base[head] = setAtPath(base?.[head], rest, value);
  return base;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function saveBotConfig(id: string, data: any): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch(`/api/admin/v2/bot-config/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ data }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
}

export default function LoggingClient({ docs }: Props) {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();

  const committedRef = useRef<Record<string, any>>(
    Object.fromEntries(docs.map((d) => [d.id, d.data ?? {}])),
  );
  const [draft, setDraft] = useState<Record<string, any>>(
    Object.fromEntries(docs.map((d) => [d.id, d.data ?? {}])),
  );
  const draftRef = useRef(draft);

  const queueSave = () => {
    pending.queue({
      label: 'Save log channel routing',
      detail: 'Changes reach the bots within ~30 s after save.',
      delayMs: 4500,
      run: async () => {
        const snap = draftRef.current;
        const comm = committedRef.current;
        const dirty = Object.keys(snap).filter((id) => JSON.stringify(snap[id]) !== JSON.stringify(comm[id]));
        if (dirty.length === 0) return;
        for (const id of dirty) {
          const before = comm[id];
          const after = snap[id];
          try {
            await saveBotConfig(id, after);
            committedRef.current = { ...committedRef.current, [id]: after };
            toast.show({ tone: 'success', title: 'Saved', message: id });
            undo.push({
              label: `Restore ${id}`,
              detail: 'Rolled back to prior log routing',
              revert: async () => {
                await saveBotConfig(id, before);
                committedRef.current = { ...committedRef.current, [id]: before };
                setDraft((d) => ({ ...d, [id]: before }));
                toast.show({ tone: 'success', title: 'Reverted', message: id });
              },
            });
          } catch (e) {
            toast.show({ tone: 'error', title: `Save failed: ${id}`, message: (e as Error).message });
          }
        }
      },
    });
  };

  const patchTarget = (target: LogTarget, value: string) => {
    const currentDoc = draft[target.docId] ?? {};
    const nextDoc = setAtPath(currentDoc, target.path, value);
    const nextDraft = { ...draftRef.current, [target.docId]: nextDoc };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    queueSave();
  };

  const grouped = new Map<LogTarget['bot'], LogTarget[]>();
  for (const t of TARGETS) {
    if (!grouped.has(t.bot)) grouped.set(t.bot, []);
    grouped.get(t.bot)!.push(t);
  }

  return (
    <div className="av-logging">
      {(['butler', 'jester', 'oracle'] as const).map((bot) => {
        const targets = grouped.get(bot) ?? [];
        if (targets.length === 0) return null;
        const meta = BOT_META[bot];
        return (
          <section key={bot} className="av-logging-group av-surface" data-bot={bot} style={{ ['--bot-tone' as any]: meta.tone }}>
            <header className="av-logging-group-head">
              <span className="av-logging-group-glyph" aria-hidden="true">{meta.glyph}</span>
              <div>
                <h3>{meta.label}</h3>
                <span>{meta.subtitle}</span>
              </div>
            </header>

            <div className="av-logging-rows">
              {targets.map((t) => {
                const currentId = String(getAtPath(draft[t.docId] ?? {}, t.path) ?? '');
                return (
                  <div key={`${t.docId}:${t.path.join('.')}`} className="av-logging-row">
                    <div className="av-logging-row-meta">
                      <strong>{t.label}</strong>
                      <span>{t.help}</span>
                    </div>
                    <div className="av-logging-row-control">
                      <ChannelPicker
                        value={currentId}
                        onChange={(v) => patchTarget(t, v)}
                        filter="text"
                        placeholder="Select log channel"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="av-logging-group av-logging-group--info av-surface" data-bot="sage">
        <header className="av-logging-group-head">
          <span className="av-logging-group-glyph" aria-hidden="true">{BOT_META.sage.glyph}</span>
          <div>
            <h3>{BOT_META.sage.label}</h3>
            <span>{BOT_META.sage.subtitle}</span>
          </div>
        </header>
        <p className="av-logging-sage-note">
          Sage replies directly in the channel it's triggered in. No log routing to configure here.
        </p>
      </section>
    </div>
  );
}
