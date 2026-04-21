'use client';

import ImageUrlInput from '../games/fields/ImageUrlInput';
import type { VoiceAssets } from './types';

interface Props {
  data: VoiceAssets;
  onChange: (patch: Partial<VoiceAssets>) => void;
}

export default function AssetsPanel({ data, onChange }: Props) {
  const emojis = data.emojis ?? {};

  const patchEmoji = (key: string, value: string) => onChange({ emojis: { ...emojis, [key]: value } });
  const removeEmoji = (key: string) => {
    const next = { ...emojis };
    delete next[key];
    onChange({ emojis: next });
  };
  const addEmoji = () => {
    const baseKey = 'newKey';
    let key = baseKey;
    let i = 2;
    while (key in emojis) key = `${baseKey}${i++}`;
    patchEmoji(key, '');
  };

  return (
    <section className="av-voice-panel">
      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Panel banner</h4></header>
        <p className="av-games-field-help">Header artwork on the room control panel.</p>
        <ImageUrlInput
          value={data.panelBannerUrl ?? ''}
          onChange={(v) => onChange({ panelBannerUrl: v })}
          folder="oracle"
          filenameHint="panel_banner"
        />
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head">
          <h4 className="av-sage-card-title">Custom emoji mappings</h4>
          <button type="button" className="av-commands-add" onClick={addEmoji}>+ Add mapping</button>
        </header>
        <p className="av-games-field-help">Keys the bot looks up when rendering messages. Values are Discord emoji strings like <code>&lt;:luna:123…&gt;</code>.</p>
        {Object.keys(emojis).length === 0 && <div className="av-commands-empty">No custom emoji mappings.</div>}
        <div className="av-voice-emoji-list">
          {Object.entries(emojis).map(([key, value]) => (
            <div key={key} className="av-voice-emoji-row">
              <input
                className="av-shopf-input av-shopf-input--mono"
                value={key}
                onChange={(e) => {
                  const next = { ...emojis };
                  const newKey = e.target.value.trim();
                  if (!newKey || newKey in emojis) return;
                  next[newKey] = next[key];
                  delete next[key];
                  onChange({ emojis: next });
                }}
              />
              <input
                className="av-shopf-input"
                value={value}
                onChange={(e) => patchEmoji(key, e.target.value)}
                placeholder="<:name:id>"
              />
              <button type="button" className="av-commands-delete" onClick={() => removeEmoji(key)} title="Remove mapping">🗑</button>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
