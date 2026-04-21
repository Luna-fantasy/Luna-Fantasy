'use client';

import { useState } from 'react';
import RoleChips from '../_components/RoleChips';

interface StopEntry {
  triggers: string[];
  enabled: boolean;
  allowedRoles: string[];
}

interface Props {
  entry: StopEntry;
  onChange: (next: StopEntry) => void;
}

export default function StopGameCard({ entry, onChange }: Props) {
  const [newTrigger, setNewTrigger] = useState('');

  const addTrigger = () => {
    const t = newTrigger.trim();
    if (!t || t.includes(' ') || t.length > 50 || entry.triggers.includes(t)) return;
    onChange({ ...entry, triggers: [...entry.triggers, t] });
    setNewTrigger('');
  };

  const removeTrigger = (i: number) => {
    if (entry.triggers.length <= 1) return;
    onChange({ ...entry, triggers: entry.triggers.filter((_, j) => j !== i) });
  };

  return (
    <section className="av-games-stop">
      <header className="av-games-stop-head">
        <div className="av-games-stop-head-text">
          <div className="av-games-stop-title">
            <span aria-hidden="true" className="av-games-stop-glyph">⊗</span>
            <span>Stop Game</span>
            <span className={`av-games-stop-badge${entry.enabled ? ' av-games-stop-badge--on' : ''}`}>
              {entry.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="av-games-stop-hint">
            Stops the active game in the current channel only. Use to recover a sabotaged or stuck lobby.
          </p>
        </div>
        <button
          type="button"
          className={`av-games-stop-toggle${entry.enabled ? ' av-games-stop-toggle--on' : ''}`}
          onClick={() => onChange({ ...entry, enabled: !entry.enabled })}
          aria-pressed={entry.enabled}
        >
          <span className="av-games-stop-toggle-knob" />
        </button>
      </header>

      <div className="av-games-stop-section">
        <label className="av-games-stop-label">Commands</label>
        <div className="av-games-stop-triggers">
          {entry.triggers.map((t, i) => (
            <span key={`${t}-${i}`} className="av-games-stop-trigger" dir="auto">
              !{t}
              {entry.triggers.length > 1 && (
                <button
                  type="button"
                  className="av-games-stop-trigger-remove"
                  onClick={() => removeTrigger(i)}
                  aria-label={`Remove ${t}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          <form
            onSubmit={(e) => { e.preventDefault(); addTrigger(); }}
            className="av-games-stop-trigger-add-form"
          >
            <input
              className="av-games-stop-trigger-add"
              placeholder="+ add trigger"
              value={newTrigger}
              onChange={(e) => setNewTrigger(e.target.value)}
              onBlur={() => addTrigger()}
              maxLength={50}
              dir="auto"
            />
          </form>
        </div>
      </div>

      <div className="av-games-stop-section">
        <label className="av-games-stop-label">Who can use it</label>
        <p className="av-games-stop-sublabel">
          Add roles that can call the stop command. Empty = only admins and owners.
        </p>
        <RoleChips
          value={entry.allowedRoles}
          onChange={(next) => onChange({ ...entry, allowedRoles: next })}
        />
      </div>
    </section>
  );
}
