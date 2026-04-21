'use client';

import { useState } from 'react';
import ImageUrlInput from '../games/fields/ImageUrlInput';
import LunaMapButtonDialog from './LunaMapButtonDialog';
import { BTN_STYLE_COLOR, type LunaMapButton, type LunaMapDoc } from './types';

interface Props {
  data: LunaMapDoc;
  onChange: (next: LunaMapDoc) => void;
}

export default function LunaMapPanel({ data, onChange }: Props) {
  const [editing, setEditing] = useState<{ index: number; button: LunaMapButton } | null>(null);

  const buttons = Array.isArray(data?.buttons) ? data.buttons : [];

  const patch = (p: Partial<LunaMapDoc>) => onChange({ ...data, ...p });

  const updateButton = (index: number, next: LunaMapButton) => {
    const nextButtons = buttons.map((b, i) => i === index ? next : b);
    patch({ buttons: nextButtons });
  };

  const addButton = () => {
    const fresh: LunaMapButton = { name: 'New button', btnStyle: 2, emojiId: '', content: '' };
    patch({ buttons: [...buttons, fresh] });
    setEditing({ index: buttons.length, button: fresh });
  };

  const removeButton = (index: number) => {
    patch({ buttons: buttons.filter((_, i) => i !== index) });
  };

  const moveButton = (index: number, dir: -1 | 1) => {
    const next = [...buttons];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patch({ buttons: next });
  };

  return (
    <section className="av-info">
      <header className="av-info-map-header av-surface">
        <div className="av-info-map-header-body">
          <label className="av-shopf-field">
            <span>Title · Arabic</span>
            <input className="av-shopf-input" dir="rtl" value={data.title ?? ''} onChange={(e) => patch({ title: e.target.value })} />
          </label>
          <label className="av-shopf-field">
            <span>Title · English</span>
            <input className="av-shopf-input" value={data.title_en ?? ''} onChange={(e) => patch({ title_en: e.target.value })} />
          </label>

          <label className="av-shopf-field av-shopf-field--full">
            <span>Description · Arabic</span>
            <textarea className="av-shopf-input" dir="rtl" rows={2} value={data.description ?? ''} onChange={(e) => patch({ description: e.target.value })} />
          </label>
          <label className="av-shopf-field av-shopf-field--full">
            <span>Description · English</span>
            <textarea className="av-shopf-input" rows={2} value={data.description_en ?? ''} onChange={(e) => patch({ description_en: e.target.value })} />
          </label>

          <div className="av-shopf-field av-shopf-field--full">
            <span>Map artwork</span>
            <ImageUrlInput
              value={data.image ?? ''}
              onChange={(v) => patch({ image: v })}
              folder="butler"
              filenameHint="luna_map_cover"
            />
          </div>
        </div>
      </header>

      <div className="av-commands-controls">
        <span className="av-info-map-count">{buttons.length} button{buttons.length === 1 ? '' : 's'}</span>
        <div style={{ flex: 1 }} />
        <button type="button" className="av-commands-add" onClick={addButton}>+ New button</button>
      </div>

      {buttons.length === 0 && (
        <div className="av-commands-empty">No buttons yet. Add the first to start the map.</div>
      )}

      <div className="av-info-button-grid">
        {buttons.map((b, i) => {
          const isMenu = Array.isArray(b.menu) && b.menu.length > 0;
          return (
            <article key={i} className="av-info-button-card" style={{ ['--btn-tone' as any]: BTN_STYLE_COLOR[b.btnStyle] }}>
              <div className="av-info-button-card-head">
                <span className="av-info-button-dot" aria-hidden="true" />
                <span className="av-info-button-mode-pill">{isMenu ? `Menu · ${b.menu!.length}` : 'Direct'}</span>
                <div className="av-info-button-move">
                  <button type="button" onClick={() => moveButton(i, -1)} disabled={i === 0} title="Move up">↑</button>
                  <button type="button" onClick={() => moveButton(i, 1)} disabled={i === buttons.length - 1} title="Move down">↓</button>
                </div>
              </div>

              <div className="av-info-button-card-body">
                <strong className="av-info-button-card-name" dir="rtl">{b.name}</strong>
                {b.name_en && <span className="av-info-button-card-en">{b.name_en}</span>}
                {b.emojiId && <code className="av-info-button-card-emoji">emoji:{b.emojiId.slice(0, 8)}…</code>}
                {!isMenu && b.content && (
                  <p className="av-info-button-card-preview" dir="rtl">{b.content.split('\n')[0].slice(0, 80)}…</p>
                )}
                {isMenu && b.menu && (
                  <p className="av-info-button-card-preview">{b.menu.map((m) => m.label).slice(0, 3).join(' · ')}{b.menu.length > 3 ? '…' : ''}</p>
                )}
              </div>

              <div className="av-info-button-card-actions">
                <button type="button" className="av-btn av-btn-ghost" onClick={() => setEditing({ index: i, button: b })}>Edit</button>
                <button type="button" className="av-commands-delete" onClick={() => removeButton(i)} title="Delete button">🗑</button>
              </div>
            </article>
          );
        })}
      </div>

      {editing && (
        <LunaMapButtonDialog
          initial={editing.button}
          filenameHint={`btn_${editing.index + 1}`}
          onSave={(next) => {
            updateButton(editing.index, next);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
