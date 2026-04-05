'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfigSection from '../components/ConfigSection';
import MinMaxWarning from '../components/MinMaxWarning';
import { useUnsavedWarning } from '../hooks/useUnsavedWarning';
import NumberInput from '../components/NumberInput';
import DurationInput from '../components/DurationInput';
import ToggleSwitch from '../components/ToggleSwitch';
import RolePicker from '../components/RolePicker';
import ChannelPicker from '../components/ChannelPicker';
import ConfigTable from '../components/ConfigTable';
import StringArrayInput from '../components/StringArrayInput';
import SaveDeployBar from '../components/SaveDeployBar';
import BotBadge from '../components/BotBadge';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';
import { useGuildData, type GuildRole, type GuildChannel } from '../utils/useGuildData';

// -- Permission summary for game cards --

function PermissionSummary({ roles: roleIds, channels: channelIds, allRoles, allChannels }: {
  roles?: string[];
  channels?: string[];
  allRoles: GuildRole[];
  allChannels: GuildChannel[];
}) {
  const hasRoles = roleIds && roleIds.length > 0;
  const hasChannels = channelIds && channelIds.length > 0;

  const roleMap = new Map(allRoles.map(r => [r.id, r]));
  const channelMap = new Map(allChannels.map(c => [c.id, c]));

  const pillStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '1px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 500,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-muted)', whiteSpace: 'nowrap',
  };
  const greenPill: React.CSSProperties = {
    ...pillStyle,
    background: 'rgba(74, 222, 128, 0.08)',
    border: '1px solid rgba(74, 222, 128, 0.25)',
    color: '#4ade80',
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
      {hasRoles ? roleIds!.map(id => {
        const r = roleMap.get(id);
        const color = r ? `#${r.color.toString(16).padStart(6, '0')}` : '#6b7280';
        return (
          <span key={`r-${id}`} style={pillStyle}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: r?.color ? color : '#6b7280', flexShrink: 0 }} />
            {r?.name ?? id.slice(0, 8)}
          </span>
        );
      }) : (
        <span style={greenPill}>🛡️ Everyone</span>
      )}
      {hasChannels ? channelIds!.map(id => {
        const c = channelMap.get(id);
        return (
          <span key={`c-${id}`} style={{ ...pillStyle, color: '#60a5fa' }}>
            # {c?.name ?? id.slice(0, 8)}
          </span>
        );
      }) : (
        <span style={greenPill}>📺 Any channel</span>
      )}
    </div>
  );
}

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
  baloot_game?: ButlerGameBase;
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
  mines?: JesterGameBase;
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
  mines: PointsTier[];
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
  { key: 'baloot_game', displayName: 'Baloot', description: 'Saudi-style Baloot card game. 2v2 teams compete in bidding, doubling, and trick-taking rounds.' },
];

const JESTER_GAMES: GameMeta[] = [
  { key: 'roulette', displayName: 'Luna Roulette', description: 'Players join a spin-wheel lobby. Last one standing wins the pot of Lunari.' },
  { key: 'mafia', displayName: 'Blood Moon', description: 'Mafia-style game. Villagers must find the vampire before it\'s too late. Roles are assigned secretly.' },
  { key: 'rps', displayName: 'Luna RPS', description: 'Multiplayer Rock Paper Scissors tournament. Players compete in rounds until one remains.' },
  { key: 'bombroulette', displayName: 'Luna Bomber', description: 'A bomb is passed between players. If it explodes on your turn, you\'re out!' },
  { key: 'guessthecountry', displayName: 'Guess The Country', description: 'Geography trivia. Players see clues and race to guess the country first.' },
  { key: 'mines', displayName: 'Mines', description: 'Hidden minefield! Pick a tile — safe or mine? Last one standing wins!' },
  { key: 'LunaFantasy', displayName: 'Luna Fantasy (Duel)', description: '1v1 card battle. Pick your best cards from your collection and duel another player.' },
  { key: 'LunaFantasyEvent', displayName: 'Luna Fantasy Event', description: 'Special event version of Luna Fantasy. Winners earn Lunari prizes.' },
  { key: 'GrandFantasy', displayName: 'Grand Fantasy', description: 'Full hand card battle using your entire collection. Play against others or the bot.' },
  { key: 'FactionWar', displayName: 'Faction War', description: 'Match cards by faction to complete sets and win. Multiple prize tiers based on performance.' },
];

// Lobby games that have tiered reward arrays
const LOBBY_GAMES: { key: keyof Pick<PointsSettings, 'roulette' | 'bombroulette' | 'rps' | 'mafia' | 'mines'>; displayName: string }[] = [
  { key: 'roulette', displayName: 'Luna Roulette' },
  { key: 'bombroulette', displayName: 'Luna Bomber' },
  { key: 'rps', displayName: 'Luna RPS' },
  { key: 'mafia', displayName: 'Blood Moon' },
  { key: 'mines', displayName: 'Mines' },
];

function getGameRewardPreview(game: any): string | null {
  if (!game) return null;
  if (game.win_reward) return `Win: ${game.win_reward.toLocaleString()} L`;
  if (game.reward) return `Win: ${game.reward.toLocaleString()} L`;
  if (game.max_bet) return `Bet: ${game.min_bet?.toLocaleString() ?? 0}–${game.max_bet.toLocaleString()} L`;
  if (game.max_reward) return `Reward: ${game.min_reward?.toLocaleString() ?? 0}–${game.max_reward.toLocaleString()} L`;
  return null;
}

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
  const { roles: guildRoles, channels: guildChannels } = useGuildData();

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
      // Baloot stores reward separately — construct game object
      if (sections.baloot_reward !== undefined) {
        (filtered as any).baloot_game = { enabled: true, reward: sections.baloot_reward };
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
      const gameKeys = ['roulette', 'mafia', 'rps', 'bombroulette', 'guessthecountry', 'mines', 'LunaFantasy', 'LunaFantasyEvent', 'GrandFantasy', 'FactionWar'];
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
  useUnsavedWarning(gamesHasChanges || pointsHasChanges);

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
            // Baloot stores only the reward number, not the full game object
            const section = key === 'baloot_game' ? 'baloot_reward' : key;
            const value = key === 'baloot_game' ? (butlerSections[key] as any)?.reward ?? 20000 : butlerSections[key];
            const res = await fetch('/api/admin/config/butler', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
              body: JSON.stringify({ section, value }),
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

  function discardGames() {
    setButlerSections({ ...butlerOriginal });
    setJesterSections({ ...jesterOriginal });
  }

  function discardPoints() {
    setPointsSettings(pointsOriginal ? { ...pointsOriginal } : null);
  }

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">🎮</span> Games Management</h1>
          <p className="admin-page-subtitle">Enable, disable, and configure all games across Butler and Jester</p>
        </div>
        <SkeletonCard count={4} />
        <SkeletonTable rows={5} />
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">🎮</span> Games Management</h1>
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
          <div style={{ marginBottom: '16px', marginTop: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="admin-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              Butler Games
              <BotBadge bot="butler" />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>({BUTLER_GAMES.length} games)</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {BUTLER_GAMES.map((meta) => {
              const game = (butlerSections as any)[meta.key];
              if (!game) return null;
              const isExpanded = expanded[meta.key] ?? false;
              const isEnabled = game.enabled ?? false;

              return (
                <div
                  key={meta.key}
                  className="admin-stat-card"
                  style={{
                    opacity: isEnabled ? 1 : 0.7,
                    transition: 'all 0.2s ease',
                    overflow: 'hidden',
                    padding: 0,
                    ...(isExpanded ? { gridColumn: '1 / -1' } : {}),
                  }}
                >
                  {/* Game card header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    gap: '12px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{meta.displayName}</span>
                        <span className={`admin-badge ${isEnabled ? 'admin-badge-success' : 'admin-badge-muted'}`}>
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '8px' }}>{meta.description}</div>
                      {getGameRewardPreview(game) && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(255, 213, 79, 0.1)',
                          border: '1px solid rgba(255, 213, 79, 0.2)',
                          color: '#fbbf24',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}>
                          {getGameRewardPreview(game)}
                        </span>
                      )}
                      <PermissionSummary roles={game.allowedRoles} channels={game.allowedChannels} allRoles={guildRoles} allChannels={guildChannels} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                      <ToggleSwitch
                        label=""
                        checked={isEnabled}
                        onChange={(v) => updateButler(meta.key, { ...game, enabled: v })}
                      />
                      <button
                        onClick={() => toggleExpanded(meta.key)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          color: 'var(--text-secondary)',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isExpanded ? 'Hide' : 'Settings'}
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
                      <div className="admin-config-grid">
                        {renderButlerGameFields(meta.key, game, updateButler)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Jester Games Section */}
          <div style={{ marginBottom: '16px', marginTop: '32px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="admin-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              Jester Games
              <BotBadge bot="jester" />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>({JESTER_GAMES.length} games)</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {JESTER_GAMES.map((meta) => {
              const game = (jesterSections as any)[meta.key];
              if (!game) return null;
              const isExpanded = expanded[`jester_${meta.key}`] ?? false;
              const isEnabled = game.enabled ?? true; // Jester games default to enabled if field missing

              return (
                <div
                  key={meta.key}
                  className="admin-stat-card"
                  style={{
                    opacity: isEnabled ? 1 : 0.7,
                    transition: 'all 0.2s ease',
                    overflow: 'hidden',
                    padding: 0,
                    ...(isExpanded ? { gridColumn: '1 / -1' } : {}),
                  }}
                >
                  {/* Game card header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    gap: '12px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{meta.displayName}</span>
                        <span className={`admin-badge ${isEnabled ? 'admin-badge-success' : 'admin-badge-muted'}`}>
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '8px' }}>{meta.description}</div>
                      {game.ticket_cost > 0 && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(255, 213, 79, 0.1)',
                          border: '1px solid rgba(255, 213, 79, 0.2)',
                          color: '#fbbf24',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}>
                          Cost: {game.ticket_cost} tickets
                        </span>
                      )}
                      <PermissionSummary roles={game.allowedRoles} channels={game.allowedChannels} allRoles={guildRoles} allChannels={guildChannels} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                      <ToggleSwitch
                        label=""
                        checked={isEnabled}
                        onChange={(v) => updateJester(meta.key, { ...game, enabled: v })}
                      />
                      <button
                        onClick={() => toggleExpanded(`jester_${meta.key}`)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          color: 'var(--text-secondary)',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isExpanded ? 'Hide' : 'Settings'}
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
                      <div className="admin-config-grid">
                        {renderJesterGameFields(meta.key, game, updateJester)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save bar for All Games */}
          <SaveDeployBar
            hasChanges={gamesHasChanges}
            saving={butlerSaving || jesterSaving}
            onSave={saveGamesConfig}
            onDiscard={discardGames}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {LOBBY_GAMES.map(({ key, displayName }) => (
                    <div key={key} className="admin-stat-card" style={{ padding: '16px 20px', gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <h4 style={{
                          fontSize: '15px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          margin: 0,
                        }}>
                          {displayName}
                        </h4>
                        <BotBadge bot="jester" />
                      </div>
                      <ConfigTable
                        columns={[
                          { key: 'players', label: '🔢 Minimum Players', type: 'number' },
                          { key: 'points', label: '🏆 Reward (Lunari)', type: 'number' },
                        ]}
                        rows={pointsSettings[key] as PointsTier[]}
                        onChange={(rows) => updatePointsTier(key, rows as PointsTier[])}
                        addLabel="Add Tier"
                      />
                    </div>
                  ))}
                </div>
              </ConfigSection>

              <ConfigSection
                title="Direct Game Rewards"
                description="Fixed Lunari amounts awarded for winning each game"
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  <div className="admin-stat-card" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Guess The Country</h4>
                      <BotBadge bot="jester" />
                    </div>
                    <NumberInput
                      label="🏆 Win Reward"
                      value={pointsSettings.guessthecountry ?? 0}
                      onChange={(v) => updatePoints('guessthecountry', v)}
                      min={0}
                      description="Lunari for winning a round"
                    />
                  </div>

                  <div className="admin-stat-card" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Luna Fantasy</h4>
                      <BotBadge bot="jester" />
                    </div>
                    <NumberInput
                      label="🏆 vs Player"
                      value={pointsSettings.LunaFantasy ?? 0}
                      onChange={(v) => updatePoints('LunaFantasy', v)}
                      min={0}
                      description="Lunari for winning a PvP duel"
                    />
                    <NumberInput
                      label="🏆 vs Bot"
                      value={pointsSettings.LunaFantasy_bot ?? 0}
                      onChange={(v) => updatePoints('LunaFantasy_bot', v)}
                      min={0}
                      description="Lunari for beating the bot"
                    />
                  </div>

                  <div className="admin-stat-card" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Grand Fantasy</h4>
                      <BotBadge bot="jester" />
                    </div>
                    <NumberInput
                      label="🏆 vs Player"
                      value={pointsSettings.GrandFantasy ?? 0}
                      onChange={(v) => updatePoints('GrandFantasy', v)}
                      min={0}
                      description="Lunari for winning a PvP match"
                    />
                    <NumberInput
                      label="🏆 vs Bot"
                      value={pointsSettings.GrandFantasy_bot ?? 0}
                      onChange={(v) => updatePoints('GrandFantasy_bot', v)}
                      min={0}
                      description="Lunari for beating the bot"
                    />
                  </div>

                  <div className="admin-stat-card" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Faction War</h4>
                      <BotBadge bot="jester" />
                    </div>
                    <NumberInput
                      label="🏆 Base Prize"
                      value={pointsSettings.FactionWar ?? 0}
                      onChange={(v) => updatePoints('FactionWar', v)}
                      min={0}
                      description="Standard win reward"
                    />
                    <NumberInput
                      label="🏆 Bonus Prize"
                      value={pointsSettings.FactionWar_bonus ?? 0}
                      onChange={(v) => updatePoints('FactionWar_bonus', v)}
                      min={0}
                      description="Bonus victory reward"
                    />
                    <NumberInput
                      label="🏆 Double Prize"
                      value={pointsSettings.FactionWar_double ?? 0}
                      onChange={(v) => updatePoints('FactionWar_double', v)}
                      min={0}
                      description="Double victory reward"
                    />
                  </div>
                </div>
              </ConfigSection>

              {/* Save bar for Rewards */}
              <SaveDeployBar
                hasChanges={pointsHasChanges}
                saving={pointsSaving}
                onSave={savePointsConfig}
                onDiscard={discardPoints}
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
  const channelRoleInputs = (
    <>
      <ChannelPicker
        label="📺 Where can this game be played?"
        description="Pick channels. Empty = works in ALL channels."
        value={game.allowedChannels ?? []}
        onChange={(v) => update(key, { ...game, allowedChannels: v })}
        multi
      />
      <RolePicker
        label="🛡️ Who can play this game?"
        description="Pick roles. Empty = EVERYONE can play."
        value={game.allowedRoles ?? []}
        onChange={(v) => update(key, { ...game, allowedRoles: v })}
        multi
      />
    </>
  );

  switch (key) {
    case 'xo_game':
    case 'rps_game':
    case 'connect4_game':
      return (
        <>
          <NumberInput label="🏆 Win Reward" value={game.win_reward} onChange={(v) => update(key, { ...game, win_reward: v })} min={0} description="Lunari awarded to the winner" />
          <NumberInput label="🏆 Draw Reward" value={game.draw_reward} onChange={(v) => update(key, { ...game, draw_reward: v })} min={0} description="Lunari earned when both players draw" />
          <DurationInput label="⏱️ Timeout" value={game.timeout ?? 0} onChange={(v) => update(key, { ...game, timeout: v })} description="How long before the game expires if no one plays" />
          {channelRoleInputs}
        </>
      );
    case 'coinflip_game':
      return (
        <>
          <NumberInput label="🎲 Min Bet" value={game.min_bet} onChange={(v) => update(key, { ...game, min_bet: v })} min={0} description="Smallest amount of Lunari a player can bet" />
          <NumberInput label="🎲 Max Bet" value={game.max_bet} onChange={(v) => update(key, { ...game, max_bet: v })} min={0} description="Largest amount of Lunari a player can bet" />
          <MinMaxWarning min={game.min_bet} max={game.max_bet} label="Bet" />
          <NumberInput label="📊 Win Multiplier" value={game.win_multiplier} onChange={(v) => update(key, { ...game, win_multiplier: v })} step={0.1} min={0} description="Bet is multiplied by this on a win (e.g. 2.0 = double)" />
          <DurationInput label="⏱️ Cooldown" value={game.cooldown ?? 0} onChange={(v) => update(key, { ...game, cooldown: v })} description="Time between plays" />
          {channelRoleInputs}
        </>
      );
    case 'hunt_game':
      return (
        <>
          <NumberInput label="📊 Success Chance (%)" value={game.success_chance} onChange={(v) => update(key, { ...game, success_chance: v })} min={0} max={100} description="Percentage chance the hunt succeeds (0-100)" />
          <NumberInput label="🏆 Min Reward" value={game.min_reward} onChange={(v) => update(key, { ...game, min_reward: v })} min={0} description="Smallest Lunari reward on a successful hunt" />
          <NumberInput label="🏆 Max Reward" value={game.max_reward} onChange={(v) => update(key, { ...game, max_reward: v })} min={0} description="Largest Lunari reward on a successful hunt" />
          <MinMaxWarning min={game.min_reward} max={game.max_reward} label="Reward" />
          <NumberInput label="💰 Min Loss" value={game.min_loss} onChange={(v) => update(key, { ...game, min_loss: v })} min={0} description="Smallest Lunari lost on a failed hunt" />
          <NumberInput label="💰 Max Loss" value={game.max_loss} onChange={(v) => update(key, { ...game, max_loss: v })} min={0} description="Largest Lunari lost on a failed hunt" />
          <MinMaxWarning min={game.min_loss} max={game.max_loss} label="Loss" />
          <DurationInput label="⏱️ Cooldown" value={game.cooldown ?? 0} onChange={(v) => update(key, { ...game, cooldown: v })} description="Time between hunts" />
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 250px' }}>
              <StringArrayInput
                label="📝 Hunt Animals"
                description="Names of animals that can be caught on a successful hunt"
                value={game.animals ?? []}
                onChange={(v) => update(key, { ...game, animals: v })}
                placeholder="e.g. Rabbit"
                addLabel="Add Animal"
              />
            </div>
            <div style={{ flex: '1 1 250px' }}>
              <StringArrayInput
                label="📝 Failure Messages"
                description="Messages shown when the hunt fails"
                value={game.failures ?? []}
                onChange={(v) => update(key, { ...game, failures: v })}
                placeholder="e.g. The animal escaped..."
                addLabel="Add Message"
                dir="auto"
              />
            </div>
          </div>
          {channelRoleInputs}
        </>
      );
    case 'roulette_game':
      return (
        <>
          <NumberInput label="🔢 Chambers" value={game.chambers} onChange={(v) => update(key, { ...game, chambers: v })} min={2} max={12} description="Number of chambers in the revolver (more = safer)" />
          <NumberInput label="🎲 Min Bet" value={game.min_bet} onChange={(v) => update(key, { ...game, min_bet: v })} min={0} description="Smallest amount of Lunari a player can bet" />
          <NumberInput label="🎲 Max Bet" value={game.max_bet} onChange={(v) => update(key, { ...game, max_bet: v })} min={0} description="Largest amount of Lunari a player can bet" />
          <MinMaxWarning min={game.min_bet} max={game.max_bet} label="Bet" />
          <NumberInput label="📊 Reward Multiplier" value={game.reward_multiplier} onChange={(v) => update(key, { ...game, reward_multiplier: v })} step={0.1} description="Bet is multiplied by this if the player survives" />
          <DurationInput label="⏱️ Cooldown" value={game.cooldown ?? 0} onChange={(v) => update(key, { ...game, cooldown: v })} description="Time between plays" />
          {channelRoleInputs}
        </>
      );
    case 'luna21_game':
      return (
        <>
          <NumberInput label="🎲 Min Bet" value={game.min_bet} onChange={(v) => update(key, { ...game, min_bet: v })} min={0} description="Smallest amount of Lunari a player can bet" />
          <NumberInput label="🎲 Max Bet" value={game.max_bet} onChange={(v) => update(key, { ...game, max_bet: v })} min={0} description="Largest amount of Lunari a player can bet" />
          <MinMaxWarning min={game.min_bet} max={game.max_bet} label="Bet" />
          <DurationInput label="⏱️ Cooldown" value={game.cooldown ?? 0} onChange={(v) => update(key, { ...game, cooldown: v })} description="Time between plays" />
          {channelRoleInputs}
        </>
      );
    case 'baloot_game':
      return (
        <>
          <NumberInput label="🏆 Win Reward" value={game.reward ?? 20000} onChange={(v) => update(key, { ...game, reward: v })} min={0} description="Lunari awarded to each player on the winning team" />
          {channelRoleInputs}
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
      <NumberInput label="⏱️ Waiting Time" value={game.waiting_time ?? 0} onChange={(v) => update(key, { ...game, waiting_time: v })} min={0} description="Seconds players can join before the game starts" />
      <NumberInput label="🔢 Min Players" value={game.min_players ?? 2} onChange={(v) => update(key, { ...game, min_players: v })} min={1} description="Minimum players needed to start the game" />
      <NumberInput label="🔢 Max Players" value={game.max_players ?? 10} onChange={(v) => update(key, { ...game, max_players: v })} min={1} description="Maximum players allowed in one game" />
    </>
  );

  const channelRoleInputs = (
    <>
      <ChannelPicker
        label="📺 Where can this game be played?"
        description="Pick channels. Empty = works in ALL channels."
        value={game.allowedChannels ?? []}
        onChange={(v) => update(key, { ...game, allowedChannels: v })}
        multi
      />
      <RolePicker
        label="🛡️ Who can play this game?"
        description="Pick roles. Empty = EVERYONE can play."
        value={game.allowedRoles ?? []}
        onChange={(v) => update(key, { ...game, allowedRoles: v })}
        multi
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
    case 'mines':
      return (
        <>
          {commonMultiplayer}
          {channelRoleInputs}
        </>
      );
    case 'guessthecountry':
      return (
        <>
          <NumberInput label="🔢 Rounds" value={game.rounds ?? 5} onChange={(v) => update(key, { ...game, rounds: v })} min={1} description="How many rounds each game lasts" />
          <NumberInput label="⏱️ Guess Time" value={game.guess_time ?? 30} onChange={(v) => update(key, { ...game, guess_time: v })} min={0} description="Seconds players have to guess each round" />
          {channelRoleInputs}
        </>
      );
    case 'LunaFantasy':
      return (
        <>
          <NumberInput label="🎟️ Ticket Cost" value={game.ticket_cost ?? 0} onChange={(v) => update(key, { ...game, ticket_cost: v })} min={0} description="Game tickets required to enter a duel (0 = free)" />
          <NumberInput label="⏱️ Round Time" value={game.round_time ?? 30} onChange={(v) => update(key, { ...game, round_time: v })} min={0} description="Seconds each player has per round" />
          <NumberInput label="⏱️ Invite Timeout" value={game.pvp_invite_time ?? 60} onChange={(v) => update(key, { ...game, pvp_invite_time: v })} min={0} description="Seconds to accept a PvP challenge" />
          {channelRoleInputs}
        </>
      );
    case 'LunaFantasyEvent':
      return (
        <>
          <NumberInput label="🎟️ Ticket Cost" value={game.ticket_cost ?? 0} onChange={(v) => update(key, { ...game, ticket_cost: v })} min={0} description="Game tickets required to enter (0 = free)" />
          <NumberInput label="🏆 Lunari Reward" value={game.lunari_reward ?? 0} onChange={(v) => update(key, { ...game, lunari_reward: v })} min={0} description="Lunari awarded to the winner" />
          <NumberInput label="⏱️ Round Time" value={game.round_time ?? 30} onChange={(v) => update(key, { ...game, round_time: v })} min={0} description="Seconds each player has per round" />
          {channelRoleInputs}
        </>
      );
    case 'GrandFantasy':
      return (
        <>
          <NumberInput label="🎟️ Ticket Cost" value={game.ticket_cost ?? 0} onChange={(v) => update(key, { ...game, ticket_cost: v })} min={0} description="Game tickets required to enter (0 = free)" />
          <NumberInput label="🏆 Prize" value={game.prize ?? 0} onChange={(v) => update(key, { ...game, prize: v })} min={0} description="Lunari awarded to the winner" />
          <NumberInput label="🏆 Prize (vs Bot)" value={game.prize_bot ?? 0} onChange={(v) => update(key, { ...game, prize_bot: v })} min={0} description="Lunari awarded when winning against the bot" />
          <NumberInput label="⏱️ Round Time" value={game.round_time ?? 30} onChange={(v) => update(key, { ...game, round_time: v })} min={0} description="Seconds each player has per round" />
          {channelRoleInputs}
        </>
      );
    case 'FactionWar':
      return (
        <>
          <NumberInput label="🎟️ Ticket Cost" value={game.ticket_cost ?? 0} onChange={(v) => update(key, { ...game, ticket_cost: v })} min={0} description="Game tickets required to enter (0 = free)" />
          <NumberInput label="⏱️ Turn Time" value={game.turn_time ?? 30} onChange={(v) => update(key, { ...game, turn_time: v })} min={0} description="Seconds per turn" />
          <NumberInput label="🏆 Base Prize" value={game.prizes?.base ?? 0} onChange={(v) => update(key, { ...game, prizes: { ...game.prizes, base: v } })} min={0} description="Base Lunari reward for completing the game" />
          <NumberInput label="🏆 Bonus Prize" value={game.prizes?.bonus ?? 0} onChange={(v) => update(key, { ...game, prizes: { ...game.prizes, bonus: v } })} min={0} description="Extra Lunari bonus for strong performance" />
          <NumberInput label="🏆 Double Prize" value={game.prizes?.double ?? 0} onChange={(v) => update(key, { ...game, prizes: { ...game.prizes, double: v } })} min={0} description="Lunari awarded for completing a full double set" />
          {channelRoleInputs}
        </>
      );
    default:
      return null;
  }
}
