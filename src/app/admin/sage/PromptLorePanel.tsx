'use client';

import type { SettingsSection } from './types';

interface Props {
  kind: 'prompt' | 'lore';
  value: string;
  onChange: (section: SettingsSection, value: string) => void;
}

const META = {
  prompt: {
    section: 'system_prompt' as SettingsSection,
    title: 'System prompt',
    help: 'The soul of Sage — persona, tone, hard rules. Keep rules unambiguous; Sage obeys the letter more than the spirit.',
    placeholders: ['[CONTEXT_INFO]', '[REQUESTER_NAME]', '[REQUESTER_ROLE]', '[REQUESTER_TITLE]'],
  },
  lore: {
    section: 'lore_text' as SettingsSection,
    title: 'World lore',
    help: 'The canon Sage grounds answers in. Markdown supported. Sage is trained to prioritise lore over its own knowledge when there is a conflict.',
    placeholders: ['# Headings', '**bold**', '- bullet list'],
  },
};

export default function PromptLorePanel({ kind, value, onChange }: Props) {
  const meta = META[kind];
  return (
    <section className="av-sage-panel">
      <article className="av-commands-card av-sage-longform">
        <header className="av-commands-card-head">
          <div>
            <h4 className="av-sage-card-title">{meta.title}</h4>
            <p className="av-games-field-help">{meta.help}</p>
          </div>
          <span className="av-sage-longform-count">{value.length.toLocaleString()} chars</span>
        </header>
        <textarea
          className="av-shopf-input av-sage-longform-area"
          rows={18}
          value={value}
          onChange={(e) => onChange(meta.section, e.target.value)}
          placeholder={`Empty — Sage falls back to its source default.`}
        />
        {meta.placeholders.length > 0 && (
          <div className="av-sage-placeholder-hint">
            Useful placeholders:{' '}
            {meta.placeholders.map((p, i) => (
              <code key={p}>{p}{i < meta.placeholders.length - 1 ? ' ' : ''}</code>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
