'use client';

import { useState } from 'react';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
}

/** Free-text chips — accepts any Unicode (Arabic, emoji, punctuation). Paste + Enter / blur to add. */
export default function ChipEditor({ value, onChange, placeholder = 'Type and press Enter', emptyText = 'No entries yet.' }: Props) {
  const [draft, setDraft] = useState('');
  const list = Array.isArray(value) ? value : [];

  const add = () => {
    const cleaned = draft.trim();
    if (!cleaned) return;
    if (list.includes(cleaned)) { setDraft(''); return; }
    onChange([...list, cleaned]);
    setDraft('');
  };

  const remove = (v: string) => onChange(list.filter((x) => x !== v));

  return (
    <div className="av-commands-free-chips-wrap">
      {list.length === 0 && <div className="av-commands-free-chips-empty">{emptyText}</div>}
      {list.length > 0 && (
        <div className="av-commands-free-chips">
          {list.map((v) => (
            <span key={v} className="av-commands-free-chip">
              <span className="av-commands-free-chip-text">{v}</span>
              <button
                type="button"
                className="av-commands-free-chip-x"
                onClick={() => remove(v)}
                aria-label={`Remove ${v}`}
                title={`Remove ${v}`}
              >×</button>
            </span>
          ))}
        </div>
      )}
      <div className="av-commands-free-chip-add-row">
        <input
          className="av-games-field-input av-commands-free-chip-input"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(); }
            if (e.key === 'Escape') setDraft('');
          }}
          onBlur={() => { if (draft) add(); }}
        />
        <button
          type="button"
          className="av-commands-free-chip-add"
          onClick={add}
          disabled={!draft.trim()}
        >+ Add</button>
      </div>
    </div>
  );
}
