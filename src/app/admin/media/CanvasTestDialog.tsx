'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../_components/Toast';
import { useFocusTrap } from '../_components/a11y';

interface Props {
  bot: 'butler' | 'jester';
  canvasType: string;
  canvasLabel: string;
  trialBackgroundUrl?: string | null;
  /** The current draft layout from the editor — sent to the bot so the test
      render reflects unsaved x/y/width/height/colors edits without saving. */
  layoutOverride?: Record<string, any> | null;
  onClose: () => void;
}

interface DiscordChannel {
  id: string;
  name: string;
  parentName: string;
  position: number;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

export default function CanvasTestDialog({ bot, canvasType, canvasLabel, trialBackgroundUrl, layoutOverride, onClose }: Props) {
  const toast = useToast();
  const [channelId, setChannelId] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'info' | 'ok' | 'err'; text: string; href?: string } | null>(null);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleEscape = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useFocusTrap(dialogRef, true, handleEscape);

  // Load the bot's accessible text channels so the user can pick from a
  // dropdown rather than copy-pasting raw IDs from Discord.
  useEffect(() => {
    let cancelled = false;
    setChannelsLoading(true);
    setChannelsError(null);
    fetch(`/api/admin/announce?botId=${bot}`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.json().then(d => ({ ok: r.ok, status: r.status, data: d })))
      .then(({ ok, status: s, data }) => {
        if (cancelled) return;
        if (!ok) {
          setChannelsError(data?.error || `Failed to load channels (${s})`);
          setChannels([]);
          return;
        }
        setChannels(Array.isArray(data?.channels) ? data.channels : []);
      })
      .catch(e => {
        if (cancelled) return;
        setChannelsError(e?.message || 'Failed to load channels');
      })
      .finally(() => {
        if (!cancelled) setChannelsLoading(false);
      });
    return () => { cancelled = true; };
  }, [bot]);

  // Group channels by category for the dropdown <optgroup>s.
  const grouped = useMemo(() => {
    const map: Record<string, DiscordChannel[]> = {};
    for (const c of channels) {
      const key = c.parentName || 'No Category';
      (map[key] ??= []).push(c);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a: DiscordChannel, b: DiscordChannel) => a.position - b.position);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [channels]);

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
          ...(layoutOverride ? { layoutOverride } : {}),
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
      <div className="av-peek-scrim av-peek-scrim--strong" onClick={busy ? undefined : onClose} />
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
            <span>Discord channel</span>
            {channelsLoading ? (
              <div className="av-canvas-channel-loading">Loading channels…</div>
            ) : channelsError ? (
              <>
                <div className="av-canvas-channel-error">{channelsError}</div>
                <input
                  className="av-shopf-input av-shopf-input--mono"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="…or paste a channel ID"
                  inputMode="numeric"
                />
              </>
            ) : (
              <select
                className="av-shopf-input"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
              >
                <option value="">— pick a channel —</option>
                {grouped.map(([category, list]) => (
                  <optgroup key={category} label={category}>
                    {list.map(c => (
                      <option key={c.id} value={c.id}>#{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
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
