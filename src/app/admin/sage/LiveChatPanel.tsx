'use client';

import ToggleCard from '../games/fields/ToggleCard';
import NumberUnitInput from '../games/fields/NumberUnitInput';
import SliderNumberInput from '../games/fields/SliderNumberInput';
import ChannelChips from '../_components/ChannelChips';
import ChannelPicker from '../_components/ChannelPicker';
import ChipEditor from '../commands/ChipEditor';
import type { LiveChatSection, SageLiveChat, SageChannelReference } from './types';

interface Props {
  data: SageLiveChat;
  onChange: (section: LiveChatSection, value: any) => void;
}

export default function LiveChatPanel({ data, onChange }: Props) {
  const templates = data.helpOfferTemplates ?? { mastermind: [], privileged: [], lunarian: [], default: [] };
  const greetings = data.greetingTemplates ?? { arabic: [], english: [] };
  const emojis = data.reactionEmojis ?? { luna: '🌙', question: '🤔', greeting: '👋', excitement: '🔥' };
  const channelRefs: SageChannelReference[] = Array.isArray(data.channelReferences) ? data.channelReferences : [];

  const patchTemplate = (tier: keyof typeof templates, list: string[]) =>
    onChange('helpOfferTemplates', { ...templates, [tier]: list });
  const patchGreeting = (lang: 'arabic' | 'english', list: string[]) =>
    onChange('greetingTemplates', { ...greetings, [lang]: list });
  const patchEmoji = (slot: string, value: string) =>
    onChange('reactionEmojis', { ...emojis, [slot]: value });

  const addChannelRef = () => onChange('channelReferences', [...channelRefs, { channelId: '', name: '', description: '' }]);
  const patchChannelRef = (i: number, next: Partial<SageChannelReference>) =>
    onChange('channelReferences', channelRefs.map((r, idx) => idx === i ? { ...r, ...next } : r));
  const removeChannelRef = (i: number) =>
    onChange('channelReferences', channelRefs.filter((_, idx) => idx !== i));

  return (
    <section className="av-sage-panel">
      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Master toggles</h4></header>
        <div className="av-sage-toggles">
          <div className="av-sage-toggle-row">
            <div><strong>Auto-join</strong><span>Sage can speak up in listed channels without being invoked.</span></div>
            <ToggleCard value={Boolean(data.autoJoinEnabled)} onChange={(v) => onChange('autoJoinEnabled', v)} onLabel="On" offLabel="Off" />
          </div>
          <div className="av-sage-toggle-row">
            <div><strong>Reactions</strong><span>Sage reacts to Luna-themed messages with emoji.</span></div>
            <ToggleCard value={Boolean(data.reactionsEnabled)} onChange={(v) => onChange('reactionsEnabled', v)} onLabel="On" offLabel="Off" />
          </div>
          <div className="av-sage-toggle-row">
            <div><strong>Periodic check-in</strong><span>Drops a friendly ping every N messages.</span></div>
            <ToggleCard value={Boolean(data.periodicCheckIn)} onChange={(v) => onChange('periodicCheckIn', v)} onLabel="On" offLabel="Off" />
          </div>
          <div className="av-sage-toggle-row">
            <div><strong>Mastermind only</strong><span>If on, every non-Mastermind interaction is dropped.</span></div>
            <ToggleCard value={Boolean(data.mastermindOnly)} onChange={(v) => onChange('mastermindOnly', v)} onLabel="Locked" offLabel="Open" />
          </div>
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Active channels</h4></header>
        <p className="av-games-field-help">Channels Sage participates in live. Paste channel IDs.</p>
        <ChannelChips value={data.liveChatChannels ?? []} onChange={(next) => onChange('liveChatChannels', next)} filter="text" />
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Probability & cooldowns</h4></header>
        <div className="av-commands-row-grid">
          <div>
            <label className="av-games-field-label">Reaction probability</label>
            <SliderNumberInput
              value={Math.round(((data.reactionProbability ?? 0) * 100))}
              onChange={(v) => onChange('reactionProbability', Math.max(0, Math.min(100, v)) / 100)}
              unit="%"
              min={0} max={100} step={5}
            />
          </div>
          <div>
            <label className="av-games-field-label">Check-in interval</label>
            <NumberUnitInput type="number-int" value={data.checkInInterval ?? 20} onChange={(v) => onChange('checkInInterval', v)} unit="msgs" min={1} max={500} />
          </div>
          <div>
            <label className="av-games-field-label">AI cooldown</label>
            <NumberUnitInput type="number-seconds" value={data.aiCooldownSeconds ?? 8} onChange={(v) => onChange('aiCooldownSeconds', v)} min={0} max={600} />
          </div>
          <div>
            <label className="av-games-field-label">Reaction cooldown</label>
            <NumberUnitInput type="number-seconds" value={data.reactionCooldownSeconds ?? 30} onChange={(v) => onChange('reactionCooldownSeconds', v)} min={0} max={600} />
          </div>
          <div>
            <label className="av-games-field-label">Greeting cooldown</label>
            <NumberUnitInput type="number-seconds" value={data.greetingCooldownSeconds ?? 60} onChange={(v) => onChange('greetingCooldownSeconds', v)} min={0} max={3600} />
          </div>
          <div>
            <label className="av-games-field-label">Help-offer cooldown</label>
            <NumberUnitInput type="number-seconds" value={data.helpOfferCooldownSeconds ?? 30} onChange={(v) => onChange('helpOfferCooldownSeconds', v)} min={0} max={3600} />
          </div>
          <div>
            <label className="av-games-field-label">Unanswered-question delay</label>
            <NumberUnitInput type="number-seconds" value={data.unansweredQuestionDelaySeconds ?? 60} onChange={(v) => onChange('unansweredQuestionDelaySeconds', v)} min={0} max={600} />
          </div>
          <div>
            <label className="av-games-field-label">Auto-join cooldown</label>
            <NumberUnitInput type="number-int" value={data.autoJoinCooldownMinutes ?? 1} onChange={(v) => onChange('autoJoinCooldownMinutes', v)} unit="min" min={0} max={240} />
          </div>
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Keywords</h4></header>
        <p className="av-games-field-help">Words that attract Sage's attention in live chat (any language).</p>
        <ChipEditor
          value={data.lunaKeywords ?? []}
          onChange={(next) => onChange('lunaKeywords', next)}
          placeholder="Add a keyword"
        />
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Help-offer templates</h4></header>
        <p className="av-games-field-help">One line per template. Sage picks one at random per tier.</p>
        <div className="av-commands-row-grid">
          {(['mastermind', 'privileged', 'lunarian', 'default'] as const).map((tier) => (
            <div key={tier} className="av-sage-tmpl-group">
              <label className="av-games-field-label" style={{ textTransform: 'capitalize' }}>{tier}</label>
              <textarea
                className="av-shopf-input av-sage-tmpl-area"
                rows={4}
                value={(templates[tier] ?? []).join('\n')}
                onChange={(e) => patchTemplate(tier, e.target.value.split('\n').filter((x) => x.trim() !== '' || x === ''))}
                placeholder="One template per line"
              />
            </div>
          ))}
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Greetings</h4></header>
        <div className="av-commands-row-grid">
          <div className="av-sage-tmpl-group">
            <label className="av-games-field-label">Arabic</label>
            <textarea className="av-shopf-input av-sage-tmpl-area" rows={4} dir="rtl"
              value={(greetings.arabic ?? []).join('\n')}
              onChange={(e) => patchGreeting('arabic', e.target.value.split('\n'))}
              placeholder="مرحبا"
            />
          </div>
          <div className="av-sage-tmpl-group">
            <label className="av-games-field-label">English</label>
            <textarea className="av-shopf-input av-sage-tmpl-area" rows={4}
              value={(greetings.english ?? []).join('\n')}
              onChange={(e) => patchGreeting('english', e.target.value.split('\n'))}
              placeholder="Hey there"
            />
          </div>
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Reaction emojis</h4></header>
        <div className="av-commands-row-grid">
          {Object.entries(emojis).map(([slot, glyph]) => (
            <label key={slot} className="av-shopf-field">
              <span style={{ textTransform: 'capitalize' }}>{slot}</span>
              <input
                className="av-shopf-input av-sage-emoji-input"
                value={glyph}
                onChange={(e) => patchEmoji(slot, e.target.value)}
                maxLength={16}
              />
            </label>
          ))}
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head">
          <h4 className="av-sage-card-title">Channel references</h4>
          <button type="button" className="av-commands-add" onClick={addChannelRef}>+ Add reference</button>
        </header>
        <p className="av-games-field-help">Sage cites these channels when answers relate to them.</p>
        {channelRefs.length === 0 && <div className="av-commands-empty">None yet.</div>}
        <div className="av-sage-channel-ref-list">
          {channelRefs.map((r, i) => (
            <div key={i} className="av-sage-channel-ref-row">
              <ChannelPicker value={r.channelId ?? ''} onChange={(v) => patchChannelRef(i, { channelId: v })} filter="text" placeholder="Select channel" />
              <input className="av-shopf-input" value={r.name ?? ''} placeholder="Display name (e.g. Luna-Cards)"
                onChange={(e) => patchChannelRef(i, { name: e.target.value })} />
              <input className="av-shopf-input" value={r.description ?? ''} placeholder="Short description"
                onChange={(e) => patchChannelRef(i, { description: e.target.value })} />
              <button type="button" className="av-commands-delete" onClick={() => removeChannelRef(i)} title="Remove">🗑</button>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
