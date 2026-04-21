'use client';

import ToggleCard from '../games/fields/ToggleCard';
import RoleChips from '../_components/RoleChips';
import ChannelPicker from '../_components/ChannelPicker';
import NumberUnitInput from '../games/fields/NumberUnitInput';
import SliderNumberInput from '../games/fields/SliderNumberInput';
import type { HubChannel, VoiceSetup } from './types';

interface Props {
  data: VoiceSetup;
  onChange: (patch: Partial<VoiceSetup>) => void;
}

export default function SetupPanel({ data, onChange }: Props) {
  const patchHub = (i: number, next: Partial<HubChannel>) => {
    onChange({ hubChannels: data.hubChannels.map((h, idx) => idx === i ? { ...h, ...next } : h) });
  };
  const addHub = () => {
    onChange({
      hubChannels: [
        ...data.hubChannels,
        { channelId: '', categoryId: '', nameTemplate: 'غرفة {user}', defaultUserLimit: 0, defaultBitrate: 64000 },
      ],
    });
  };
  const removeHub = (i: number) => onChange({ hubChannels: data.hubChannels.filter((_, idx) => idx !== i) });

  return (
    <section className="av-voice-panel">
      <article className="av-commands-card">
        <header className="av-commands-card-head">
          <h4 className="av-sage-card-title">Hub channels</h4>
          <button type="button" className="av-commands-add" onClick={addHub}>+ New hub</button>
        </header>
        <p className="av-games-field-help">Each hub is a voice channel users click to spawn their own temporary room.</p>
        {data.hubChannels.length === 0 && <div className="av-commands-empty">No hub channels yet — add one to open the gates of Lunvor's voice halls.</div>}
        <div className="av-voice-hub-list">
          {data.hubChannels.map((h, i) => (
            <div key={i} className="av-voice-hub-row">
              <div className="av-shopf-field">
                <span>Hub channel</span>
                <ChannelPicker value={h.channelId} onChange={(v) => patchHub(i, { channelId: v })} filter="voice" placeholder="Select hub channel" />
              </div>
              <div className="av-shopf-field">
                <span>Category</span>
                <ChannelPicker value={h.categoryId} onChange={(v) => patchHub(i, { categoryId: v })} filter="category" placeholder="Select category" />
              </div>
              <label className="av-shopf-field">
                <span>Name template</span>
                <input className="av-shopf-input" value={h.nameTemplate} onChange={(e) => patchHub(i, { nameTemplate: e.target.value })} placeholder="غرفة {user}" />
              </label>
              <label className="av-shopf-field">
                <span>User limit</span>
                <input className="av-shopf-input av-shopf-input--num" type="number" min={0} max={99} value={h.defaultUserLimit}
                  onChange={(e) => patchHub(i, { defaultUserLimit: Number(e.target.value) || 0 })} />
              </label>
              <label className="av-shopf-field">
                <span>Bitrate (kbps)</span>
                <input className="av-shopf-input av-shopf-input--num" type="number" min={8} max={384} step={8}
                  value={Math.round(h.defaultBitrate / 1000)}
                  onChange={(e) => patchHub(i, { defaultBitrate: Math.max(8000, Math.min(384000, (Number(e.target.value) || 64) * 1000)) })} />
              </label>
              <button type="button" className="av-commands-delete" onClick={() => removeHub(i)} title="Remove hub">🗑</button>
            </div>
          ))}
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Placement & roles</h4></header>
        <div className="av-commands-row-grid">
          <div>
            <label className="av-games-field-label">VIP category</label>
            <p className="av-games-field-help">Where VIP rooms are created (inherits perms).</p>
            <ChannelPicker value={data.vipCategoryId} onChange={(v) => onChange({ vipCategoryId: v })} filter="category" placeholder="Select VIP category" />
          </div>
          <div>
            <label className="av-games-field-label">Log channel</label>
            <p className="av-games-field-help">Room create/delete/rename/lock events post here.</p>
            <ChannelPicker value={data.logChannelId} onChange={(v) => onChange({ logChannelId: v })} filter="text" placeholder="Select log channel" />
          </div>
          <div>
            <label className="av-games-field-label">Staff roles</label>
            <p className="av-games-field-help">These roles can manage any room (not just their own).</p>
            <RoleChips value={data.staffRoleIds ?? []} onChange={(next) => onChange({ staffRoleIds: next })} />
          </div>
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Limits & intervals</h4></header>
        <div className="av-commands-row-grid">
          <div>
            <label className="av-games-field-label">Max temp rooms / user</label>
            <SliderNumberInput value={data.maxTempRoomsPerUser} onChange={(v) => onChange({ maxTempRoomsPerUser: v })} min={1} max={10} step={1} unit="rooms" />
          </div>
          <div>
            <label className="av-games-field-label">Max VIP rooms / user</label>
            <SliderNumberInput value={data.maxVipRoomsPerUser} onChange={(v) => onChange({ maxVipRoomsPerUser: v })} min={1} max={10} step={1} unit="rooms" />
          </div>
          <div>
            <label className="av-games-field-label">Grace period (empty room auto-close)</label>
            <NumberUnitInput type="number-ms-as-seconds" value={data.gracePeriodMs} onChange={(v) => onChange({ gracePeriodMs: v })} min={1} max={600} />
          </div>
          <div>
            <label className="av-games-field-label">Welcome cooldown</label>
            <NumberUnitInput type="number-ms-as-seconds" value={data.welcomeCooldownMs} onChange={(v) => onChange({ welcomeCooldownMs: v })} min={0} max={3600} />
          </div>
          <div>
            <label className="av-games-field-label">Aura update interval</label>
            <NumberUnitInput type="number-ms-as-seconds" value={data.auraUpdateIntervalMs} onChange={(v) => onChange({ auraUpdateIntervalMs: v })} min={10} max={600} />
          </div>
          <div>
            <label className="av-games-field-label">Panel refresh interval</label>
            <NumberUnitInput type="number-ms-as-seconds" value={data.panelAutoRefreshMs} onChange={(v) => onChange({ panelAutoRefreshMs: v })} min={10} max={600} />
          </div>
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Challenges</h4></header>
        <div className="av-commands-row-grid">
          <div className="av-sage-toggle-row">
            <div><strong>Auto-drop challenges</strong><span>Bot throws games in active rooms on a timer.</span></div>
            <ToggleCard value={Boolean(data.challengesEnabled)} onChange={(v) => onChange({ challengesEnabled: v })} onLabel="On" offLabel="Off" />
          </div>
          <div>
            <label className="av-games-field-label">Drop interval</label>
            <NumberUnitInput type="number-ms-as-seconds" value={data.challengeIntervalMs} onChange={(v) => onChange({ challengeIntervalMs: v })} min={60} max={7200} />
          </div>
          <div>
            <label className="av-games-field-label">Min members</label>
            <SliderNumberInput value={data.challengeMinMembers} onChange={(v) => onChange({ challengeMinMembers: v })} min={1} max={25} step={1} unit="users" />
          </div>
        </div>
      </article>
    </section>
  );
}
