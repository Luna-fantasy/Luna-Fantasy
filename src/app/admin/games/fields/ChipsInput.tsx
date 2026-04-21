'use client';

import { useState } from 'react';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  kind: 'role' | 'channel';
}

/**
 * Chips editor for Discord role or channel ID arrays. Paste an ID + Enter to add,
 * × on a chip to remove. Empty-state explains the "everyone / everywhere" default.
 */
export default function ChipsInput({ value, onChange, kind }: Props) {
  const [draft, setDraft] = useState('');

  const list = Array.isArray(value) ? value : [];
  const sanitize = (raw: string) => raw.trim().replace(/[^\d]/g, '');

  const add = () => {
    const cleaned = sanitize(draft);
    if (!cleaned) return;
    if (list.includes(cleaned)) { setDraft(''); return; }
    onChange([...list, cleaned]);
    setDraft('');
  };

  const remove = (id: string) => {
    onChange(list.filter((v) => v !== id));
  };

  const emptyText = kind === 'role'
    ? 'Anyone can play — add a role ID to restrict.'
    : 'Every channel allowed — add a channel ID to scope.';

  const placeholder = kind === 'role'
    ? 'Paste a role ID and press Enter'
    : 'Paste a channel ID and press Enter';

  return (
    <div className="av-games-field-control av-games-chips-control">
      {list.length === 0 && <div className="av-games-chips-empty">{emptyText}</div>}

      {list.length > 0 && (
        <div className="av-games-chips">
          {list.map((id) => (
            <span key={id} className={`av-games-chip av-games-chip--${kind}`}>
              <span className="av-games-chip-id">{id}</span>
              <button
                type="button"
                className="av-games-chip-remove"
                onClick={() => remove(id)}
                aria-label={`Remove ${id}`}
                title={`Remove ${id}`}
              >×</button>
            </span>
          ))}
        </div>
      )}

      <div className="av-games-chip-add-row">
        <input
          className="av-games-field-input av-games-chip-input"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(); }
            if (e.key === 'Escape') setDraft('');
          }}
          onBlur={() => { if (draft) add(); }}
          inputMode="numeric"
        />
        <button type="button" className="av-games-chip-add-btn" onClick={add} disabled={!sanitize(draft)}>+ Add</button>
      </div>
    </div>
  );
}
