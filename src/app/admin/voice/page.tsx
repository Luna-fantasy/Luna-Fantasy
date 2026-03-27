'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ConfigSection from '../components/ConfigSection';
import NumberInput from '../components/NumberInput';
import ToggleSwitch from '../components/ToggleSwitch';
import DurationInput from '../components/DurationInput';
import StringArrayInput from '../components/StringArrayInput';
import RolePicker from '../components/RolePicker';
import ChannelPicker from '../components/ChannelPicker';
import SaveDeployBar from '../components/SaveDeployBar';
import StatCard from '../components/StatCard';
import AdminLightbox from '../components/AdminLightbox';
import ConfirmModal from '../components/ConfirmModal';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';
import { timeAgo } from '../utils/timeAgo';
import { computeConfigDiff } from '../utils/computeConfigDiff';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HubChannel {
  channelId: string;
  categoryId: string;
  nameTemplate: string;
  defaultUserLimit: number;
  defaultBitrate: number;
}

interface SetupSection {
  hubChannels: HubChannel[];
  vipCategoryId: string;
  logChannelId: string;
  staffRoleIds: string[];
  maxTempRoomsPerUser: number;
  maxVipRoomsPerUser: number;
  gracePeriodMs: number;
  welcomeCooldownMs: number;
  challengesEnabled: boolean;
  challengeIntervalMs: number;
  challengeMinMembers: number;
  auraUpdateIntervalMs: number;
  panelAutoRefreshMs: number;
}

interface TriviaQuestion {
  q: string;
  answers: string[];
  correct: number;
}

interface GameSettings {
  mathOps: { enabled: string[]; rewardMin: number; rewardMax: number; timeoutMs: number };
  triviaReward: { autoDropMin: number; autoDropMax: number; miniMin: number; miniMax: number };
  triviaTimeoutMs: number;
  triviaSessionSize: number;
  streakBonuses: Record<string, number>;
  quickReact: { rewardMin: number; rewardMax: number; delayMin: number; delayMax: number; timeoutMs: number };
  emojiRaceEmojis: string[];
  sowalefSessionSize: number;
  sowalefDebounceMs: number;
  gameCooldownMs: number;
  endCooldownMs: number;
  auraRewardMultipliers?: Record<string, number>;
  bossChallenge?: { enabled: boolean; rewardMin: number; rewardMax: number; cooldownHours: number; questionCount: number };
}

interface ContentPanel {
  line1: string;
  line2: string;
  line3: string;
  line4: string;
}

interface ContentAura {
  auraTiers: Record<string, string>;
  auraThresholds: Record<string, number>;
  auraWeights: Record<string, number>;
}

interface ContentWhisper {
  cooldownMs: number;
  colors: number[];
  ansiColors: string[];
  modalTitle: string;
  modalPlaceholder: string;
  autoCleanupMs: number;
}

interface VipTier {
  name: string;
  label: string;
  cost: number;
  days: number;
  emoji: string;
}

interface VipSection {
  tiers: Record<string, VipTier>;
  renewDiscountPercent: number;
  expiryWarningHours: number;
  graceAfterExpiryMs: number;
}

interface AssetsSection {
  panelBannerUrl: string;
  emojis: Record<string, string>;
}

interface VoiceSections {
  setup?: SetupSection;
  games_trivia?: TriviaQuestion[];
  games_sowalef?: string[];
  games_settings?: GameSettings;
  content_welcome?: string[];
  content_panel?: ContentPanel;
  content_buttons?: Record<string, string>;
  content_aura?: ContentAura;
  content_whisper?: ContentWhisper;
  content_expiry?: Record<string, string>;
  assets?: AssetsSection;
}

interface VoiceStats {
  activeRooms: any[];
  hallOfRecords: { byAura: any[]; byVisitors: any[] };
  topUsers: any[];
  totals: { totalRoomsCreated: number; totalVoiceHours: number; totalLunariSpent: number; activeRoomsCount: number };
}

interface VoiceUserProfile {
  stats: {
    totalRoomsCreated: number;
    totalVoiceMinutes: number;
    challengesWon: number;
    totalLunariSpent: number;
    vipPurchases: number;
  };
  roomHistory: { name: string; peakAuraScore: number; totalVisitors: number; deletedAt: string | null }[];
  currentRoom: { _id: string; name: string; aura: { tier: string; score: number }; memberCount: number } | null;
}

type Tab = 'setup' | 'games' | 'content' | 'assets' | 'stats';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ALL_MATH_OPS = [
  'add', 'subtract', 'multiply', 'divide', 'square', 'cube',
  'percent', 'multistep_add', 'multistep_sub', 'order_of_ops',
];

const BUTTON_KEYS = [
  'lock', 'unlock', 'hide', 'limit', 'region', 'trust',
  'ban', 'kick', 'claim', 'transfer', 'whisper', 'save',
  'load', 'math', 'trivia', 'react', 'sowalef',
];

const BUTTON_DESCRIPTIONS: Record<string, string> = {
  lock: 'Prevents new users from joining the room',
  unlock: 'Allows anyone to join the room again',
  hide: 'Makes the room invisible to non-members',
  limit: 'Sets a maximum number of users in the room',
  region: 'Changes the voice server region for better quality',
  trust: 'Gives a user permission to manage the room',
  ban: 'Permanently blocks a user from the room',
  kick: 'Removes a user from the room (they can rejoin)',
  claim: 'Takes ownership of an unclaimed room',
  transfer: 'Gives room ownership to another user',
  whisper: 'Sends a private message to the room',
  save: 'Saves the current room settings as a preset',
  load: 'Restores a previously saved room preset',
  math: 'Starts a math challenge game',
  trivia: 'Starts a trivia quiz game',
  react: 'Starts a quick reaction game',
  sowalef: 'Starts a conversation topic game',
};

const AURA_TIER_KEYS = ['dormant', 'flickering', 'glowing', 'radiant', 'blazing'];
const AURA_THRESHOLD_KEYS = ['flickering', 'glowing', 'radiant', 'blazing'];
const AURA_WEIGHT_KEYS = ['warmthPerVisitor', 'warmthMax', 'energyDivisor', 'energyMax', 'harmonyPerMin', 'harmonyMax', 'loyaltyMax'];

const TIMEOUT_MESSAGE_KEYS = ['trivia', 'math', 'emoji_race', 'quickreact', 'endurance'];

const AURA_ROW_STYLES: Record<string, React.CSSProperties> = {
  dormant: { opacity: 0.6 },
  flickering: { borderLeft: '3px solid #3b82f6' },
  glowing: { borderLeft: '3px solid #06b6d4' },
  radiant: { borderLeft: '3px solid #a855f7' },
  blazing: { borderLeft: '3px solid #f97316' },
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function VoicePage() {
  const [tab, setTab] = useState<Tab>('setup');
  const [sections, setSections] = useState<VoiceSections>({});
  const [original, setOriginal] = useState<VoiceSections>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configMetadata, setConfigMetadata] = useState<{ updatedAt: string | null; updatedBy: string | null }>({ updatedAt: null, updatedBy: null });

  // Stats tab
  const [stats, setStats] = useState<VoiceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsFetched, setStatsFetched] = useState(false);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Games tab search
  const [triviaSearch, setTriviaSearch] = useState('');
  const [sowalefSearch, setSowalefSearch] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);

  // Room management
  const [confirmAction, setConfirmAction] = useState<{ action: string; roomId: string; roomName: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // User drill-down
  const [userModalId, setUserModalId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<VoiceUserProfile | null>(null);
  const [userProfileLoading, setUserProfileLoading] = useState(false);

  const { toast } = useToast();

  /* ---------------------------------------------------------------- */
  /*  Fetch config                                                     */
  /* ---------------------------------------------------------------- */

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config/oracle');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const s = data.sections || {};
      if (data.metadata) setConfigMetadata(data.metadata);
      setSections(s);
      setOriginal(s);
    } catch {
      toast('Failed to load voice config. Try refreshing.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  /* ---------------------------------------------------------------- */
  /*  Fetch stats (only on stats tab)                                  */
  /* ---------------------------------------------------------------- */

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/voice/stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
    } catch {
      toast('Failed to load voice stats.', 'error');
    } finally {
      setStatsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (tab === 'stats' && !statsFetched) {
      setStatsLoading(true);
      setStatsFetched(true);
      fetchStats();
    }
    if (tab === 'stats') {
      statsIntervalRef.current = setInterval(fetchStats, 10_000);
      return () => { if (statsIntervalRef.current) clearInterval(statsIntervalRef.current); };
    } else {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    }
  }, [tab, statsFetched, fetchStats]);

  /* ---------------------------------------------------------------- */
  /*  Change tracking                                                  */
  /* ---------------------------------------------------------------- */

  const hasChanges = JSON.stringify(sections) !== JSON.stringify(original);
  const configDiff = hasChanges ? computeConfigDiff(original as any, sections as any) : [];

  function updateSection<K extends keyof VoiceSections>(key: K, value: VoiceSections[K]) {
    setSections((prev) => ({ ...prev, [key]: value }));
  }

  const handleDiscard = () => {
    setSections(original);
  };

  /* ---------------------------------------------------------------- */
  /*  Save                                                             */
  /* ---------------------------------------------------------------- */

  async function saveConfig() {
    setSaving(true);
    try {
      const changedSections: Array<keyof VoiceSections> = [];
      for (const key of Object.keys(sections) as Array<keyof VoiceSections>) {
        if (JSON.stringify(sections[key]) !== JSON.stringify(original[key])) {
          changedSections.push(key);
        }
      }
      for (const section of changedSections) {
        const res = await fetch('/api/admin/config/oracle', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body: JSON.stringify({ section, value: sections[section] }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(data.error || `Failed to save section "${section}"`);
        }
      }
      setOriginal({ ...sections });
      toast('Saved! Changes take effect within 30 seconds.', 'success');
    } catch (err: any) {
      toast(`Save failed: ${err.message}`, 'error');
      // Re-fetch config from server to show the true persisted state
      try {
        const res = await fetch('/api/admin/config/oracle');
        if (res.ok) {
          const data = await res.json();
          const s = data.sections || {};
          if (data.metadata) setConfigMetadata(data.metadata);
          setSections(s);
          setOriginal(s);
        }
      } catch {
        // Silently fail — user already saw the save error toast
      }
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Upload handler                                                   */
  /* ---------------------------------------------------------------- */

  async function handleBannerUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast('File must be under 5 MB.', 'error');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/config/oracle/upload', {
        method: 'POST',
        headers: { 'x-csrf-token': getCsrfToken() },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }
      const data = await res.json();
      updateSection('assets', { ...sections.assets!, panelBannerUrl: data.url });
      toast('Banner uploaded.', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Room management actions                                          */
  /* ---------------------------------------------------------------- */

  async function executeRoomAction(action: string, roomId: string, value?: string) {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/voice/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ action, roomId, ...(value ? { value } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || `Failed to ${action} room`);
      }
      toast(`Room ${action} queued. Bot will execute on next cycle.`, 'success');
      setConfirmAction(null);
      // Refresh stats to show updated state
      fetchStats();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  User profile drill-down                                          */
  /* ---------------------------------------------------------------- */

  async function fetchUserProfile(userId: string) {
    setUserModalId(userId);
    setUserProfile(null);
    setUserProfileLoading(true);
    try {
      const res = await fetch(`/api/admin/voice/user?id=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || 'Failed to load user profile');
      }
      const data = await res.json();
      setUserProfile(data);
    } catch (err: any) {
      toast(err.message, 'error');
      setUserModalId(null);
    } finally {
      setUserProfileLoading(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">🎙️</span> Voice</h1>
          <p className="admin-page-subtitle">Configure Oracle voice rooms, games, and content</p>
        </div>
        <SkeletonCard count={2} />
        <SkeletonTable rows={4} />
      </>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  const setup = sections.setup;
  const trivia = sections.games_trivia ?? [];
  const sowalef = sections.games_sowalef ?? [];
  const gs = sections.games_settings;
  const welcome = sections.content_welcome ?? [];
  const panel = sections.content_panel;
  const buttons = sections.content_buttons ?? {};
  const aura = sections.content_aura;
  const whisper = sections.content_whisper;
  const assets = sections.assets;

  const indexedTrivia = trivia.map((t, i) => ({ item: t, realIdx: i }));
  const filteredTrivia = triviaSearch
    ? indexedTrivia.filter(({ item }) => item.q.includes(triviaSearch) || item.answers.some((a) => a.includes(triviaSearch)))
    : indexedTrivia;

  const indexedSowalef = sowalef.map((s, i) => ({ item: s, realIdx: i }));
  const filteredSowalef = sowalefSearch
    ? indexedSowalef.filter(({ item }) => item.includes(sowalefSearch))
    : indexedSowalef;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">🎙️</span> Voice</h1>
        <p className="admin-page-subtitle">Configure Oracle voice rooms, games, and content</p>
      </div>

      {configMetadata.updatedAt && (
        <div className="admin-last-updated">
          Last updated {timeAgo(configMetadata.updatedAt)} by {configMetadata.updatedBy || 'Unknown'}
        </div>
      )}

      {/* Tab bar */}
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'setup' ? 'admin-tab-active' : ''}`} onClick={() => setTab('setup')}>
          Setup
        </button>
        <button className={`admin-tab ${tab === 'games' ? 'admin-tab-active' : ''}`} onClick={() => setTab('games')}>
          Games
        </button>
        <button className={`admin-tab ${tab === 'content' ? 'admin-tab-active' : ''}`} onClick={() => setTab('content')}>
          Content
        </button>
        <button className={`admin-tab ${tab === 'assets' ? 'admin-tab-active' : ''}`} onClick={() => setTab('assets')}>
          Assets
        </button>
        <button className={`admin-tab ${tab === 'stats' ? 'admin-tab-active' : ''}`} onClick={() => setTab('stats')}>
          Stats
        </button>
      </div>

      {/* ============================================================ */}
      {/*  SETUP TAB                                                    */}
      {/* ============================================================ */}
      {tab === 'setup' && setup && (
        <>
          <ConfigSection title="Hub Channels" description="Voice channel hubs that spawn temporary rooms when users join">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {setup.hubChannels.map((hub, idx) => (
                <div key={idx} style={{ padding: '12px', background: 'var(--bg-deep)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                    <ChannelPicker
                      label="Hub Channel"
                      description="Voice channel that spawns rooms"
                      value={hub.channelId}
                      onChange={(val) => {
                        const updated = [...setup.hubChannels];
                        updated[idx] = { ...hub, channelId: val as string };
                        updateSection('setup', { ...setup, hubChannels: updated });
                      }}
                      channelTypes={[2]}
                      placeholder="Select voice channel"
                    />
                    <ChannelPicker
                      label="Category"
                      description="Category for spawned rooms"
                      value={hub.categoryId}
                      onChange={(val) => {
                        const updated = [...setup.hubChannels];
                        updated[idx] = { ...hub, categoryId: val as string };
                        updateSection('setup', { ...setup, hubChannels: updated });
                      }}
                      channelTypes={[4]}
                      placeholder="Select category"
                    />
                    <div className="admin-form-group">
                      <label className="admin-form-label">Name Template</label>
                      <input
                        type="text"
                        className="admin-input"
                        value={hub.nameTemplate}
                        onChange={(e) => {
                          const updated = [...setup.hubChannels];
                          updated[idx] = { ...hub, nameTemplate: e.target.value };
                          updateSection('setup', { ...setup, hubChannels: updated });
                        }}
                        placeholder="{name}'s Room"
                      />
                    </div>
                    <NumberInput
                      label="User Limit"
                      value={hub.defaultUserLimit}
                      onChange={(v) => {
                        const updated = [...setup.hubChannels];
                        updated[idx] = { ...hub, defaultUserLimit: v };
                        updateSection('setup', { ...setup, hubChannels: updated });
                      }}
                      min={0}
                      max={99}
                      description="0 = unlimited"
                    />
                    <NumberInput
                      label="Bitrate (kbps)"
                      value={hub.defaultBitrate}
                      onChange={(v) => {
                        const updated = [...setup.hubChannels];
                        updated[idx] = { ...hub, defaultBitrate: v };
                        updateSection('setup', { ...setup, hubChannels: updated });
                      }}
                      min={8}
                      max={384}
                      description="Voice quality"
                    />
                  </div>
                  <button
                    className="admin-btn admin-btn-danger admin-btn-sm"
                    style={{ marginTop: '8px' }}
                    onClick={() => {
                      const updated = setup.hubChannels.filter((_, i) => i !== idx);
                      updateSection('setup', { ...setup, hubChannels: updated });
                    }}
                  >
                    Remove Hub
                  </button>
                </div>
              ))}
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => {
                  updateSection('setup', {
                    ...setup,
                    hubChannels: [...setup.hubChannels, { channelId: '', categoryId: '', nameTemplate: "{name}'s Room", defaultUserLimit: 0, defaultBitrate: 64 }],
                  });
                }}
              >
                + Add Hub Channel
              </button>
            </div>
          </ConfigSection>

          <ConfigSection title="Logging" description="Log channel for voice events">
            <ChannelPicker
              label="Log Channel"
              description="Channel for voice event logs"
              value={setup.logChannelId}
              onChange={(val) => updateSection('setup', { ...setup, logChannelId: val as string })}
              channelTypes={[0, 5]}
              placeholder="Select log channel"
            />
          </ConfigSection>

          <ConfigSection title="Staff Roles" description="Roles with elevated voice room permissions">
            <RolePicker
              label="Staff Roles"
              description="Select roles that can manage voice rooms"
              value={setup.staffRoleIds}
              onChange={(val) => updateSection('setup', { ...setup, staffRoleIds: Array.isArray(val) ? val : [val] })}
              multi={true}
              placeholder="Select staff roles"
            />
          </ConfigSection>

          <ConfigSection title="Room Limits" description="How many rooms each user can create">
            <div className="admin-config-grid">
              <NumberInput
                label="Max Temp Rooms"
                value={setup.maxTempRoomsPerUser}
                onChange={(v) => updateSection('setup', { ...setup, maxTempRoomsPerUser: v })}
                min={1}
                max={10}
                description="How many temporary voice rooms a single user can create (1-10)"
              />
              <NumberInput
                label="Max VIP Rooms"
                value={setup.maxVipRoomsPerUser}
                onChange={(v) => updateSection('setup', { ...setup, maxVipRoomsPerUser: v })}
                min={1}
                max={5}
                description="How many permanent VIP rooms a single user can own (1-5)"
              />
            </div>
          </ConfigSection>

          <ConfigSection title="Challenges" description="Voice challenges that trigger periodically">
            <div className="admin-config-grid">
              <ToggleSwitch
                label="Challenges Enabled"
                checked={setup.challengesEnabled}
                onChange={(v) => updateSection('setup', { ...setup, challengesEnabled: v })}
              />
              <NumberInput
                label="Min Members"
                value={setup.challengeMinMembers}
                onChange={(v) => updateSection('setup', { ...setup, challengeMinMembers: v })}
                min={1}
                max={25}
                description="Minimum members in a room to trigger a challenge (1-25)"
              />
            </div>
          </ConfigSection>

          <ConfigSection title="Intervals" description="Timing for various automated systems">
            <div className="admin-config-grid">
              <DurationInput
                label="Grace Period"
                value={setup.gracePeriodMs}
                onChange={(v) => updateSection('setup', { ...setup, gracePeriodMs: v })}
                description="Time before an empty room is deleted"
              />
              <DurationInput
                label="Welcome Cooldown"
                value={setup.welcomeCooldownMs}
                onChange={(v) => updateSection('setup', { ...setup, welcomeCooldownMs: v })}
                description="Cooldown between welcome messages"
              />
              <DurationInput
                label="Challenge Interval"
                value={setup.challengeIntervalMs}
                onChange={(v) => updateSection('setup', { ...setup, challengeIntervalMs: v })}
                description="Time between challenge triggers"
              />
              <DurationInput
                label="Aura Update Interval"
                value={setup.auraUpdateIntervalMs}
                onChange={(v) => updateSection('setup', { ...setup, auraUpdateIntervalMs: v })}
                description="How often aura scores recalculate"
              />
              <DurationInput
                label="Panel Auto-Refresh"
                value={setup.panelAutoRefreshMs}
                onChange={(v) => updateSection('setup', { ...setup, panelAutoRefreshMs: v })}
                description="How often the panel embed refreshes"
              />
            </div>
          </ConfigSection>
        </>
      )}

      {/* ============================================================ */}
      {/*  GAMES TAB                                                    */}
      {/* ============================================================ */}
      {tab === 'games' && (
        <>
          <ConfigSection title="Trivia Questions" description={`${trivia.length} questions total`} defaultOpen={false}>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                className="admin-input"
                placeholder="Search questions..."
                value={triviaSearch}
                onChange={(e) => setTriviaSearch(e.target.value)}
                dir="rtl"
                style={{ textAlign: 'right', width: '100%' }}
              />
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredTrivia.map(({ item: question, realIdx }) => (
                  <div key={realIdx} style={{ padding: '12px', background: 'var(--bg-deep)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="admin-form-group" style={{ marginBottom: '10px' }}>
                      <label className="admin-form-label">Question</label>
                      <input
                        type="text"
                        className="admin-input"
                        value={question.q}
                        onChange={(e) => {
                          const updated = [...trivia];
                          updated[realIdx] = { ...question, q: e.target.value };
                          updateSection('games_trivia', updated);
                        }}
                        dir="rtl"
                        style={{ textAlign: 'right' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      {[0, 1, 2, 3].map((aIdx) => (
                        <div key={aIdx} className="admin-form-group">
                          <label className="admin-form-label">Answer {aIdx + 1}</label>
                          <input
                            type="text"
                            className="admin-input"
                            value={question.answers[aIdx] ?? ''}
                            onChange={(e) => {
                              const updated = [...trivia];
                              const answers = [...question.answers];
                              answers[aIdx] = e.target.value;
                              updated[realIdx] = { ...question, answers };
                              updateSection('games_trivia', updated);
                            }}
                            dir="rtl"
                            style={{ textAlign: 'right' }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Correct Answer</label>
                        <select
                          className="admin-input"
                          value={question.correct}
                          onChange={(e) => {
                            const updated = [...trivia];
                            updated[realIdx] = { ...question, correct: Number(e.target.value) };
                            updateSection('games_trivia', updated);
                          }}
                        >
                          <option value={0}>Answer 1</option>
                          <option value={1}>Answer 2</option>
                          <option value={2}>Answer 3</option>
                          <option value={3}>Answer 4</option>
                        </select>
                      </div>
                      <button
                        className="admin-btn admin-btn-danger admin-btn-sm"
                        style={{ marginTop: '20px' }}
                        onClick={() => {
                          const updated = trivia.filter((_, i) => i !== realIdx);
                          updateSection('games_trivia', updated);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
              ))}
            </div>
            <button
              className="admin-btn admin-btn-ghost admin-btn-sm"
              style={{ marginTop: '12px' }}
              onClick={() => {
                updateSection('games_trivia', [...trivia, { q: '', answers: ['', '', '', ''], correct: 0 }]);
              }}
            >
              + Add Question
            </button>
          </ConfigSection>

          <ConfigSection title="Sowalef Questions" description={`${sowalef.length} questions total`} defaultOpen={false}>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                className="admin-input"
                placeholder="Search questions..."
                value={sowalefSearch}
                onChange={(e) => setSowalefSearch(e.target.value)}
                dir="rtl"
                style={{ textAlign: 'right', width: '100%' }}
              />
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredSowalef.map(({ item: question, realIdx }) => (
                  <div key={realIdx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '30px', textAlign: 'center', flexShrink: 0 }}>{realIdx + 1}</span>
                    <input
                      type="text"
                      className="admin-input"
                      value={question}
                      onChange={(e) => {
                        const updated = [...sowalef];
                        updated[realIdx] = e.target.value;
                        updateSection('games_sowalef', updated);
                      }}
                      dir="rtl"
                      style={{ textAlign: 'right', flex: 1 }}
                    />
                    <button
                      className="admin-btn admin-btn-danger admin-btn-sm"
                      style={{ padding: '4px 10px' }}
                      onClick={() => {
                        const updated = sowalef.filter((_, i) => i !== realIdx);
                        updateSection('games_sowalef', updated);
                      }}
                    >
                      &times;
                    </button>
                  </div>
              ))}
            </div>
            <button
              className="admin-btn admin-btn-ghost admin-btn-sm"
              style={{ marginTop: '12px' }}
              onClick={() => {
                updateSection('games_sowalef', [...sowalef, '']);
              }}
            >
              + Add Question
            </button>
          </ConfigSection>

          {gs && (
            <>
              <ConfigSection title="Math Operations" description="Configure enabled math game operations and rewards">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                  {ALL_MATH_OPS.map((op) => (
                    <label key={op} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={gs.mathOps.enabled.includes(op)}
                        onChange={(e) => {
                          const enabled = e.target.checked
                            ? [...gs.mathOps.enabled, op]
                            : gs.mathOps.enabled.filter((o) => o !== op);
                          updateSection('games_settings', { ...gs, mathOps: { ...gs.mathOps, enabled } });
                        }}
                      />
                      {op.replace(/_/g, ' ')}
                    </label>
                  ))}
                </div>
                <div className="admin-config-grid">
                  <NumberInput
                    label="Reward Min"
                    value={gs.mathOps.rewardMin}
                    onChange={(v) => updateSection('games_settings', { ...gs, mathOps: { ...gs.mathOps, rewardMin: v } })}
                    min={0}
                    description="Minimum Lunari reward"
                  />
                  <NumberInput
                    label="Reward Max"
                    value={gs.mathOps.rewardMax}
                    onChange={(v) => updateSection('games_settings', { ...gs, mathOps: { ...gs.mathOps, rewardMax: v } })}
                    min={0}
                    description="Maximum Lunari reward"
                  />
                  <DurationInput
                    label="Timeout"
                    value={gs.mathOps.timeoutMs}
                    onChange={(v) => updateSection('games_settings', { ...gs, mathOps: { ...gs.mathOps, timeoutMs: v } })}
                    description="Time limit per question"
                  />
                </div>
              </ConfigSection>

              <ConfigSection title="Rewards & Timing" description="Trivia rewards, streak bonuses, quick react, and cooldowns">
                <div className="admin-config-grid">
                  <NumberInput
                    label="Auto-Drop Min"
                    value={gs.triviaReward.autoDropMin}
                    onChange={(v) => updateSection('games_settings', { ...gs, triviaReward: { ...gs.triviaReward, autoDropMin: v } })}
                    min={0}
                    description="Min reward for auto trivia drops"
                  />
                  <NumberInput
                    label="Auto-Drop Max"
                    value={gs.triviaReward.autoDropMax}
                    onChange={(v) => updateSection('games_settings', { ...gs, triviaReward: { ...gs.triviaReward, autoDropMax: v } })}
                    min={0}
                    description="Max reward for auto trivia drops"
                  />
                  <NumberInput
                    label="Mini Trivia Min"
                    value={gs.triviaReward.miniMin}
                    onChange={(v) => updateSection('games_settings', { ...gs, triviaReward: { ...gs.triviaReward, miniMin: v } })}
                    min={0}
                    description="Min reward for mini trivia"
                  />
                  <NumberInput
                    label="Mini Trivia Max"
                    value={gs.triviaReward.miniMax}
                    onChange={(v) => updateSection('games_settings', { ...gs, triviaReward: { ...gs.triviaReward, miniMax: v } })}
                    min={0}
                    description="Max reward for mini trivia"
                  />
                  <DurationInput
                    label="Trivia Timeout"
                    value={gs.triviaTimeoutMs}
                    onChange={(v) => updateSection('games_settings', { ...gs, triviaTimeoutMs: v })}
                    description="Time limit per trivia question"
                  />
                  <NumberInput
                    label="Trivia Session Size"
                    value={gs.triviaSessionSize}
                    onChange={(v) => updateSection('games_settings', { ...gs, triviaSessionSize: v })}
                    min={1}
                    description="Questions per session"
                  />
                  <NumberInput
                    label="Streak Bonus (3)"
                    value={gs.streakBonuses?.['3'] ?? 0}
                    onChange={(v) => updateSection('games_settings', { ...gs, streakBonuses: { ...gs.streakBonuses, '3': v } })}
                    min={0}
                    description="Bonus Lunari at 3 streak"
                  />
                  <NumberInput
                    label="Streak Bonus (5)"
                    value={gs.streakBonuses?.['5'] ?? 0}
                    onChange={(v) => updateSection('games_settings', { ...gs, streakBonuses: { ...gs.streakBonuses, '5': v } })}
                    min={0}
                    description="Bonus Lunari at 5 streak"
                  />
                  <NumberInput
                    label="Streak Bonus (10)"
                    value={gs.streakBonuses?.['10'] ?? 0}
                    onChange={(v) => updateSection('games_settings', { ...gs, streakBonuses: { ...gs.streakBonuses, '10': v } })}
                    min={0}
                    description="Bonus Lunari at 10 streak"
                  />
                  <NumberInput
                    label="Quick React Min"
                    value={gs.quickReact.rewardMin}
                    onChange={(v) => updateSection('games_settings', { ...gs, quickReact: { ...gs.quickReact, rewardMin: v } })}
                    min={0}
                    description="Min reward"
                  />
                  <NumberInput
                    label="Quick React Max"
                    value={gs.quickReact.rewardMax}
                    onChange={(v) => updateSection('games_settings', { ...gs, quickReact: { ...gs.quickReact, rewardMax: v } })}
                    min={0}
                    description="Max reward"
                  />
                  <DurationInput
                    label="React Delay Min"
                    value={gs.quickReact.delayMin}
                    onChange={(v) => updateSection('games_settings', { ...gs, quickReact: { ...gs.quickReact, delayMin: v } })}
                    description="Minimum delay before react event"
                  />
                  <DurationInput
                    label="React Delay Max"
                    value={gs.quickReact.delayMax}
                    onChange={(v) => updateSection('games_settings', { ...gs, quickReact: { ...gs.quickReact, delayMax: v } })}
                    description="Maximum delay before react event"
                  />
                  <DurationInput
                    label="React Timeout"
                    value={gs.quickReact.timeoutMs}
                    onChange={(v) => updateSection('games_settings', { ...gs, quickReact: { ...gs.quickReact, timeoutMs: v } })}
                    description="Time to react"
                  />
                  <NumberInput
                    label="Sowalef Session Size"
                    value={gs.sowalefSessionSize}
                    onChange={(v) => updateSection('games_settings', { ...gs, sowalefSessionSize: v })}
                    min={1}
                    description="Questions per sowalef session"
                  />
                  <DurationInput
                    label="Sowalef Debounce"
                    value={gs.sowalefDebounceMs}
                    onChange={(v) => updateSection('games_settings', { ...gs, sowalefDebounceMs: v })}
                    description="Debounce between answers"
                  />
                  <DurationInput
                    label="Game Cooldown"
                    value={gs.gameCooldownMs}
                    onChange={(v) => updateSection('games_settings', { ...gs, gameCooldownMs: v })}
                    description="Cooldown between games"
                  />
                  <DurationInput
                    label="End Cooldown"
                    value={gs.endCooldownMs}
                    onChange={(v) => updateSection('games_settings', { ...gs, endCooldownMs: v })}
                    description="Cooldown after game ends"
                  />
                </div>
              </ConfigSection>

              <ConfigSection title="Emoji Race" description="Emojis used in emoji race games">
                <StringArrayInput
                  label="Emoji Race Emojis"
                  value={gs.emojiRaceEmojis}
                  onChange={(v) => updateSection('games_settings', { ...gs, emojiRaceEmojis: v })}
                  addLabel="Add Emoji"
                  placeholder="Paste an emoji"
                />
              </ConfigSection>

              <ConfigSection title="Aura Reward Multipliers" description="Higher aura rooms give bigger rewards. 1.0 = baseline.">
                <div className="admin-config-grid">
                  {(['dormant', 'flickering', 'glowing', 'radiant', 'blazing'] as const).map((tier) => (
                    <NumberInput
                      key={tier}
                      label={tier.charAt(0).toUpperCase() + tier.slice(1)}
                      value={gs.auraRewardMultipliers?.[tier] ?? ({ dormant: 0.5, flickering: 0.75, glowing: 1.0, radiant: 1.5, blazing: 2.0 }[tier])}
                      onChange={(v) => updateSection('games_settings', {
                        ...gs,
                        auraRewardMultipliers: { ...({ dormant: 0.5, flickering: 0.75, glowing: 1.0, radiant: 1.5, blazing: 2.0 }), ...gs.auraRewardMultipliers, [tier]: v },
                      })}
                      min={0}
                      max={5}
                      step={0.1}
                      description={`${tier} room multiplier`}
                    />
                  ))}
                </div>
              </ConfigSection>

              <ConfigSection title="Boss Challenge" description="Daily high-stakes challenge in the most active room">
                <div className="admin-config-grid">
                  <ToggleSwitch
                    label="Boss Challenge Enabled"
                    checked={gs.bossChallenge?.enabled ?? true}
                    onChange={(v) => updateSection('games_settings', {
                      ...gs,
                      bossChallenge: { ...({ enabled: true, rewardMin: 500, rewardMax: 1000, cooldownHours: 24, questionCount: 5 }), ...gs.bossChallenge, enabled: v },
                    })}
                  />
                  <NumberInput
                    label="Reward Min"
                    value={gs.bossChallenge?.rewardMin ?? 500}
                    onChange={(v) => updateSection('games_settings', {
                      ...gs,
                      bossChallenge: { ...({ enabled: true, rewardMin: 500, rewardMax: 1000, cooldownHours: 24, questionCount: 5 }), ...gs.bossChallenge, rewardMin: v },
                    })}
                    min={0}
                    description="Minimum Lunari reward"
                  />
                  <NumberInput
                    label="Reward Max"
                    value={gs.bossChallenge?.rewardMax ?? 1000}
                    onChange={(v) => updateSection('games_settings', {
                      ...gs,
                      bossChallenge: { ...({ enabled: true, rewardMin: 500, rewardMax: 1000, cooldownHours: 24, questionCount: 5 }), ...gs.bossChallenge, rewardMax: v },
                    })}
                    min={0}
                    description="Maximum Lunari reward"
                  />
                  <NumberInput
                    label="Cooldown (hours)"
                    value={gs.bossChallenge?.cooldownHours ?? 24}
                    onChange={(v) => updateSection('games_settings', {
                      ...gs,
                      bossChallenge: { ...({ enabled: true, rewardMin: 500, rewardMax: 1000, cooldownHours: 24, questionCount: 5 }), ...gs.bossChallenge, cooldownHours: v },
                    })}
                    min={1}
                    max={168}
                    description="Hours between boss drops"
                  />
                  <NumberInput
                    label="Questions"
                    value={gs.bossChallenge?.questionCount ?? 5}
                    onChange={(v) => updateSection('games_settings', {
                      ...gs,
                      bossChallenge: { ...({ enabled: true, rewardMin: 500, rewardMax: 1000, cooldownHours: 24, questionCount: 5 }), ...gs.bossChallenge, questionCount: v },
                    })}
                    min={1}
                    max={20}
                    description="Number of boss questions"
                  />
                </div>
              </ConfigSection>
            </>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/*  CONTENT TAB                                                  */}
      {/* ============================================================ */}
      {tab === 'content' && (
        <>
          <ConfigSection title="Welcome Greetings" description="Shown when a user joins a voice room. Use {name} for the user's display name.">
            <StringArrayInput
              label="Welcome Messages"
              value={welcome}
              onChange={(v) => updateSection('content_welcome', v)}
              addLabel="Add Greeting"
              dir="rtl"
              placeholder="Message with {name}"
            />
          </ConfigSection>

          {panel && (
            <ConfigSection title="Panel Description" description="Text displayed on the voice room control panel in Discord (RTL Arabic)">
              {([
                { key: 'line1' as const, label: 'Line 1 — Header', desc: 'Title or welcome text at the top of the panel' },
                { key: 'line2' as const, label: 'Line 2 — Description', desc: 'Main instructions or room info' },
                { key: 'line3' as const, label: 'Line 3 — Details', desc: 'Additional details or tips' },
                { key: 'line4' as const, label: 'Line 4 — Footer', desc: 'Footer note at the bottom of the panel' },
              ]).map(({ key, label, desc }) => (
                <div key={key} className="admin-form-group" style={{ marginBottom: '10px' }}>
                  <label className="admin-form-label">{label}</label>
                  <textarea
                    className="admin-input"
                    value={panel[key]}
                    onChange={(e) => updateSection('content_panel', { ...panel, [key]: e.target.value })}
                    dir="rtl"
                    style={{ textAlign: 'right', width: '100%', resize: 'vertical', minHeight: '60px' }}
                    rows={2}
                  />
                  <span className="admin-number-input-desc">{desc}</span>
                </div>
              ))}
            </ConfigSection>
          )}

          <ConfigSection title="Button Labels" description="Text displayed on voice room control buttons (Arabic, max 80 characters)">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {BUTTON_KEYS.map((key) => (
                <div key={key} className="admin-form-group">
                  <label className="admin-form-label" style={{ textTransform: 'capitalize' }}>{key}</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={buttons[key] ?? ''}
                    onChange={(e) => updateSection('content_buttons', { ...buttons, [key]: e.target.value })}
                    dir="rtl"
                    style={{ textAlign: 'right' }}
                    maxLength={80}
                  />
                  {BUTTON_DESCRIPTIONS[key] && (
                    <span className="admin-number-input-desc">{BUTTON_DESCRIPTIONS[key]}</span>
                  )}
                </div>
              ))}
            </div>
          </ConfigSection>

          {aura && (
            <ConfigSection title="Aura Tiers" description="Labels, score thresholds, and weights for the aura system">
              <div style={{ marginBottom: '16px' }}>
                <label className="admin-form-label" style={{ marginBottom: '8px', display: 'block' }}>Tier Labels</label>
                <div className="admin-config-grid">
                  {AURA_TIER_KEYS.map((key) => (
                    <div key={key} className="admin-form-group">
                      <label className="admin-form-label" style={{ textTransform: 'capitalize' }}>{key}</label>
                      <input
                        type="text"
                        className="admin-input"
                        value={aura.auraTiers[key] ?? ''}
                        onChange={(e) => updateSection('content_aura', { ...aura, auraTiers: { ...aura.auraTiers, [key]: e.target.value } })}
                        dir="rtl"
                        style={{ textAlign: 'right' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="admin-form-label" style={{ marginBottom: '8px', display: 'block' }}>Score Thresholds</label>
                <div className="admin-config-grid">
                  {AURA_THRESHOLD_KEYS.map((key) => (
                    <NumberInput
                      key={key}
                      label={key.charAt(0).toUpperCase() + key.slice(1)}
                      value={aura.auraThresholds[key] ?? 0}
                      onChange={(v) => updateSection('content_aura', { ...aura, auraThresholds: { ...aura.auraThresholds, [key]: v } })}
                      min={0}
                      description={`Score needed for ${key} tier`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="admin-form-label" style={{ marginBottom: '8px', display: 'block' }}>Aura Weights</label>
                <div className="admin-config-grid">
                  {AURA_WEIGHT_KEYS.map((key) => (
                    <NumberInput
                      key={key}
                      label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
                      value={aura.auraWeights[key] ?? 0}
                      onChange={(v) => updateSection('content_aura', { ...aura, auraWeights: { ...aura.auraWeights, [key]: v } })}
                      min={0}
                      step={0.1}
                      description={`Weight for ${key}`}
                    />
                  ))}
                </div>
              </div>
            </ConfigSection>
          )}

          {whisper && (
            <ConfigSection title="Whisper Settings" description="Configuration for the anonymous whisper system">
              <div className="admin-config-grid">
                <DurationInput
                  label="Cooldown"
                  value={whisper.cooldownMs}
                  onChange={(v) => updateSection('content_whisper', { ...whisper, cooldownMs: v })}
                  description="Time between whispers"
                />
                <DurationInput
                  label="Auto-Cleanup"
                  value={whisper.autoCleanupMs}
                  onChange={(v) => updateSection('content_whisper', { ...whisper, autoCleanupMs: v })}
                  description="Delete whispers after this time"
                />
                <div className="admin-form-group">
                  <label className="admin-form-label">Modal Title</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={whisper.modalTitle}
                    onChange={(e) => updateSection('content_whisper', { ...whisper, modalTitle: e.target.value })}
                    dir="rtl"
                    style={{ textAlign: 'right' }}
                  />
                  <span className="admin-number-input-desc">Title shown at the top of the whisper popup</span>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Modal Placeholder</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={whisper.modalPlaceholder}
                    onChange={(e) => updateSection('content_whisper', { ...whisper, modalPlaceholder: e.target.value })}
                    dir="rtl"
                    style={{ textAlign: 'right' }}
                  />
                  <span className="admin-number-input-desc">Hint text shown inside the empty whisper input box</span>
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <label className="admin-form-label" style={{ marginBottom: '4px', display: 'block' }}>Embed Colors (hex)</label>
                <span className="admin-number-input-desc" style={{ display: 'block', marginBottom: '8px' }}>Colors cycle through these for whisper embeds — add more for variety</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {(whisper.colors ?? []).map((color, idx) => (
                    <div key={idx} className="admin-form-group">
                      <label className="admin-form-label" style={{ fontSize: '11px' }}>Color {idx + 1}</label>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="admin-input"
                          value={`0x${color.toString(16).toUpperCase().padStart(6, '0')}`}
                          onChange={(e) => {
                            const val = parseInt(e.target.value.replace(/^0x/i, ''), 16);
                            if (!isNaN(val)) {
                              const updated = [...whisper.colors];
                              updated[idx] = val;
                              updateSection('content_whisper', { ...whisper, colors: updated });
                            }
                          }}
                          style={{ flex: 1, fontFamily: 'monospace' }}
                        />
                        <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: `#${color.toString(16).padStart(6, '0')}`, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ConfigSection>
          )}

          <ConfigSection title="Game Timeout Messages" description="Messages displayed when nobody answers in time (Arabic, right-to-left)">
            <div className="admin-config-grid">
              {TIMEOUT_MESSAGE_KEYS.map((key) => (
                <div key={key} className="admin-form-group">
                  <label className="admin-form-label" style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={(sections.content_expiry ?? {})[key] ?? ''}
                    onChange={(e) => {
                      const expiry = { ...(sections.content_expiry ?? {}), [key]: e.target.value };
                      updateSection('content_expiry', expiry);
                    }}
                    dir="rtl"
                    style={{ textAlign: 'right' }}
                  />
                </div>
              ))}
            </div>
          </ConfigSection>
        </>
      )}

      {/* ============================================================ */}
      {/*  ASSETS TAB                                                   */}
      {/* ============================================================ */}
      {tab === 'assets' && (
        <>
          <ConfigSection title="Panel Banner" description="Banner image displayed on the voice panel embed">
            {assets?.panelBannerUrl && (
              <div style={{ marginBottom: '12px' }}>
                <img
                  src={assets.panelBannerUrl}
                  alt="Panel banner"
                  style={{ maxWidth: '400px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="file"
                accept="image/png,image/jpeg"
                id="banner-upload"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBannerUpload(file);
                  e.target.value = '';
                }}
              />
              <button
                className={`admin-btn admin-btn-secondary ${uploading ? 'admin-btn-loading' : ''}`}
                onClick={() => document.getElementById('banner-upload')?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Banner'}
              </button>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PNG or JPEG, max 5 MB</span>
            </div>
          </ConfigSection>

          <ConfigSection title="Emojis" description="Custom emoji IDs used by Oracle. Format: <:name:id> — find the ID by typing \:emoji: in Discord">
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Key</th>
                    <th style={{ textAlign: 'left' }}>Discord Format</th>
                    <th style={{ textAlign: 'left', width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(assets?.emojis ?? {}).map(([key, val]) => (
                    <tr key={key}>
                      <td>
                        <input
                          type="text"
                          className="admin-input"
                          value={key}
                          onChange={(e) => {
                            const newKey = e.target.value;
                            if (newKey === key) return;
                            const updated = { ...assets!.emojis };
                            delete updated[key];
                            updated[newKey] = val;
                            updateSection('assets', { ...assets!, emojis: updated });
                          }}
                          style={{ fontSize: '13px', fontFamily: 'monospace' }}
                          placeholder="emoji_key"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="admin-input"
                          value={val}
                          onChange={(e) => {
                            const updated = { ...assets!.emojis, [key]: e.target.value };
                            updateSection('assets', { ...assets!, emojis: updated });
                          }}
                          style={{ fontSize: '13px', fontFamily: 'monospace' }}
                          placeholder="<:name:id>"
                        />
                      </td>
                      <td>
                        <button
                          className="admin-btn admin-btn-danger admin-btn-sm"
                          style={{ padding: '4px 10px' }}
                          onClick={() => {
                            const updated = { ...assets!.emojis };
                            delete updated[key];
                            updateSection('assets', { ...assets!, emojis: updated });
                          }}
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="admin-btn admin-btn-ghost admin-btn-sm"
              style={{ marginTop: '12px' }}
              onClick={() => {
                const emojis = { ...(assets?.emojis ?? {}), '': '' };
                updateSection('assets', { ...(assets ?? { panelBannerUrl: '' }), emojis });
              }}
            >
              + Add Emoji
            </button>
          </ConfigSection>
        </>
      )}

      {/* ============================================================ */}
      {/*  STATS TAB                                                    */}
      {/* ============================================================ */}
      {tab === 'stats' && (
        <>
          {statsLoading ? (
            <>
              <SkeletonCard count={4} />
              <SkeletonTable rows={5} />
            </>
          ) : stats ? (
            <>
              <div className="admin-stats-grid">
                <StatCard label="Total Rooms Created" value={stats.totals?.totalRoomsCreated ?? 0} icon="🏠" color="cyan" />
                <StatCard label="Total Voice Hours" value={stats.totals?.totalVoiceHours ?? 0} icon="🕐" color="purple" />
                <StatCard label="Total Lunari Spent" value={stats.totals?.totalLunariSpent ?? 0} icon="💰" color="gold" />
                <StatCard label="Active Rooms Now" value={stats.totals?.activeRoomsCount ?? 0} icon="🎙️" color="green" />
              </div>

              {/* Export buttons */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <a href="/api/admin/voice/export?format=csv" download className="admin-btn admin-btn-sm admin-btn-ghost">📄 Export CSV</a>
                <a href="/api/admin/voice/export?format=json" download className="admin-btn admin-btn-sm admin-btn-ghost">📦 Export JSON</a>
              </div>

              <ConfigSection title="Active Rooms" description="Currently active voice rooms (auto-refreshes every 10s)">
                {(() => {
                  const rooms = stats.activeRooms ?? [];
                  const totalMembers = rooms.reduce((sum: number, r: any) => sum + (r.memberCount ?? 0), 0);
                  const blazingCount = rooms.filter((r: any) => r.aura?.tier === 'blazing').length;
                  return (
                    <>
                      {rooms.length > 0 && (
                        <div style={{
                          display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '13px',
                          color: 'var(--text-secondary)', padding: '8px 12px',
                          background: 'rgba(0, 212, 255, 0.05)', borderRadius: '6px',
                          border: '1px solid rgba(0, 212, 255, 0.1)',
                        }}>
                          <span><strong>{rooms.length}</strong> active</span>
                          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                          <span><strong>{totalMembers}</strong> members</span>
                          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                          <span style={{ color: '#f97316' }}><strong>{blazingCount}</strong> blazing</span>
                        </div>
                      )}
                      {rooms.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No active rooms right now.</p>
                      ) : (
                        <div className="admin-table-container">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left' }}>Name</th>
                                <th style={{ textAlign: 'left' }}>Owner</th>
                                <th style={{ textAlign: 'left' }}>Type</th>
                                <th style={{ textAlign: 'left' }}>Aura</th>
                                <th style={{ textAlign: 'left' }}>Members</th>
                                <th style={{ textAlign: 'left' }}>Status</th>
                                <th style={{ textAlign: 'left' }}>Created</th>
                                <th style={{ textAlign: 'left' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rooms.map((room: any, idx: number) => {
                                const tier = room.aura?.tier ?? 'dormant';
                                return (
                                  <tr key={room._id ?? idx} style={AURA_ROW_STYLES[tier] ?? {}}>
                                    <td style={{ fontSize: '13px' }}>{room.name || 'Unknown'}</td>
                                    <td style={{ fontSize: '13px', fontFamily: 'monospace' }}>{room.ownerId || 'Unknown'}</td>
                                    <td style={{ fontSize: '13px' }}>{room.type || 'Unknown'}</td>
                                    <td style={{ fontSize: '13px' }}>{room.aura ? `${tier} (${room.aura.score ?? 0})` : '-'}</td>
                                    <td style={{ fontSize: '13px' }}>{room.memberCount ?? 0}</td>
                                    <td style={{ fontSize: '13px' }}>
                                      {room.isLocked && (
                                        <span style={{
                                          display: 'inline-block', padding: '1px 6px', fontSize: '11px',
                                          borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)',
                                          color: '#ef4444', marginRight: '4px',
                                        }}>Locked</span>
                                      )}
                                      {room.isHidden && (
                                        <span style={{
                                          display: 'inline-block', padding: '1px 6px', fontSize: '11px',
                                          borderRadius: '4px', background: 'rgba(168, 85, 247, 0.15)',
                                          color: '#a855f7',
                                        }}>Hidden</span>
                                      )}
                                      {!room.isLocked && !room.isHidden && (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Open</span>
                                      )}
                                    </td>
                                    <td style={{ fontSize: '13px' }}>{room.createdAt ? timeAgo(room.createdAt) : '-'}</td>
                                    <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                                      <button
                                        className="admin-btn admin-btn-ghost admin-btn-sm"
                                        style={{ padding: '2px 6px', fontSize: '12px', marginRight: '4px' }}
                                        title={room.isLocked ? 'Unlock room' : 'Lock room'}
                                        onClick={() => setConfirmAction({
                                          action: room.isLocked ? 'unlock' : 'lock',
                                          roomId: room._id,
                                          roomName: room.name || 'Unknown',
                                        })}
                                      >
                                        {room.isLocked ? '🔓' : '🔒'}
                                      </button>
                                      <button
                                        className="admin-btn admin-btn-ghost admin-btn-sm"
                                        style={{ padding: '2px 6px', fontSize: '12px', color: '#ef4444' }}
                                        title="Delete room"
                                        onClick={() => setConfirmAction({
                                          action: 'delete',
                                          roomId: room._id,
                                          roomName: room.name || 'Unknown',
                                        })}
                                      >
                                        🗑️
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  );
                })()}
              </ConfigSection>

              <ConfigSection title="Hall of Records" description="Top users by aura score and visitor count">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>Top 10 by Aura</h4>
                    {(stats.hallOfRecords?.byAura ?? []).length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No data yet.</p>
                    ) : (
                      <div className="admin-table-container">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left' }}>#</th>
                              <th style={{ textAlign: 'left' }}>User</th>
                              <th style={{ textAlign: 'left' }}>Tier</th>
                              <th style={{ textAlign: 'left' }}>Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(stats.hallOfRecords?.byAura ?? []).map((entry: any, idx: number) => (
                              <tr key={idx}>
                                <td style={{ fontSize: '13px' }}>{idx + 1}</td>
                                <td>
                                  <button
                                    onClick={() => fetchUserProfile(entry.ownerId)}
                                    style={{
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      color: 'var(--accent-cyan)', fontSize: '13px', padding: 0,
                                      textDecoration: 'underline', textDecorationStyle: 'dotted' as const,
                                    }}
                                    title={`View profile for ${entry.ownerId}`}
                                  >
                                    {entry.name || entry.ownerId || 'Unknown'}
                                  </button>
                                </td>
                                <td style={{ fontSize: '13px' }}>{entry.peakAuraTier || '-'}</td>
                                <td style={{ fontSize: '13px' }}>{typeof entry.peakAuraScore === 'number' ? entry.peakAuraScore.toLocaleString() : (entry.peakAuraScore ?? 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>Top 10 by Visitors</h4>
                    {(stats.hallOfRecords?.byVisitors ?? []).length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No data yet.</p>
                    ) : (
                      <div className="admin-table-container">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left' }}>#</th>
                              <th style={{ textAlign: 'left' }}>User</th>
                              <th style={{ textAlign: 'left' }}>Visitors</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(stats.hallOfRecords?.byVisitors ?? []).map((entry: any, idx: number) => (
                              <tr key={idx}>
                                <td style={{ fontSize: '13px' }}>{idx + 1}</td>
                                <td>
                                  <button
                                    onClick={() => fetchUserProfile(entry.ownerId)}
                                    style={{
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      color: 'var(--accent-cyan)', fontSize: '13px', padding: 0,
                                      textDecoration: 'underline', textDecorationStyle: 'dotted' as const,
                                    }}
                                    title={`View profile for ${entry.ownerId}`}
                                  >
                                    {entry.name || entry.ownerId || 'Unknown'}
                                  </button>
                                </td>
                                <td style={{ fontSize: '13px' }}>{typeof entry.totalVisitors === 'number' ? entry.totalVisitors.toLocaleString() : (entry.totalVisitors ?? 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </ConfigSection>

              <ConfigSection title="Top Users" description="Leaderboard of most active voice users">
                {(stats.topUsers ?? []).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No data yet.</p>
                ) : (
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>#</th>
                          <th style={{ textAlign: 'left' }}>User ID</th>
                          <th style={{ textAlign: 'left' }}>Hours</th>
                          <th style={{ textAlign: 'left' }}>Rooms</th>
                          <th style={{ textAlign: 'left' }}>Challenges</th>
                          <th style={{ textAlign: 'left' }}>Lunari Spent</th>
                          <th style={{ textAlign: 'left' }}>VIP Purchases</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats.topUsers ?? []).map((user: any, idx: number) => (
                          <tr key={user._id ?? idx}>
                            <td style={{ fontSize: '13px' }}>{idx + 1}</td>
                            <td>
                              <button
                                onClick={() => fetchUserProfile(user._id)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: 'var(--accent-cyan)', fontSize: '13px', padding: 0,
                                  fontFamily: 'monospace',
                                  textDecoration: 'underline', textDecorationStyle: 'dotted' as const,
                                }}
                                title={`View profile for ${user._id}`}
                              >
                                {user._id || 'Unknown'}
                              </button>
                            </td>
                            <td style={{ fontSize: '13px' }}>{typeof user.totalVoiceMinutes === 'number' ? Math.round(user.totalVoiceMinutes / 60).toLocaleString() : 0}</td>
                            <td style={{ fontSize: '13px' }}>{(user.totalRoomsCreated ?? 0).toLocaleString()}</td>
                            <td style={{ fontSize: '13px' }}>{(user.challengesWon ?? 0).toLocaleString()}</td>
                            <td style={{ fontSize: '13px' }}>{(user.totalLunariSpent ?? 0).toLocaleString()}</td>
                            <td style={{ fontSize: '13px' }}>{(user.vipPurchases ?? 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ConfigSection>
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '20px 0' }}>Failed to load stats. Try switching tabs and back.</p>
          )}
        </>
      )}

      {/* Room action confirm modal */}
      {confirmAction && (
        <ConfirmModal
          title={`${confirmAction.action.charAt(0).toUpperCase() + confirmAction.action.slice(1)} Room`}
          message={`Are you sure you want to ${confirmAction.action} "${confirmAction.roomName}"? The bot will execute this on its next aura cycle.`}
          confirmLabel={actionLoading ? 'Processing...' : confirmAction.action.charAt(0).toUpperCase() + confirmAction.action.slice(1)}
          variant="danger"
          onConfirm={() => executeRoomAction(confirmAction.action, confirmAction.roomId)}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* User profile drill-down modal */}
      {userModalId && (
        <AdminLightbox isOpen={true} onClose={() => { setUserModalId(null); setUserProfile(null); }} title={`Voice Profile: ${userModalId}`} size="lg">
          {userProfileLoading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading user data...</div>
          ) : userProfile ? (
            <div style={{ padding: '8px 0' }}>
              {/* Stats cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                <div style={{ padding: '12px', background: 'rgba(0, 212, 255, 0.06)', borderRadius: '8px', border: '1px solid rgba(0, 212, 255, 0.1)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Rooms Created</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{(userProfile.stats.totalRoomsCreated ?? 0).toLocaleString()}</div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(168, 85, 247, 0.06)', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.1)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Voice Hours</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round((userProfile.stats.totalVoiceMinutes ?? 0) / 60).toLocaleString()}</div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(6, 182, 212, 0.06)', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.1)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Challenges Won</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{(userProfile.stats.challengesWon ?? 0).toLocaleString()}</div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255, 213, 79, 0.06)', borderRadius: '8px', border: '1px solid rgba(255, 213, 79, 0.1)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Lunari Spent</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{(userProfile.stats.totalLunariSpent ?? 0).toLocaleString()}</div>
                </div>
              </div>

              {/* Current room indicator */}
              {userProfile.currentRoom && (
                <div style={{
                  padding: '10px 14px', marginBottom: '16px', borderRadius: '6px',
                  background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.15)',
                  fontSize: '13px', color: 'var(--text-secondary)',
                }}>
                  <strong style={{ color: '#22c55e' }}>Active Room:</strong>{' '}
                  {userProfile.currentRoom.name} &mdash;{' '}
                  {userProfile.currentRoom.aura?.tier ?? 'dormant'} ({userProfile.currentRoom.aura?.score ?? 0}),{' '}
                  {userProfile.currentRoom.memberCount ?? 0} members
                </div>
              )}

              {/* Room history table */}
              <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>Room History (last 10)</h4>
              {userProfile.roomHistory.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No room history found.</p>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Name</th>
                        <th style={{ textAlign: 'left' }}>Peak Aura</th>
                        <th style={{ textAlign: 'left' }}>Visitors</th>
                        <th style={{ textAlign: 'left' }}>Deleted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userProfile.roomHistory.map((room, idx) => (
                        <tr key={idx}>
                          <td style={{ fontSize: '13px' }}>{room.name || 'Unknown'}</td>
                          <td style={{ fontSize: '13px' }}>{(room.peakAuraScore ?? 0).toLocaleString()}</td>
                          <td style={{ fontSize: '13px' }}>{(room.totalVisitors ?? 0).toLocaleString()}</td>
                          <td style={{ fontSize: '13px' }}>{room.deletedAt ? timeAgo(room.deletedAt) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Failed to load user data.</div>
          )}
        </AdminLightbox>
      )}

      {/* Save bar (not shown on stats tab) */}
      {tab !== 'stats' && (
        <SaveDeployBar
          hasChanges={hasChanges}
          saving={saving}
          onSave={saveConfig}
          onDiscard={handleDiscard}
          projectName="Oracle"
          diff={configDiff}
        />
      )}
    </>
  );
}
