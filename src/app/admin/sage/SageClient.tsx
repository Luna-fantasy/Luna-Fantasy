'use client';

import { useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import SettingsPanel from './SettingsPanel';
import PromptLorePanel from './PromptLorePanel';
import PrivilegesPanel from './PrivilegesPanel';
import LiveChatPanel from './LiveChatPanel';
import MemoriesPanel from './MemoriesPanel';
import ActivityPanel from './ActivityPanel';
import type { LiveChatSection, SageSnapshot, SettingsSection } from './types';

type Tab = 'settings' | 'system_prompt' | 'lore' | 'privileges' | 'live_chat' | 'memories' | 'activity';

interface Props {
  initial: SageSnapshot;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function saveSettings(section: SettingsSection, value: any): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/config/sage', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ section, value }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
}

async function saveLiveChat(section: LiveChatSection, value: any): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/sage-live-chat/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ section, value }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
}

export default function SageClient({ initial }: Props) {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();

  const [tab, setTab] = useState<Tab>('settings');
  const [snapshot, setSnapshot] = useState<SageSnapshot>(initial);
  const snapshotRef = useRef(snapshot);

  const queueSettingsSave = (section: SettingsSection, beforeValue: any, afterValue: any) => {
    pending.queue({
      label: `Save ${section}`,
      detail: 'Settings / prompt / lore / privileges',
      delayMs: 4500,
      run: async () => {
        try {
          await saveSettings(section, afterValue);
          toast.show({ tone: 'success', title: 'Saved', message: section });
          undo.push({
            label: `Restore ${section}`,
            detail: 'Prior snapshot',
            revert: async () => {
              await saveSettings(section, beforeValue);
              applySettingsPatch(section, beforeValue);
              toast.show({ tone: 'success', title: 'Reverted', message: section });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const queueLiveChatSave = (section: LiveChatSection, beforeValue: any, afterValue: any) => {
    pending.queue({
      label: `Save live chat · ${section}`,
      detail: 'Reaches Sage within ~30 s',
      delayMs: 4500,
      run: async () => {
        try {
          await saveLiveChat(section, afterValue);
          toast.show({ tone: 'success', title: 'Saved', message: section });
          undo.push({
            label: `Restore live chat · ${section}`,
            detail: 'Prior snapshot',
            revert: async () => {
              await saveLiveChat(section, beforeValue);
              applyLiveChatPatch(section, beforeValue);
              toast.show({ tone: 'success', title: 'Reverted', message: section });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  function applySettingsPatch(section: SettingsSection, value: any) {
    setSnapshot((s) => {
      const next = { ...s };
      switch (section) {
        case 'system_prompt':  next.systemPrompt = value ?? ''; break;
        case 'lore_text':      next.lore = value ?? ''; break;
        case 'privileged_roles':  next.privileges = { ...next.privileges, privilegedRoles: value ?? [] }; break;
        case 'lunarian_role_id':  next.privileges = { ...next.privileges, lunarianRoleId: value ?? '' }; break;
        case 'lunarian_access':   next.privileges = { ...next.privileges, lunarianAccess: Boolean(value) }; break;
        case 'all_known_roles':   next.privileges = { ...next.privileges, allKnownRoles: value ?? [] }; break;
        default:
          next.settings = { ...next.settings, [section]: value } as typeof next.settings;
      }
      snapshotRef.current = next;
      return next;
    });
  }

  function applyLiveChatPatch(section: LiveChatSection, value: any) {
    setSnapshot((s) => {
      const next = { ...s, liveChat: { ...s.liveChat, [section]: value } };
      snapshotRef.current = next;
      return next;
    });
  }

  const onSettings = (section: SettingsSection, value: any) => {
    const before = readSettings(snapshotRef.current, section);
    applySettingsPatch(section, value);
    queueSettingsSave(section, before, value);
  };

  const onLiveChat = (section: LiveChatSection, value: any) => {
    const before = (snapshotRef.current.liveChat as any)?.[section];
    applyLiveChatPatch(section, value);
    queueLiveChatSave(section, before, value);
  };

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'settings',     label: 'Settings' },
    { id: 'system_prompt', label: 'System Prompt' },
    { id: 'lore',         label: 'Lore' },
    { id: 'privileges',   label: 'Privileges' },
    { id: 'live_chat',    label: 'Live Chat' },
    { id: 'memories',     label: 'Memories' },
    { id: 'activity',     label: 'Activity' },
  ];

  return (
    <div className="av-sage">
      <nav className="av-inbox-chipset" role="tablist" aria-label="Sage section">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`av-inbox-chip${tab === t.id ? ' av-inbox-chip--active' : ''}`}
            onClick={() => setTab(t.id)}
          >{t.label}</button>
        ))}
      </nav>

      {tab === 'settings'      && <SettingsPanel data={snapshot.settings} onChange={onSettings} />}
      {tab === 'system_prompt' && <PromptLorePanel kind="prompt" value={snapshot.systemPrompt} onChange={onSettings} />}
      {tab === 'lore'          && <PromptLorePanel kind="lore"   value={snapshot.lore}         onChange={onSettings} />}
      {tab === 'privileges'    && <PrivilegesPanel data={snapshot.privileges} onChange={onSettings} />}
      {tab === 'live_chat'     && <LiveChatPanel   data={snapshot.liveChat}   onChange={onLiveChat} />}
      {tab === 'memories'      && <MemoriesPanel />}
      {tab === 'activity'      && <ActivityPanel />}
    </div>
  );
}

function readSettings(s: SageSnapshot, section: SettingsSection): any {
  switch (section) {
    case 'system_prompt': return s.systemPrompt;
    case 'lore_text':     return s.lore;
    case 'privileged_roles': return s.privileges.privilegedRoles;
    case 'lunarian_role_id': return s.privileges.lunarianRoleId;
    case 'lunarian_access':  return s.privileges.lunarianAccess;
    case 'all_known_roles':  return s.privileges.allKnownRoles;
    default: return (s.settings as any)[section];
  }
}
