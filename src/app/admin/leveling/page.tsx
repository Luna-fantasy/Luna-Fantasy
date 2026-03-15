'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfigSection from '../components/ConfigSection';
import NumberInput from '../components/NumberInput';
import ToggleSwitch from '../components/ToggleSwitch';
import DurationInput from '../components/DurationInput';
import ConfigTable from '../components/ConfigTable';
import BotBadge from '../components/BotBadge';
import SaveDeployBar from '../components/SaveDeployBar';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';

interface LevelingSections {
  text_xp?: { min: number; max: number; cooldown: number };
  voice_xp?: { enabled: boolean; xp_per_minute: number; require_mic: boolean; check_interval: number };
  boosted_roles?: Record<string, number>;
  level_rewards?: Record<string, string[]>;
}

export default function LevelingPage() {
  const [sections, setSections] = useState<LevelingSections>({});
  const [original, setOriginal] = useState<LevelingSections>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config/butler');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const allSections = data.sections || {};
      const configKeys = ['text_xp', 'voice_xp', 'boosted_roles', 'level_rewards'];
      const filtered: LevelingSections = {};
      for (const k of configKeys) {
        if (allSections[k]) (filtered as any)[k] = allSections[k];
      }
      setSections(filtered);
      setOriginal(filtered);
    } catch {
      toast('Failed to load leveling config. Try refreshing.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const hasChanges = JSON.stringify(sections) !== JSON.stringify(original);

  function updateSection<K extends keyof LevelingSections>(key: K, value: LevelingSections[K]) {
    setSections((prev) => ({ ...prev, [key]: value }));
  }

  async function saveConfig() {
    setSaving(true);

    const changedSections: Array<keyof LevelingSections> = [];
    for (const key of Object.keys(sections) as Array<keyof LevelingSections>) {
      if (JSON.stringify(sections[key]) !== JSON.stringify(original[key])) {
        changedSections.push(key);
      }
    }

    try {
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
          <h1 className="admin-page-title">Leveling</h1>
          <p className="admin-page-subtitle">Configure XP earning rates, boost roles, and level-up rewards</p>
        </div>
        <div className="admin-loading"><div className="admin-spinner" />Loading leveling config...</div>
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Leveling</h1>
        <p className="admin-page-subtitle">Configure XP earning rates, boost roles, and level-up rewards</p>
      </div>

      <ConfigSection title="Text XP" description="XP earned from sending messages in text channels">
        {sections.text_xp && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
            <NumberInput label="Minimum XP" value={sections.text_xp.min} onChange={(v) => updateSection('text_xp', { ...sections.text_xp!, min: v })} min={0} description="Least XP a message can earn" />
            <NumberInput label="Maximum XP" value={sections.text_xp.max} onChange={(v) => updateSection('text_xp', { ...sections.text_xp!, max: v })} min={0} description="Most XP a message can earn" />
            <DurationInput label="Cooldown" value={sections.text_xp.cooldown} onChange={(v) => updateSection('text_xp', { ...sections.text_xp!, cooldown: v })} description="Wait time before another message earns XP" />
          </div>
        )}
        <BotBadge bot="butler" />
      </ConfigSection>

      <ConfigSection title="Voice XP" description="XP earned from being in voice channels">
        {sections.voice_xp && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
            <ToggleSwitch label="Enabled" checked={sections.voice_xp.enabled} onChange={(v) => updateSection('voice_xp', { ...sections.voice_xp!, enabled: v })} />
            <NumberInput label="XP per Minute" value={sections.voice_xp.xp_per_minute} onChange={(v) => updateSection('voice_xp', { ...sections.voice_xp!, xp_per_minute: v })} step={0.1} min={0} description="XP earned each minute in voice" />
            <ToggleSwitch label="Require Microphone" checked={sections.voice_xp.require_mic} onChange={(v) => updateSection('voice_xp', { ...sections.voice_xp!, require_mic: v })} />
            <DurationInput label="Check Interval" value={sections.voice_xp.check_interval} onChange={(v) => updateSection('voice_xp', { ...sections.voice_xp!, check_interval: v })} description="How often the bot checks who is in voice" />
          </div>
        )}
        <BotBadge bot="butler" />
      </ConfigSection>

      <ConfigSection title="XP Boost Roles" description="Roles that earn extra XP. A multiplier of 2.0 means double XP.">
        {sections.boosted_roles && (
          <ConfigTable
            columns={[
              { key: 'roleId', label: 'Discord Role ID', type: 'text' },
              { key: 'multiplier', label: 'XP Multiplier', type: 'number' },
            ]}
            rows={Object.entries(sections.boosted_roles).map(([roleId, multiplier]) => ({ roleId, multiplier }))}
            onChange={(rows) => {
              const newRoles: Record<string, number> = {};
              for (const row of rows) newRoles[row.roleId as string] = Number(row.multiplier);
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
          <ConfigTable
            columns={[
              { key: 'level', label: 'Level', type: 'number', width: '80px' },
              { key: 'roleIds', label: 'Role IDs (comma-separated)', type: 'text' },
            ]}
            rows={Object.entries(sections.level_rewards).map(([level, roleIds]) => ({
              level: Number(level),
              roleIds: roleIds.join(', '),
            }))}
            onChange={(rows) => {
              const newRewards: Record<string, string[]> = {};
              for (const row of rows) {
                const level = String(row.level);
                const ids = String(row.roleIds).split(',').map(s => s.trim()).filter(Boolean);
                if (level && ids.length > 0) newRewards[level] = ids;
              }
              updateSection('level_rewards', newRewards);
            }}
            addLabel="Add Level Reward"
          />
        )}
        {!sections.level_rewards && (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            No level rewards configured yet. They will appear here once set in the bot config.
          </p>
        )}
        <BotBadge bot="butler" />
      </ConfigSection>

      <SaveDeployBar
        hasChanges={hasChanges}
        saving={saving}
        onSave={saveConfig}
        projectName="Butler"
      />
    </>
  );
}
