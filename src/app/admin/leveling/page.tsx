'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfigSection from '../components/ConfigSection';
import NumberInput from '../components/NumberInput';
import ToggleSwitch from '../components/ToggleSwitch';
import DurationInput from '../components/DurationInput';
import ConfigTable from '../components/ConfigTable';
import BotBadge from '../components/BotBadge';
import SaveDeployBar from '../components/SaveDeployBar';
import { useUnsavedWarning } from '../hooks/useUnsavedWarning';
import RolePicker from '../components/RolePicker';
import ChannelPicker from '../components/ChannelPicker';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';
import { timeAgo } from '../utils/timeAgo';
import { computeConfigDiff } from '../utils/computeConfigDiff';

interface LevelingSections {
  text_xp?: { min: number; max: number; cooldown: number };
  voice_xp?: { enabled: boolean; xp_per_minute: number; require_mic: boolean; check_interval: number };
  boosted_roles?: Record<string, number>;
  double_xp_enabled?: boolean;
  level_rewards?: Record<string, string[]>;
  level_up_mode?: 'same_channel' | 'dedicated_channel';
  level_up_message?: string;
  level_up_channel?: string;
  chat_event_points?: { messages_per_point_batch: number; points_per_message_batch: number; points_per_invite: number };
}

interface JesterLevelReward {
  roleId: string;
  level: number;
  lunari: number;
  tickets: number;
}

export default function LevelingPage() {
  const [sections, setSections] = useState<LevelingSections>({});
  const [original, setOriginal] = useState<LevelingSections>({});
  const [jesterRewards, setJesterRewards] = useState<Record<string, JesterLevelReward>>({});
  const [jesterRewardsOriginal, setJesterRewardsOriginal] = useState<Record<string, JesterLevelReward>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configMetadata, setConfigMetadata] = useState<{ updatedAt: string | null; updatedBy: string | null }>({ updatedAt: null, updatedBy: null });

  const { toast } = useToast();

  const fetchConfig = useCallback(async () => {
    try {
      const [butlerRes, jesterRes] = await Promise.all([
        fetch('/api/admin/config/butler'),
        fetch('/api/admin/config/jester'),
      ]);
      if (!butlerRes.ok) throw new Error(`Butler HTTP ${butlerRes.status}`);
      if (!jesterRes.ok) throw new Error(`Jester HTTP ${jesterRes.status}`);

      const butlerData = await butlerRes.json();
      const jesterData = await jesterRes.json();

      const allSections = butlerData.sections || {};
      // Pick the most recent metadata from either bot
      const bMeta = butlerData.metadata;
      const jMeta = jesterData.metadata;
      if (bMeta?.updatedAt || jMeta?.updatedAt) {
        const bTime = bMeta?.updatedAt ? new Date(bMeta.updatedAt).getTime() : 0;
        const jTime = jMeta?.updatedAt ? new Date(jMeta.updatedAt).getTime() : 0;
        setConfigMetadata(bTime >= jTime ? bMeta : jMeta);
      }
      const configKeys = ['text_xp', 'voice_xp', 'boosted_roles', 'double_xp_enabled', 'level_rewards', 'level_up_mode', 'level_up_message', 'level_up_channel', 'chat_event_points'];
      const filtered: LevelingSections = {};
      for (const k of configKeys) {
        if (allSections[k] !== undefined) (filtered as any)[k] = allSections[k];
      }
      setSections(filtered);
      setOriginal(filtered);

      const jRewards = jesterData.sections?.level_rewards ?? {};
      setJesterRewards(jRewards);
      setJesterRewardsOriginal(jRewards);
    } catch {
      toast('Failed to load leveling config. Try refreshing.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const butlerHasChanges = JSON.stringify(sections) !== JSON.stringify(original);
  const jesterHasChanges = JSON.stringify(jesterRewards) !== JSON.stringify(jesterRewardsOriginal);
  const hasChanges = butlerHasChanges || jesterHasChanges;
  useUnsavedWarning(hasChanges);
  const hasValidationErrors =
    (sections.text_xp ? sections.text_xp.min > sections.text_xp.max : false) ||
    (sections.voice_xp ? sections.voice_xp.enabled && sections.voice_xp.xp_per_minute <= 0 : false);

  const configDiff = hasChanges ? computeConfigDiff(original as any, sections as any) : [];

  function updateSection<K extends keyof LevelingSections>(key: K, value: LevelingSections[K]) {
    setSections((prev) => ({ ...prev, [key]: value }));
  }

  const handleDiscard = () => {
    setSections(original);
    setJesterRewards(jesterRewardsOriginal);
  };

  async function saveConfig() {
    setSaving(true);

    try {
      // Save Butler changes
      if (butlerHasChanges) {
        const changedSections: Array<keyof LevelingSections> = [];
        for (const key of Object.keys(sections) as Array<keyof LevelingSections>) {
          if (JSON.stringify(sections[key]) !== JSON.stringify(original[key])) {
            changedSections.push(key);
          }
        }
        for (const section of changedSections) {
          const res = await fetch('/api/admin/config/butler', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
            body: JSON.stringify({ section, value: sections[section] }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || `Failed to save ${section}`);
          }
        }
        setOriginal({ ...sections });
      }

      // Save Jester level rewards
      if (jesterHasChanges) {
        const res = await fetch('/api/admin/config/jester', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body: JSON.stringify({ section: 'level_rewards', value: jesterRewards }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to save Jester level rewards');
        }
        setJesterRewardsOriginal({ ...jesterRewards });
      }

      toast('Saved! Changes take effect within 30 seconds.', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">✨</span> Leveling</h1>
          <p className="admin-page-subtitle">Configure XP earning rates, boost roles, and level-up rewards</p>
        </div>
        <SkeletonCard count={2} />
        <SkeletonTable rows={4} />
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">✨</span> Leveling</h1>
        <p className="admin-page-subtitle">Configure XP earning rates, boost roles, and level-up rewards</p>
      </div>

      {configMetadata.updatedAt && (
        <div className="admin-last-updated">
          Last updated {timeAgo(configMetadata.updatedAt)} by {configMetadata.updatedBy || 'Unknown'}
        </div>
      )}

      <ConfigSection title="Text XP" description="XP earned from sending messages in text channels">
        {sections.text_xp && (
          <>
            <div className="admin-config-grid">
              <NumberInput label="✨ Minimum XP" value={sections.text_xp.min} onChange={(v) => updateSection('text_xp', { ...sections.text_xp!, min: v })} min={0} description="Least XP a message can earn" />
              <NumberInput label="✨ Maximum XP" value={sections.text_xp.max} onChange={(v) => updateSection('text_xp', { ...sections.text_xp!, max: v })} min={0} description="Most XP a message can earn" />
              <DurationInput label="⏱️ Cooldown" value={sections.text_xp.cooldown} onChange={(v) => updateSection('text_xp', { ...sections.text_xp!, cooldown: v })} description="Wait time before another message earns XP" />
            </div>
            {sections.text_xp.min > sections.text_xp.max && (
              <div style={{ color: '#f43f5e', fontSize: '13px', marginTop: '8px' }}>
                Minimum XP must be less than or equal to Maximum XP
              </div>
            )}
          </>
        )}
        <BotBadge bot="butler" />
      </ConfigSection>

      <ConfigSection title="Voice XP" description="XP earned from being in voice channels">
        {sections.voice_xp && (
          <>
            <div className="admin-config-grid">
              <ToggleSwitch label="⚡ Enabled" checked={sections.voice_xp.enabled} onChange={(v) => updateSection('voice_xp', { ...sections.voice_xp!, enabled: v })} />
              <NumberInput label="✨ XP per Minute" value={sections.voice_xp.xp_per_minute} onChange={(v) => updateSection('voice_xp', { ...sections.voice_xp!, xp_per_minute: v })} step={0.1} min={0} description="XP earned each minute in voice" />
              <ToggleSwitch label="⚡ Require Microphone" checked={sections.voice_xp.require_mic} onChange={(v) => updateSection('voice_xp', { ...sections.voice_xp!, require_mic: v })} />
              <DurationInput label="⏱️ Check Interval" value={sections.voice_xp.check_interval} onChange={(v) => updateSection('voice_xp', { ...sections.voice_xp!, check_interval: v })} description="How often the bot checks who is in voice" />
            </div>
            {sections.voice_xp.xp_per_minute <= 0 && sections.voice_xp.enabled && (
              <div style={{ color: '#f43f5e', fontSize: '13px', marginTop: '8px' }}>
                XP per Minute must be greater than 0 when Voice XP is enabled
              </div>
            )}
          </>
        )}
        <BotBadge bot="butler" />
      </ConfigSection>

      <ConfigSection title="Chat Event Points" description="How points are calculated during timed chat events (competitions)">
        <div className="admin-config-grid">
          <NumberInput
            label="🔢 Messages per Batch"
            value={sections.chat_event_points?.messages_per_point_batch ?? 10}
            onChange={(v) => updateSection('chat_event_points', { ...sections.chat_event_points!, messages_per_point_batch: v })}
            min={1}
            description="Number of messages needed to earn one batch of points"
          />
          <NumberInput
            label="🔢 Points per Batch"
            value={sections.chat_event_points?.points_per_message_batch ?? 5}
            onChange={(v) => updateSection('chat_event_points', { ...sections.chat_event_points!, points_per_message_batch: v })}
            min={1}
            description="Event points earned per message batch"
          />
          <NumberInput
            label="🔢 Points per Invite"
            value={sections.chat_event_points?.points_per_invite ?? 5}
            onChange={(v) => updateSection('chat_event_points', { ...sections.chat_event_points!, points_per_invite: v })}
            min={0}
            description="Event points earned per server invite during event"
          />
        </div>
        <BotBadge bot="butler" />
      </ConfigSection>

      <ConfigSection title="XP Boost Roles" description="Roles that earn extra XP. A multiplier of 2.0 means double XP.">
        <div style={{ marginBottom: 16 }}>
          <ToggleSwitch
            label="⚡ Double XP Active"
            checked={sections.double_xp_enabled ?? false}
            onChange={(v) => updateSection('double_xp_enabled', v)}
          />
        </div>
        {sections.boosted_roles && (
          <ConfigTable
            columns={[
              { key: 'roleId', label: 'Role', type: 'role' },
              { key: 'multiplier', label: 'XP Multiplier', type: 'number' },
            ]}
            rows={Object.entries(sections.boosted_roles).map(([roleId, multiplier]) => ({ roleId, multiplier }))}
            onChange={(rows) => {
              const newRoles: Record<string, number> = {};
              for (const row of rows) {
                if (row.roleId) newRoles[row.roleId as string] = Number(row.multiplier);
              }
              updateSection('boosted_roles', newRoles);
            }}
            addLabel="Add Boost Role"
          />
        )}
        {!sections.boosted_roles && (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            No boost roles configured yet. They will appear here once set in the bot config.
          </p>
        )}
        <BotBadge bot="butler" />
      </ConfigSection>

      <ConfigSection title="Level Rewards" description="Discord roles automatically granted when a user reaches a level">
        {sections.level_rewards && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(sections.level_rewards).map(([level, roleIds]) => (
              <div key={level} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px', background: 'var(--bg-deep)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ minWidth: 80 }}>
                  <label className="admin-number-input-label">🔢 Level</label>
                  <input
                    type="number"
                    className="admin-form-input"
                    value={level}
                    onChange={(e) => {
                      const newLevel = e.target.value;
                      const newRewards = { ...sections.level_rewards };
                      delete newRewards[level];
                      if (newLevel) newRewards[newLevel] = roleIds;
                      updateSection('level_rewards', newRewards);
                    }}
                    style={{ padding: '6px 10px', fontSize: '13px', width: '70px' }}
                    min={1}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <RolePicker
                    label="🛡️ Reward Roles"
                    description="Roles granted when reaching this level"
                    value={roleIds}
                    onChange={(v) => {
                      const newRewards = { ...sections.level_rewards };
                      newRewards[level] = v as string[];
                      updateSection('level_rewards', newRewards);
                    }}
                    multi
                  />
                </div>
                <button
                  className="admin-btn admin-btn-danger admin-btn-sm"
                  style={{ marginTop: '24px' }}
                  onClick={() => {
                    const newRewards = { ...sections.level_rewards };
                    delete newRewards[level];
                    updateSection('level_rewards', newRewards);
                  }}
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              className="admin-btn admin-btn-ghost admin-btn-sm"
              onClick={() => {
                let nextLevel = Math.max(0, ...Object.keys(sections.level_rewards ?? {}).map(Number)) + 10;
                while (String(nextLevel) in (sections.level_rewards ?? {})) nextLevel += 10;
                updateSection('level_rewards', { ...sections.level_rewards, [String(nextLevel)]: [] });
              }}
            >
              + Add Level Reward
            </button>
          </div>
        )}
        {!sections.level_rewards && (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            No level rewards configured yet. They will appear here once set in the bot config.
          </p>
        )}
        <BotBadge bot="butler" />
      </ConfigSection>

      <ConfigSection title="Level-Up Notification" description="Message sent when a user levels up and the channel it's posted in">
        <div className="admin-form-group">
          <label className="admin-form-label">Announcement Mode</label>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px' }}>
            Choose where level-up announcements are sent
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`admin-btn admin-btn-sm ${(sections.level_up_mode ?? 'same_channel') === 'same_channel' ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
              onClick={() => updateSection('level_up_mode', 'same_channel')}
            >
              Same Channel
            </button>
            <button
              className={`admin-btn admin-btn-sm ${sections.level_up_mode === 'dedicated_channel' ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
              onClick={() => updateSection('level_up_mode', 'dedicated_channel')}
            >
              Dedicated Channel
            </button>
          </div>
          {(sections.level_up_mode ?? 'same_channel') === 'same_channel' && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
              Level-up messages are posted in the same channel where the user was chatting.
            </p>
          )}
        </div>
        {sections.level_up_mode === 'dedicated_channel' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            <ChannelPicker
              label="📺 Level-Up Channel"
              description="Channel where level-up announcements are posted"
              value={sections.level_up_channel ?? ''}
              onChange={(v) => updateSection('level_up_channel', v as string)}
            />
          </div>
        )}
        <div className="admin-number-input-wrap" style={{ marginTop: '12px' }}>
          <label className="admin-number-input-label">📝 Level-Up Message</label>
          <textarea
            className="admin-number-input"
            value={sections.level_up_message ?? ''}
            onChange={(e) => updateSection('level_up_message', e.target.value)}
            placeholder="ارتقاء جديد يكتب تحت ضوء القمر. لقد وصل {user} الى المستوى {level}!"
            rows={3}
            dir="auto"
            style={{ width: '100%', resize: 'vertical', fontSize: '13px' }}
          />
          <span className="admin-number-input-desc">
            Use {'{'}<strong>user</strong>{'}'} for the user mention and {'{'}<strong>level</strong>{'}'} for the new level number
          </span>
        </div>
        {sections.level_up_message && (
          <div style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Preview:</span>
            <div style={{ marginTop: '4px', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontSize: '13px', direction: 'rtl' }}>
              {sections.level_up_message
                .replace('{user}', '@ExampleUser')
                .replace('{level}', '10')
                .replace('{party}', '\uD83C\uDF89')}
            </div>
          </div>
        )}
        <BotBadge bot="butler" />
      </ConfigSection>

      <ConfigSection title="Jester Level Rewards" description="Lunari and tickets awarded when a user reaches milestone levels (every 10 levels). Managed by Jester bot.">
        {Object.keys(jesterRewards).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(jesterRewards)
              .sort(([, a], [, b]) => a.level - b.level)
              .map(([roleId, reward]) => (
                <div key={roleId} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 140px 140px auto', gap: 10, alignItems: 'end', padding: '12px', background: 'var(--bg-deep)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <label className="admin-number-input-label">🔢 Level</label>
                    <input
                      type="number"
                      className="admin-form-input"
                      value={reward.level}
                      onChange={(e) => {
                        const updated = { ...jesterRewards };
                        updated[roleId] = { ...reward, level: Number(e.target.value) };
                        setJesterRewards(updated);
                      }}
                      min={1}
                      style={{ padding: '6px 10px', fontSize: '13px', width: '70px' }}
                    />
                  </div>
                  <RolePicker
                    label="🛡️ Role Granted"
                    description="Discord role that triggers this reward when assigned"
                    value={roleId}
                    onChange={(newRoleId) => {
                      const updated = { ...jesterRewards };
                      delete updated[roleId];
                      updated[newRoleId as string] = reward;
                      setJesterRewards(updated);
                    }}
                  />
                  <NumberInput
                    label="💰 Lunari"
                    value={reward.lunari}
                    onChange={(v) => {
                      const updated = { ...jesterRewards };
                      updated[roleId] = { ...reward, lunari: v };
                      setJesterRewards(updated);
                    }}
                    min={0}
                    description="Lunari awarded"
                  />
                  <NumberInput
                    label="🎟️ Tickets"
                    value={reward.tickets}
                    onChange={(v) => {
                      const updated = { ...jesterRewards };
                      updated[roleId] = { ...reward, tickets: v };
                      setJesterRewards(updated);
                    }}
                    min={0}
                    description="Game tickets awarded"
                  />
                  <button
                    className="admin-btn admin-btn-danger admin-btn-sm"
                    style={{ marginTop: '24px' }}
                    onClick={() => {
                      const updated = { ...jesterRewards };
                      delete updated[roleId];
                      setJesterRewards(updated);
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            <button
              className="admin-btn admin-btn-ghost admin-btn-sm"
              onClick={() => {
                const maxLevel = Math.max(0, ...Object.values(jesterRewards).map(r => r.level));
                const newRoleId = `new_${Date.now()}`;
                setJesterRewards({
                  ...jesterRewards,
                  [newRoleId]: { roleId: newRoleId, level: maxLevel + 10, lunari: 0, tickets: 0 },
                });
              }}
            >
              + Add Level Reward
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>
              No Jester level rewards configured. Add rewards to grant Lunari and tickets at milestone levels.
            </p>
            <button
              className="admin-btn admin-btn-ghost admin-btn-sm"
              onClick={() => {
                const newRoleId = `new_${Date.now()}`;
                setJesterRewards({ [newRoleId]: { roleId: newRoleId, level: 10, lunari: 25000, tickets: 0 } });
              }}
            >
              + Add Level Reward
            </button>
          </div>
        )}
        <BotBadge bot="jester" />
      </ConfigSection>

      <SaveDeployBar
        hasChanges={hasChanges}
        saving={saving}
        onSave={saveConfig}
        onDiscard={handleDiscard}
        projectName={butlerHasChanges && jesterHasChanges ? 'Butler + Jester' : jesterHasChanges ? 'Jester' : 'Butler'}
        validationErrors={hasValidationErrors}
        diff={configDiff}
      />
    </>
  );
}
