'use client';

import { useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import RoleChips from '../_components/RoleChips';
import ImageUrlInput from '../games/fields/ImageUrlInput';
import { saveEconomySection } from './BankingClient';

/**
 * Real shape per `LunaButlerMain/commands/steal_commands.ts` — the bot reads
 * all of these fields from `bot_config._id="butler_games"` doc under
 * `data.steal_system`. Every optional field falls back to a sensible hardcoded
 * default in the command handler, so only `enabled` truly has to be set.
 */
interface StealSystem {
  enabled: boolean;
  cooldown: number;
  min_percentage: number;
  max_percentage: number;
  required_roles: string[];
  success_title?: string;
  success_footer?: string;
  success_image?: string;
  fail_title?: string;
  fail_description?: string;
  fail_image?: string;
}

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

function formatCooldown(ms: number): string {
  if (ms >= 24 * HOUR_MS && ms % (24 * HOUR_MS) === 0) return `${ms / (24 * HOUR_MS)}d`;
  if (ms >= HOUR_MS && ms % HOUR_MS === 0) return `${ms / HOUR_MS}h`;
  return `${Math.round(ms / MIN_MS)}m`;
}

export default function StealSystemPanel({
  value,
  onSaved,
}: {
  value: StealSystem;
  onSaved: (next: StealSystem) => void;
}) {
  const toast = useToast();
  const pending = usePendingAction();
  const [w, setW] = useState<StealSystem>({
    enabled: value.enabled ?? false,
    cooldown: value.cooldown ?? 86_400_000,
    min_percentage: typeof value.min_percentage === 'number' ? value.min_percentage : 1,
    max_percentage: typeof value.max_percentage === 'number' ? value.max_percentage : 5,
    required_roles: Array.isArray(value.required_roles) ? value.required_roles : [],
    success_title: value.success_title ?? '',
    success_footer: value.success_footer ?? '',
    success_image: value.success_image ?? '',
    fail_title: value.fail_title ?? '',
    fail_description: value.fail_description ?? '',
    fail_image: value.fail_image ?? '',
  });

  const dirty = JSON.stringify(w) !== JSON.stringify(value);
  const hours = Math.max(1, Math.round(w.cooldown / HOUR_MS));
  const rangeInvalid = w.max_percentage < w.min_percentage;

  const save = () => {
    if (rangeInvalid) {
      toast.show({ tone: 'error', title: 'Bad range', message: 'max_percentage must be ≥ min_percentage' });
      return;
    }
    pending.queue({
      label: 'Save steal system',
      detail: w.enabled
        ? `ON · ${w.min_percentage}–${w.max_percentage}% of target · every ${formatCooldown(w.cooldown)}`
        : 'OFF',
      delayMs: 4500,
      tone: 'danger',
      run: async () => {
        try {
          await saveEconomySection('steal_system', w);
          onSaved(w);
          toast.show({ tone: 'success', title: 'Saved', message: 'Steal system updated.' });
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
          <h3>Steal system</h3>
          <p>
            Controls the <code>!steal</code> command — chance band, cooldown, role gating, and the success/failure embed copy.
            Stored in <code>butler_games.steal_system</code>. Insurance plans override this on protected users.
          </p>
        </div>
        {dirty && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => setW(value)}>Reset</button>
            <button
              type="button"
              className="av-btn av-btn-primary av-btn-sm"
              onClick={save}
              disabled={rangeInvalid}
              title={rangeInvalid ? 'Max % must be at least as large as Min %' : undefined}
            >Save steal</button>
          </div>
        )}
      </header>

      <div className="av-banking-investment-grid">
        <label className="av-banking-field" style={{ gridColumn: '1 / -1' }}>
          <span>Master switch</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              id="steal-enabled"
              type="checkbox"
              checked={w.enabled}
              onChange={(e) => setW({ ...w, enabled: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <label htmlFor="steal-enabled" style={{ cursor: 'pointer' }}>
              <strong>{w.enabled ? 'Steal command is active' : 'Steal command is disabled'}</strong>
            </label>
          </div>
          <small>When off, /steal responds with "disabled by admin". Insurance still shields protected users when on.</small>
        </label>

        <label className="av-banking-field">
          <span>Cooldown (hours)</span>
          <input
            type="number"
            className="av-audit-input"
            min={1}
            max={168}
            value={hours}
            onChange={(e) => setW({ ...w, cooldown: Math.max(MIN_MS, (Number(e.target.value) || 1) * HOUR_MS) })}
          />
          <small>Per-user cooldown between attempts. Default 24h.</small>
        </label>

        <label className="av-banking-field">
          <span>Min % of target's balance</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number"
              className="av-audit-input"
              step={0.5}
              min={0}
              max={100}
              value={w.min_percentage}
              onChange={(e) => setW({ ...w, min_percentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            />
            <span className="av-text-muted">%</span>
          </div>
          <small>Floor of the randomized steal amount.</small>
        </label>

        <label className="av-banking-field">
          <span>Max % of target's balance</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number"
              className="av-audit-input"
              step={0.5}
              min={0}
              max={100}
              value={w.max_percentage}
              onChange={(e) => setW({ ...w, max_percentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
              aria-invalid={rangeInvalid}
            />
            <span className="av-text-muted">%</span>
          </div>
          <small>Ceiling. Must be ≥ min. {rangeInvalid && <span style={{ color: 'var(--av-danger)' }}>Currently below min.</span>}</small>
        </label>

        <label className="av-banking-field" style={{ gridColumn: '1 / -1' }}>
          <span>Allowed roles</span>
          <RoleChips
            value={w.required_roles}
            onChange={(ids) => setW({ ...w, required_roles: ids })}
          />
          <small>Only members with at least one of these roles can run /steal. Leave empty to allow no one (disables the command effectively).</small>
        </label>
      </div>

      <details className="av-banking-nested-details" style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '8px 0', color: 'var(--text-secondary)' }}>
          Success / failure copy &amp; images (optional)
        </summary>
        <div className="av-banking-investment-grid" style={{ marginTop: 12 }}>
          <label className="av-banking-field">
            <span>Success title</span>
            <input
              className="av-audit-input"
              value={w.success_title ?? ''}
              onChange={(e) => setW({ ...w, success_title: e.target.value })}
              maxLength={120}
              placeholder="Leave blank to use bot default"
            />
          </label>
          <label className="av-banking-field">
            <span>Success footer</span>
            <input
              className="av-audit-input"
              value={w.success_footer ?? ''}
              onChange={(e) => setW({ ...w, success_footer: e.target.value })}
              maxLength={200}
            />
          </label>
          <label className="av-banking-field" style={{ gridColumn: '1 / -1' }}>
            <span>Success image</span>
            <ImageUrlInput
              value={w.success_image ?? ''}
              onChange={(url) => setW({ ...w, success_image: url })}
              folder="butler"
              filenameHint="steal-success"
            />
            <small>Shown in the embed on a successful steal. Leave blank for bot default.</small>
          </label>

          <label className="av-banking-field">
            <span>Fail title</span>
            <input
              className="av-audit-input"
              value={w.fail_title ?? ''}
              onChange={(e) => setW({ ...w, fail_title: e.target.value })}
              maxLength={120}
            />
          </label>
          <label className="av-banking-field">
            <span>Fail description</span>
            <input
              className="av-audit-input"
              value={w.fail_description ?? ''}
              onChange={(e) => setW({ ...w, fail_description: e.target.value })}
              maxLength={400}
              placeholder="Supports {thief} and {target} placeholders"
            />
          </label>
          <label className="av-banking-field" style={{ gridColumn: '1 / -1' }}>
            <span>Fail image</span>
            <ImageUrlInput
              value={w.fail_image ?? ''}
              onChange={(url) => setW({ ...w, fail_image: url })}
              folder="butler"
              filenameHint="steal-fail"
            />
            <small>Shown when steal is blocked by insurance. Leave blank for bot default.</small>
          </label>
        </div>
      </details>

      <div className="av-banking-preview-box">
        <strong>Preview:</strong> {w.enabled ? (
          <>
            Each <code>!steal</code> attempt takes <strong>{w.min_percentage}%</strong>–<strong>{w.max_percentage}%</strong> of the target's balance, locks the thief out for <strong>{formatCooldown(w.cooldown)}</strong>,
            and is gated to {w.required_roles.length > 0 ? <>the {w.required_roles.length} allowed role{w.required_roles.length === 1 ? '' : 's'} below</> : <span style={{ color: 'var(--av-warning)' }}>no roles (command effectively disabled)</span>}.
          </>
        ) : (
          <><strong>Disabled.</strong> Players cannot steal. Re-enable above.</>
        )}
      </div>
    </section>
  );
}
