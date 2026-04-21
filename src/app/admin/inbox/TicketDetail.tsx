'use client';

import { useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import { usePeek } from '../_components/PeekProvider';
import { useTimezone } from '../_components/TimezoneProvider';
import type { UnifiedInboxItem } from '@/lib/admin/inbox';

interface Message {
  id: string;
  author: string;
  authorId?: string;
  avatar: string | null;
  isBot: boolean;
  content: string;
  timestamp: string;
  embeds: number;
  attachments: { name: string; url: string }[];
}

interface Props {
  item: UnifiedInboxItem;
  guildId: string;
  onStatusChange: (next: UnifiedInboxItem) => void;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function patchTicket(threadId: string, action: 'close' | 'reopen'): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch(`/api/admin/v2/inbox/ticket/${encodeURIComponent(threadId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

export default function TicketDetail({ item, guildId, onStatusChange }: Props) {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();
  const { openPeek } = usePeek();
  const { fmtRel, absolute } = useTimezone();

  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);

  const threadId = item.threadId ?? '';

  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    setLoadingMsgs(true);
    setMsgError(null);
    fetch(`/api/admin/tickets/messages?threadId=${encodeURIComponent(threadId)}`, { cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          setMsgError(body?.error || `HTTP ${r.status}`);
          setMessages([]);
        } else if (body?.error) {
          setMsgError(body.error);
          setMessages([]);
        } else {
          setMessages(Array.isArray(body?.messages) ? body.messages : []);
        }
      })
      .catch((e) => { if (!cancelled) { setMsgError((e as Error).message); setMessages([]); } })
      .finally(() => { if (!cancelled) setLoadingMsgs(false); });
    return () => { cancelled = true; };
  }, [threadId]);

  const runAction = (action: 'close' | 'reopen') => {
    const before = item;
    const label  = action === 'close' ? `Close ticket #${item.ticketNumber}` : `Reopen ticket #${item.ticketNumber}`;
    const reverseAction: 'close' | 'reopen' = action === 'close' ? 'reopen' : 'close';
    const reverseLabel = action === 'close' ? `Reopen ticket #${item.ticketNumber}` : `Close ticket #${item.ticketNumber}`;

    pending.queue({
      label,
      detail: item.categoryTitle ?? item.categoryId,
      delayMs: 4500,
      tone: action === 'close' ? 'danger' : 'default',
      run: async () => {
        try {
          await patchTicket(threadId, action);
          const nextStatus = action === 'close' ? 'closed' : 'open';
          const patched: UnifiedInboxItem = {
            ...item,
            status: nextStatus as any,
            tone: nextStatus === 'closed' ? 'muted' : 'cyan',
            updatedAt: new Date().toISOString(),
            closedBy: action === 'close' ? 'me' : undefined,
          };
          onStatusChange(patched);
          toast.show({ tone: 'success', title: action === 'close' ? 'Closed' : 'Reopened', message: `#${item.ticketNumber}` });
          undo.push({
            label: reverseLabel,
            detail: item.categoryTitle ?? item.categoryId,
            revert: async () => {
              await patchTicket(threadId, reverseAction);
              onStatusChange(before);
              toast.show({ tone: 'success', title: 'Reverted', message: `#${item.ticketNumber}` });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: `${action === 'close' ? 'Close' : 'Reopen'} failed`, message: (e as Error).message });
        }
      },
    });
  };

  return (
    <div className="av-inbox-detail">
      <header className="av-inbox-detail-head">
        <div className="av-inbox-detail-head-left">
          <span className="av-inbox-kind-icon" data-kind="ticket" aria-hidden="true">✉</span>
          <div>
            <h3 className="av-inbox-detail-title">
              #{item.ticketNumber} · {item.categoryTitle ?? item.categoryId}
            </h3>
            <div className="av-inbox-detail-sub">
              <span className="av-inbox-status-badge" data-tone={item.tone}>{item.status}</span>
              <span className="av-inbox-detail-by">
                by <button type="button" className="av-inbox-userlink" onClick={() => openPeek(item.userId)}>
                  {item.userName ?? item.userId}
                </button>
                <span title={absolute(item.createdAt)}> · opened {fmtRel(item.createdAt)}</span>
                {item.closedBy && item.updatedAt && (
                  <span title={absolute(item.updatedAt)}> · closed {fmtRel(item.updatedAt)}</span>
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="av-inbox-detail-actions">
          {item.status === 'open' ? (
            <button type="button" className="av-btn av-btn-primary av-btn-danger" onClick={() => runAction('close')}>
              Close ticket
            </button>
          ) : (
            <button type="button" className="av-btn av-btn-primary" onClick={() => runAction('reopen')}>
              Reopen ticket
            </button>
          )}
          <a
            className="av-btn av-btn-ghost"
            href={`https://discord.com/channels/${guildId}/${threadId}`}
            target="_blank"
            rel="noreferrer"
            title="Open Discord thread"
          >Open in Discord ↗</a>
        </div>
      </header>

      <section className="av-inbox-transcript">
        {loadingMsgs && (
          <div className="av-inbox-transcript-loading">Loading conversation…</div>
        )}
        {!loadingMsgs && msgError && (
          <div className="av-inbox-transcript-empty">
            <strong>Transcript unavailable.</strong> {msgError}
          </div>
        )}
        {!loadingMsgs && !msgError && messages && messages.length === 0 && (
          <div className="av-inbox-transcript-empty">No messages yet.</div>
        )}
        {!loadingMsgs && messages && messages.length > 0 && (
          <div className="av-inbox-transcript-list">
            {messages.map((m) => (
              <div key={m.id} className={`av-inbox-bubble${m.isBot ? ' av-inbox-bubble--bot' : ''}`}>
                <div className="av-inbox-bubble-avatar">
                  {m.avatar
                    ? <img src={m.avatar} alt="" />
                    : <span>{(m.author || '?').slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="av-inbox-bubble-body">
                  <div className="av-inbox-bubble-head">
                    <strong className="av-inbox-bubble-author">{m.author}</strong>
                    <span className="av-inbox-bubble-time" title={absolute(m.timestamp)}>{fmtRel(m.timestamp)}</span>
                  </div>
                  {m.content && <div className="av-inbox-bubble-content">{m.content}</div>}
                  {m.embeds > 0 && (
                    <div className="av-inbox-bubble-meta">· {m.embeds} embed{m.embeds === 1 ? '' : 's'}</div>
                  )}
                  {m.attachments.length > 0 && (
                    <div className="av-inbox-bubble-atts">
                      {m.attachments.map((a) => (
                        <a key={a.url} href={a.url} target="_blank" rel="noreferrer">{a.name}</a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
