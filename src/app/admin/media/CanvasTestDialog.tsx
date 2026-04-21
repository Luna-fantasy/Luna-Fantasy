'use client';

import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../_components/Toast';
import { useFocusTrap } from '../_components/a11y';

interface Props {
  bot: 'butler' | 'jester';
  canvasType: string;
  canvasLabel: string;
  trialBackgroundUrl?: string | null;
  onClose: () => void;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

export default function CanvasTestDialog({ bot, canvasType, canvasLabel, trialBackgroundUrl, onClose }: Props) {
  const toast = useToast();
  const [channelId, setChannelId] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'info' | 'ok' | 'err'; text: string; href?: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleEscape = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useFocusTrap(dialogRef, true, handleEscape);

  const run = async () => {
    if (!/^\d{17,20}$/.test(channelId.trim())) {
      toast.show({ tone: 'warn', title: 'Channel ID', message: 'Paste a numeric Discord channel ID.' });
      return;
    }
    setBusy(true);
    setStatus({ tone: 'info', text: 'Asking the bot to render…' });
    try {
      const token = await fetchCsrf();
      const res = await fetch('/api/admin/canvas/test-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        credentials: 'include',
        body: JSON.stringify({
          bot,
          canvasType,
          channelId: channelId.trim(),
          ...(trialBackgroundUrl ? { trialBackgroundUrl } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ tone: 'err', text: body?.error || `HTTP ${res.status}` });
        return;
      }
      setStatus({ tone: 'ok', text: 'Rendered — posted in Discord.', href: body?.messageUrl });
    } catch (e) {
      setStatus({ tone: 'err', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <>
      <div className="av-peek-scrim" onClick={busy ? undefined : onClose} />
      <div ref={dialogRef} className="av-itemdialog av-media-test-dialog" role="dialog" aria-modal="true" aria-label="Test render in Discord">
        <header className="av-itemdialog-head">
          <div>
            <h3>Test render · {canvasLabel}</h3>
            <p>The bot renders the current layout + colours and posts the PNG to the channel you pick.</p>
          </div>
          <button type="button" className="av-peek-close" onClick={onClose} disabled={busy}>×</button>
        </header>
        <div className="av-itemdialog-body">
          {trialBackgroundUrl && (
            <div className="av-canvas-trial-notice">
              <strong>Using trial background</strong>
              <span>The bot will render with your uploaded trial image — the official background stays unchanged until you save.</span>
            </div>
          )}
          <label className="av-shopf-field">
            <span>Discord channel ID</span>
            <input
              className="av-shopf-input av-shopf-input--mono"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 1418437086985453598"
              inputMode="numeric"
            />
          </label>

          {status && (
            <div className={`av-media-test-status av-media-test-status--${status.tone}`}>
              {status.text}
              {status.href && (
                <> · <a href={status.href} target="_blank" rel="noreferrer">Open message ↗</a></>
              )}
            </div>
          )}
        </div>
        <footer className="av-itemdialog-foot">
          <button type="button" className="av-btn av-btn-ghost" onClick={onClose} disabled={busy}>Close</button>
          <button type="button" className="av-btn av-btn-primary" onClick={run} disabled={busy || !channelId.trim()}>
            {busy ? 'Waiting…' : 'Render & post'}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
