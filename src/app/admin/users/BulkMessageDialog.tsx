'use client';

import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../_components/a11y';

interface Props {
  count: number;
  onSend: (message: string) => Promise<void> | void;
  onClose: () => void;
}

export default function BulkMessageDialog({ count, onSend, onClose }: Props) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleEscape = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useFocusTrap(dialogRef, true, handleEscape);

  const submit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 2 || trimmed.length > 2000) return;
    setBusy(true);
    try {
      await onSend(trimmed);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <>
      <div className="av-peek-scrim" onClick={busy ? undefined : onClose} />
      <div ref={dialogRef} className="av-moddialog" role="dialog" aria-modal="true" aria-label="Bulk message">
        <header>
          <div>
            <h3>Message {count} {count === 1 ? 'user' : 'users'}</h3>
            <p>The bot will DM each selected user. Delivery is queued — heavy batches take a few seconds per user.</p>
          </div>
          <button type="button" className="av-peek-close" onClick={onClose} aria-label="Close" disabled={busy}>×</button>
        </header>
        <div className="av-moddialog-body">
          <label className="av-moddialog-field">
            <span>Message</span>
            <textarea
              className="av-shopf-input"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hello from Luna admin…"
              maxLength={2000}
              data-autofocus
            />
            <span className="av-moddialog-hint">{message.length} / 2000</span>
          </label>
        </div>
        <footer>
          <button type="button" className="av-btn av-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="av-btn av-btn-primary" onClick={submit} disabled={busy || message.trim().length < 2}>
            {busy ? 'Queueing…' : `Queue · ${count}`}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
