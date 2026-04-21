'use client';

import NumberUnitInput from '../games/fields/NumberUnitInput';
import type { VoiceContent } from './types';

interface Props {
  data: VoiceContent;
  onChange: (patch: Partial<VoiceContent>) => void;
}

const BUTTON_KEYS = ['lock', 'unlock', 'hide', 'limit', 'region', 'trust', 'ban', 'kick', 'claim', 'transfer', 'whisper', 'save', 'load', 'math', 'trivia', 'react', 'sowalef'];

export default function ContentPanel({ data, onChange }: Props) {
  // Every array/object field gets coerced locally so a malformed payload from
  // the server (or a partial patch via `onChange`) can never crash the panel
  // with "x.join is not a function" or similar.
  const greetings = Array.isArray(data.welcomeGreetings) ? data.welcomeGreetings : [];
  const panelLines = Array.isArray(data.panelText) ? data.panelText : [];
  const labels = data.buttonLabels && typeof data.buttonLabels === 'object' ? data.buttonLabels : {};
  const thresholds = data.auraThresholds ?? { flickering: 10, glowing: 30, radiant: 60, blazing: 90 };
  const weights = data.auraWeights ?? { warmthPerVisitor: 3, warmthMax: 25, energyDivisor: 10, energyMax: 25, harmonyPerMin: 5, harmonyMax: 25, loyaltyMax: 25 };
  const tierNames = data.auraTiers ?? { dormant: 'Dormant', flickering: 'Flickering', glowing: 'Glowing', radiant: 'Radiant', blazing: 'Blazing' };
  const whisper = data.whisper ?? {};
  const expiry = Array.isArray(data.expiryTitles) ? data.expiryTitles : [];

  return (
    <section className="av-voice-panel">
      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Welcome greetings</h4></header>
        <p className="av-games-field-help">One greeting per line; bot picks randomly.</p>
        <textarea
          className="av-shopf-input av-sage-tmpl-area"
          rows={6}
          value={greetings.join('\n')}
          onChange={(e) => onChange({ welcomeGreetings: e.target.value.split('\n') })}
          dir="auto"
        />
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Panel text</h4></header>
        <p className="av-games-field-help">Lines displayed on the room control panel.</p>
        <textarea
          className="av-shopf-input av-sage-tmpl-area"
          rows={4}
          value={panelLines.join('\n')}
          onChange={(e) => onChange({ panelText: e.target.value.split('\n') })}
          dir="auto"
        />
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Button labels</h4></header>
        <div className="av-commands-row-grid">
          {BUTTON_KEYS.map((key) => (
            <label key={key} className="av-shopf-field">
              <span style={{ textTransform: 'capitalize' }}>{key}</span>
              <input
                className="av-shopf-input"
                value={labels[key] ?? ''}
                onChange={(e) => onChange({ buttonLabels: { ...labels, [key]: e.target.value.slice(0, 80) } })}
                maxLength={80}
                dir="auto"
              />
            </label>
          ))}
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Aura tiers</h4></header>
        <div className="av-commands-row-grid">
          {(['dormant', 'flickering', 'glowing', 'radiant', 'blazing'] as const).map((tier) => (
            <label key={tier} className="av-shopf-field">
              <span style={{ textTransform: 'capitalize' }}>{tier}</span>
              <input
                className="av-shopf-input"
                value={tierNames[tier] ?? ''}
                onChange={(e) => onChange({ auraTiers: { ...tierNames, [tier]: e.target.value } })}
                dir="auto"
              />
            </label>
          ))}
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Aura thresholds</h4></header>
        <p className="av-games-field-help">Score needed to reach each tier (ascending).</p>
        <div className="av-commands-row-grid">
          {(['flickering', 'glowing', 'radiant', 'blazing'] as const).map((tier) => (
            <div key={tier}>
              <label className="av-games-field-label" style={{ textTransform: 'capitalize' }}>{tier}</label>
              <NumberUnitInput type="number-int" value={thresholds[tier]} onChange={(v) => onChange({ auraThresholds: { ...thresholds, [tier]: v } })} min={0} max={500} unit="pts" />
            </div>
          ))}
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Aura weights</h4></header>
        <div className="av-commands-row-grid">
          {Object.entries(weights).map(([k, v]) => (
            <div key={k}>
              <label className="av-games-field-label">{k}</label>
              <NumberUnitInput type="number-int" value={Number(v)} onChange={(nv) => onChange({ auraWeights: { ...weights, [k]: nv } })} min={0} max={100} />
            </div>
          ))}
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Whisper</h4></header>
        <div className="av-commands-row-grid">
          <label className="av-shopf-field">
            <span>Modal title</span>
            <input className="av-shopf-input" value={whisper.modalTitle ?? ''} onChange={(e) => onChange({ whisper: { ...whisper, modalTitle: e.target.value } })} dir="auto" />
          </label>
          <label className="av-shopf-field">
            <span>Placeholder</span>
            <input className="av-shopf-input" value={whisper.modalPlaceholder ?? ''} onChange={(e) => onChange({ whisper: { ...whisper, modalPlaceholder: e.target.value } })} dir="auto" />
          </label>
          <div>
            <label className="av-games-field-label">Cooldown</label>
            <NumberUnitInput type="number-ms-as-seconds" value={whisper.cooldownMs ?? 60000} onChange={(v) => onChange({ whisper: { ...whisper, cooldownMs: v } })} min={0} max={3600} />
          </div>
          <div>
            <label className="av-games-field-label">Auto cleanup</label>
            <NumberUnitInput type="number-ms-as-seconds" value={whisper.autoCleanupMs ?? 60000} onChange={(v) => onChange({ whisper: { ...whisper, autoCleanupMs: v } })} min={0} max={3600} />
          </div>
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Expiry titles</h4></header>
        <p className="av-games-field-help">Titles shown when a room is auto-closed. One per line.</p>
        <textarea
          className="av-shopf-input av-sage-tmpl-area"
          rows={5}
          value={expiry.join('\n')}
          onChange={(e) => onChange({ expiryTitles: e.target.value.split('\n') })}
          dir="auto"
        />
      </article>
    </section>
  );
}
