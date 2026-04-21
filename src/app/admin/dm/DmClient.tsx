'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { usePeek } from '../_components/PeekProvider';

type DmType = 'content' | 'embed';
type BotId = 'butler' | 'jester' | 'sage' | 'oracle';

const BOT_LABELS: Record<BotId, string> = {
  butler: 'Luna Butler',
  jester: 'Luna Jester',
  sage:   'Luna Sage',
  oracle: 'Luna Oracle',
};

interface QueuedDm {
  _id: string;
  targetUserId: string;
  targetUsername?: string;
  targetAvatar?: string;
  bot?: BotId;
  type: DmType;
  content?: string;
  embed?: { title?: string; description?: string; color?: number; footer?: string };
  createdBy: string;
  createdByUsername?: string;
  createdAt: string;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  sentAt?: string;
  error?: string;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export default function DmClient() {
  const toast = useToast();
  const pending = usePendingAction();
  const { openPeek } = usePeek();

  const [targetUserId, setTargetUserId] = useState('');
  const [bot, setBot] = useState<BotId>('butler');
  const [type, setType] = useState<DmType>('content');
  const [content, setContent] = useState('');
  const [embedTitle, setEmbedTitle] = useState('');
  const [embedDesc, setEmbedDesc] = useState('');
  const [embedFooter, setEmbedFooter] = useState('');
  const [embedColor, setEmbedColor] = useState('#48D8FF');
  const [sending, setSending] = useState(false);

  const [dms, setDms] = useState<QueuedDm[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({ pending: 0, processing: 0, sent: 0, failed: 0 });
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all');

  const load = useCallback(async () => {
    try {
      const qs = filter !== 'all' ? `?status=${filter}` : '';
      const res = await fetch(`/api/admin/dm${qs}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setDms(body.dms ?? []);
      setStats(body.stats ?? {});
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    }
  }, [filter, toast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const canSend = (() => {
    if (!/^\d{17,20}$/.test(targetUserId)) return false;
    if (type === 'content') return content.trim().length > 0 && content.length <= 2000;
    return (embedTitle.trim().length > 0 || embedDesc.trim().length > 0);
  })();

  const clear = () => {
    setTargetUserId(''); setContent('');
    setEmbedTitle(''); setEmbedDesc(''); setEmbedFooter('');
  };

  const send = () => {
    if (!canSend) return;
    const colorInt = parseInt(embedColor.replace('#', ''), 16);
    const body = type === 'content'
      ? { targetUserId, bot, type, content }
      : {
          targetUserId, bot, type,
          content: content || undefined,
          embed: {
            title: embedTitle,
            description: embedDesc,
            color: Number.isFinite(colorInt) ? colorInt : 0x48D8FF,
            footer: embedFooter || undefined,
          },
        };

    const botLabel = BOT_LABELS[bot];
    pending.queue({
      label: `DM ${targetUserId} via ${botLabel}`,
      detail: `${botLabel} will deliver within 30s`,
      delayMs: 4500,
      run: async () => {
        setSending(true);
        try {
          const token = await fetchCsrf();
          const res = await fetch('/api/admin/dm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
            credentials: 'include',
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
          toast.show({ tone: 'success', title: 'Queued', message: `${botLabel} will deliver shortly` });
          clear();
          void load();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Queue failed', message: (e as Error).message });
        } finally {
          setSending(false);
        }
      },
    });
  };

  return (
    <div className="av-dm-page">
      <div className="av-voice-stat-summary">
        <div><strong>{stats.pending ?? 0}</strong><span>Pending</span></div>
        <div><strong>{stats.processing ?? 0}</strong><span>Processing</span></div>
        <div><strong>{stats.sent ?? 0}</strong><span>Delivered</span></div>
        <div><strong>{stats.failed ?? 0}</strong><span>Failed</span></div>
      </div>

      <div className="av-dm-layout">
        <article className="av-surface av-dm-composer">
          <header className="av-flows-head">
            <div>
              <h3>Compose</h3>
              <p>The selected bot delivers this DM to the target user. Text or embed.</p>
            </div>
          </header>

          <div className="av-notifications-fields">
            <div>
              <label className="av-games-field-label">Send as</label>
              <p className="av-games-field-help">
                The recipient sees this DM from the chosen bot's identity. Only Butler currently has
                a delivery poller — other bots queue their docs but won't deliver until their poller
                ships (see BOT_CHANGES.md §9).
              </p>
              <div className="av-announce-bots">
                {(['butler', 'jester', 'sage', 'oracle'] as BotId[]).map((id) => {
                  const active = bot === id;
                  const isReady = id === 'butler';
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`av-announce-bot${active ? ' av-announce-bot--active' : ''}${!isReady ? ' av-announce-bot--disabled' : ''}`}
                      aria-pressed={active}
                      disabled={!isReady}
                      onClick={() => isReady && setBot(id)}
                      title={isReady ? `Send as ${BOT_LABELS[id]}` : `${BOT_LABELS[id]} has no DM delivery poller yet — can't send from this identity`}
                    >
                      <span className="av-announce-bot-name">{BOT_LABELS[id]}</span>
                      {!isReady && <span className="av-announce-bot-warn">no poller</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="av-games-field-label">Target Discord ID</label>
              <input
                type="text"
                className="av-shopf-input av-shopf-input--mono"
                placeholder="e.g. 155442713808994307"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
              />
            </div>

            <div>
              <label className="av-games-field-label">Message type</label>
              <div className="av-inbox-chipset">
                <button type="button" className={`av-inbox-chip${type === 'content' ? ' av-inbox-chip--active' : ''}`} onClick={() => setType('content')}>Plain text</button>
                <button type="button" className={`av-inbox-chip${type === 'embed' ? ' av-inbox-chip--active' : ''}`} onClick={() => setType('embed')}>Embed</button>
              </div>
            </div>

            {type === 'content' && (
              <div>
                <label className="av-games-field-label">Message <span className="av-text-muted">({content.length}/2000)</span></label>
                <textarea
                  className="av-shopf-input"
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, 2000))}
                  placeholder="What do you want to tell them?"
                />
              </div>
            )}

            {type === 'embed' && (
              <>
                <div>
                  <label className="av-games-field-label">Embed title</label>
                  <input type="text" className="av-shopf-input" value={embedTitle} onChange={(e) => setEmbedTitle(e.target.value.slice(0, 256))} />
                </div>
                <div>
                  <label className="av-games-field-label">Embed description</label>
                  <textarea className="av-shopf-input" rows={4} value={embedDesc} onChange={(e) => setEmbedDesc(e.target.value.slice(0, 4000))} />
                </div>
                <div className="av-leveling-grid">
                  <div>
                    <label className="av-games-field-label">Footer</label>
                    <input type="text" className="av-shopf-input" value={embedFooter} onChange={(e) => setEmbedFooter(e.target.value.slice(0, 2048))} />
                  </div>
                  <div>
                    <label className="av-games-field-label">Color</label>
                    <input type="color" className="av-shopf-input av-dm-color" value={embedColor} onChange={(e) => setEmbedColor(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="av-games-field-label">Extra message above embed (optional)</label>
                  <input type="text" className="av-shopf-input" value={content} onChange={(e) => setContent(e.target.value.slice(0, 2000))} />
                </div>
              </>
            )}

            <div className="av-dm-actions">
              <button type="button" className="av-btn av-btn-ghost" onClick={clear} disabled={sending}>Clear</button>
              <button type="button" className="av-btn av-btn-primary" onClick={send} disabled={!canSend || sending}>
                {sending ? 'Queuing…' : 'Send DM'}
              </button>
            </div>
          </div>
        </article>

        <article className="av-surface av-dm-preview">
          <header className="av-flows-head">
            <div>
              <h3>Discord preview</h3>
              <p>How the DM will render in Butler's direct message.</p>
            </div>
          </header>
          <div className="av-notifications-preview-box">
            {content && type === 'content' && (
              <div className="av-notifications-discord-content">{content}</div>
            )}
            {type === 'embed' && content && (
              <div className="av-notifications-discord-content" style={{ marginBottom: 8 }}>{content}</div>
            )}
            {type === 'embed' && (embedTitle || embedDesc) && (
              <div className="av-notifications-embed" style={{ borderLeftColor: embedColor }}>
                {embedTitle && <div className="av-notifications-embed-title">{embedTitle}</div>}
                {embedDesc && <div className="av-notifications-embed-description">{embedDesc}</div>}
                {embedFooter && <div className="av-notifications-embed-footer">{embedFooter}</div>}
              </div>
            )}
            {!content && type === 'content' && <div className="av-text-muted">Type a message to preview…</div>}
            {type === 'embed' && !embedTitle && !embedDesc && !content && <div className="av-text-muted">Add an embed title or description…</div>}
          </div>
        </article>
      </div>

      <article className="av-surface">
        <header className="av-flows-head">
          <div>
            <h3>Queue history</h3>
            <p>Recently-queued DMs across all admins. Auto-refreshes every 15 seconds.</p>
          </div>
          <div className="av-inbox-chipset" role="tablist">
            {(['all', 'pending', 'sent', 'failed'] as const).map((f) => (
              <button key={f} type="button" className={`av-inbox-chip${filter === f ? ' av-inbox-chip--active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </header>

        {dms.length === 0 && <div className="av-commands-empty">No DMs in queue.</div>}

        <div className="av-dm-list">
          {dms.map((dm) => (
            <div key={dm._id} className={`av-dm-row av-dm-row--${dm.status}`}>
              <div className="av-dm-row-status">
                <span className={`av-dm-badge av-dm-badge--${dm.status}`}>{dm.status}</span>
                <span className="av-text-muted">{relativeTime(dm.createdAt)}</span>
              </div>
              <div className="av-dm-row-target">
                <button type="button" className="av-inbox-userlink" onClick={() => openPeek(dm.targetUserId)}>
                  {dm.targetAvatar && <img src={`https://cdn.discordapp.com/avatars/${dm.targetUserId}/${dm.targetAvatar}.png?size=32`} alt="" width={20} height={20} style={{ borderRadius: '50%', marginRight: 6 }} />}
                  {dm.targetUsername || dm.targetUserId}
                </button>
                <span className="av-text-muted" style={{ fontSize: 'var(--av-text-xs)' }}>
                  by {dm.createdByUsername || dm.createdBy}
                </span>
              </div>
              <div className="av-dm-row-content">
                {dm.type === 'embed' && dm.embed?.title && <strong>{dm.embed.title}</strong>}
                <div>{dm.type === 'embed' ? (dm.embed?.description || dm.content || '—') : dm.content}</div>
                {dm.status === 'failed' && dm.error && <div className="av-text-loss av-dm-error">Error: {dm.error}</div>}
              </div>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
