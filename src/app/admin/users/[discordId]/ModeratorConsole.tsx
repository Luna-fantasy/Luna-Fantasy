'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../_components/Toast';
import { useUndo } from '../../_components/UndoProvider';
import { usePendingAction } from '../../_components/PendingActionProvider';
import Icon from '../../_components/Icon';
import { useFocusTrap } from '../../_components/a11y';
import type { IconName } from '../../_components/nav-config';

interface Props {
  discordId: string;
  displayName: string;
  current?: {
    balance?: number;
    level?: number;
    tickets?: number;
  };
  onMutated: () => void | Promise<void>;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  if (!res.ok) throw new Error('CSRF fetch failed');
  const data = await res.json();
  return data.token;
}

async function apiMutate(
  path: string,
  method: 'POST' | 'DELETE',
  body?: Record<string, unknown>,
): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

interface ActionDef {
  id: string;
  label: string;
  icon: IconName;
  tone: 'primary' | 'warn' | 'danger';
  description: string;
  form: 'amount+reason' | 'reason' | 'confirm';
  category: 'economy' | 'discipline' | 'bank';
}

const ACTIONS: ActionDef[] = [
  { id: 'credit',       label: 'Give Lunari',          icon: 'sparkles', tone: 'primary', description: 'Add Lunari to this player\u2019s balance', form: 'amount+reason', category: 'economy' },
  { id: 'debit',        label: 'Take Lunari',          icon: 'coins',    tone: 'warn',    description: 'Subtract Lunari from this player\u2019s balance', form: 'amount+reason', category: 'economy' },
  { id: 'level',        label: 'Change Level',         icon: 'trending', tone: 'primary', description: 'Nudge the player\u2019s level up or down (\u00B1200)', form: 'amount+reason', category: 'economy' },
  { id: 'tickets',      label: 'Change Tickets',       icon: 'ticket',   tone: 'primary', description: 'Adjust ticket count (\u00B110,000)', form: 'amount+reason', category: 'economy' },

  { id: 'cooldowns',    label: 'Clear All Cooldowns',  icon: 'settings', tone: 'warn',    description: 'Let them use every command again right now', form: 'reason',     category: 'discipline' },
  { id: 'passport',     label: 'Take Away Passport',   icon: 'passport', tone: 'danger',  description: 'Remove the passport and strip the passport role', form: 'reason',     category: 'discipline' },

  { id: 'debt',         label: 'Forgive Debt',         icon: 'shield',   tone: 'warn',    description: 'Clear outstanding debt for this player', form: 'reason', category: 'bank' },
  { id: 'loans',        label: 'Wipe All Loans',       icon: 'bank',     tone: 'warn',    description: 'Cancel every active loan on record', form: 'reason', category: 'bank' },
];

const CATEGORY_META: Record<ActionDef['category'], { label: string; description: string }> = {
  economy:    { label: 'Economy',    description: 'Give or take Lunari, levels, and tickets.' },
  discipline: { label: 'Discipline', description: 'Reset cooldowns and revoke passports.' },
  bank:       { label: 'Banking',    description: 'Forgive debts and wipe loans.' },
};

export default function ModeratorConsole({ discordId, displayName, current, onMutated }: Props) {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();
  const [openAction, setOpenAction] = useState<ActionDef | null>(null);

  const grouped = ACTIONS.reduce<Record<string, ActionDef[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  return (
    <section className="av-surface av-modcon">
      <header className="av-flows-head">
        <div>
          <h3>Moderator Console</h3>
          <p>Admin actions — every mutation confirms with a 5-second cancel window and registers in the undo drawer.</p>
        </div>
      </header>

      <div className="av-modcon-grid">
        {Object.entries(CATEGORY_META).map(([cat, meta]) => (
          <div key={cat} className="av-modcon-group">
            <div className="av-modcon-group-head">
              <span className="av-modcon-group-label">{meta.label}</span>
              <span className="av-modcon-group-desc">{meta.description}</span>
            </div>
            <div className="av-modcon-actions">
              {(grouped[cat] ?? []).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`av-modcon-action av-modcon-action--${a.tone}`}
                  onClick={() => setOpenAction(a)}
                  title={a.description}
                >
                  <span className="av-modcon-action-icon" aria-hidden="true">
                    <Icon name={a.icon} size={20} />
                  </span>
                  <span className="av-modcon-action-text">
                    <span className="av-modcon-action-label">{a.label}</span>
                    <span className="av-modcon-action-hint">{a.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {openAction && (
        <ActionDialog
          action={openAction}
          discordId={discordId}
          displayName={displayName}
          current={current}
          onClose={() => setOpenAction(null)}
          onSuccess={onMutated}
          toast={toast}
          undo={undo}
          pending={pending}
        />
      )}
    </section>
  );
}

function ActionDialog({
  action, discordId, displayName, current, onClose, onSuccess, toast, undo, pending,
}: {
  action: ActionDef;
  discordId: string;
  displayName: string;
  current?: Props['current'];
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  toast: ReturnType<typeof useToast>;
  undo: ReturnType<typeof useUndo>;
  pending: ReturnType<typeof usePendingAction>;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleEscape = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useFocusTrap(dialogRef, true, handleEscape);

  const needsAmount = action.form === 'amount+reason';
  const requiresReason = action.form !== 'confirm';

  // Derive the current stat this action affects, for the before→after preview
  const currentValue = action.id === 'credit' || action.id === 'debit' ? current?.balance
    : action.id === 'level'   ? current?.level
    : action.id === 'tickets' ? current?.tickets
    : undefined;
  const statLabel = action.id === 'credit' || action.id === 'debit' ? 'Lunari'
    : action.id === 'level'   ? 'Level'
    : action.id === 'tickets' ? 'Tickets'
    : '';
  const parsed = Number(amount);
  const hasValidAmount = needsAmount && amount !== '' && Number.isFinite(parsed);
  const delta = !hasValidAmount ? 0 : (action.id === 'debit' ? -Math.abs(parsed) : parsed);
  const afterValue = typeof currentValue === 'number' && hasValidAmount ? currentValue + delta : undefined;
  const deltaNeg = delta < 0;

  const submit = async () => {
    const parsedAmount = needsAmount ? Number(amount) : 0;
    if (needsAmount && !Number.isFinite(parsedAmount)) {
      toast.show({ tone: 'error', title: 'Bad amount', message: 'Enter a numeric value.' });
      return;
    }
    if (requiresReason && !reason.trim()) {
      toast.show({ tone: 'error', title: 'Reason required', message: 'Give a short audit-log reason.' });
      return;
    }
    setBusy(true);

    const label = action.label + (needsAmount ? ` (${parsedAmount.toLocaleString()})` : '');
    const dangerous = action.tone === 'danger';

    const ok = await pending.queue({
      label,
      detail: `${displayName} · ${reason || 'no reason'}`,
      delayMs: dangerous ? 6000 : 5000,
      tone: dangerous ? 'danger' : 'default',
      run: async () => {
        try {
          const undoEntry = await executeAction(action, discordId, parsedAmount, reason, displayName);
          if (undoEntry) undo.push(undoEntry);
          toast.show({ tone: 'success', title: 'Applied', message: label });
          await onSuccess();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Failed', message: (e as Error).message });
        }
      },
    });
    setBusy(false);
    if (ok !== false) onClose();
  };

  return createPortal(
    <>
      <div className="av-peek-scrim" onClick={onClose} />
      <div ref={dialogRef} className="av-moddialog" role="dialog" aria-modal="true" aria-label={action.label}>
        <header>
          <div>
            <h3>{action.label}</h3>
            <p>{action.description} <span className="av-moddialog-target">on {displayName}</span></p>
          </div>
          <button type="button" className="av-peek-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="av-moddialog-body">
          {needsAmount && typeof currentValue === 'number' && (
            <div className="av-modpreview">
              <div className="av-modpreview-col">
                <div className="av-modpreview-label">Current {statLabel}</div>
                <div className="av-modpreview-value av-modpreview-value--before">
                  {currentValue.toLocaleString()}
                </div>
              </div>
              <div className={`av-modpreview-arrow${deltaNeg ? ' av-modpreview-arrow--loss' : ' av-modpreview-arrow--gain'}${hasValidAmount ? ' av-modpreview-arrow--active' : ''}`}>
                <span className="av-modpreview-delta">
                  {hasValidAmount ? `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toLocaleString()}` : '—'}
                </span>
                <svg width="56" height="12" viewBox="0 0 56 12" aria-hidden="true">
                  <path d="M2 6 L48 6 M42 2 L50 6 L42 10" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <div className="av-modpreview-col">
                <div className="av-modpreview-label">After</div>
                <div className={`av-modpreview-value av-modpreview-value--after${hasValidAmount ? (deltaNeg ? ' av-modpreview-value--loss' : ' av-modpreview-value--gain') : ''}`}>
                  {typeof afterValue === 'number' ? afterValue.toLocaleString() : currentValue.toLocaleString()}
                </div>
              </div>
            </div>
          )}
          {needsAmount && (
            <label className="av-moddialog-field">
              <span>Amount {action.id === 'debit' ? '(will be subtracted)' : ''}</span>
              <input
                className="av-audit-input"
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </label>
          )}
          {requiresReason && (
            <label className="av-moddialog-field">
              <span>Reason <strong>·</strong> required</span>
              <input
                className="av-audit-input"
                placeholder="Short explanation for audit log"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus={!needsAmount}
              />
            </label>
          )}
          {action.tone === 'danger' && (
            <div className="av-moddialog-warn">
              <strong>Destructive.</strong> This action is reversible via the undo drawer but the audit entry stays.
            </div>
          )}
        </div>
        <footer>
          <button type="button" className="av-btn av-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={`av-btn ${action.tone === 'danger' ? 'av-btn-danger' : 'av-btn-primary'}`}
            onClick={submit}
            disabled={busy}
          >
            {busy ? 'Applying…' : `Queue · ${action.label}`}
          </button>
        </footer>
      </div>
    </>,
    document.body
  );
}

// Returns an undo entry if the action is reversible, else null.
async function executeAction(
  action: ActionDef,
  discordId: string,
  amount: number,
  reason: string,
  displayName: string,
): Promise<Parameters<ReturnType<typeof useUndo>['push']>[0] | null> {
  const base = `/api/admin/users/${discordId}`;
  const label = action.label;
  const detail = `${displayName} · ${reason || 'no reason'}`;

  switch (action.id) {
    case 'credit':
      await apiMutate(`${base}/balance`, 'POST', { amount, reason });
      return { label: `Credit ${amount.toLocaleString()}`, detail, revert: async () => { await apiMutate(`${base}/balance`, 'POST', { amount: -amount, reason: 'undo:' + reason }); } };
    case 'debit':
      await apiMutate(`${base}/balance`, 'POST', { amount: -Math.abs(amount), reason });
      return { label: `Debit ${Math.abs(amount).toLocaleString()}`, detail, revert: async () => { await apiMutate(`${base}/balance`, 'POST', { amount: Math.abs(amount), reason: 'undo:' + reason }); } };
    case 'level':
      await apiMutate(`${base}/level`, 'POST', { amount, reason });
      return { label: `Level ${amount >= 0 ? '+' : ''}${amount}`, detail, revert: async () => { await apiMutate(`${base}/level`, 'POST', { amount: -amount, reason: 'undo:' + reason }); } };
    case 'tickets':
      await apiMutate(`${base}/tickets`, 'POST', { amount, reason });
      return { label: `Tickets ${amount >= 0 ? '+' : ''}${amount}`, detail, revert: async () => { await apiMutate(`${base}/tickets`, 'POST', { amount: -amount, reason: 'undo:' + reason }); } };
    case 'cooldowns':
      await apiMutate(`${base}/cooldowns`, 'DELETE', { reason });
      return null; // not reversible
    case 'passport':
      await apiMutate(`${base}/passport`, 'DELETE', { reason });
      return null; // not trivially reversible
    case 'debt':
      await apiMutate(`${base}/debt`, 'DELETE', { reason });
      return null;
    case 'loans':
      await apiMutate(`${base}/loans`, 'DELETE', { reason });
      return null;
    default:
      throw new Error(`Unknown action: ${action.id}`);
  }
}
