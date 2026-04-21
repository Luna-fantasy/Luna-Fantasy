'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import ImageUrlInput from '../games/fields/ImageUrlInput';
import { BTN_STYLE_COLOR, BTN_STYLE_LABEL, type LunaMapButton, type LunaMapMenuItem } from './types';

interface Props {
  initial: LunaMapButton;
  onSave: (next: LunaMapButton) => void;
  onClose: () => void;
  filenameHint: string;
}

type Mode = 'direct' | 'menu';

export default function LunaMapButtonDialog({ initial, onSave, onClose, filenameHint }: Props) {
  const startingMode: Mode = (initial.menu && initial.menu.length > 0) ? 'menu' : 'direct';
  const [mode, setMode] = useState<Mode>(startingMode);

  const [name, setName] = useState(initial.name ?? '');
  const [nameEn, setNameEn] = useState(initial.name_en ?? '');
  const [emojiId, setEmojiId] = useState(initial.emojiId ?? '');
  const [btnStyle, setBtnStyle] = useState<LunaMapButton['btnStyle']>(initial.btnStyle ?? 2);

  const [content, setContent] = useState(initial.content ?? '');
  const [contentEn, setContentEn] = useState(initial.content_en ?? '');
  const [image, setImage] = useState(initial.image ?? '');

  const [menu, setMenu] = useState<LunaMapMenuItem[]>(Array.isArray(initial.menu) ? initial.menu : []);

  const addMenuItem = () => {
    setMenu([...menu, { label: 'New entry', label_en: 'New entry', content: '', content_en: '', image: '' }]);
  };

  const patchMenuItem = (i: number, patch: Partial<LunaMapMenuItem>) => {
    setMenu(menu.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  };

  const removeMenuItem = (i: number) => {
    setMenu(menu.filter((_, idx) => idx !== i));
  };

  const moveMenuItem = (i: number, dir: -1 | 1) => {
    const next = [...menu];
    const target = i + dir;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    setMenu(next);
  };

  const submit = () => {
    const base: LunaMapButton = {
      name: name.trim() || 'Untitled',
      name_en: nameEn.trim() || undefined,
      emojiId: emojiId.trim(),
      btnStyle,
    };
    if (mode === 'direct') {
      base.content = content.trim();
      if (contentEn.trim()) base.content_en = contentEn.trim();
      if (image.trim()) base.image = image.trim();
      // Explicit: no menu in direct mode
      base.menu = undefined;
    } else {
      base.menu = menu;
    }
    onSave(base);
  };

  return createPortal(
    <>
      <div className="av-peek-scrim" onClick={onClose} />
      <div className="av-itemdialog av-info-button-dialog" role="dialog" aria-modal="true" aria-label="Luna map button editor">
        <header className="av-itemdialog-head">
          <div>
            <h3>{initial.name ? `Edit · ${initial.name}` : 'New button'}</h3>
            <p>Lives inside the Luna Map dropdown Discord shows with <code>!map</code>.</p>
          </div>
          <button type="button" className="av-peek-close" onClick={onClose}>×</button>
        </header>

        <div className="av-itemdialog-body">
          <div className="av-info-button-preview" style={{ ['--btn-tone' as any]: BTN_STYLE_COLOR[btnStyle] }}>
            <span className="av-info-button-preview-dot" aria-hidden="true" />
            <strong>{name || 'Untitled'}</strong>
            {nameEn && <span className="av-info-button-preview-en">({nameEn})</span>}
            <span className="av-info-button-mode-pill">{mode === 'direct' ? 'Direct' : `Menu · ${menu.length}`}</span>
          </div>

          <div className="av-itemdialog-fields">
            <label className="av-shopf-field">
              <span>Name · Arabic</span>
              <input className="av-shopf-input" value={name} dir="rtl" onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="av-shopf-field">
              <span>Name · English</span>
              <input className="av-shopf-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </label>

            <label className="av-shopf-field">
              <span>Emoji ID</span>
              <input
                className="av-shopf-input av-shopf-input--mono"
                value={emojiId}
                placeholder="Discord custom emoji id"
                inputMode="numeric"
                onChange={(e) => setEmojiId(e.target.value.replace(/[^\d]/g, ''))}
              />
            </label>

            <label className="av-shopf-field">
              <span>Button colour</span>
              <select
                className="av-shopf-input"
                value={btnStyle}
                onChange={(e) => setBtnStyle(Number(e.target.value) as LunaMapButton['btnStyle'])}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{BTN_STYLE_LABEL[n]}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="av-info-mode-toggle">
            <button
              type="button"
              className={`av-info-mode-btn${mode === 'direct' ? ' av-info-mode-btn--active' : ''}`}
              onClick={() => setMode('direct')}
            >Direct content</button>
            <button
              type="button"
              className={`av-info-mode-btn${mode === 'menu' ? ' av-info-mode-btn--active' : ''}`}
              onClick={() => setMode('menu')}
            >Sub-menu · {menu.length}</button>
          </div>

          {mode === 'direct' && (
            <div className="av-itemdialog-fields">
              <label className="av-shopf-field av-shopf-field--full">
                <span>Content · Arabic (markdown)</span>
                <textarea className="av-shopf-input" rows={6} dir="rtl" value={content} onChange={(e) => setContent(e.target.value)} />
              </label>
              <label className="av-shopf-field av-shopf-field--full">
                <span>Content · English (markdown)</span>
                <textarea className="av-shopf-input" rows={6} value={contentEn} onChange={(e) => setContentEn(e.target.value)} />
              </label>
              <div className="av-shopf-field av-shopf-field--full">
                <span>Image (optional)</span>
                <ImageUrlInput
                  value={image}
                  onChange={setImage}
                  folder="butler"
                  filenameHint={`luna_map_${filenameHint}`}
                />
              </div>
            </div>
          )}

          {mode === 'menu' && (
            <div className="av-info-menu-list">
              {menu.length === 0 && (
                <div className="av-commands-empty">No sub-entries yet. Add the first one below.</div>
              )}
              {menu.map((m, i) => (
                <article key={i} className="av-info-menu-item">
                  <header className="av-info-menu-item-head">
                    <span className="av-commands-reply-num">#{i + 1}</span>
                    <div className="av-info-menu-move">
                      <button type="button" onClick={() => moveMenuItem(i, -1)} disabled={i === 0} title="Move up">↑</button>
                      <button type="button" onClick={() => moveMenuItem(i, 1)} disabled={i === menu.length - 1} title="Move down">↓</button>
                    </div>
                    <button
                      type="button"
                      className="av-commands-delete"
                      onClick={() => removeMenuItem(i)}
                      title="Remove entry"
                    >🗑</button>
                  </header>
                  <div className="av-itemdialog-fields">
                    <label className="av-shopf-field">
                      <span>Label · Arabic</span>
                      <input className="av-shopf-input" dir="rtl" value={m.label} onChange={(e) => patchMenuItem(i, { label: e.target.value })} />
                    </label>
                    <label className="av-shopf-field">
                      <span>Label · English</span>
                      <input className="av-shopf-input" value={m.label_en ?? ''} onChange={(e) => patchMenuItem(i, { label_en: e.target.value })} />
                    </label>
                    <label className="av-shopf-field av-shopf-field--full">
                      <span>Content · Arabic (markdown)</span>
                      <textarea className="av-shopf-input" rows={4} dir="rtl" value={m.content} onChange={(e) => patchMenuItem(i, { content: e.target.value })} />
                    </label>
                    <label className="av-shopf-field av-shopf-field--full">
                      <span>Content · English (markdown)</span>
                      <textarea className="av-shopf-input" rows={4} value={m.content_en ?? ''} onChange={(e) => patchMenuItem(i, { content_en: e.target.value })} />
                    </label>
                    <div className="av-shopf-field av-shopf-field--full">
                      <span>Image</span>
                      <ImageUrlInput
                        value={m.image ?? ''}
                        onChange={(v) => patchMenuItem(i, { image: v })}
                        folder="butler"
                        filenameHint={`luna_map_${filenameHint}_${i + 1}`}
                      />
                    </div>
                  </div>
                </article>
              ))}
              {menu.length < 25 && (
                <button type="button" className="av-commands-add" onClick={addMenuItem}>+ Add entry</button>
              )}
            </div>
          )}
        </div>

        <footer className="av-itemdialog-foot">
          <button type="button" className="av-btn av-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="av-btn av-btn-primary" onClick={submit}>Save button</button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
