'use client';

import { useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import JesterTriggersPanel, { type CommandsDoc, GAME_COMMAND_KEYS } from './JesterTriggersPanel';
import AutoRepliesPanel, { type AutoReplyDoc } from './AutoRepliesPanel';
import AutoImagesPanel, { type AutoImageRule } from './AutoImagesPanel';

type Tab = 'triggers' | 'replies' | 'images';

interface Snapshot {
  jester_commands: CommandsDoc;
  butler_auto_reply: AutoReplyDoc;
  butler_auto_images: AutoImageRule[];
}

interface Props {
  initial: Snapshot;
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

export default function CommandsClient({ initial }: Props) {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();

  const [tab, setTab] = useState<Tab>('triggers');
  const [draft, setDraft] = useState<Snapshot>(initial);
  const draftRef = useRef<Snapshot>(initial);
  const committedRef = useRef<Snapshot>(initial);

  const queueSave = () => {
    pending.queue({
      label: 'Save commands',
      detail: 'Changes reach the bots within 30 s after save.',
      delayMs: 4500,
      run: async () => {
        const snap = draftRef.current;
        const comm = committedRef.current;
        const keys = Object.keys(snap) as Array<keyof Snapshot>;
        const dirty = keys.filter((k) => JSON.stringify(snap[k]) !== JSON.stringify(comm[k]));
        if (dirty.length === 0) return;

        for (const key of dirty) {
          const before = comm[key];
          const after = snap[key];
          try {
            await saveBotConfig(key, after);
            committedRef.current = { ...committedRef.current, [key]: after };
            toast.show({ tone: 'success', title: 'Saved', message: key });
            undo.push({
              label: `Restore ${key}`,
              detail: 'Rolled back to prior snapshot',
              revert: async () => {
                await saveBotConfig(key, before);
                committedRef.current = { ...committedRef.current, [key]: before };
                setDraft((d) => ({ ...d, [key]: before } as Snapshot));
                toast.show({ tone: 'success', title: 'Reverted', message: key });
              },
            });
          } catch (e) {
            toast.show({ tone: 'error', title: `Save failed: ${key}`, message: (e as Error).message });
          }
        }
      },
    });
  };

  const patchDoc = <K extends keyof Snapshot>(key: K, next: Snapshot[K]) => {
    const nextDraft = { ...draftRef.current, [key]: next };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    queueSave();
  };

  const countReplies = draft.butler_auto_reply?.replies?.length ?? 0;
  // Match the panel's filter — game commands are edited on the Games page and
  // hidden from this list, so the tab count must ignore them too.
  const countTriggers = Object.keys(draft.jester_commands ?? {}).filter(
    (id) => !GAME_COMMAND_KEYS.has(id),
  ).length;
  const countImages = draft.butler_auto_images?.length ?? 0;

  return (
    <div className="av-commands">
      <nav className="av-inbox-chipset" role="tablist" aria-label="Commands section">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'triggers'}
          className={`av-inbox-chip${tab === 'triggers' ? ' av-inbox-chip--active' : ''}`}
          onClick={() => setTab('triggers')}
        >Jester Triggers · {countTriggers}</button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'replies'}
          className={`av-inbox-chip${tab === 'replies' ? ' av-inbox-chip--active' : ''}`}
          onClick={() => setTab('replies')}
        >Auto-Replies · {countReplies}</button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'images'}
          className={`av-inbox-chip${tab === 'images' ? ' av-inbox-chip--active' : ''}`}
          onClick={() => setTab('images')}
        >Auto-Images · {countImages}</button>
      </nav>

      <p className="av-commands-slash-note">
        <strong>Slash commands</strong> (<code>/lunari</code>, <code>/gf</code>, …) are source-locked. Adding or renaming one still needs a bot deploy.
      </p>

      {tab === 'triggers' && (
        <JesterTriggersPanel
          data={draft.jester_commands ?? {}}
          onChange={(next) => patchDoc('jester_commands', next)}
        />
      )}
      {tab === 'replies' && (
        <AutoRepliesPanel
          data={draft.butler_auto_reply ?? { enabled: false, replies: [] }}
          onChange={(next) => patchDoc('butler_auto_reply', next)}
        />
      )}
      {tab === 'images' && (
        <AutoImagesPanel
          data={draft.butler_auto_images ?? []}
          onChange={(next) => patchDoc('butler_auto_images', next)}
        />
      )}
    </div>
  );
}
