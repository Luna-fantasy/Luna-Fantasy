'use client';

import { useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import { usePeek } from '../_components/PeekProvider';
import { useTimezone } from '../_components/TimezoneProvider';
import type { UnifiedInboxItem } from '@/lib/admin/inbox';

interface Props {
  item: UnifiedInboxItem;
  votesRequired: number;
  adminId: string;
  onStatusChange: (next: UnifiedInboxItem) => void;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

type Action = 'like' | 'dislike' | 'clear_vote' | 'accept' | 'reject';

interface PatchBody { action: Action; reason?: string; reopen?: boolean }

async function patchApp(appId: string, body: PatchBody): Promise<any> {
  const token = await fetchCsrf();
  const res = await fetch(`/api/admin/v2/inbox/application/${encodeURIComponent(appId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export default function ApplicationDetail({ item, votesRequired, adminId, onStatusChange }: Props) {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();
  const { openPeek } = usePeek();
  const { fmtRel, absolute } = useTimezone();

  const likes = item.votes?.likes ?? [];
  const dislikes = item.votes?.dislikes ?? [];
  const myVote: 'like' | 'dislike' | null = likes.includes(adminId) ? 'like' : dislikes.includes(adminId) ? 'dislike' : null;
  const ringPct = Math.min(100, Math.round((likes.length / Math.max(1, votesRequired)) * 100));

  const [rejectMode, setRejectMode] = useState(false);
  const [acceptMode, setAcceptMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [acceptReason, setAcceptReason] = useState('');

  const applyResponse = (data: any) => {
    const next: UnifiedInboxItem = {
      ...item,
      status: data.status ?? item.status,
      tone: data.status === 'accepted' ? 'green' : data.status === 'rejected' ? 'red' : 'gold',
      votes: data.votes ?? item.votes,
      acceptedBy: data.acceptedBy ?? (data.status === 'accepted' ? adminId : undefined),
      rejectedBy: data.rejectedBy ?? (data.status === 'rejected' ? adminId : undefined),
      rejectionReason: data.rejectionReason ?? item.rejectionReason,
      updatedAt: data.acceptedAt ?? data.rejectedAt ?? new Date().toISOString(),
    };
    onStatusChange(next);
    return next;
  };

  const runVote = (action: 'like' | 'dislike' | 'clear_vote') => {
    const before = item;
    const nextLabel = action === 'clear_vote' ? 'Clear vote'
                    : action === 'like'       ? 'Liked'
                                              : 'Disliked';

    pending.queue({
      label: `${nextLabel} · ${item.categoryTitle ?? item.categoryId}`,
      detail: `by ${item.userName ?? item.userId}`,
      delayMs: 4500,
      run: async () => {
        try {
          const data = await patchApp(item.appId!, { action });
          applyResponse(data);
          toast.show({ tone: 'success', title: nextLabel, message: item.userName ?? item.userId });
          undo.push({
            label: `Undo ${nextLabel.toLowerCase()}`,
            detail: item.userName ?? item.userId,
            revert: async () => {
              // Re-derive revert action from the previous vote
              const prior = likes.includes(adminId) ? 'like' : dislikes.includes(adminId) ? 'dislike' : 'clear_vote';
              const data2 = await patchApp(item.appId!, { action: prior as Action });
              applyResponse(data2);
              onStatusChange(before);
              toast.show({ tone: 'success', title: 'Reverted', message: item.appId! });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Vote failed', message: (e as Error).message });
        }
      },
    });
  };

  const runAccept = () => {
    const before = item;
    const reason = acceptReason.trim();
    pending.queue({
      label: `Accept · ${item.userName ?? item.userId}`,
      detail: item.categoryTitle ?? item.categoryId,
      delayMs: 5000,
      run: async () => {
        try {
          const data = await patchApp(item.appId!, { action: 'accept', reason });
          applyResponse(data);
          toast.show({ tone: 'success', title: 'Accepted', message: item.userName ?? item.userId });
          undo.push({
            label: `Reopen application`,
            detail: item.userName ?? item.userId,
            revert: async () => {
              const data2 = await patchApp(item.appId!, { action: 'accept', reopen: true });
              applyResponse(data2);
              onStatusChange(before);
              toast.show({ tone: 'success', title: 'Reopened', message: item.appId! });
            },
          });
          setAcceptMode(false);
          setAcceptReason('');
        } catch (e) {
          toast.show({ tone: 'error', title: 'Accept failed', message: (e as Error).message });
        }
      },
    });
  };

  const runReject = () => {
    const reason = rejectReason.trim();
    if (reason.length < 4) {
      toast.show({ tone: 'warn', title: 'Reason required', message: 'Rejection needs a reason (min 4 characters).' });
      return;
    }
    const before = item;
    pending.queue({
      label: `Reject · ${item.userName ?? item.userId}`,
      detail: reason,
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        try {
          const data = await patchApp(item.appId!, { action: 'reject', reason });
          applyResponse(data);
          toast.show({ tone: 'success', title: 'Rejected', message: item.userName ?? item.userId });
          undo.push({
            label: `Reopen application`,
            detail: item.userName ?? item.userId,
            revert: async () => {
              const data2 = await patchApp(item.appId!, { action: 'accept', reopen: true });
              applyResponse(data2);
              onStatusChange(before);
              toast.show({ tone: 'success', title: 'Reopened', message: item.appId! });
            },
          });
          setRejectMode(false);
          setRejectReason('');
        } catch (e) {
          toast.show({ tone: 'error', title: 'Reject failed', message: (e as Error).message });
        }
      },
    });
  };

  const runReopen = () => {
    const before = item;
    pending.queue({
      label: `Reopen · ${item.userName ?? item.userId}`,
      detail: item.categoryTitle ?? item.categoryId,
      delayMs: 4500,
      run: async () => {
        try {
          const data = await patchApp(item.appId!, { action: 'accept', reopen: true });
          applyResponse(data);
          toast.show({ tone: 'success', title: 'Reopened', message: item.userName ?? item.userId });
          undo.push({
            label: `Restore previous decision`,
            detail: item.userName ?? item.userId,
            revert: async () => {
              onStatusChange(before);
              if (before.status === 'accepted') {
                await patchApp(item.appId!, { action: 'accept' });
              } else if (before.status === 'rejected') {
                await patchApp(item.appId!, { action: 'reject', reason: before.rejectionReason ?? 'Restored' });
              }
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Reopen failed', message: (e as Error).message });
        }
      },
    });
  };

  const answers = item.answers ?? {};
  const answerEntries = Object.entries(answers);
  const decided = item.status === 'accepted' || item.status === 'rejected';

  return (
    <div className="av-inbox-detail">
      <header className="av-inbox-detail-head">
        <div className="av-inbox-detail-head-left">
          <span className="av-inbox-kind-icon" data-kind="application" aria-hidden="true">◈</span>
          <div>
            <h3 className="av-inbox-detail-title">
              {item.categoryTitle ?? item.categoryId}
            </h3>
            <div className="av-inbox-detail-sub">
              <span className="av-inbox-status-badge" data-tone={item.tone}>{item.status}</span>
              <span className="av-inbox-detail-by">
                by <button type="button" className="av-inbox-userlink" onClick={() => openPeek(item.userId)}>
                  {item.userName ?? item.userId}
                </button>
                <span title={absolute(item.createdAt)}> · submitted {fmtRel(item.createdAt)}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="av-inbox-vote-wrap">
          <div
            className="av-inbox-vote-ring"
            style={{ ['--ring-fill' as any]: `${ringPct}%` }}
            title={`${likes.length} of ${votesRequired} required likes`}
          >
            <span>{likes.length}<small>/{votesRequired}</small></span>
          </div>
        </div>
      </header>

      {answerEntries.length > 0 && (
        <section className="av-inbox-answers">
          {answerEntries.map(([label, value]) => (
            <div key={label} className="av-inbox-answer">
              <label className="av-inbox-answer-label">{label}</label>
              <div className="av-inbox-answer-value">{String(value ?? '') || <em>(empty)</em>}</div>
            </div>
          ))}
        </section>
      )}

      {!decided && (
        <section className="av-inbox-vote-btns">
          <button
            type="button"
            className={`av-inbox-vote-btn av-inbox-vote-btn--like${myVote === 'like' ? ' av-inbox-vote-btn--mine' : ''}`}
            onClick={() => runVote(myVote === 'like' ? 'clear_vote' : 'like')}
            aria-pressed={myVote === 'like'}
          >
            <span aria-hidden="true">👍</span>
            <span className="av-inbox-vote-count">{likes.length}</span>
            <span className="av-inbox-vote-label">{myVote === 'like' ? 'You liked' : 'Like'}</span>
          </button>
          <button
            type="button"
            className={`av-inbox-vote-btn av-inbox-vote-btn--dislike${myVote === 'dislike' ? ' av-inbox-vote-btn--mine' : ''}`}
            onClick={() => runVote(myVote === 'dislike' ? 'clear_vote' : 'dislike')}
            aria-pressed={myVote === 'dislike'}
          >
            <span aria-hidden="true">👎</span>
            <span className="av-inbox-vote-count">{dislikes.length}</span>
            <span className="av-inbox-vote-label">{myVote === 'dislike' ? 'You disliked' : 'Dislike'}</span>
          </button>
        </section>
      )}

      {!decided && (
        <section className="av-inbox-decision-bar">
          {acceptMode ? (
            <div className="av-inbox-reason-editor">
              <label className="av-inbox-reason-label">
                Optional note (sent with the acceptance)
              </label>
              <textarea
                className="av-inbox-reason-input"
                value={acceptReason}
                onChange={(e) => setAcceptReason(e.target.value.slice(0, 500))}
                placeholder="e.g. Welcome to the Knights — report to the Sentinel channel."
                rows={3}
              />
              <div className="av-inbox-reason-actions">
                <button type="button" className="av-btn av-btn-ghost" onClick={() => { setAcceptMode(false); setAcceptReason(''); }}>Cancel</button>
                <button type="button" className="av-btn av-btn-primary" onClick={runAccept}>Accept</button>
              </div>
            </div>
          ) : rejectMode ? (
            <div className="av-inbox-reason-editor">
              <label className="av-inbox-reason-label">
                Rejection reason (required — min 4 chars)
              </label>
              <textarea
                className="av-inbox-reason-input"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value.slice(0, 500))}
                placeholder="e.g. Application was incomplete — please resubmit with full answers."
                rows={3}
                autoFocus
              />
              <div className="av-inbox-reason-actions">
                <span className="av-inbox-reason-count">{rejectReason.length}/500</span>
                <button type="button" className="av-btn av-btn-ghost" onClick={() => { setRejectMode(false); setRejectReason(''); }}>Cancel</button>
                <button
                  type="button"
                  className="av-btn av-btn-primary av-btn-danger"
                  onClick={runReject}
                  disabled={rejectReason.trim().length < 4}
                >Reject</button>
              </div>
            </div>
          ) : (
            <div className="av-inbox-decision-actions">
              <button type="button" className="av-btn av-btn-primary" onClick={() => setAcceptMode(true)}>Accept</button>
              <button type="button" className="av-btn av-btn-primary av-btn-danger" onClick={() => setRejectMode(true)}>Reject</button>
            </div>
          )}
        </section>
      )}

      {decided && (
        <section className={`av-inbox-decision av-inbox-decision--${item.status}`}>
          <div className="av-inbox-decision-head">
            <strong>{item.status === 'accepted' ? 'Accepted' : 'Rejected'}</strong>
            <span className="av-inbox-decision-time" title={item.updatedAt ? absolute(item.updatedAt) : undefined}>
              {item.updatedAt ? fmtRel(item.updatedAt) : ''}
            </span>
            <span className="av-inbox-decision-by">
              by {(item.acceptedBy ?? item.rejectedBy) ?? '—'}
            </span>
          </div>
          {item.rejectionReason && (
            <p className="av-inbox-decision-reason">{item.rejectionReason}</p>
          )}
          <div className="av-inbox-decision-actions">
            <button type="button" className="av-btn av-btn-ghost" onClick={runReopen}>Reopen as pending</button>
          </div>
        </section>
      )}
    </div>
  );
}
