'use client';

import ToggleCard from '../games/fields/ToggleCard';
import RoleChips from '../_components/RoleChips';
import ChipEditor from '../commands/ChipEditor';
import NumberUnitInput from '../games/fields/NumberUnitInput';
import type { SageSettings, SettingsSection } from './types';

interface Props {
  data: SageSettings;
  onChange: (section: SettingsSection, value: any) => void;
}

export default function SettingsPanel({ data, onChange }: Props) {
  return (
    <section className="av-sage-panel">
      <div className="av-commands-banner">
        <strong>AI provider & model</strong>
        <span>Changes reach the bot within ~30 s via the 30-second TTL cache.</span>
      </div>

      <article className="av-commands-card">
        <header className="av-commands-card-head">
          <h4 className="av-sage-card-title">Provider</h4>
        </header>
        <div className="av-sage-provider-row">
          {(['google', 'openrouter'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`av-sage-provider${data.provider === p ? ' av-sage-provider--active' : ''}`}
              onClick={() => onChange('provider', p)}
              aria-pressed={data.provider === p}
            >
              <strong>{p === 'google' ? 'Google' : 'OpenRouter'}</strong>
              <span>{p === 'google' ? 'Gemini models' : 'Claude, GPT, others'}</span>
            </button>
          ))}
        </div>
        <div className="av-commands-row-grid">
          <label className="av-shopf-field">
            <span>Google model</span>
            <input className="av-shopf-input av-shopf-input--mono" value={data.google_model ?? ''}
              onChange={(e) => onChange('google_model', e.target.value)}
              placeholder="gemini-2.5-flash" />
          </label>
          <label className="av-shopf-field">
            <span>OpenRouter model</span>
            <input className="av-shopf-input av-shopf-input--mono" value={data.openrouter_model ?? ''}
              onChange={(e) => onChange('openrouter_model', e.target.value)}
              placeholder="anthropic/claude-3.5-sonnet:online" />
          </label>
          <label className="av-shopf-field">
            <span>Image generation model</span>
            <input className="av-shopf-input av-shopf-input--mono" value={data.image_generation_model ?? ''}
              onChange={(e) => onChange('image_generation_model', e.target.value)}
              placeholder="gemini-2.5-flash-image" />
          </label>
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Features</h4></header>
        <div className="av-sage-toggles">
          <div className="av-sage-toggle-row">
            <div>
              <strong>Web search</strong>
              <span>Allow Sage to cite recent info via provider-side tools.</span>
            </div>
            <ToggleCard value={Boolean(data.enable_search)} onChange={(v) => onChange('enable_search', v)} onLabel="Enabled" offLabel="Disabled" />
          </div>
          <div className="av-sage-toggle-row">
            <div>
              <strong>Image generation</strong>
              <span>Lets listed roles call Sage to render an image.</span>
            </div>
            <ToggleCard value={Boolean(data.enable_image_generation)} onChange={(v) => onChange('enable_image_generation', v)} onLabel="Enabled" offLabel="Disabled" />
          </div>
        </div>
      </article>

      <article className="av-commands-card">
        <header className="av-commands-card-head"><h4 className="av-sage-card-title">Invocation</h4></header>
        <div className="av-commands-row-grid">
          <div>
            <label className="av-games-field-label">Prefix triggers</label>
            <p className="av-games-field-help">Words the bot wakes up for (besides @mention).</p>
            <ChipEditor
              value={data.sage_prefix ?? []}
              onChange={(next) => onChange('sage_prefix', next)}
              placeholder="e.g. سيج"
            />
          </div>
          <div>
            <label className="av-games-field-label">Owner role IDs</label>
            <p className="av-games-field-help">These roles can run the owner-only Sage commands.</p>
            <RoleChips value={data.owner_role_ids ?? []} onChange={(next) => onChange('owner_role_ids', next)} />
          </div>
          <div>
            <label className="av-games-field-label">Image gen roles</label>
            <p className="av-games-field-help">Roles allowed to ask Sage to generate images.</p>
            <RoleChips value={data.image_gen_roles ?? []} onChange={(next) => onChange('image_gen_roles', next)} />
          </div>
          <div>
            <label className="av-games-field-label">Channel context window</label>
            <p className="av-games-field-help">Recent messages Sage reads for context.</p>
            <NumberUnitInput
              type="number-int"
              value={data.channel_context_limit ?? 50}
              onChange={(v) => onChange('channel_context_limit', v)}
              unit="msgs"
              min={5} max={200} step={5}
            />
          </div>
        </div>
      </article>
    </section>
  );
}
