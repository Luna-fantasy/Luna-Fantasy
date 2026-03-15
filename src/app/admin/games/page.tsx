'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfigSection from '../components/ConfigSection';
import NumberInput from '../components/NumberInput';
import DurationInput from '../components/DurationInput';
import ToggleSwitch from '../components/ToggleSwitch';
import IdChipInput from '../components/IdChipInput';
import ConfigTable from '../components/ConfigTable';
import SaveDeployBar from '../components/SaveDeployBar';
import BotBadge from '../components/BotBadge';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';

// -- Butler game types --

interface ButlerGameBase {
  enabled: boolean;
  [key: string]: any;
}

interface ButlerSections {
  xo_game?: ButlerGameBase;
  rps_game?: ButlerGameBase;
  connect4_game?: ButlerGameBase;
  coinflip_game?: ButlerGameBase;
  hunt_game?: ButlerGameBase;
  roulette_game?: ButlerGameBase;
  luna21_game?: ButlerGameBase;
}

// -- Jester game types --

interface JesterGameBase {
  enabled?: boolean;
  [key: string]: any;
}

interface JesterSections {
  roulette?: JesterGameBase;
  mafia?: JesterGameBase;
  rps?: JesterGameBase;
  bombroulette?: JesterGameBase;
  guessthecountry?: JesterGameBase;
  magicbot?: JesterGameBase;
  LunaFantasy?: JesterGameBase;
  LunaFantasyEvent?: JesterGameBase;
  GrandFantasy?: JesterGameBase;
  FactionWar?: JesterGameBase;
}

// -- Points settings types --

interface PointsTier {
  players: number;
  points: number;
}

interface PointsSettings {
  roulette: PointsTier[];
  bombroulette: PointsTier[];
  rps: PointsTier[];
  mafia: PointsTier[];
  guessthecountry: number;
  LunaFantasy: number;
  LunaFantasy_bot: number;
  GrandFantasy: number;
  GrandFantasy_bot: number;
  FactionWar: number;
  FactionWar_bonus: number;
  FactionWar_double: number;
  FactionWar_bot: number;
  FactionWar_bonus_bot: number;
  FactionWar_double_bot: number;
  magicbot: number;
  [key: string]: any;
}

// -- Game metadata --

interface GameMeta {
  key: string;
  displayName: string;
  description: string;
}

const BUTLER_GAMES: GameMeta[] = [
  { key: 'xo_game', displayName: 'Tic-Tac-Toe (XO)', description: 'Classic Tic-Tac-Toe. Two players take turns marking squares. Winner earns Lunari.' },
  { key: 'rps_game', displayName: 'Rock Paper Scissors', description: 'Challenge another player to Rock Paper Scissors. Both players can earn Lunari on a draw.' },
  { key: 'connect4_game', displayName: 'Connect 4', description: 'Drop discs into a vertical board. First to connect 4 in a row wins Lunari.' },
  { key: 'coinflip_game', displayName: 'Coinflip', description: 'Bet Lunari on a coin flip. Double or nothing based on the win multiplier.' },
  { key: 'hunt_game', displayName: 'Hunt', description: 'Go on a hunt with a chance to find Lunari. You might come back empty-handed or lose some.' },
  { key: 'roulette_game', displayName: 'Russian Roulette', description: 'Bet Lunari and spin the chamber. Survive and win big, or lose your bet.' },
  { key: 'luna21_game', displayName: 'Luna 21', description: 'Blackjack-style card game. Get as close to 21 as possible without going over.' },
];

const JESTER_GAMES: GameMeta[] = [
  { key: 'roulette', displayName: 'Luna Roulette', description: 'Players join a spin-wheel lobby. Last one standing wins the pot of Lunari.' },
  { key: 'mafia', displayName: 'Blood Moon', description: 'Mafia-style game. Villagers must find the vampire before it\'s too late. Roles are assigned secretly.' },
  { key: 'rps', displayName: 'Luna RPS', description: 'Multiplayer Rock Paper Scissors tournament. Players compete in rounds until one remains.' },
  { key: 'bombroulette', displayName: 'Luna Bomber', description: 'A bomb is passed between players. If it explodes on your turn, you\'re out!' },
  { key: 'guessthecountry', displayName: 'Guess The Country', description: 'Geography trivia. Players see clues and race to guess the country first.' },
  { key: 'magicbot', displayName: 'Magic Pull', description: 'Spend tickets to pull a random magic card. Rarer cards are harder to find.' },
  { key: 'LunaFantasy', displayName: 'Luna Fantasy (Duel)', description: '1v1 card battle. Pick your best cards from your collection and duel another player.' },
  { key: 'LunaFantasyEvent', displayName: 'Luna Fantasy Event', description: 'Special event version of Luna Fantasy. Winners earn Lunari prizes.' },
  { key: 'GrandFantasy', displayName: 'Grand Fantasy', description: 'Full hand card battle using your entire collection. Play against others or the bot.' },
  { key: 'FactionWar', displayName: 'Faction War', description: 'Match cards by faction to complete sets and win. Multiple prize tiers based on performance.' },
];

// Lobby games that have tiered reward arrays
const LOBBY_GAMES: { key: keyof Pick<PointsSettings, 'roulette' | 'bombroulette' | 'rps' | 'mafia'>; displayName: string }[] = [
  { key: 'roulette', displayName: 'Luna Roulette' },
  { key: 'bombroulette', displayName: 'Luna Bomber' },
  { key: 'rps', displayName: 'Luna RPS' },
  { key: 'mafia', displayName: 'Blood Moon' },
];

type Tab = 'games' | 'rewards';

export default function GamesManagementPage() {
  const [tab, setTab] = useState<Tab>('games');

  // Butler state
  const [butlerSections, setButlerSections] = useState<ButlerSections>({});
  const [butlerOriginal, setButlerOriginal] = useState<ButlerSections>({});
  const [butlerLoading, setButlerLoading] = useState(true);
  const [butlerSaving, setButlerSaving] = useState(false);

  // Jester state
  const [jesterSections, setJesterSections] = useState<JesterSections>({});
  const [jesterOriginal, setJesterOriginal] = useState<JesterSections>({});
  const [jesterLoading, setJesterLoading] = useState(true);
  const [jesterSaving, setJesterSaving] = useState(false);

  // Points settings state (Rewards tab)
  const [pointsSettings, setPointsSettings] = useState<PointsSettings | null>(null);
  const [pointsOriginal, setPointsOriginal] = useState<PointsSettings | null>(null);
  const [pointsSaving, setPointsSaving] = useState(false);

  // Expanded state for settings panels
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { toast } = useToast();

  // -- Fetch configs --

  const fetchButlerConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config/butler');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sections = data.sections || {};
      const gameKeys = ['xo_game', 'rps_game', 'connect4_game', 'coinflip_game', 'hunt_game', 'roulette_game', 'luna21_game'];
      const filtered: ButlerSections = {};
      for (const k of gameKeys) {
        if (sections[k]) (filtered as any)[k] = sections[k];
      }
      setButlerSections(filtered);
      setButlerOriginal(filtered);
    } catch {
      toast('Failed to load Butler games. Try refreshing.', 'error');
    } finally {
      setButlerLoading(false);
    }
  }, [toast]);

  const fetchJesterConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config/jester');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sections = data.sections || {};
      const gameKeys = ['roulette', 'mafia', 'rps', 'bombroulette', 'guessthecountry', 'magicbot', 'LunaFantasy', 'LunaFantasyEvent', 'GrandFantasy', 'FactionWar'];
      const filtered: JesterSections = {};
      for (const k of gameKeys) {
          if (sections[k]) (filtered as any)[k] = sections[k];
        }
        setJesterSections(filtered);
        setJesterOriginal(filtered);

      // Also grab points_settings for the Rewards tab
      if (sections.points_settings) {
        setPointsSettings(sections.points_settings);
        setPointsOriginal(sections.points_settings);
      }
    } catch {
      toast('Failed to load Jester games. Try refreshing.', 'error');
    } finally {
      setJesterLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchButlerConfig();
    fetchJesterConfig();
  }, [fetchButlerConfig, fetchJesterConfig]);

  // -- Change detection --

  const butlerHasChanges = JSON.stringify(butlerSections) !== JSON.stringify(butlerOriginal);
  const jesterHasChanges = JSON.stringify(jesterSections) !== JSON.stringify(jesterOriginal);
  const gamesHasChanges = butlerHasChanges || jesterHasChanges;
  const pointsHasChanges = JSON.stringify(pointsSettings) !== JSON.stringify(pointsOriginal);

  // -- Update helpers --

  function updateButler(key: string, value: any) {
    setButlerSections((prev) => ({ ...prev, [key]: value }));
  }

  function updateJester(key: string, value: any) {
    setJesterSections((prev) => ({ ...prev, [key]: value }));
  }

  function updatePoints(key: string, value: any) {
    setPointsSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  function updatePointsTier(gameKey: string, rows: PointsTier[]) {
    setPointsSettings((prev) => prev ? { ...prev, [gameKey]: rows } : prev);
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // -- Save (All Games tab) --

  async function saveGamesConfig() {
    const savingButler = butlerHasChanges;
    const savingJester = jesterHasChanges;

    if (savingButler) setButlerSaving(true);
    if (savingJester) setJesterSaving(true);

    try {
      // Save Butler changes
      if (savingButler) {
        for (const key of Object.keys(butlerSections) as Array<keyof ButlerSections>) {
          if (JSON.stringify(butlerSections[key]) !== JSON.stringify(butlerOriginal[key])) {
            const res = await fetch('/api/admin/config/butler', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
              body: JSON.stringify({ section: key, value: butlerSections[key] }),
            });
            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || `Failed to save Butler ${key}`);
            }
          }
        }
        setButlerOriginal({ ...butlerSections });
      }

      // Save Jester changes
      if (savingJester) {
        for (const key of Object.keys(jesterSections) as Array<keyof JesterSections>) {
          if (JSON.stringify(jesterSections[key]) !== JSON.stringify(jesterOriginal[key])) {
            const res = await fetch('/api/admin/config/jester', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
              body: JSON.stringify({ section: key, value: jesterSections[key] }),
            });
            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || `Failed to save Jester ${key}`);
            }
          }
        }
        setJesterOriginal({ ...jesterSections });
      }

      toast('Saved! Changes take effect within 30 seconds.', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setButlerSaving(false);
      setJesterSaving(false);
    }
  }

  // -- Save (Rewards tab) --

  async function savePointsConfig() {
    setPointsSaving(true);

    try {
      const res = await fetch('/api/admin/config/jester', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ section: 'points_settings', value: pointsSettings }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save reward settings');
      }
      setPointsOriginal(pointsSettings ? { ...pointsSettings } : null);
      toast('Saved! Changes take effect within 30 seconds.', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setPointsSaving(false);
    }
  }

  // -- Loading state --

  const loading = butlerLoading || jesterLoading;

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title">Games Management</h1>
          <p className="admin-page-subtitle">Enable, disable, and configure all games across Butler and Jester</p>
        </div>
        <div className="admin-loading"><div className="admin-spinner" />Loading game configs...</div>
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Games Management</h1>
        <p className="admin-page-subtitle">Enable, disable, and configure all games across Butler and Jester</p>
      </div>

      {/* Tab bar */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'games' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('games')}
        >
          All Games
        </button>
        <button
          className={`admin-tab ${tab === 'rewards' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('rewards')}
        >
          Rewards
        </button>
      </div>

      {/* All Games tab */}
      {tab === 'games' && (
        <>
          {/* Butler Games Section */}
          <div style={{ marginBottom: '12px', marginTop: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#60a5fa',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}>
                BUTLER
              </span>
              Butler Games
              <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400 }}>({BUTLER_GAMES.length} games)</span>
            </h2>
          </div>

          {BUTLER_GAMES.map((meta) => {
            const game = (butlerSections as any)[meta.key];
            if (!game) return null;
            const isExpanded = expanded[meta.key] ?? false;
            const isEnabled = game.enabled ?? false;

            return (
              <div
                key={meta.key}
                style={{
                  marginBottom: '12px',
                  border: `1px solid ${isEnabled ? 'rgba(255, 255, 255, 0.06)' : 'rgba(239, 68, 68, 0.2)'}`,
                  borderRadius: '12px',
                  background: isEnabled ? 'rgba(255, 255, 255, 0.02)' : 'rgba(239, 68, 68, 0.03)',
                  opacity: isEnabled ? 1 : 0.7,
                  transition: 'all 0.2s ease',
                  overflow: 'hidden',
                }}
              >
                {/* Game card header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  gap: '16px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)' }}>{meta.displayName}</span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#60a5fa',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}>
                        Butler
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{meta.description}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                    <ToggleSwitch
                      label={isEnabled ? 'Enabled' : 'Disabled'}
                      checked={isEnabled}
                      onChange={(v) => updateButler(meta.key, { ...game, enabled: v })}
                    />
                    <button
                      onClick={() => toggleExpanded(meta.key)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'var(--text-secondary)',
                        padding: '6px 14px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isExpanded ? 'Hide Settings' : 'Settings'}
                    </button>
                  </div>
                </div>

                {/* Expanded settings */}
                {isExpanded && (
                  <div style={{
                    padding: '0 20px 20px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    paddingTop: '16px',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                      {renderButlerGameFields(meta.key, game, updateButler)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Jester Games Section */}
          <div style={{ marginBottom: '12px', marginTop: '36px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: '6px',
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                color: '#c084fc',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}>
                JESTER
              </span>
              Jester Games
              <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400 }}>({JESTER_GAMES.length} games)</span>
            </h2>
          </div>

          {JESTER_GAMES.map((meta) => {
            const game = (jesterSections as any)[meta.key];
            if (!game) return null;
            const isExpanded = expanded[`jester_${meta.key}`] ?? false;
            const isEnabled = game.enabled ?? true; // Jester games default to enabled if field missing

            return (
              <div
                key={meta.key}
                style={{
                  marginBottom: '12px',
                  border: `1px solid ${isEnabled ? 'rgba(255, 255, 255, 0.06)' : 'rgba(239, 68, 68, 0.2)'}`,
                  borderRadius: '12px',
                  background: isEnabled ? 'rgba(255, 255, 255, 0.02)' : 'rgba(239, 68, 68, 0.03)',
                  opacity: isEnabled ? 1 : 0.7,
                  transition: 'all 0.2s ease',
                  overflow: 'hidden',
                }}
              >
                {/* Game card header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  gap: '16px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)' }}>{meta.displayName}</span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(168, 85, 247, 0.15)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        color: '#c084fc',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}>
                        Jester
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{meta.description}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                    <ToggleSwitch
                      label={isEnabled ? 'Enabled' : 'Disabled'}
                      checked={isEnabled}
                      onChange={(v) => updateJester(meta.key, { ...game, enabled: v })}
                    />
                    <button
                      onClick={() => toggleExpanded(`jester_${meta.key}`)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'var(--text-secondary)',
                        padding: '6px 14px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isExpanded ? 'Hide Settings' : 'Settings'}
                    </button>
                  </div>
                </div>

                {/* Expanded settings */}
                {isExpanded && (
                  <div style={{
                    padding: '0 20px 20px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    paddingTop: '16px',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                      {renderJesterGameFields(meta.key, game, updateJester)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Save bar for All Games */}
          <SaveDeployBar
            hasChanges={gamesHasChanges}
            saving={butlerSaving || jesterSaving}
            onSave={saveGamesConfig}
            projectName={
              butlerHasChanges && jesterHasChanges
                ? 'Butler + Jester'
                : butlerHasChanges
                  ? 'Butler'
                  : 'Jester'
            }
          />
        </>
      )}


      {/* Rewards tab */}
      {tab === 'rewards' && (
        <>
          {!pointsSettings ? (
            <div style={{ color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>
              Reward settings could not be loaded. Check that the Jester config includes a points_settings section.
            </div>
          ) : (
            <>
              <ConfigSection
                title="Lobby Game Rewards"
                description="Lunari awarded to winners based on how many players joined the lobby"
              >
                {LOBBY_GAMES.map(({ key, displayName }) => (
                  <div key={key} style={{ marginBottom: '20px' }}>
                    <h4 style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '8px',
                      marginTop: key !== 'roulette' ? '16px' : '0',
                    }}>
                      {displayName}
                    </h4>
                    <ConfigTable
                      columns={[
                        { key: 'players', label: 'Minimum Players', type: 'number' },
                        { key: 'points', label: 'Reward (Lunari)', type: 'number' },
                      ]}
                      rows={pointsSettings[key] as PointsTier[]}
                      onChange={(rows) => updatePointsTier(key, rows as PointsTier[])}
                      addLabel="Add Tier"
                    />
                  </div>
                ))}
                <BotBadge bot="jester" />
              </ConfigSection>

              <ConfigSection
                title="Direct Game Rewards"
                description="Fixed Lunari amounts awarded for winning each game"
              >
                <NumberInput
                  label="Guess The Country"
                  value={pointsSettings.guessthecountry ?? 0}
                  onChange={(v) => updatePoints('guessthecountry', v)}
                  min={0}
                  description="Lunari for winning a round"
                />
                <NumberInput
                  label="Luna Fantasy (vs Player)"
                  value={pointsSettings.LunaFantasy ?? 0}
                  onChange={(v) => updatePoints('LunaFantasy', v)}
                  min={0}
                  description="Lunari for winning a PvP duel"
                />
                <NumberInput
                  label="Luna Fantasy (vs Bot)"
                  value={pointsSettings.LunaFantasy_bot ?? 0}
                  onChange={(v) => updatePoints('LunaFantasy_bot', v)}
                  min={0}
                  description="Lunari for beating the bot"
                />
                <NumberInput
                  label="Grand Fantasy (vs Player)"
                  value={pointsSettings.GrandFantasy ?? 0}
                  onChange={(v) => updatePoints('GrandFantasy', v)}
                  min={0}
                  description="Lunari for winning a PvP match"
                />
                <NumberInput
                  label="Grand Fantasy (vs Bot)"
                  value={pointsSettings.GrandFantasy_bot ?? 0}
                  onChange={(v) => updatePoints('GrandFantasy_bot', v)}
                  min={0}
                  description="Lunari for beating the bot"
                />
                <NumberInput
                  label="Faction War (Base Prize)"
                  value={pointsSettings.FactionWar ?? 0}
                  onChange={(v) => updatePoints('FactionWar', v)}
                  min={0}
                  description="Standard win reward"
                />
                <NumberInput
                  label="Faction War (Bonus Prize)"
                  value={pointsSettings.FactionWar_bonus ?? 0}
                  onChange={(v) => updatePoints('FactionWar_bonus', v)}
                  min={0}
                  description="Bonus victory reward"
                />
                <NumberInput
                  label="Faction War (Double Prize)"
                  value={pointsSettings.FactionWar_double ?? 0}
                  onChange={(v) => updatePoints('FactionWar_double', v)}
                  min={0}
                  description="Double victory reward"
                />
                <NumberInput
                  label="Magic Pull"
                  value={pointsSettings.magicbot ?? 0}
                  onChange={(v) => updatePoints('magicbot', v)}
                  min={0}
                  description="Lunari awarded per magic card pull"
                />
                <BotBadge bot="jester" />
              </ConfigSection>

              {/* Save bar for Rewards */}
              <SaveDeployBar
                hasChanges={pointsHasChanges}
                saving={pointsSaving}
                onSave={savePointsConfig}
                projectName="Jester"
              />
            </>
          )}
        </>
      )}
    </>
  );
}

// -- Butler game field renderers --

function renderButlerGameFields(
  key: string,
  game: any,
  update: (key: string, value: any) => void,
) {
  switch (key) {
    case 'xo_game':
    case 'rps_game':
    case 'connect4_game':
      return (
        <>
          <NumberInput label="Win Reward" value={game.win_reward} onChange={(v) => update(key, { ...game, win_reward: v })} min={0} description="Lunari awarded to the winner" />
          <NumberInput label="Draw Reward" value={game.draw_reward} onChange={(v) => update(key, { ...game, draw_reward: v })} min={0} description="Lunari earned when both players draw" />
          <DurationInput label="Timeout" value={game.timeout ?? 0} onChange={(v) => update(key, { ...game, timeout: v })} description="How long before the game expires if no one plays" />
        </>
      );
    case 'coinflip_game':
      return (
        <>
          <NumberInput label="Min Bet" value={game.min_bet} onChange={(v) => update(key, { ...game, min_bet: v })} min={0} description="Smallest amount of Lunari a player can bet" />
          <NumberInput label="Max Bet" value={game.max_bet} onChange={(v) => update(key, { ...game, max_bet: v })} min={0} description="Largest amount of Lunari a player can bet" />
          <NumberInput label="Win Multiplier" value={game.win_multiplier} onChange={(v) => update(key, { ...game, win_multiplier: v })} step={0.1} min={0} description="Bet is multiplied by this on a win (e.g. 2.0 = double)" />
          <DurationInput label="Cooldown" value={game.cooldown ?? 0} onChange={(v) => update(key, { ...game, cooldown: v })} description="Time between plays" />
        </>
      );
    case 'hunt_game':
      return (
        <>
          <NumberInput label="Success Chance (%)" value={game.success_chance} onChange={(v) => update(key, { ...game, success_chance: v })} min={0} max={100} description="Percentage chance the hunt succeeds (0-100)" />
          <NumberInput label="Min Reward" value={game.min_reward} onChange={(v) => update(key, { ...game, min_reward: v })} min={0} description="Smallest Lunari reward on a successful hunt" />
          <NumberInput label="Max Reward" value={game.max_reward} onChange={(v) => update(key, { ...game, max_reward: v })} min={0} description="Largest Lunari reward on a successful hunt" />
          <NumberInput label="Min Loss" value={game.min_loss} onChange={(v) => update(key, { ...game, min_loss: v })} min={0} description="Smallest Lunari lost on a failed hunt" />
          <NumberInput label="Max Loss" value={game.max_loss} onChange={(v) => update(key, { ...game, max_loss: v })} min={0} description="Largest Lunari lost on a failed hunt" />
          <DurationInput label="Cooldown" value={game.cooldown ?? 0} onChange={(v) => update(key, { ...game, cooldown: v })} description="Time between hunts" />
        </>
      );
    case 'roulette_game':
      return (
        <>
          <NumberInput label="Chambers" value={game.chambers} onChange={(v) => update(key, { ...game, chambers: v })} min={2} max={12} description="Number of chambers in the revolver (more = safer)" />
          <NumberInput label="Min Bet" value={game.min_bet} onChange={(v) => update(key, { ...game, min_bet: v })} min={0} description="Smallest amount of Lunari a player can bet" />
          <NumberInput label="Max Bet" value={game.max_bet} onChange={(v) => update(key, { ...game, max_bet: v })} min={0} description="Largest amount of Lunari a player can bet" />
          <NumberInput label="Reward Multiplier" value={game.reward_multiplier} onChange={(v) => update(key, { ...game, reward_multiplier: v })} step={0.1} description="Bet is multiplied by this if the player survives" />
          <DurationInput label="Cooldown" value={game.cooldown ?? 0} onChange={(v) => update(key, { ...game, cooldown: v })} description="Time between plays" />
        </>
      );
    case 'luna21_game':
      return (
        <>
          <NumberInput label="Min Bet" value={game.min_bet} onChange={(v) => update(key, { ...game, min_bet: v })} min={0} description="Smallest amount of Lunari a player can bet" />
          <NumberInput label="Max Bet" value={game.max_bet} onChange={(v) => update(key, { ...game, max_bet: v })} min={0} description="Largest amount of Lunari a player can bet" />
          <DurationInput label="Cooldown" value={game.cooldown ?? 0} onChange={(v) => update(key, { ...game, cooldown: v })} description="Time between plays" />
        </>
      );
    default:
      return null;
  }
}

// -- Jester game field renderers --

function renderJesterGameFields(
  key: string,
  game: any,
  update: (key: string, value: any) => void,
) {
  const commonMultiplayer = (
    <>
      <NumberInput label="Waiting Time" value={game.waiting_time ?? 0} onChange={(v) => update(key, { ...game, waiting_time: v })} min={0} description="Seconds players can join before the game starts" />
      <NumberInput label="Min Players" value={game.min_players ?? 2} onChange={(v) => update(key, { ...game, min_players: v })} min={1} description="Minimum players needed to start the game" />
      <NumberInput label="Max Players" value={game.max_players ?? 10} onChange={(v) => update(key, { ...game, max_players: v })} min={1} description="Maximum players allowed in one game" />
    </>
  );

  const channelRoleInputs = (
    <>
      <IdChipInput
        label="Allowed Channels"
        description="Only these channels can use this game. Leave empty to allow all channels."
        ids={game.allowedChannels ?? []}
        onChange={(ids) => update(key, { ...game, allowedChannels: ids })}
        placeholder="Paste a Discord channel ID and press Enter"
      />
      <IdChipInput
        label="Allowed Roles"
        description="Only users with these roles can play. Leave empty to allow everyone."
        ids={game.allowedRoles ?? []}
        onChange={(ids) => update(key, { ...game, allowedRoles: ids })}
        placeholder="Paste a Discord role ID and press Enter"
      />
    </>
  );

  switch (key) {
    case 'roulette':
    case 'mafia':
    case 'rps':
    case 'bombroulette':
      return (
        <>
          {commonMultiplayer}
          {channelRoleInputs}
        </>
      );
    case 'guessthecountry':
      return (
        <>
          <NumberInput label="Rounds" value={game.rounds ?? 5} onChange={(v) => update(key, { ...game, rounds: v })} min={1} description="How many rounds each game lasts" />
          <NumberInput label="Guess Time" value={game.guess_time ?? 30} onChange={(v) => update(key, { ...game, guess_time: v })} min={0} description="Seconds players have to guess each round" />
          {channelRoleInputs}
        </>
      );
    case 'magicbot':
      return (
        <>
          <NumberInput label="Ticket Cost" value={game.ticket_cost ?? 0} onChange={(v) => update(key, { ...game, ticket_cost: v })} min={0} description="Game tickets required to play (0 = free)" />
          {channelRoleInputs}
        </>
      );
    case 'LunaFantasy':
      return (
        <>
          <NumberInput label="Ticket Cost" value={game.ticket_cost ?? 0} onChange={(v) => update(key, { ...game, ticket_cost: v })} min={0} description="Game tickets required to enter a duel (0 = free)" />
          <NumberInput label="Round Time" value={game.round_time ?? 30} onChange={(v) => update(key, { ...game, round_time: v })} min={0} description="Seconds each player has per round" />
          <NumberInput label="Invite Timeout" value={game.pvp_invite_time ?? 60} onChange={(v) => update(key, { ...game, pvp_invite_time: v })} min={0} description="Seconds to accept a PvP challenge" />
          {channelRoleInputs}
        </>
      );
    case 'LunaFantasyEvent':
      return (
        <>
          <NumberInput label="Ticket Cost" value={game.ticket_cost ?? 0} onChange={(v) => update(key, { ...game, ticket_cost: v })} min={0} description="Game tickets required to enter (0 = free)" />
          <NumberInput label="Lunari Reward" value={game.lunari_reward ?? 0} onChange={(v) => update(key, { ...game, lunari_reward: v })} min={0} description="Lunari awarded to the winner" />
          <NumberInput label="Round Time" value={game.round_time ?? 30} onChange={(v) => update(key, { ...game, round_time: v })} min={0} description="Seconds each player has per round" />
          {channelRoleInputs}
        </>
      );
    case 'GrandFantasy':
      return (
        <>
          <NumberInput label="Ticket Cost" value={game.ticket_cost ?? 0} onChange={(v) => update(key, { ...game, ticket_cost: v })} min={0} description="Game tickets required to enter (0 = free)" />
          <NumberInput label="Prize" value={game.prize ?? 0} onChange={(v) => update(key, { ...game, prize: v })} min={0} description="Lunari awarded to the winner" />
          <NumberInput label="Prize (vs Bot)" value={game.prize_bot ?? 0} onChange={(v) => update(key, { ...game, prize_bot: v })} min={0} description="Lunari awarded when winning against the bot" />
          <NumberInput label="Round Time" value={game.round_time ?? 30} onChange={(v) => update(key, { ...game, round_time: v })} min={0} description="Seconds each player has per round" />
          {channelRoleInputs}
        </>
      );
    case 'FactionWar':
      return (
        <>
          <NumberInput label="Ticket Cost" value={game.ticket_cost ?? 0} onChange={(v) => update(key, { ...game, ticket_cost: v })} min={0} description="Game tickets required to enter (0 = free)" />
          <NumberInput label="Turn Time" value={game.turn_time ?? 30} onChange={(v) => update(key, { ...game, turn_time: v })} min={0} description="Seconds per turn" />
          <NumberInput label="Base Prize" value={game.prizes?.base ?? 0} onChange={(v) => update(key, { ...game, prizes: { ...game.prizes, base: v } })} min={0} description="Base Lunari reward for completing the game" />
          <NumberInput label="Bonus Prize" value={game.prizes?.bonus ?? 0} onChange={(v) => update(key, { ...game, prizes: { ...game.prizes, bonus: v } })} min={0} description="Extra Lunari bonus for strong performance" />
          <NumberInput label="Double Prize" value={game.prizes?.double ?? 0} onChange={(v) => update(key, { ...game, prizes: { ...game.prizes, double: v } })} min={0} description="Lunari awarded for completing a full double set" />
          {channelRoleInputs}
        </>
      );
    default:
      return null;
  }
}
