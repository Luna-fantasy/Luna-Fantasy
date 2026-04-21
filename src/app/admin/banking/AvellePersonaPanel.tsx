'use client';

import { useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import ImageUrlInput from '../games/fields/ImageUrlInput';
import { saveBankingSection } from './BankingClient';

interface Persona {
  name: string;
  title: string;
  description: string;
  portrait: string;
  portraitVersion: number;
}

export default function AvellePersonaPanel({
  persona,
  onSaved,
}: {
  persona: Persona;
  onSaved: (p: Persona) => void;
}) {
  const toast = useToast();
  const pending = usePendingAction();

  const [name, setName] = useState(persona.name);
  const [title, setTitle] = useState(persona.title);
  const [description, setDescription] = useState(persona.description);
  const [portrait, setPortrait] = useState(persona.portrait);

  const dirty =
    name !== persona.name ||
    title !== persona.title ||
    description !== persona.description ||
    portrait !== persona.portrait;

  const reset = () => {
    setName(persona.name);
    setTitle(persona.title);
    setDescription(persona.description);
    setPortrait(persona.portrait);
  };

  const save = () => {
    if (!name.trim()) {
      toast.show({ tone: 'error', title: 'Name required', message: 'Avelle needs a name.' });
      return;
    }
    const next: Persona = {
      name: name.trim(),
      title: title.trim(),
      description: description.trim(),
      portrait: portrait.trim(),
      portraitVersion: Date.now(),
    };
    pending.queue({
      label: "Save Avelle Adar's persona",
      detail: 'Butler picks up within ~30s · Discord embeds refresh next interaction',
      delayMs: 4500,
      run: async () => {
        try {
          await saveBankingSection('persona', next);
          onSaved(next);
          toast.show({ tone: 'success', title: 'Persona saved', message: `${next.name} is updated.` });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  return (
    <section className="av-banking-panel">
      <header className="av-banking-panel-head">
        <div>
          <h3>Avelle's persona</h3>
          <p>This is what players see when they open <code>/bank</code> in Discord. Changes take effect within ~30 seconds.</p>
        </div>
        {dirty && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={reset}>Reset</button>
            <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={save}>Save persona</button>
          </div>
        )}
      </header>

      <div className="av-banking-persona-grid">
        {/* Portrait column — preview + replace */}
        <div className="av-banking-portrait-col">
          <ImageUrlInput
            value={portrait}
            onChange={(url) => setPortrait(url)}
            folder="butler"
            filenameHint="Avelle-Adar"
          />
        </div>

        {/* Fields column */}
        <div className="av-banking-persona-fields">
          <label className="av-banking-field">
            <span>Name</span>
            <input
              className="av-audit-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Avelle Adar"
              maxLength={80}
            />
          </label>

          <label className="av-banking-field">
            <span>Title / sub-heading</span>
            <input
              className="av-audit-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lord Treasurer of Luna"
              maxLength={120}
            />
            <small>Shown as a chip under his name in the dashboard.</small>
          </label>

          <label className="av-banking-field">
            <span>Description — what he says</span>
            <textarea
              className="av-audit-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="I'm Avelle Adar. Owner of the bank of Luna…"
              maxLength={800}
              rows={4}
            />
            <small>This text appears under his portrait in every bank embed. {description.length}/800 chars.</small>
          </label>
        </div>
      </div>

      <div className="av-banking-persona-note">
        <strong>Note:</strong> The Butler bot currently ships with Avelle's name and description hardcoded in
        <code> commands/banker_commands.ts</code>. Saving here updates the dashboard + any surface that
        reads <code>bot_config.butler_banking.persona</code>. A follow-up bot release will wire the Discord
        embeds to read from this config so your edits flow end-to-end.
      </div>
    </section>
  );
}
