'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import ChannelPicker from '../_components/ChannelPicker';
import RolePicker from '../_components/RolePicker';

interface TextXp { min: number; max: number; cooldown: number }
interface VoiceXp { enabled: boolean; xp_per_minute: number; require_mic: boolean; check_interval: number }
interface BoostedRoles { [roleId: string]: number }

interface LevelingConfig {
  enabled: boolean;
  text_xp: TextXp;
  voice_xp: VoiceXp;
  boosted_roles: BoostedRoles;
  level_up_message: string;
  level_up_channel_id: string;
  double_xp_enabled: boolean;
  level_up_mode: 'same_channel' | 'dedicated_channel';
}

const DEFAULTS: LevelingConfig = {
  enabled: true,
  text_xp: { min: 10, max: 25, cooldown: 60 },
  voice_xp: { enabled: true, xp_per_minute: 0.1, require_mic: false, check_interval: 300 },
  boosted_roles: {},
  level_up_message: '🎉 مبروك {user}! وصلت للمستوى {level}',
  level_up_channel_id: '',
  double_xp_enabled: false,
  level_up_mode: 'same_channel',
};

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function saveSection(section: string, value: any): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/config/butler', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ section, value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

export default function LevelingConfigPanel() {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<LevelingConfig>(DEFAULTS);
  const [saved, setSaved] = useState<LevelingConfig>(DEFAULTS);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config/butler', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const s = body.sections ?? {};
      const loaded: LevelingConfig = {
        enabled: s.level_enabled ?? DEFAULTS.enabled,
        text_xp: s.text_xp ?? DEFAULTS.text_xp,
        voice_xp: s.voice_xp ?? DEFAULTS.voice_xp,
        boosted_roles: s.boosted_roles ?? DEFAULTS.boosted_roles,
        level_up_message: s.level_up_message ?? DEFAULTS.level_up_message,
        level_up_channel_id: s.level_up_channel ?? DEFAULTS.level_up_channel_id,
        double_xp_enabled: s.double_xp_enabled ?? DEFAULTS.double_xp_enabled,
        level_up_mode: s.level_up_mode ?? DEFAULTS.level_up_mode,
      };
      setSaved(loaded);
      setDraft(loaded);
      setDirtyKeys(new Set());
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (open && !loading && saved === DEFAULTS) void load(); }, [open, load, loading, saved]);

  const markDirty = (key: string) => setDirtyKeys((d) => { const n = new Set(d); n.add(key); return n; });

  const saveField = (section: string, value: any, label: string) => {
    const before = (saved as any)[mapSectionToField(section)];
    pending.queue({
      label: `Save ${label}`,
      detail: 'Butler picks up within ~30s',
      delayMs: 4500,
      run: async () => {
        try {
          await saveSection(section, value);
          setSaved((s) => ({ ...s, [mapSectionToField(section)]: value }));
          setDirtyKeys((d) => { const n = new Set(d); n.delete(section); return n; });
          toast.show({ tone: 'success', title: 'Saved', message: label });
          undo.push({
            label: `Restore ${label}`,
            detail: 'Prior value',
            revert: async () => {
              await saveSection(section, before);
              setSaved((s) => ({ ...s, [mapSectionToField(section)]: before }));
              setDraft((d) => ({ ...d, [mapSectionToField(section)]: before }));
              toast.show({ tone: 'success', title: 'Reverted', message: label });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const updateTextXp = (patch: Partial<TextXp>) => {
    const next = { ...draft.text_xp, ...patch };
    setDraft((d) => ({ ...d, text_xp: next }));
    markDirty('text_xp');
  };
  const updateVoiceXp = (patch: Partial<VoiceXp>) => {
    const next = { ...draft.voice_xp, ...patch };
    setDraft((d) => ({ ...d, voice_xp: next }));
    markDirty('voice_xp');
  };
  const updateBoosted = (next: BoostedRoles) => {
    setDraft((d) => ({ ...d, boosted_roles: next }));
    markDirty('boosted_roles');
  };

  return (
    <section className="av-surface">
      <header className="av-flows-head">
        <div>
          <h3>Leveling configuration</h3>
          <p>Tune XP rates, voice settings, boosted role multipliers, and level-up announcements. Changes propagate to Butler within ~30 seconds.</p>
        </div>
        <div className="av-flows-actions">
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide' : 'Open editor'}
          </button>
        </div>
      </header>

      {open && (
        <div className="av-leveling-config">
          {loading && <div className="av-commands-empty">Loading current config…</div>}

          {!loading && (
            <>
              {/* System enabled + mode toggles */}
              <div className="av-leveling-section">
                <label className="av-games-field-label">Level system</label>
                <div className="av-leveling-toggles">
                  <label className="av-leveling-toggle">
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      onChange={(e) => {
                        setDraft((d) => ({ ...d, enabled: e.target.checked }));
                        saveField('level_enabled', e.target.checked, 'Level system enabled');
                      }}
                    />
                    <span>System enabled</span>
                  </label>
                  <label className="av-leveling-toggle">
                    <input
                      type="checkbox"
                      checked={draft.double_xp_enabled}
                      onChange={(e) => {
                        setDraft((d) => ({ ...d, double_xp_enabled: e.target.checked }));
                        saveField('double_xp_enabled', e.target.checked, 'Double XP');
                      }}
                    />
                    <span>Double XP event</span>
                  </label>
                  <div className="av-leveling-toggle">
                    <label>Announce in:</label>
                    <select
                      className="av-shopf-input"
                      value={draft.level_up_mode}
                      onChange={(e) => {
                        const v = e.target.value as 'same_channel' | 'dedicated_channel';
                        setDraft((d) => ({ ...d, level_up_mode: v }));
                        saveField('level_up_mode', v, 'Level-up mode');
                      }}
                    >
                      <option value="same_channel">Same channel as message</option>
                      <option value="dedicated_channel">Dedicated channel</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Text XP */}
              <div className="av-leveling-section">
                <div className="av-leveling-section-head">
                  <label className="av-games-field-label">Text XP per message</label>
                  {dirtyKeys.has('text_xp') && (
                    <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={() => saveField('text_xp', draft.text_xp, 'Text XP')}>Save</button>
                  )}
                </div>
                <div className="av-leveling-grid">
                  <div>
                    <span className="av-games-field-sublabel">Min XP</span>
                    <input type="number" min={0} className="av-shopf-input" value={draft.text_xp.min} onChange={(e) => updateTextXp({ min: Number(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <span className="av-games-field-sublabel">Max XP</span>
                    <input type="number" min={0} className="av-shopf-input" value={draft.text_xp.max} onChange={(e) => updateTextXp({ max: Number(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <span className="av-games-field-sublabel">Cooldown (seconds)</span>
                    <input type="number" min={0} className="av-shopf-input" value={draft.text_xp.cooldown} onChange={(e) => updateTextXp({ cooldown: Number(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>

              {/* Voice XP */}
              <div className="av-leveling-section">
                <div className="av-leveling-section-head">
                  <label className="av-games-field-label">Voice XP</label>
                  {dirtyKeys.has('voice_xp') && (
                    <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={() => saveField('voice_xp', draft.voice_xp, 'Voice XP')}>Save</button>
                  )}
                </div>
                <div className="av-leveling-grid">
                  <label className="av-leveling-toggle">
                    <input type="checkbox" checked={draft.voice_xp.enabled} onChange={(e) => updateVoiceXp({ enabled: e.target.checked })} />
                    <span>Voice XP enabled</span>
                  </label>
                  <label className="av-leveling-toggle">
                    <input type="checkbox" checked={draft.voice_xp.require_mic} onChange={(e) => updateVoiceXp({ require_mic: e.target.checked })} />
                    <span>Require unmuted mic</span>
                  </label>
                  <div>
                    <span className="av-games-field-sublabel">XP per minute</span>
                    <input type="number" min={0} step={0.01} className="av-shopf-input" value={draft.voice_xp.xp_per_minute} onChange={(e) => updateVoiceXp({ xp_per_minute: Number(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <span className="av-games-field-sublabel">Check interval (seconds)</span>
                    <input type="number" min={30} className="av-shopf-input" value={draft.voice_xp.check_interval} onChange={(e) => updateVoiceXp({ check_interval: Number(e.target.value) || 300 })} />
                  </div>
                </div>
              </div>

              {/* Boosted roles */}
              <BoostedRolesEditor
                value={draft.boosted_roles}
                onChange={updateBoosted}
                dirty={dirtyKeys.has('boosted_roles')}
                onSave={() => saveField('boosted_roles', draft.boosted_roles, 'Boosted roles')}
              />

              {/* Level-up channel */}
              <div className="av-leveling-section">
                <div className="av-leveling-section-head">
                  <label className="av-games-field-label">Level-up announcement channel</label>
                </div>
                <p className="av-games-field-sublabel" style={{ marginBottom: 8 }}>
                  Leave empty to post in the same channel where the user levels up.
                </p>
                <ChannelPicker
                  value={draft.level_up_channel_id}
                  filter="text"
                  placeholder="Pick a channel"
                  onChange={(id) => {
                    setDraft((d) => ({ ...d, level_up_channel_id: id }));
                    if (id !== saved.level_up_channel_id) {
                      saveField('level_up_channel', id, 'Level-up channel');
                    }
                  }}
                />
              </div>

              {/* Level-up message template */}
              <div className="av-leveling-section">
                <div className="av-leveling-section-head">
                  <label className="av-games-field-label">Level-up message template</label>
                </div>
                <p className="av-games-field-sublabel" style={{ marginBottom: 8 }}>
                  Placeholders: <code>{'{user}'}</code> = mention, <code>{'{level}'}</code> = new level, <code>{'{xp}'}</code> = xp amount
                </p>
                <textarea
                  className="av-shopf-input"
                  rows={3}
                  value={draft.level_up_message}
                  onChange={(e) => setDraft((d) => ({ ...d, level_up_message: e.target.value }))}
                  onBlur={() => {
                    if (draft.level_up_message !== saved.level_up_message) {
                      saveField('level_up_message', draft.level_up_message, 'Level-up message');
                    }
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function mapSectionToField(section: string): keyof LevelingConfig {
  switch (section) {
    case 'level_enabled': return 'enabled';
    case 'text_xp': return 'text_xp';
    case 'voice_xp': return 'voice_xp';
    case 'boosted_roles': return 'boosted_roles';
    case 'level_up_message': return 'level_up_message';
    case 'level_up_channel': return 'level_up_channel_id';
    case 'double_xp_enabled': return 'double_xp_enabled';
    case 'level_up_mode': return 'level_up_mode';
    default: return 'enabled';
  }
}

function BoostedRolesEditor({ value, onChange, dirty, onSave }: {
  value: BoostedRoles;
  onChange: (v: BoostedRoles) => void;
  dirty: boolean;
  onSave: () => void;
}) {
  const [newRoleId, setNewRoleId] = useState('');
  const [newMult, setNewMult] = useState(1.5);

  const rows = Object.entries(value);

  const addRole = () => {
    const id = newRoleId.replace(/[^\d]/g, '');
    if (!id) return;
    onChange({ ...value, [id]: newMult });
    setNewRoleId('');
    setNewMult(1.5);
  };

  const removeRole = (id: string) => {
    const next = { ...value };
    delete next[id];
    onChange(next);
  };

  const updateMult = (id: string, mult: number) => {
    onChange({ ...value, [id]: mult });
  };

  return (
    <div className="av-leveling-section">
      <div className="av-leveling-section-head">
        <label className="av-games-field-label">Boosted role multipliers</label>
        {dirty && <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={onSave}>Save</button>}
      </div>
      <p className="av-games-field-sublabel" style={{ marginBottom: 8 }}>
        Roles in this list earn XP at the given multiplier (e.g. 1.5 = 50% extra XP).
      </p>

      {rows.length === 0 && <div className="av-commands-empty">No boosted roles configured.</div>}

      <div className="av-boosted-roles-list">
        {rows.map(([roleId, mult]) => (
          <div key={roleId} className="av-boosted-role-row">
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <RolePicker value={roleId} onChange={() => { /* editing an existing roleId is read-only; remove + re-add instead */ }} hideFallback />
            </div>
            <div className="av-boosted-mult">
              <input type="number" min={1} step={0.1} className="av-shopf-input" value={mult} onChange={(e) => updateMult(roleId, Number(e.target.value) || 1)} />
              <span>×</span>
            </div>
            <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => removeRole(roleId)}>Remove</button>
          </div>
        ))}
      </div>

      <div className="av-boosted-role-add">
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <RolePicker
            value={newRoleId}
            onChange={(id) => setNewRoleId(id)}
            placeholder="Pick a role to boost"
            hideFallback
          />
        </div>
        <div className="av-boosted-mult">
          <input type="number" min={1} step={0.1} className="av-shopf-input" value={newMult} onChange={(e) => setNewMult(Number(e.target.value) || 1.5)} />
          <span>×</span>
        </div>
        <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={addRole} disabled={!newRoleId}>Add</button>
      </div>
    </div>
  );
}
