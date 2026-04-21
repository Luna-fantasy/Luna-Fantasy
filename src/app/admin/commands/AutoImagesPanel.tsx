'use client';

import ChannelPicker from '../_components/ChannelPicker';
import ImageUrlInput from '../games/fields/ImageUrlInput';

export interface AutoImageRule {
  channel_id: string;
  image_url: string;
}

interface Props {
  data: AutoImageRule[];
  onChange: (next: AutoImageRule[]) => void;
}

export default function AutoImagesPanel({ data, onChange }: Props) {
  const rules = Array.isArray(data) ? data : [];

  const patchRule = (idx: number, patch: Partial<AutoImageRule>) => {
    onChange(rules.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const remove = (idx: number) => onChange(rules.filter((_, i) => i !== idx));

  const add = () => onChange([...rules, { channel_id: '', image_url: '' }]);

  // Dedupe check — warn when two rules share the same channel
  const channelCounts = rules.reduce<Record<string, number>>((acc, r) => {
    if (r.channel_id) acc[r.channel_id] = (acc[r.channel_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="av-commands">
      <div className="av-commands-banner av-commands-banner--warn">
        <strong>Careful — this fires on every message</strong>
        <span>The bot posts the image after every message in the listed channel. Only use this for decorative dividers or very quiet channels.</span>
      </div>

      <div className="av-commands-controls">
        <div style={{ flex: 1 }} />
        <button type="button" className="av-commands-add" onClick={add}>+ New rule</button>
      </div>

      {rules.length === 0 && (
        <div className="av-commands-empty">No image rules — the channels remain unadorned.</div>
      )}

      <div className="av-commands-list">
        {rules.map((r, idx) => {
          const dup = r.channel_id && channelCounts[r.channel_id] > 1;
          return (
            <article key={idx} className="av-commands-card">
              <header className="av-commands-card-head">
                <span className="av-commands-reply-num">#{idx + 1}</span>
                <button
                  type="button"
                  className="av-commands-delete"
                  onClick={() => remove(idx)}
                  title="Delete rule"
                  aria-label="Delete rule"
                >🗑</button>
              </header>

              <div className="av-commands-row-grid">
                <div>
                  <label className="av-games-field-label">Channel</label>
                  <p className="av-games-field-help">Select the target channel for auto-image posting.</p>
                  <ChannelPicker
                    value={r.channel_id ?? ''}
                    onChange={(v) => patchRule(idx, { channel_id: v })}
                    filter="text"
                    placeholder="Select channel"
                  />
                  {dup && (
                    <p className="av-commands-dup-warning">⚠ Another rule already points at this channel. The bot will double-post.</p>
                  )}
                </div>

                <div>
                  <label className="av-games-field-label">Image</label>
                  <p className="av-games-field-help">Uploaded to R2 under the butler folder. Preview below.</p>
                  <ImageUrlInput
                    value={r.image_url ?? ''}
                    onChange={(v) => patchRule(idx, { image_url: v })}
                    folder="butler"
                    filenameHint={`auto_image_${idx + 1}`}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
