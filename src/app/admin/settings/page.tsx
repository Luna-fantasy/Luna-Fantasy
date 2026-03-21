'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfigSection from '../components/ConfigSection';
import NumberInput from '../components/NumberInput';
import ToggleSwitch from '../components/ToggleSwitch';
import DurationInput from '../components/DurationInput';
import BotBadge from '../components/BotBadge';
import SaveDeployBar from '../components/SaveDeployBar';
import RolePicker from '../components/RolePicker';
import ChannelPicker from '../components/ChannelPicker';
import ImagePicker from '../components/ImagePicker';
import ConfigTable from '../components/ConfigTable';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';
import { timeAgo } from '../utils/timeAgo';
import { computeConfigDiff } from '../utils/computeConfigDiff';

// -- Butler Channels --
interface ButlerChannelConfig {
  lunari_log_channel_id?: string;
  level_up_channel_id?: string;
  ticket_logs_channel_id?: string;
  applications_reviews_channel_id?: string;
  applications_logs_channel_id?: string;
  staff_stats_channel_id?: string;
  auto_image_channels?: string[];
  leaderboard?: { channel_id: string; update_interval: number };
  leaderboard_levels?: { channel_id: string; update_interval: number };
}

// -- Butler Roles --
interface ButlerRoleConfig {
  owners_roles_ids?: string[];
  admin_games_roles_ids?: string[];
  salary_staff_roles?: string[];
  salary_special_roles?: string[];
  salary_booster_role?: string;
  overdue_debt_role_id?: string;
  vip_deposit_role_id?: string;
}

// -- Jester Channels --
interface JesterChannelConfig {
  log_channels?: { lunari?: string; cards?: string; stones?: string };
  fantasy_leaderboard?: { channel_id: string; update_interval: number };
  auction_channel_id?: string;
  allowed_game_channels?: string[];
}

// -- Jester Roles --
interface JesterRoleConfig {
  owners_roles_ids?: string[];
  admin_games_roles_ids?: string[];
  debt_role_id?: string;
  collection_rewards?: Record<string, { rolesIds: string[]; rolesNames?: string[] }>;
  stone_completion_role?: string;
  stone_full_completion_role?: string;
}

// -- Auto Systems --
interface AutoReplyConfig {
  enabled: boolean;
  replies: Array<{ trigger: string; response: string }>;
}

// -- Badge Thresholds --
interface BadgeThresholdsConfig {
  million: number;
  text_messages: number;
  voice_hours: number;
  game_wins: number;
  la_luna_level: number;
}

const BADGE_DEFAULTS: BadgeThresholdsConfig = {
  million: 1_000_000,
  text_messages: 2_500,
  voice_hours: 100,
  game_wins: 500,
  la_luna_level: 100,
};

type Tab = 'butler-channels' | 'butler-roles' | 'jester-channels' | 'jester-roles' | 'auto' | 'badges';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('butler-channels');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configMetadata, setConfigMetadata] = useState<{ updatedAt: string | null; updatedBy: string | null }>({ updatedAt: null, updatedBy: null });

  // Butler
  const [bChannels, setBChannels] = useState<ButlerChannelConfig>({});
  const [bChannelsOrig, setBChannelsOrig] = useState<ButlerChannelConfig>({});
  const [bRoles, setBRoles] = useState<ButlerRoleConfig>({});
  const [bRolesOrig, setBRolesOrig] = useState<ButlerRoleConfig>({});
  const [autoReply, setAutoReply] = useState<AutoReplyConfig>({ enabled: false, replies: [] });
  const [autoReplyOrig, setAutoReplyOrig] = useState<AutoReplyConfig>({ enabled: false, replies: [] });
  const [autoImages, setAutoImages] = useState<Array<{ channel_id: string; image_url: string }>>([]);
  const [autoImagesOrig, setAutoImagesOrig] = useState<Array<{ channel_id: string; image_url: string }>>([]);

  // Jester
  const [jChannels, setJChannels] = useState<JesterChannelConfig>({});
  const [jChannelsOrig, setJChannelsOrig] = useState<JesterChannelConfig>({});
  const [jRoles, setJRoles] = useState<JesterRoleConfig>({});
  const [jRolesOrig, setJRolesOrig] = useState<JesterRoleConfig>({});

  // Badge thresholds
  const [badges, setBadges] = useState<BadgeThresholdsConfig>(BADGE_DEFAULTS);
  const [badgesOrig, setBadgesOrig] = useState<BadgeThresholdsConfig>(BADGE_DEFAULTS);

  const { toast } = useToast();

  const fetchConfig = useCallback(async () => {
    try {
      const [butlerRes, jesterRes] = await Promise.all([
        fetch('/api/admin/config/butler'),
        fetch('/api/admin/config/jester'),
      ]);
      if (!butlerRes.ok || !jesterRes.ok) throw new Error('Failed to load config');
      const butlerData = await butlerRes.json();
      const jesterData = await jesterRes.json();
      const bs = butlerData.sections || {};
      const js = jesterData.sections || {};

      const bMeta = butlerData.metadata;
      const jMeta = jesterData.metadata;
      if (bMeta?.updatedAt || jMeta?.updatedAt) {
        const bTime = bMeta?.updatedAt ? new Date(bMeta.updatedAt).getTime() : 0;
        const jTime = jMeta?.updatedAt ? new Date(jMeta.updatedAt).getTime() : 0;
        setConfigMetadata(bTime >= jTime ? bMeta : jMeta);
      }

      if (bs.channel_config) { setBChannels(bs.channel_config); setBChannelsOrig(bs.channel_config); }
      if (bs.role_config) { setBRoles(bs.role_config); setBRolesOrig(bs.role_config); }
      if (bs.auto_reply) { setAutoReply(bs.auto_reply); setAutoReplyOrig(bs.auto_reply); }
      if (bs.auto_images) { const imgs = Array.isArray(bs.auto_images) ? bs.auto_images : bs.auto_images?.channels ?? []; setAutoImages(imgs); setAutoImagesOrig(imgs); }
      if (js.channel_config) { setJChannels(js.channel_config); setJChannelsOrig(js.channel_config); }
      if (js.collection_rewards) {
        setJRoles(p => ({ ...p, collection_rewards: js.collection_rewards }));
        setJRolesOrig(p => ({ ...p, collection_rewards: js.collection_rewards }));
      }
      if (bs.badge_thresholds) {
        // Convert voice_seconds from DB to voice_hours for UI
        const bt = {
          ...BADGE_DEFAULTS,
          ...bs.badge_thresholds,
          voice_hours: Math.round((bs.badge_thresholds.voice_seconds ?? BADGE_DEFAULTS.voice_hours * 3600) / 3600),
        };
        delete (bt as any).voice_seconds;
        setBadges(bt);
        setBadgesOrig(bt);
      }
    } catch {
      toast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const saveButlerSection = async (section: string, value: any) => {
    const res = await fetch('/api/admin/config/butler', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
      body: JSON.stringify({ section, value }),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
  };

  const saveJesterSection = async (section: string, value: any) => {
    const res = await fetch('/api/admin/config/jester', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
      body: JSON.stringify({ section, value }),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
  };

  const hasChanges =
    JSON.stringify(bChannels) !== JSON.stringify(bChannelsOrig) ||
    JSON.stringify(bRoles) !== JSON.stringify(bRolesOrig) ||
    JSON.stringify(autoReply) !== JSON.stringify(autoReplyOrig) ||
    JSON.stringify(autoImages) !== JSON.stringify(autoImagesOrig) ||
    JSON.stringify(jChannels) !== JSON.stringify(jChannelsOrig) ||
    JSON.stringify(jRoles) !== JSON.stringify(jRolesOrig) ||
    JSON.stringify(badges) !== JSON.stringify(badgesOrig);

  const handleSave = async () => {
    setSaving(true);
    try {
      const tasks: Promise<void>[] = [];
      if (JSON.stringify(bChannels) !== JSON.stringify(bChannelsOrig)) tasks.push(saveButlerSection('channel_config', bChannels));
      if (JSON.stringify(bRoles) !== JSON.stringify(bRolesOrig)) tasks.push(saveButlerSection('role_config', bRoles));
      if (JSON.stringify(autoReply) !== JSON.stringify(autoReplyOrig)) tasks.push(saveButlerSection('auto_reply', autoReply));
      if (JSON.stringify(autoImages) !== JSON.stringify(autoImagesOrig)) tasks.push(saveButlerSection('auto_images', autoImages));
      if (JSON.stringify(jChannels) !== JSON.stringify(jChannelsOrig)) tasks.push(saveJesterSection('channel_config', jChannels));
      if (JSON.stringify(jRoles) !== JSON.stringify(jRolesOrig)) tasks.push(saveJesterSection('collection_rewards', jRoles.collection_rewards));
      if (JSON.stringify(badges) !== JSON.stringify(badgesOrig)) {
        // Convert voice_hours to voice_seconds for the bot
        const { voice_hours, ...rest } = badges;
        tasks.push(saveButlerSection('badge_thresholds', { ...rest, voice_seconds: voice_hours * 3600 }));
      }
      await Promise.all(tasks);
      setBChannelsOrig(bChannels);
      setBRolesOrig(bRoles);
      setAutoReplyOrig(autoReply);
      setAutoImagesOrig(autoImages);
      setJChannelsOrig(jChannels);
      setJRolesOrig(jRoles);
      setBadgesOrig(badges);
      toast('Saved! Changes take effect within 30 seconds.', 'success');
    } catch (err: any) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setBChannels(bChannelsOrig);
    setBRoles(bRolesOrig);
    setAutoReply(autoReplyOrig);
    setAutoImages(autoImagesOrig);
    setJChannels(jChannelsOrig);
    setJRoles(jRolesOrig);
    setBadges(badgesOrig);
  };

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">⚙️</span> General Settings</h1>
          <p className="admin-page-subtitle">Channel IDs, role IDs, and auto-moderation for both bots</p>
        </div>
        <SkeletonCard count={3} />
        <SkeletonTable rows={4} />
      </>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'butler-channels', label: 'Butler Channels' },
    { key: 'butler-roles', label: 'Butler Roles' },
    { key: 'jester-channels', label: 'Jester Channels' },
    { key: 'jester-roles', label: 'Jester Roles' },
    { key: 'auto', label: 'Auto Systems' },
    { key: 'badges', label: 'Badges' },
  ];

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">⚙️</span> General Settings</h1>
        <p className="admin-page-subtitle">Channel IDs, role IDs, and auto-moderation for both bots</p>
      </div>

      {configMetadata.updatedAt && (
        <div className="admin-last-updated">
          Last updated {timeAgo(configMetadata.updatedAt)} by {configMetadata.updatedBy || 'Unknown'}
        </div>
      )}

      <div className="admin-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`admin-tab ${tab === t.key ? 'admin-tab-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* -- Butler Channels -- */}
      {tab === 'butler-channels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ConfigSection title="Log Channels" description="Where Butler sends transaction and event logs">
            <ChannelPicker label="📺 Lunari Transaction Log" description="Channel where Butler posts all Lunari economy transactions" value={bChannels.lunari_log_channel_id ?? ''} onChange={v => setBChannels(p => ({ ...p, lunari_log_channel_id: v as string }))} />
            <ChannelPicker label="📺 Level Up Announcements" description="Channel where level-up embeds are posted when users rank up" value={bChannels.level_up_channel_id ?? ''} onChange={v => setBChannels(p => ({ ...p, level_up_channel_id: v as string }))} />
            <ChannelPicker label="📺 Ticket Logs" description="Channel where ticket open/close events are logged" value={bChannels.ticket_logs_channel_id ?? ''} onChange={v => setBChannels(p => ({ ...p, ticket_logs_channel_id: v as string }))} />
            <ChannelPicker label="📺 Applications Reviews" description="Channel where staff application reviews are posted" value={bChannels.applications_reviews_channel_id ?? ''} onChange={v => setBChannels(p => ({ ...p, applications_reviews_channel_id: v as string }))} />
            <ChannelPicker label="📺 Applications Logs" description="Channel where application submission logs are sent" value={bChannels.applications_logs_channel_id ?? ''} onChange={v => setBChannels(p => ({ ...p, applications_logs_channel_id: v as string }))} />
            <ChannelPicker label="📺 Staff Stats Channel" description="Channel where staff activity stats are posted" value={bChannels.staff_stats_channel_id ?? ''} onChange={v => setBChannels(p => ({ ...p, staff_stats_channel_id: v as string }))} />
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection title="Leaderboards" description="Auto-updating leaderboard channels">
            <ChannelPicker label="📺 Points Leaderboard Channel" description="Channel where the Lunari leaderboard is auto-posted" value={bChannels.leaderboard?.channel_id ?? ''} onChange={v => setBChannels(p => ({ ...p, leaderboard: { channel_id: v as string, update_interval: p.leaderboard?.update_interval ?? 86400000 } }))} />
            <DurationInput label="⏱️ Points Update Interval" value={bChannels.leaderboard?.update_interval ?? 86400000} onChange={v => setBChannels(p => ({ ...p, leaderboard: { ...p.leaderboard!, update_interval: v } }))} description="How often the points leaderboard refreshes" />
            <ChannelPicker label="📺 Levels Leaderboard Channel" description="Channel where the XP/levels leaderboard is auto-posted" value={bChannels.leaderboard_levels?.channel_id ?? ''} onChange={v => setBChannels(p => ({ ...p, leaderboard_levels: { channel_id: v as string, update_interval: p.leaderboard_levels?.update_interval ?? 86400000 } }))} />
            <DurationInput label="⏱️ Levels Update Interval" value={bChannels.leaderboard_levels?.update_interval ?? 86400000} onChange={v => setBChannels(p => ({ ...p, leaderboard_levels: { ...p.leaderboard_levels!, update_interval: v } }))} description="How often the levels leaderboard refreshes" />
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection title="Image-Only Channels" description="Butler will automatically delete any non-image messages in these channels. Use for art galleries or media-only channels.">
            <ChannelPicker label="📺 Channel IDs" description="Channels where Butler deletes non-image messages automatically" value={bChannels.auto_image_channels ?? []} onChange={v => setBChannels(p => ({ ...p, auto_image_channels: v as string[] }))} multi />
            <BotBadge bot="butler" />
          </ConfigSection>
        </div>
      )}

      {/* -- Butler Roles -- */}
      {tab === 'butler-roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ConfigSection title="Staff Roles" description="Roles with admin and management permissions">
            <RolePicker label="🛡️ Owner Roles (Mastermind)" description="Roles with full admin access to both bots. Handle with care." value={bRoles.owners_roles_ids ?? []} onChange={v => setBRoles(p => ({ ...p, owners_roles_ids: v as string[] }))} multi />
            <RolePicker label="🛡️ Admin Game Roles" description="Roles that can manage games and economy commands" value={bRoles.admin_games_roles_ids ?? []} onChange={v => setBRoles(p => ({ ...p, admin_games_roles_ids: v as string[] }))} multi />
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection title="Economy Roles" description="Roles used by banking and economy features">
            <RolePicker label="🛡️ Salary Staff Roles" description="Roles eligible for the !salary command payout" value={bRoles.salary_staff_roles ?? []} onChange={v => setBRoles(p => ({ ...p, salary_staff_roles: v as string[] }))} multi />
            <RolePicker label="🛡️ Salary Special Roles" description="Special roles with custom salary amounts" value={bRoles.salary_special_roles ?? []} onChange={v => setBRoles(p => ({ ...p, salary_special_roles: v as string[] }))} multi />
            <RolePicker label="🛡️ Salary Booster Role (Nitro)" description="Role for Nitro boosters that gives a salary bonus" value={bRoles.salary_booster_role ?? ''} onChange={v => setBRoles(p => ({ ...p, salary_booster_role: v as string }))} />
            <RolePicker label="🛡️ Overdue Debt Role" description="Auto-assigned to users with overdue loan repayments" value={bRoles.overdue_debt_role_id ?? ''} onChange={v => setBRoles(p => ({ ...p, overdue_debt_role_id: v as string }))} />
            <RolePicker label="🛡️ VIP Deposit Role" description="Required role for VIP daily bonus rewards" value={bRoles.vip_deposit_role_id ?? ''} onChange={v => setBRoles(p => ({ ...p, vip_deposit_role_id: v as string }))} />
            <BotBadge bot="butler" />
          </ConfigSection>

        </div>
      )}

      {/* -- Jester Channels -- */}
      {tab === 'jester-channels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ConfigSection title="Transaction Log Channels" description="Where Jester sends transaction embeds">
            <ChannelPicker label="📺 Lunari Log" description="Channel for Jester Lunari transaction logs" value={jChannels.log_channels?.lunari ?? ''} onChange={v => setJChannels(p => ({ ...p, log_channels: { ...p.log_channels, lunari: v as string } }))} />
            <ChannelPicker label="📺 Cards Log" description="Channel for card transaction logs (pulls, trades, sells)" value={jChannels.log_channels?.cards ?? ''} onChange={v => setJChannels(p => ({ ...p, log_channels: { ...p.log_channels, cards: v as string } }))} />
            <ChannelPicker label="📺 Stones Log" description="Channel for stone transaction logs (chests, trades, sells)" value={jChannels.log_channels?.stones ?? ''} onChange={v => setJChannels(p => ({ ...p, log_channels: { ...p.log_channels, stones: v as string } }))} />
            <BotBadge bot="jester" />
          </ConfigSection>

          <ConfigSection title="Game & Trade Channels" description="Channels for leaderboards, auctions, and games">
            <ChannelPicker label="📺 Fantasy Leaderboard Channel" description="Channel where the fantasy game leaderboard is auto-posted" value={jChannels.fantasy_leaderboard?.channel_id ?? ''} onChange={v => setJChannels(p => ({ ...p, fantasy_leaderboard: { channel_id: v as string, update_interval: p.fantasy_leaderboard?.update_interval ?? 86400000 } }))} />
            <DurationInput label="⏱️ Leaderboard Update Interval" value={jChannels.fantasy_leaderboard?.update_interval ?? 86400000} onChange={v => setJChannels(p => ({ ...p, fantasy_leaderboard: { ...p.fantasy_leaderboard!, update_interval: v } }))} description="How often the fantasy leaderboard refreshes" />
            <ChannelPicker label="📺 Card Auction Channel" description="Channel where card auctions are posted" value={jChannels.auction_channel_id ?? ''} onChange={v => setJChannels(p => ({ ...p, auction_channel_id: v as string }))} />
            <ChannelPicker label="📺 Allowed Game Channels" description="Channels where Jester game commands can be used" value={jChannels.allowed_game_channels ?? []} onChange={v => setJChannels(p => ({ ...p, allowed_game_channels: v as string[] }))} multi />
            <BotBadge bot="jester" />
          </ConfigSection>
        </div>
      )}

      {/* -- Jester Roles -- */}
      {tab === 'jester-roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ConfigSection title="Staff Roles" description="Roles with admin permissions for Jester">
            <RolePicker label="🛡️ Owner Roles" description="Roles with full admin access to Jester" value={jRoles.owners_roles_ids ?? []} onChange={v => setJRoles(p => ({ ...p, owners_roles_ids: v as string[] }))} multi />
            <RolePicker label="🛡️ Admin Game Roles" description="Roles that can manage Jester games and card operations" value={jRoles.admin_games_roles_ids ?? []} onChange={v => setJRoles(p => ({ ...p, admin_games_roles_ids: v as string[] }))} multi />
            <RolePicker label="🛡️ Debt Role" description="Auto-assigned to users with unpaid card/stone debts" value={jRoles.debt_role_id ?? ''} onChange={v => setJRoles(p => ({ ...p, debt_role_id: v as string }))} />
            <BotBadge bot="jester" />
          </ConfigSection>

          <ConfigSection title="Card Collection Rewards" description="Roles granted when a user completes all cards of a specific rarity">
            {(['COMMON', 'RARE', 'EPIC', 'UNIQUE', 'LEGENDARY', 'SECRET'] as const).map(rarity => (
              <RolePicker
                key={rarity}
                label={`🛡️ ${rarity} Collection Role`}
                description={`Granted when all ${rarity} cards are collected`}
                value={jRoles.collection_rewards?.[rarity]?.rolesIds ?? []}
                onChange={v => setJRoles(p => ({
                  ...p,
                  collection_rewards: {
                    ...p.collection_rewards,
                    [rarity]: { ...p.collection_rewards?.[rarity], rolesIds: v as string[] },
                  },
                }))}
                multi
              />
            ))}
            <RolePicker
              label="🛡️ All Rarities Complete"
              description="Granted when a user completes every card in every rarity"
              value={jRoles.collection_rewards?.['ALL_RARITIES']?.rolesIds ?? []}
              onChange={v => setJRoles(p => ({
                ...p,
                collection_rewards: {
                  ...p.collection_rewards,
                  ALL_RARITIES: { ...p.collection_rewards?.['ALL_RARITIES'], rolesIds: v as string[] },
                },
              }))}
              multi
            />
            <BotBadge bot="jester" />
          </ConfigSection>

          <ConfigSection title="Stone Collection Rewards" description="Roles granted when stone collections are completed">
            <RolePicker label="🛡️ Stone Completion Role" description="Granted when a user completes all basic stone collections" value={jRoles.stone_completion_role ?? ''} onChange={v => setJRoles(p => ({ ...p, stone_completion_role: v as string }))} />
            <RolePicker label="🛡️ Stone Full Completion Role" description="Granted when a user completes all stone collections including rare" value={jRoles.stone_full_completion_role ?? ''} onChange={v => setJRoles(p => ({ ...p, stone_full_completion_role: v as string }))} />
            <BotBadge bot="jester" />
          </ConfigSection>
        </div>
      )}

      {/* -- Auto Systems -- */}
      {tab === 'auto' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ConfigSection title="Auto Reply" description="Automatic responses to specific triggers">
            <ToggleSwitch label="⚡ Enabled" checked={autoReply.enabled} onChange={v => setAutoReply(p => ({ ...p, enabled: v }))} />
            <div className="admin-form-group" style={{ marginTop: 12 }}>
              <label className="admin-form-label">Replies ({autoReply.replies.length})</label>
              {autoReply.replies.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input className="admin-input" style={{ flex: 1 }} value={r.trigger} placeholder="Trigger" onChange={(e) => {
                    const copy = [...autoReply.replies];
                    copy[i] = { ...copy[i], trigger: e.target.value };
                    setAutoReply(p => ({ ...p, replies: copy }));
                  }} />
                  <input className="admin-input" style={{ flex: 2 }} value={r.response} placeholder="Response" onChange={(e) => {
                    const copy = [...autoReply.replies];
                    copy[i] = { ...copy[i], response: e.target.value };
                    setAutoReply(p => ({ ...p, replies: copy }));
                  }} />
                  <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => {
                    setAutoReply(p => ({ ...p, replies: p.replies.filter((_, j) => j !== i) }));
                  }}>Remove</button>
                </div>
              ))}
              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => {
                setAutoReply(p => ({ ...p, replies: [...p.replies, { trigger: '', response: '' }] }));
              }}>Add Reply</button>
            </div>
            <BotBadge bot="butler" />
          </ConfigSection>

          <ConfigSection title="Auto-Image Posting" description="Channels where the bot automatically posts an image whenever a message is sent (image-only channels)">
            {autoImages.map((entry, i) => (
              <div key={i} style={{ marginBottom: 16, padding: '12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <ChannelPicker
                      label=""
                      value={entry.channel_id}
                      onChange={v => {
                        const copy = [...autoImages];
                        copy[i] = { ...copy[i], channel_id: v as string };
                        setAutoImages(copy);
                      }}
                    />
                  </div>
                  <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setAutoImages(prev => prev.filter((_, j) => j !== i))}>
                    &times;
                  </button>
                </div>
                <ImagePicker
                  label="Image"
                  value={entry.image_url}
                  onChange={url => {
                    const copy = [...autoImages];
                    copy[i] = { ...copy[i], image_url: url };
                    setAutoImages(copy);
                  }}
                  uploadPrefix="butler/auto-images/"
                />
              </div>
            ))}
            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setAutoImages(prev => [...prev, { channel_id: '', image_url: '' }])}>
              + Add Channel
            </button>
            <BotBadge bot="butler" />
          </ConfigSection>
        </div>
      )}

      {/* -- Badge Thresholds -- */}
      {tab === 'badges' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ConfigSection title="Badge Thresholds" description="Minimum values required to earn each automatic badge. Changes apply on next badge scan.">
            <NumberInput label="Million Lunari" description="Lunari balance or lifetime earnings needed for the Million badge" value={badges.million} onChange={v => setBadges(p => ({ ...p, million: v }))} min={1} step={100000} />
            <NumberInput label="Text Messages" description="Total messages sent needed for the Wordsmith badge" value={badges.text_messages} onChange={v => setBadges(p => ({ ...p, text_messages: v }))} min={1} step={100} />
            <NumberInput label="Voice Time (hours)" description="Total voice channel hours needed for the Voice Legend badge" value={badges.voice_hours} onChange={v => setBadges(p => ({ ...p, voice_hours: v }))} min={1} step={10} />
            <NumberInput label="Game Wins" description="Total game wins (all modes combined) needed for the 500 Wins badge" value={badges.game_wins} onChange={v => setBadges(p => ({ ...p, game_wins: v }))} min={1} step={50} />
            <NumberInput label="La Luna Level" description="Player level needed for the La Luna badge" value={badges.la_luna_level} onChange={v => setBadges(p => ({ ...p, la_luna_level: v }))} min={1} step={10} />
            <BotBadge bot="butler" />
          </ConfigSection>
        </div>
      )}

      <SaveDeployBar
        hasChanges={hasChanges}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        diff={hasChanges ? [
          ...computeConfigDiff(bChannelsOrig as any, bChannels as any, 'Butler Channels'),
          ...computeConfigDiff(bRolesOrig as any, bRoles as any, 'Butler Roles'),
          ...computeConfigDiff(jChannelsOrig as any, jChannels as any, 'Jester Channels'),
        ] : []}
      />
    </>
  );
}
