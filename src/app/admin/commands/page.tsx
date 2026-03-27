'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfigSection from '../components/ConfigSection';
import ToggleSwitch from '../components/ToggleSwitch';
import BotBadge from '../components/BotBadge';
import SaveDeployBar from '../components/SaveDeployBar';
import { useUnsavedWarning } from '../hooks/useUnsavedWarning';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';
import { computeConfigDiff } from '../utils/computeConfigDiff';

interface CommandEntry {
  triggers: string[];
  enabled: boolean;
  permission: 'everyone' | 'admin' | 'owner';
}
type CommandsConfig = Record<string, CommandEntry>;

// Human-readable descriptions for each command
const BUTLER_DESCRIPTIONS: Record<string, string> = {
  bank: 'Opens the banking interface (salary, loans, trade, investment)',
  shop: 'Posts a shop panel to the channel',
  mells: 'Shortcut for Mells Selvair shop',
  lbm: 'Preview Lunari leaderboard (no timer effect)',
  lbl: 'Preview levels leaderboard (no timer effect)',
  staffchat: 'Set up staff chat tracker in channel',
  staffvoice: 'Set up staff voice tracker in channel',
  resetvoice: 'Clear voice tracking data',
  resetstaffembeds: 'Reset staff stat embeds',
  leveltest: 'Render a test level-up card',
  clear4: 'Clear all stuck Baloot game state',
};

const JESTER_DESCRIPTIONS: Record<string, string> = {
  setroadmap: 'Display the Luna Map / Roadmaps',
  roulette: 'Start a Roulette game (spin wheel)',
  bombroulette: 'Start a Luna Bomber game',
  rps: 'Start a Rock Paper Scissors game',
  guessthecountry: 'Start a Guess the Country game',
  mafia: 'Start a Blood Moon (Mafia) game',
  LunaFantasy: 'Start a Luna Fantasy duel',
  votegame: 'Vote on which game to play',
  setshop: 'Post the main shop (Brimor/Broker)',
  'set-tickets-shop': 'Post the Zoldar ticket shop',
  'set-luckbox-shop': 'Post the Kael Vandar luckbox shop',
  'set-seluna': 'Configure Seluna vendor',
  'cancel-seluna': 'Cancel active Seluna vendor',
  seluna: 'Display Seluna limited shop',
  devseluna: 'Dev mode for testing Seluna',
  'set-meluna': 'Configure Meluna stone vendor',
  lbf: 'Force generate leaderboard preview',
  roulettevtest: 'Test roulette video generation',
};

// Default configs when MongoDB has no data
const BUTLER_DEFAULTS: CommandsConfig = {
  bank:             { triggers: ['bank', 'banker'], enabled: true, permission: 'everyone' },
  shop:             { triggers: ['shop'], enabled: true, permission: 'owner' },
  mells:            { triggers: ['mells'], enabled: true, permission: 'owner' },
  lbm:              { triggers: ['lbm'], enabled: true, permission: 'owner' },
  lbl:              { triggers: ['lbl'], enabled: true, permission: 'owner' },
  staffchat:        { triggers: ['staffchat'], enabled: true, permission: 'owner' },
  staffvoice:       { triggers: ['staffvoice'], enabled: true, permission: 'owner' },
  resetvoice:       { triggers: ['resetvoice'], enabled: true, permission: 'owner' },
  resetstaffembeds: { triggers: ['resetstaffembeds'], enabled: true, permission: 'owner' },
  leveltest:        { triggers: ['leveltest'], enabled: true, permission: 'owner' },
  clear4:           { triggers: ['clear4'], enabled: true, permission: 'owner' },
};

const JESTER_DEFAULTS: CommandsConfig = {
  setroadmap:         { triggers: ['luna'], enabled: true, permission: 'owner' },
  roulette:           { triggers: ['roulette'], enabled: true, permission: 'admin' },
  bombroulette:       { triggers: ['LunaBomber', 'bomb'], enabled: true, permission: 'admin' },
  rps:                { triggers: ['rps', 'rock-paper-scissors'], enabled: true, permission: 'admin' },
  guessthecountry:    { triggers: ['country', 'guess-country'], enabled: true, permission: 'admin' },
  mafia:              { triggers: ['BloodMoon', 'Blood'], enabled: true, permission: 'admin' },
  LunaFantasy:        { triggers: ['fantasyyyyyyyyyyyyy', 'luna-fantasyyyyyyyyyyyyy'], enabled: true, permission: 'everyone' },
  votegame:           { triggers: ['votegame', 'vote-game', 'vote'], enabled: true, permission: 'everyone' },
  setshop:            { triggers: ['shop'], enabled: true, permission: 'owner' },
  'set-tickets-shop': { triggers: ['set-tickets-shop', 'Zoldar'], enabled: true, permission: 'owner' },
  'set-luckbox-shop': { triggers: ['set-luckbox-shop', 'Kael'], enabled: true, permission: 'owner' },
  'set-seluna':       { triggers: ['set-seluna', 'Seluna'], enabled: true, permission: 'owner' },
  'cancel-seluna':    { triggers: ['cancel-seluna', 'remove-seluna'], enabled: true, permission: 'owner' },
  seluna:             { triggers: ['seluna'], enabled: true, permission: 'everyone' },
  devseluna:          { triggers: ['devseluna'], enabled: true, permission: 'owner' },
  'set-meluna':       { triggers: ['set-meluna', 'Meluna'], enabled: true, permission: 'owner' },
  lbf:                { triggers: ['lbf', 'leaderboard-force'], enabled: true, permission: 'owner' },
  roulettevtest:      { triggers: ['tr'], enabled: true, permission: 'owner' },
};

// Check for duplicate triggers within a single bot
function getDuplicateTriggers(cmds: CommandsConfig): Map<string, string[]> {
  const seen = new Map<string, string>();
  const dupes = new Map<string, string[]>();
  for (const [key, entry] of Object.entries(cmds)) {
    for (const t of entry.triggers) {
      const lower = t.toLowerCase();
      if (seen.has(lower)) {
        dupes.set(lower, [seen.get(lower)!, key]);
      }
      seen.set(lower, key);
    }
  }
  return dupes;
}

// Check for duplicate triggers across both bots
function getCrossBotDuplicates(butler: CommandsConfig, jester: CommandsConfig): Map<string, [string, string]> {
  const dupes = new Map<string, [string, string]>();
  const butlerTriggers = new Map<string, string>();
  for (const [key, entry] of Object.entries(butler)) {
    for (const t of entry.triggers) butlerTriggers.set(t.toLowerCase(), key);
  }
  for (const [key, entry] of Object.entries(jester)) {
    for (const t of entry.triggers) {
      const lower = t.toLowerCase();
      if (butlerTriggers.has(lower)) {
        dupes.set(lower, [butlerTriggers.get(lower)!, key]);
      }
    }
  }
  return dupes;
}

export default function CommandsPage() {
  const [butlerCmds, setButlerCmds] = useState<CommandsConfig>(BUTLER_DEFAULTS);
  const [butlerCmdsOriginal, setButlerCmdsOriginal] = useState<CommandsConfig>(BUTLER_DEFAULTS);
  const [jesterCmds, setJesterCmds] = useState<CommandsConfig>(JESTER_DEFAULTS);
  const [jesterCmdsOriginal, setJesterCmdsOriginal] = useState<CommandsConfig>(JESTER_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  const fetchConfig = useCallback(async () => {
    try {
      const [butlerRes, jesterRes] = await Promise.all([
        fetch('/api/admin/config/butler'),
        fetch('/api/admin/config/jester'),
      ]);
      if (butlerRes.ok) {
        const data = await butlerRes.json();
        if (data.sections?.commands) {
          setButlerCmds(data.sections.commands);
          setButlerCmdsOriginal(data.sections.commands);
        }
      }
      if (jesterRes.ok) {
        const data = await jesterRes.json();
        if (data.sections?.commands) {
          setJesterCmds(data.sections.commands);
          setJesterCmdsOriginal(data.sections.commands);
        }
      }
    } catch {
      toast('Failed to load command config', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const butlerChanged = JSON.stringify(butlerCmds) !== JSON.stringify(butlerCmdsOriginal);
  const jesterChanged = JSON.stringify(jesterCmds) !== JSON.stringify(jesterCmdsOriginal);
  const hasChanges = butlerChanged || jesterChanged;
  useUnsavedWarning(hasChanges);

  const configDiff = hasChanges ? computeConfigDiff(
    { butler_commands: butlerCmdsOriginal, jester_commands: jesterCmdsOriginal },
    { butler_commands: butlerCmds, jester_commands: jesterCmds },
  ) : [];

  const butlerDupes = getDuplicateTriggers(butlerCmds);
  const jesterDupes = getDuplicateTriggers(jesterCmds);
  const hasDupes = butlerDupes.size > 0 || jesterDupes.size > 0;
  const crossBotDupes = getCrossBotDuplicates(butlerCmds, jesterCmds);

  const butlerEnabled = Object.values(butlerCmds).filter(c => c.enabled).length;
  const butlerTotal = Object.keys(butlerCmds).length;
  const jesterEnabled = Object.values(jesterCmds).filter(c => c.enabled).length;
  const jesterTotal = Object.keys(jesterCmds).length;

  async function saveConfig() {
    setSaving(true);
    try {
      const csrf = getCsrfToken();
      const saves: Promise<Response>[] = [];
      if (butlerChanged) {
        saves.push(fetch('/api/admin/config/butler', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
          body: JSON.stringify({ section: 'commands', value: butlerCmds }),
        }));
      }
      if (jesterChanged) {
        saves.push(fetch('/api/admin/config/jester', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
          body: JSON.stringify({ section: 'commands', value: jesterCmds }),
        }));
      }
      const results = await Promise.all(saves);
      for (const r of results) {
        if (!r.ok) {
          const data = await r.json();
          throw new Error(data.error || 'Save failed');
        }
      }
      if (butlerChanged) setButlerCmdsOriginal({ ...butlerCmds });
      if (jesterChanged) setJesterCmdsOriginal({ ...jesterCmds });
      toast('Saved! Bots will pick up changes within 30 seconds.', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setButlerCmds(butlerCmdsOriginal);
    setJesterCmds(jesterCmdsOriginal);
  }

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">&gt;_</span> Commands</h1>
          <p className="admin-page-subtitle">Manage bot command triggers, aliases, and permissions</p>
        </div>
        <SkeletonCard count={4} />
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">&gt;_</span> Commands</h1>
        <p className="admin-page-subtitle">Manage bot command triggers, aliases, and permissions. Changes apply within 30 seconds — no deploy needed.</p>
      </div>

      <div className="admin-alert admin-alert-info" style={{ fontSize: '12px' }}>
        Slash commands (/balance, /daily, /rank, etc.) are registered with Discord and cannot be renamed here. Only prefix commands (!command) are configurable.
      </div>

      {crossBotDupes.size > 0 && (
        <div className="admin-alert admin-alert-warning" style={{ fontSize: '12px' }}>
          Cross-bot trigger conflict: {Array.from(crossBotDupes.entries()).map(([trigger, [b, j]]) =>
            `"!${trigger}" is used by both Butler (${b}) and Jester (${j})`
          ).join('; ')}. Both bots will respond to the same message.
        </div>
      )}

      <ConfigSection title="Butler Commands" description={`${butlerTotal} prefix commands handled by LunaButler`} defaultOpen>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <BotBadge bot="butler" />
          <span className="cmd-status-line">{butlerEnabled} of {butlerTotal} enabled</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          {Object.entries(butlerCmds).map(([key, entry]) => (
            <CommandCard
              key={key}
              commandKey={key}
              entry={entry}
              description={BUTLER_DESCRIPTIONS[key] || ''}
              duplicates={butlerDupes}
              onChange={(updated) => setButlerCmds({ ...butlerCmds, [key]: updated })}
            />
          ))}
        </div>
      </ConfigSection>

      <ConfigSection title="Jester Commands" description={`${jesterTotal} prefix commands handled by LunaJester`} defaultOpen>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <BotBadge bot="jester" />
          <span className="cmd-status-line">{jesterEnabled} of {jesterTotal} enabled</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          {Object.entries(jesterCmds).map(([key, entry]) => (
            <CommandCard
              key={key}
              commandKey={key}
              entry={entry}
              description={JESTER_DESCRIPTIONS[key] || ''}
              duplicates={jesterDupes}
              onChange={(updated) => setJesterCmds({ ...jesterCmds, [key]: updated })}
            />
          ))}
        </div>
      </ConfigSection>

      <SaveDeployBar
        hasChanges={hasChanges}
        saving={saving}
        onSave={saveConfig}
        onDiscard={handleDiscard}
        projectName="Commands"
        validationErrors={hasDupes}
        diff={configDiff}
      />
    </>
  );
}

function CommandCard({
  commandKey,
  entry,
  description,
  duplicates,
  onChange,
}: {
  commandKey: string;
  entry: CommandEntry;
  description: string;
  duplicates: Map<string, string[]>;
  onChange: (entry: CommandEntry) => void;
}) {
  const [newTrigger, setNewTrigger] = useState('');

  const hasDupe = entry.triggers.some(t => duplicates.has(t.toLowerCase()));

  const cardClasses = [
    'cmd-card',
    !entry.enabled && 'cmd-card-disabled',
    hasDupe && 'cmd-card-error',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClasses}>
      {/* Header */}
      <div className="cmd-card-header">
        <div className="cmd-card-header-left">
          <span className="cmd-card-name">!{commandKey}</span>
          <span className="cmd-card-desc">{description}</span>
        </div>
        <ToggleSwitch
          label=""
          checked={entry.enabled}
          onChange={(v) => onChange({ ...entry, enabled: v })}
        />
      </div>

      {/* Permission */}
      <div className="cmd-card-row">
        <span className="cmd-card-row-label">Permission:</span>
        <span className={`cmd-permission-dot cmd-permission-dot-${entry.permission}`} />
        <select
          className="admin-form-input cmd-permission-select"
          value={entry.permission}
          onChange={(e) => onChange({ ...entry, permission: e.target.value as any })}
        >
          <option value="everyone">Everyone</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
        </select>
      </div>

      {/* Triggers */}
      <div className="cmd-card-row cmd-card-row-triggers">
        <span className="cmd-card-row-label">Triggers:</span>
        <div className="cmd-trigger-list">
          {entry.triggers.map((trigger, i) => {
            const isDupe = duplicates.has(trigger.toLowerCase());
            return (
              <span key={i} className={`cmd-trigger-pill ${isDupe ? 'cmd-trigger-pill-dupe' : ''}`} dir="auto">
                !{trigger}
                {entry.triggers.length > 1 && (
                  <button
                    className="cmd-trigger-remove"
                    onClick={() => onChange({ ...entry, triggers: entry.triggers.filter((_, j) => j !== i) })}
                  >
                    &times;
                  </button>
                )}
              </span>
            );
          })}
          <form className="cmd-trigger-add" onSubmit={(e) => {
            e.preventDefault();
            const t = newTrigger.trim();
            if (t && !entry.triggers.includes(t) && !t.includes(' ') && t.length <= 50) {
              onChange({ ...entry, triggers: [...entry.triggers, t] });
              setNewTrigger('');
            }
          }}>
            <input
              className="admin-form-input"
              placeholder="+ alias"
              value={newTrigger}
              onChange={(e) => setNewTrigger(e.target.value)}
              dir="auto"
              maxLength={50}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
