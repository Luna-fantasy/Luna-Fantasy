'use client';

import ToggleCard from '../games/fields/ToggleCard';

export interface AutoReply {
  trigger: string;
  response: string;
  reply: boolean;
}

export interface AutoReplyDoc {
  enabled: boolean;
  replies: AutoReply[];
}

interface Props {
  data: AutoReplyDoc;
  onChange: (next: AutoReplyDoc) => void;
}

export default function AutoRepliesPanel({ data, onChange }: Props) {
  const enabled = Boolean(data?.enabled);
  const replies = Array.isArray(data?.replies) ? data.replies : [];

  const patchReply = (idx: number, patch: Partial<AutoReply>) => {
    onChange({ ...data, enabled, replies: replies.map((r, i) => i === idx ? { ...r, ...patch } : r) });
  };

  const remove = (idx: number) => {
    onChange({ ...data, enabled, replies: replies.filter((_, i) => i !== idx) });
  };

  const add = () => {
    onChange({
      ...data,
      enabled,
      replies: [...replies, { trigger: 'hello', response: 'hi {mention}', reply: true }],
    });
  };

  return (
    <section className="av-commands">
      <div className="av-commands-global-row">
        <div>
          <h4 className="av-commands-global-title">Auto-Replies</h4>
          <p className="av-commands-global-help">Global toggle for the whole system. Individual rules still need the box on top to fire.</p>
        </div>
        <ToggleCard
          value={enabled}
          onChange={(v) => onChange({ ...data, enabled: v, replies })}
          onLabel="System ON"
          offLabel="System OFF"
        />
      </div>

      <div className="av-commands-banner">
        <strong>Wildcards & placeholders</strong>
        <span>
          <code>صباح*</code> matches anything starting with صباح · <code>*شكرا*</code> matches any message containing شكرا · use <code>&#123;mention&#125;</code>, <code>&#123;user&#125;</code>, <code>&#123;username&#125;</code>, <code>&#123;tag&#125;</code> in responses.
        </span>
      </div>

      <div className="av-commands-controls">
        <div style={{ flex: 1 }} />
        <button type="button" className="av-commands-add" onClick={add}>+ New reply</button>
      </div>

      {replies.length === 0 && (
        <div className="av-commands-empty">No auto-replies yet — the bot holds its tongue until you teach it to speak.</div>
      )}

      <div className="av-commands-list">
        {replies.map((r, idx) => (
          <article key={idx} className="av-commands-card">
            <header className="av-commands-card-head">
              <div className="av-commands-reply-head">
                <span className="av-commands-reply-num">#{idx + 1}</span>
                <div className="av-commands-reply-trigger-wrap">
                  <label className="av-games-field-label">Trigger</label>
                  <input
                    className="av-games-field-input"
                    value={r.trigger}
                    onChange={(e) => patchReply(idx, { trigger: e.target.value })}
                    placeholder="e.g. صباح* or *شكرا*"
                  />
                </div>
              </div>
              <div className="av-commands-toggle-row">
                <ToggleCard
                  value={Boolean(r.reply)}
                  onChange={(v) => patchReply(idx, { reply: v })}
                  onLabel="Reply"
                  offLabel="New msg"
                />
                <button
                  type="button"
                  className="av-commands-delete"
                  onClick={() => remove(idx)}
                  title="Delete reply"
                  aria-label="Delete reply"
                >🗑</button>
              </div>
            </header>

            <div>
              <label className="av-games-field-label">Response</label>
              <p className="av-games-field-help">What the bot says. Placeholders get replaced with the author's mention/tag at send time.</p>
              <textarea
                className="av-games-field-input av-games-field-textarea"
                rows={3}
                value={r.response}
                onChange={(e) => patchReply(idx, { response: e.target.value })}
                placeholder="e.g. صباح النور {mention} ☀️"
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
