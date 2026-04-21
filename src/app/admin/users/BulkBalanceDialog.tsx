'use client';

import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../_components/a11y';

interface Props {
  count: number;
  onApply: (amount: number, reason: string) => Promise<void> | void;
  onClose: () => void;
}

const MAX_AMOUNT = 10_000_000;

export default function BulkBalanceDialog({ count, onApply, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleEscape = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useFocusTrap(dialogRef, true, handleEscape);

  const parsed = Number(amount);
  const validAmount = Number.isFinite(parsed) && parsed !== 0 && Math.abs(parsed) <= MAX_AMOUNT;
  const validReason = reason.trim().length >= 3 && reason.trim().length <= 500;

  const submit = async () => {
    if (!validAmount || !validReason) return;
    setBusy(true);
    try {
      await onApply(parsed, reason.trim());
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <>
      <div className="av-peek-scrim" onClick={busy ? undefined : onClose} />
      <div ref={dialogRef} className="av-moddialog" role="dialog" aria-modal="true" aria-label="Bulk adjust balance">
        <header>
          <div>
            <h3>Adjust {count} {count === 1 ? 'balance' : 'balances'}</h3>
            <p>Applies the same amount to every selected user. Positive credits, negative debits. Each change logs to the audit trail.</p>
          </div>
          <button type="button" className="av-peek-close" onClick={onClose} aria-label="Close" disabled={busy}>×</button>
        </header>
        <div className="av-moddialog-body">
          <label className="av-moddialog-field">
            <span>Amount (Lunari)</span>
            <input
              className="av-shopf-input"
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1000 or -500"
              data-autofocus
            />
            <span className="av-moddialog-hint">
              Max ±{MAX_AMOUNT.toLocaleString()} Lunari per user.
            </span>
          </label>
          <label className="av-moddialog-field">
            <span>Reason (audit log)</span>
            <input
              className="av-shopf-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Event prize payout"
              maxLength={500}
            />
            <span className="av-moddialog-hint">{reason.length} / 500 · minimum 3 chars</span>
          </label>
        </div>
        <footer>
          <button type="button" className="av-btn av-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={`av-btn ${parsed < 0 ? 'av-btn-danger' : 'av-btn-primary'}`}
            onClick={submit}
            disabled={busy || !validAmount || !validReason}
          >
            {busy ? 'Applying…' : `${parsed < 0 ? 'Debit' : 'Credit'} · ${count}`}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
