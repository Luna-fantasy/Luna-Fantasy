'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ConfigSection from '../components/ConfigSection';
import NumberInput from '../components/NumberInput';
import SaveDeployBar from '../components/SaveDeployBar';
import ToggleSwitch from '../components/ToggleSwitch';
import DataTable, { Column } from '../components/DataTable';
import AdminLightbox from '../components/AdminLightbox';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import { useUnsavedWarning } from '../hooks/useUnsavedWarning';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';

// -- Types --

interface LiveChatConfig {
  autoJoinEnabled: boolean;
  reactionsEnabled: boolean;
  periodicCheckIn: boolean;
  mastermindOnly: boolean;
  reactionProbability: number; // stored as decimal 0.1-0.5
  autoJoinCooldownMinutes: number;
  checkInInterval: number;    // messages
  liveChatChannels: string[]; // channel IDs where live chat is active
}

interface MemoryFact {
  text: string;
  setBy: string;
  setByRole: string;
  setAt: string;
  expiresAt?: string | null;
}

interface UserMemoryDoc {
  userId: string;
  facts: MemoryFact[];
}

interface ChannelOverride {
  channelId: string;
  autoJoin: boolean;
  reactions: boolean;
}

interface ActivityEntry {
  _id: string;
  time: string;
  channelId: string;
  type: 'keyword' | 'reaction' | 'periodic' | 'unanswered_question';
  reason: string;
  action: string;
  responsePreview: string;
}

// -- Defaults --

const DEFAULT_CONFIG: LiveChatConfig = {
  autoJoinEnabled: true,
  reactionsEnabled: true,
  periodicCheckIn: true,
  mastermindOnly: false,
  reactionProbability: 0.3,
  autoJoinCooldownMinutes: 3,
  checkInInterval: 20,
  liveChatChannels: [],
};

type Tab = 'toggles' | 'memories' | 'channels' | 'activity';

// -- Helpers --

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

// -- Component --

export default function SageLiveChatPage() {
  const [tab, setTab] = useState<Tab>('toggles');

  // Config state
  const [config, setConfig] = useState<LiveChatConfig>({ ...DEFAULT_CONFIG });
  const [configOriginal, setConfigOriginal] = useState<LiveChatConfig>({ ...DEFAULT_CONFIG });
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Memories state
  const [memoryDocs, setMemoryDocs] = useState<UserMemoryDoc[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memorySearch, setMemorySearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newFactText, setNewFactText] = useState('');
  const [newFactExpiry, setNewFactExpiry] = useState('');
  const [addingFact, setAddingFact] = useState(false);
  const [deletingFactIdx, setDeletingFactIdx] = useState<number | null>(null);

  // Channels state
  const [channels, setChannels] = useState<ChannelOverride[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelAutoJoin, setNewChannelAutoJoin] = useState(true);
  const [newChannelReactions, setNewChannelReactions] = useState(true);
  const [savingChannels, setSavingChannels] = useState(false);

  // Activity state
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityTypeFilter, setActivityTypeFilter] = useState('');
  const [activityChannelFilter, setActivityChannelFilter] = useState('');
  const activityRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { toast } = useToast();

  // -- Config fetch/save --

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sage-live-chat/config');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const c: LiveChatConfig = {
        autoJoinEnabled: data.autoJoinEnabled ?? DEFAULT_CONFIG.autoJoinEnabled,
        reactionsEnabled: data.reactionsEnabled ?? DEFAULT_CONFIG.reactionsEnabled,
        periodicCheckIn: data.periodicCheckIn ?? DEFAULT_CONFIG.periodicCheckIn,
        mastermindOnly: data.mastermindOnly ?? DEFAULT_CONFIG.mastermindOnly,
        reactionProbability: data.reactionProbability ?? DEFAULT_CONFIG.reactionProbability,
        autoJoinCooldownMinutes: data.autoJoinCooldownMinutes ?? DEFAULT_CONFIG.autoJoinCooldownMinutes,
        checkInInterval: data.checkInInterval ?? DEFAULT_CONFIG.checkInInterval,
        liveChatChannels: data.liveChatChannels ?? DEFAULT_CONFIG.liveChatChannels,
      };
      setConfig(c);
      setConfigOriginal(c);
    } catch {
      toast('Failed to load live chat config.', 'error');
    } finally {
      setConfigLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const configChanged = JSON.stringify(config) !== JSON.stringify(configOriginal);
  useUnsavedWarning(configChanged);

  async function saveConfig() {
    setSaving(true);
    // Track which fields have been saved so discard stays accurate on partial failure
    const savedOriginal: Record<string, any> = { ...configOriginal };
    try {
      // Send only changed fields as individual { section, value } updates
      const fields: Array<{ section: keyof LiveChatConfig; value: any }> = [];
      for (const key of Object.keys(config) as Array<keyof LiveChatConfig>) {
        if (JSON.stringify(config[key]) !== JSON.stringify(configOriginal[key])) {
          fields.push({ section: key, value: config[key] });
        }
      }
      for (const { section, value } of fields) {
        const res = await fetch('/api/admin/sage-live-chat/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body: JSON.stringify({ section, value }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to save ${section}`);
        }
        // Mark this field as saved immediately so partial failures stay in sync
        savedOriginal[section] = value;
      }
      setConfigOriginal({ ...config });
      toast('Config saved successfully.', 'success');
    } catch (err: any) {
      // Update original to reflect what was actually persisted
      setConfigOriginal(savedOriginal as LiveChatConfig);
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function discardConfig() {
    setConfig({ ...configOriginal });
  }

  // -- Memories --

  const fetchMemories = useCallback(async () => {
    setMemoriesLoading(true);
    try {
      const params = new URLSearchParams();
      if (memorySearch.trim()) params.set('search', memorySearch.trim());
      const res = await fetch(`/api/admin/sage-live-chat/memories?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: UserMemoryDoc[] = await res.json();
      setMemoryDocs(Array.isArray(data) ? data : []);
    } catch {
      toast('Failed to load user memories.', 'error');
    } finally {
      setMemoriesLoading(false);
    }
  }, [memorySearch, toast]);

  useEffect(() => {
    if (tab === 'memories') fetchMemories();
  }, [tab, fetchMemories]);

  const selectedUserFacts = memoryDocs.find(d => d.userId === selectedUserId)?.facts ?? [];

  function openUserFacts(userId: string) {
    setSelectedUserId(userId);
    setNewFactText('');
    setNewFactExpiry('');
  }

  async function addFact() {
    if (!selectedUserId || !newFactText.trim()) return;
    setAddingFact(true);
    try {
      const body: any = { userId: selectedUserId, text: newFactText.trim() };
      if (newFactExpiry) body.expiresAt = new Date(newFactExpiry).toISOString();
      const res = await fetch('/api/admin/sage-live-chat/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add fact');
      }
      toast('Fact added.', 'success');
      setNewFactText('');
      setNewFactExpiry('');
      await fetchMemories();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setAddingFact(false);
    }
  }

  async function deleteFact(factIndex: number) {
    if (!selectedUserId) return;
    setDeletingFactIdx(factIndex);
    try {
      const res = await fetch('/api/admin/sage-live-chat/memories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ userId: selectedUserId, factIndex }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete fact');
      }
      toast('Fact deleted.', 'success');
      await fetchMemories();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setDeletingFactIdx(null);
    }
  }

  // -- Channels --

  const fetchChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const res = await fetch('/api/admin/sage-live-chat/channels');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // API returns { channelOverrides: Record<id, {autoJoin, reactions}>, enabledChannels }
      const overrides = data.channelOverrides ?? {};
      const arr: ChannelOverride[] = Object.entries(overrides).map(([id, o]: [string, any]) => ({
        channelId: id,
        autoJoin: o.autoJoin ?? true,
        reactions: o.reactions ?? true,
      }));
      setChannels(arr);
    } catch {
      toast('Failed to load channel overrides.', 'error');
    } finally {
      setChannelsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (tab === 'channels') fetchChannels();
  }, [tab, fetchChannels]);

  async function addChannelOverride() {
    if (!newChannelId.trim()) return;
    setSavingChannels(true);
    try {
      const res = await fetch('/api/admin/sage-live-chat/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ channelId: newChannelId.trim(), overrides: { autoJoin: newChannelAutoJoin, reactions: newChannelReactions } }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save channel override');
      }
      setNewChannelId('');
      setNewChannelAutoJoin(true);
      setNewChannelReactions(true);
      toast('Channel override added.', 'success');
      await fetchChannels();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSavingChannels(false);
    }
  }

  async function removeChannelOverride(channelId: string) {
    setSavingChannels(true);
    try {
      const res = await fetch('/api/admin/sage-live-chat/channels', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove channel override');
      }
      toast('Channel override removed.', 'success');
      await fetchChannels();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSavingChannels(false);
    }
  }

  // -- Activity Log --

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const params = new URLSearchParams({ page: String(activityPage), limit: '20' });
      if (activityTypeFilter) params.set('type', activityTypeFilter);
      if (activityChannelFilter && /^\d{17,20}$/.test(activityChannelFilter)) params.set('channel', activityChannelFilter);
      const res = await fetch(`/api/admin/sage-live-chat/activity-log?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setActivity(data.items ?? []);
      setActivityTotal(data.total ?? 0);
    } catch {
      toast('Failed to load activity log.', 'error');
    } finally {
      setActivityLoading(false);
    }
  }, [activityPage, activityTypeFilter, activityChannelFilter, toast]);

  useEffect(() => {
    if (tab === 'activity') fetchActivity();
  }, [tab, fetchActivity]);

  // Auto-refresh activity every 30 seconds
  useEffect(() => {
    if (tab === 'activity') {
      activityRefreshRef.current = setInterval(fetchActivity, 30000);
      return () => {
        if (activityRefreshRef.current) clearInterval(activityRefreshRef.current);
      };
    }
    if (activityRefreshRef.current) clearInterval(activityRefreshRef.current);
  }, [tab, fetchActivity]);

  // -- Column definitions --

  const memoryColumns: Column<{ userId: string; factsCount: number }>[] = [
    { key: 'userId', label: 'User ID', sortable: true },
    { key: 'factsCount', label: 'Facts', sortable: true },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <button
          className="admin-btn admin-btn-ghost admin-btn-sm"
          onClick={() => openUserFacts(row.userId)}
        >
          View / Manage
        </button>
      ),
    },
  ];

  const channelColumns: Column<ChannelOverride>[] = [
    { key: 'channelId', label: 'Channel ID', sortable: true },
    {
      key: 'autoJoin',
      label: 'Auto-Join',
      sortable: false,
      render: (row) => (
        <span style={{ color: row.autoJoin ? '#34d399' : 'var(--text-muted)' }}>
          {row.autoJoin ? 'On' : 'Off'}
        </span>
      ),
    },
    {
      key: 'reactions',
      label: 'Reactions',
      sortable: false,
      render: (row) => (
        <span style={{ color: row.reactions ? '#34d399' : 'var(--text-muted)' }}>
          {row.reactions ? 'On' : 'Off'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (row) => (
        <button
          className="admin-btn admin-btn-danger admin-btn-sm"
          onClick={() => removeChannelOverride(row.channelId)}
          disabled={savingChannels}
        >
          Remove
        </button>
      ),
    },
  ];

  const activityColumns: Column<ActivityEntry>[] = [
    {
      key: 'time',
      label: 'Time',
      sortable: false,
      render: (row) => <span style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{formatDate(row.time)}</span>,
    },
    { key: 'channelId', label: 'Channel', sortable: false },
    {
      key: 'type',
      label: 'Type',
      sortable: false,
      render: (row) => (
        <span style={{
          fontSize: '11px',
          padding: '2px 8px',
          borderRadius: '4px',
          background: row.type === 'keyword' ? 'rgba(59,130,246,0.15)' :
            row.type === 'reaction' ? 'rgba(168,85,247,0.15)' :
            row.type === 'periodic' ? 'rgba(52,211,153,0.15)' :
            'rgba(251,191,36,0.15)',
          color: row.type === 'keyword' ? '#60a5fa' :
            row.type === 'reaction' ? '#a855f7' :
            row.type === 'periodic' ? '#34d399' :
            '#fbbf24',
        }}>
          {row.type}
        </span>
      ),
    },
    { key: 'reason', label: 'Reason', sortable: false },
    { key: 'action', label: 'Action', sortable: false },
    {
      key: 'responsePreview',
      label: 'Response',
      sortable: false,
      render: (row) => (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '200px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.responsePreview || '-'}
        </span>
      ),
    },
  ];

  // -- Render --

  if (configLoading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title">Sage Live Chat</h1>
          <p className="admin-page-subtitle">Manage auto-join, reactions, user memories, and activity</p>
        </div>
        <SkeletonCard count={3} />
        <SkeletonTable rows={4} />
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Sage Live Chat</h1>
        <p className="admin-page-subtitle">Manage auto-join, reactions, user memories, and activity</p>
      </div>

      {/* Status overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div className="admin-stat-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Auto-Join</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: config.autoJoinEnabled ? '#34d399' : 'var(--text-muted)' }}>
            {config.autoJoinEnabled ? 'Enabled' : 'Disabled'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Cooldown: {config.autoJoinCooldownMinutes}m
          </div>
        </div>
        <div className="admin-stat-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Reactions</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: config.reactionsEnabled ? '#34d399' : 'var(--text-muted)' }}>
            {config.reactionsEnabled ? 'Enabled' : 'Disabled'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Probability: {Math.round(config.reactionProbability * 100)}%
          </div>
        </div>
        <div className="admin-stat-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Check-In</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: config.periodicCheckIn ? '#34d399' : 'var(--text-muted)' }}>
            {config.periodicCheckIn ? 'Enabled' : 'Disabled'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Every {config.checkInInterval} messages
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'toggles' ? 'admin-tab-active' : ''}`} onClick={() => setTab('toggles')}>
          Feature Toggles
          {configChanged && <span style={{ marginLeft: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-legendary)', display: 'inline-block' }} />}
        </button>
        <button className={`admin-tab ${tab === 'memories' ? 'admin-tab-active' : ''}`} onClick={() => setTab('memories')}>
          User Memories
        </button>
        <button className={`admin-tab ${tab === 'channels' ? 'admin-tab-active' : ''}`} onClick={() => setTab('channels')}>
          Channel Config
        </button>
        <button className={`admin-tab ${tab === 'activity' ? 'admin-tab-active' : ''}`} onClick={() => setTab('activity')}>
          Activity Log
        </button>
      </div>

      {/* Tab 1: Feature Toggles */}
      {tab === 'toggles' && (
        <>
          <ConfigSection title="Access Control" description="Emergency kill switch — restrict all Sage interactions to Masterminds only.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ToggleSwitch
                label="Mastermind-only mode"
                checked={config.mastermindOnly}
                onChange={(v) => setConfig({ ...config, mastermindOnly: v })}
              />
              {config.mastermindOnly && (
                <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(244,63,94,0.12)', color: '#f43f5e', fontSize: '13px', fontWeight: 500 }}>
                  Only Masterminds can interact with Sage. All other users are blocked from prefix, mention, and live chat.
                </div>
              )}
            </div>
          </ConfigSection>

          <ConfigSection title="Active Channels" description="Sage only participates in live chat in these channels. If empty, live chat is disabled everywhere.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {config.liveChatChannels.length === 0 && (
                <div style={{ padding: '12px', borderRadius: '6px', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', fontSize: '13px' }}>
                  No channels configured — live chat features are currently disabled.
                </div>
              )}
              {config.liveChatChannels.map((chId, i) => (
                <div key={chId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{chId}</code>
                  <button
                    className="admin-btn admin-btn-danger admin-btn-sm"
                    onClick={() => setConfig({ ...config, liveChatChannels: config.liveChatChannels.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="Channel ID (e.g., 1234567890123456)"
                  id="newLiveChatChannel"
                  style={{ width: '260px' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const input = e.currentTarget;
                      const val = input.value.trim();
                      if (/^\d{17,20}$/.test(val) && !config.liveChatChannels.includes(val)) {
                        setConfig({ ...config, liveChatChannels: [...config.liveChatChannels, val] });
                        input.value = '';
                      }
                    }
                  }}
                />
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  onClick={() => {
                    const input = document.getElementById('newLiveChatChannel') as HTMLInputElement;
                    const val = input?.value.trim();
                    if (val && /^\d{17,20}$/.test(val) && !config.liveChatChannels.includes(val)) {
                      setConfig({ ...config, liveChatChannels: [...config.liveChatChannels, val] });
                      input.value = '';
                    }
                  }}
                >
                  Add Channel
                </button>
              </div>
            </div>
          </ConfigSection>

          <ConfigSection title="Auto-Join" description="Sage automatically joins active conversations">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <ToggleSwitch
                label="Auto-join enabled"
                checked={config.autoJoinEnabled}
                onChange={(v) => setConfig({ ...config, autoJoinEnabled: v })}
              />
              <NumberInput
                label="Auto-join cooldown"
                description="Minutes between auto-joins (1-5)"
                value={config.autoJoinCooldownMinutes}
                onChange={(v) => setConfig({ ...config, autoJoinCooldownMinutes: v })}
                min={1}
                max={5}
              />
            </div>
          </ConfigSection>

          <ConfigSection title="Reactions" description="Sage reacts to messages with emoji">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <ToggleSwitch
                label="Reactions enabled"
                checked={config.reactionsEnabled}
                onChange={(v) => setConfig({ ...config, reactionsEnabled: v })}
              />
              <NumberInput
                label="Reaction probability"
                description={`Chance of reacting to a message (10-50%). Currently: ${Math.round(config.reactionProbability * 100)}%`}
                value={Math.round(config.reactionProbability * 100)}
                onChange={(v) => setConfig({ ...config, reactionProbability: v / 100 })}
                min={10}
                max={50}
              />
            </div>
          </ConfigSection>

          <ConfigSection title="Periodic Check-In" description="Sage periodically checks in on quiet channels">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <ToggleSwitch
                label="Periodic check-in enabled"
                checked={config.periodicCheckIn}
                onChange={(v) => setConfig({ ...config, periodicCheckIn: v })}
              />
              <NumberInput
                label="Check-in interval"
                description="Number of messages between check-ins (10-30)"
                value={config.checkInInterval}
                onChange={(v) => setConfig({ ...config, checkInInterval: v })}
                min={10}
                max={30}
              />
            </div>
          </ConfigSection>

          <SaveDeployBar
            hasChanges={configChanged}
            saving={saving}
            onSave={saveConfig}
            onDiscard={discardConfig}
            projectName="Sage Live Chat"
          />
        </>
      )}

      {/* Tab 2: User Memories */}
      {tab === 'memories' && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="admin-input"
                placeholder="Filter by user ID..."
                value={memorySearch}
                onChange={(e) => setMemorySearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchMemories(); }}
                style={{ width: '280px', maxWidth: '100%' }}
              />
              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={fetchMemories} disabled={memoriesLoading}>
                {memoriesLoading ? 'Loading...' : 'Search'}
              </button>
            </div>
          </div>

          {memoriesLoading && memoryDocs.length === 0 ? (
            <SkeletonTable rows={5} />
          ) : (
            <DataTable
              title="User Memories"
              columns={memoryColumns}
              data={memoryDocs.map(d => ({ userId: d.userId, factsCount: d.facts?.length ?? 0 }))}
              pageSize={20}
            />
          )}

          {/* User facts modal */}
          <AdminLightbox
            isOpen={selectedUserId !== null}
            onClose={() => setSelectedUserId(null)}
            title={`Facts for ${selectedUserId}`}
            size="lg"
          >
            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '16px' }}>
              {selectedUserFacts.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No facts recorded</div>
              ) : (
                <table className="admin-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Fact</th>
                      <th style={{ textAlign: 'left' }}>Set By</th>
                      <th style={{ textAlign: 'left' }}>Set At</th>
                      <th style={{ textAlign: 'left' }}>Expires</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUserFacts.map((fact, idx) => {
                      const expired = isExpired(fact.expiresAt);
                      return (
                        <tr key={idx} style={expired ? { opacity: 0.45 } : undefined}>
                          <td style={{ fontSize: '13px', maxWidth: '220px', wordBreak: 'break-word' }}>
                            {fact.text}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {fact.setBy}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatDate(fact.setAt)}
                          </td>
                          <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {expired ? (
                              <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(244,63,94,0.15)', color: '#f43f5e', fontSize: '10px', fontWeight: 600 }}>
                                Expired
                              </span>
                            ) : fact.expiresAt ? (
                              <span style={{ color: 'var(--text-muted)' }}>{formatDate(fact.expiresAt)}</span>
                            ) : '-'}
                          </td>
                          <td>
                            <button
                              className="admin-btn admin-btn-danger admin-btn-sm"
                              onClick={() => deleteFact(idx)}
                              disabled={deletingFactIdx === idx}
                            >
                              {deletingFactIdx === idx ? '...' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Add fact form */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>Add Fact</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Fact text</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="Enter a fact about this user..."
                    value={newFactText}
                    onChange={(e) => setNewFactText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newFactText.trim()) addFact(); }}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Expiry (optional)</label>
                  <input
                    type="datetime-local"
                    className="admin-input"
                    value={newFactExpiry}
                    onChange={(e) => setNewFactExpiry(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <button
                  className={`admin-btn admin-btn-primary admin-btn-sm ${addingFact ? 'admin-btn-loading' : ''}`}
                  onClick={addFact}
                  disabled={addingFact || !newFactText.trim()}
                >
                  {addingFact ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          </AdminLightbox>
        </>
      )}

      {/* Tab 3: Channel Configuration */}
      {tab === 'channels' && (
        <>
          {channelsLoading ? (
            <SkeletonTable rows={4} />
          ) : (
            <DataTable
              title="Channel Overrides"
              columns={channelColumns}
              data={channels}
              pageSize={20}
            />
          )}

          {/* Add override form */}
          <ConfigSection title="Add Channel Override" description="Set per-channel auto-join and reaction toggles">
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Channel ID</label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="e.g. 1234567890123456"
                  value={newChannelId}
                  onChange={(e) => setNewChannelId(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <ToggleSwitch label="Auto-Join" checked={newChannelAutoJoin} onChange={setNewChannelAutoJoin} />
              <ToggleSwitch label="Reactions" checked={newChannelReactions} onChange={setNewChannelReactions} />
              <button
                className={`admin-btn admin-btn-primary admin-btn-sm ${savingChannels ? 'admin-btn-loading' : ''}`}
                onClick={addChannelOverride}
                disabled={savingChannels || !newChannelId.trim()}
              >
                {savingChannels ? 'Saving...' : 'Add Override'}
              </button>
            </div>
          </ConfigSection>
        </>
      )}

      {/* Tab 4: Activity Log */}
      {tab === 'activity' && (
        <>
          <div className="admin-filters" style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="admin-input"
              value={activityTypeFilter}
              onChange={(e) => { setActivityTypeFilter(e.target.value); setActivityPage(1); }}
              style={{ width: '180px', cursor: 'pointer' }}
            >
              <option value="">All Types</option>
              <option value="keyword">Keyword</option>
              <option value="reaction">Reaction</option>
              <option value="periodic">Periodic</option>
              <option value="unanswered_question">Unanswered Question</option>
            </select>
            <input
              type="text"
              className="admin-input"
              placeholder="Filter by channel ID..."
              value={activityChannelFilter}
              onChange={(e) => { setActivityChannelFilter(e.target.value); setActivityPage(1); }}
              style={{ width: '200px' }}
            />
            <button
              className="admin-btn admin-btn-ghost admin-btn-sm"
              onClick={fetchActivity}
              disabled={activityLoading}
            >
              {activityLoading ? 'Loading...' : 'Refresh'}
            </button>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Auto-refreshes every 30s</span>
          </div>

          {activityLoading && activity.length === 0 ? (
            <SkeletonTable rows={6} />
          ) : (
            <DataTable
              title="Activity Log"
              columns={activityColumns}
              data={activity}
              pageSize={20}
              totalItems={activityTotal}
              currentPage={activityPage}
              onPageChange={setActivityPage}
              serverPagination
            />
          )}
        </>
      )}
    </>
  );
}
