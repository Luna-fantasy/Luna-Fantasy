'use client';

import { useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import SetupPanel from './SetupPanel';
import GamesPanel from './GamesPanel';
import ContentPanel from './ContentPanel';
import AssetsPanel from './AssetsPanel';
import StatsPanel from './StatsPanel';
import MusicPanel from './MusicPanel';
import type { VoiceSection, VoiceSnapshot } from './types';

type Tab = 'setup' | 'games' | 'content' | 'assets' | 'music' | 'stats';

interface Props {
  initial: VoiceSnapshot;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function saveSection(section: VoiceSection, value: any): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/config/oracle', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ section, value }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
}

export default function VoiceClient({ initial }: Props) {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();

  const [tab, setTab] = useState<Tab>('setup');
  const [snap, setSnap] = useState<VoiceSnapshot>(initial);
  const snapRef = useRef(snap);

  const patch = (next: VoiceSnapshot) => { snapRef.current = next; setSnap(next); };

  const queueSave = (section: VoiceSection, beforeValue: any, afterValue: any, label: string) => {
    pending.queue({
      label: `Save ${label}`,
      detail: 'Reaches Oracle within ~30 s',
      delayMs: 4500,
      run: async () => {
        try {
          await saveSection(section, afterValue);
          toast.show({ tone: 'success', title: 'Saved', message: label });
          undo.push({
            label: `Restore ${label}`,
            detail: 'Prior snapshot',
            revert: async () => {
              await saveSection(section, beforeValue);
              toast.show({ tone: 'success', title: 'Reverted', message: label });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const setupChange = (p: Partial<VoiceSnapshot['setup']>) => {
    const before = snapRef.current.setup;
    const after = { ...before, ...p };
    patch({ ...snapRef.current, setup: after });
    queueSave('setup', before, after, 'Setup');
  };

  const triviaChange = (next: VoiceSnapshot['gamesTrivia']) => {
    const before = snapRef.current.gamesTrivia;
    patch({ ...snapRef.current, gamesTrivia: next });
    queueSave('games_trivia', before, next, 'Trivia');
  };

  const sowalefChange = (next: VoiceSnapshot['gamesSowalef']) => {
    const before = snapRef.current.gamesSowalef;
    patch({ ...snapRef.current, gamesSowalef: next });
    queueSave('games_sowalef', before, next, 'Sowalef');
  };

  const gamesSettingsChange = (next: VoiceSnapshot['gamesSettings']) => {
    const before = snapRef.current.gamesSettings;
    patch({ ...snapRef.current, gamesSettings: next });
    queueSave('games_settings', before, next, 'Game settings');
  };

  const contentChange = (p: Partial<VoiceSnapshot['content']>) => {
    const beforeContent = snapRef.current.content;
    const nextContent = { ...beforeContent, ...p };
    patch({ ...snapRef.current, content: nextContent });

    // Route each dirty field into the right section (server has split sections for content)
    if ('welcomeGreetings' in p) queueSave('content_welcome', beforeContent.welcomeGreetings, nextContent.welcomeGreetings, 'Greetings');
    if ('panelText' in p) queueSave('content_panel', beforeContent.panelText, nextContent.panelText, 'Panel text');
    if ('buttonLabels' in p) queueSave('content_buttons', beforeContent.buttonLabels, nextContent.buttonLabels, 'Button labels');
    if ('auraTiers' in p || 'auraThresholds' in p || 'auraWeights' in p) {
      const aura = { auraTiers: nextContent.auraTiers, auraThresholds: nextContent.auraThresholds, auraWeights: nextContent.auraWeights };
      queueSave('content_aura', { auraTiers: beforeContent.auraTiers, auraThresholds: beforeContent.auraThresholds, auraWeights: beforeContent.auraWeights }, aura, 'Aura');
    }
    if ('whisper' in p) queueSave('content_whisper', beforeContent.whisper, nextContent.whisper, 'Whisper');
    if ('expiryTitles' in p) queueSave('content_expiry', beforeContent.expiryTitles, nextContent.expiryTitles, 'Expiry');
  };

  const assetsChange = (p: Partial<VoiceSnapshot['assets']>) => {
    const before = snapRef.current.assets;
    const after = { ...before, ...p };
    patch({ ...snapRef.current, assets: after });
    queueSave('assets', before, after, 'Assets');
  };

  const musicChange = (next: VoiceSnapshot['music']) => {
    const before = snapRef.current.music;
    patch({ ...snapRef.current, music: next });
    queueSave('music', before, next, 'Music');
  };

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'setup',   label: 'Setup' },
    { id: 'games',   label: 'Games' },
    { id: 'content', label: 'Content' },
    { id: 'assets',  label: 'Assets' },
    { id: 'music',   label: '🎵 Music' },
    { id: 'stats',   label: 'Stats' },
  ];

  return (
    <div className="av-voice">
      <nav className="av-inbox-chipset" role="tablist" aria-label="Voice section">
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

      {tab === 'setup'   && <SetupPanel data={snap.setup} onChange={setupChange} />}
      {tab === 'games'   && <GamesPanel
        trivia={snap.gamesTrivia}
        sowalef={snap.gamesSowalef}
        settings={snap.gamesSettings}
        onTriviaChange={triviaChange}
        onSowalefChange={sowalefChange}
        onSettingsChange={gamesSettingsChange}
      />}
      {tab === 'content' && <ContentPanel data={snap.content} onChange={contentChange} />}
      {tab === 'assets'  && <AssetsPanel data={snap.assets} onChange={assetsChange} />}
      {tab === 'music'   && <MusicPanel data={snap.music} onChange={musicChange} />}
      {tab === 'stats'   && <StatsPanel music={snap.music} />}
    </div>
  );
}
