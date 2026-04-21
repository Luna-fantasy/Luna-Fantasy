'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { usePeek } from '../_components/PeekProvider';
import { useTimezone } from '../_components/TimezoneProvider';
import type { Challenge, ChallengeAction } from './types';

interface Props {
  challenge: Challenge;
  onAfterAction: () => void;
  onCreateClicked: () => void;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function putAction(challengeId: string, action: ChallengeAction, extra: Record<string, any> = {}): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/challenges', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ action, challengeId, ...extra }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

function formatRemaining(totalMs: number): { label: string; danger: boolean } {
  if (totalMs <= 0) return { label: 'Expired', danger: true };
  const h = Math.floor(totalMs / 3600_000);
  const m = Math.floor((totalMs % 3600_000) / 60_000);
  const danger = totalMs < 3600_000; // under 1h
  if (h > 24) return { label: `${Math.floor(h / 24)}d ${h % 24}h left`, danger };
  if (h >= 1) return { label: `${h}h ${m}m left`, danger };
  return { label: `${m}m left`, danger: true };
}

export function NoActiveHero({ onCreateClicked }: { onCreateClicked: () => void }) {
  return (
    <section className="av-surface av-challenges-hero av-challenges-hero--empty">
      <div className="av-challenges-hero-cover av-challenges-hero-cover--empty">✦</div>
      <div>
        <h3 className="av-challenges-hero-title">No active challenge</h3>
        <p className="av-challenges-hero-desc">The hall is quiet. Launch one to light the banners, pull submissions, and put Lunari on the line.</p>
      </div>
      <div className="av-challenges-hero-actions">
        <button type="button" className="av-btn av-btn-primary" onClick={onCreateClicked}>+ New challenge</button>
      </div>
    </section>
  );
}

export default function ActiveHero({ challenge, onAfterAction, onCreateClicked }: Props) {
  const toast = useToast();
  const pending = usePendingAction();
  const { openPeek } = usePeek();
  const { absolute } = useTimezone();

  const expiresAt = challenge.votingExpiresAt ? new Date(challenge.votingExpiresAt).getTime() : null;
  const [remaining, setRemaining] = useState<{ label: string; danger: boolean } | null>(null);

  useEffect(() => {
    if (!expiresAt) { setRemaining(null); return; }
    const tick = () => setRemaining(formatRemaining(expiresAt - Date.now()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  // Top-3 preview (entries ordered by vote count)
  const top = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of challenge.votes ?? []) counts.set(v.votedForUserId, (counts.get(v.votedForUserId) ?? 0) + 1);
    return (challenge.entries ?? [])
      .map((e) => ({ ...e, votes: counts.get(e.userId) ?? 0 }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 3);
  }, [challenge.entries, challenge.votes]);

  const cover = top[0]?.imageUrl || challenge.entries?.[0]?.imageUrl || null;

  const rewardTotal = (challenge.reward?.tiers ?? []).reduce((sum, t) => sum + (t.amount ?? 0), 0);

  const runAction = (action: 'close' | 'cancel') => {
    pending.queue({
      label: action === 'close' ? `Close · ${challenge.name}` : `Cancel · ${challenge.name}`,
      detail: action === 'close'
        ? 'Tallies votes, pays rewards, posts the results embed.'
        : 'Destroys state with no rewards. Cannot be undone.',
      delayMs: action === 'close' ? 5000 : 6000,
      tone: 'danger',
      run: async () => {
        try {
          await putAction(challenge._id, action);
          toast.show({ tone: 'success', title: action === 'close' ? 'Closed' : 'Cancelled', message: challenge.name });
          onAfterAction();
        } catch (e) {
          toast.show({ tone: 'error', title: `${action === 'close' ? 'Close' : 'Cancel'} failed`, message: (e as Error).message });
        }
      },
    });
  };

  const exportCsv = () => {
    window.open(`/api/admin/challenges/export?id=${encodeURIComponent(challenge._id)}&format=csv`, '_blank');
  };

  return (
    <section className="av-surface av-challenges-hero">
      <div className="av-challenges-hero-cover">
        {cover
          ? <img src={cover} alt="" />
          : <span className="av-challenges-hero-cover-glyph" aria-hidden="true">✦</span>}
      </div>

      <div className="av-challenges-hero-meta">
        <div className="av-challenges-hero-row">
          <span className="av-inbox-status-badge" data-tone="cyan">{challenge.status}</span>
          {remaining && (
            <span className={`av-challenges-countdown${remaining.danger ? ' av-challenges-countdown--danger' : ''}`}
              title={challenge.votingExpiresAt ? absolute(challenge.votingExpiresAt) : undefined}>
              {remaining.label}
            </span>
          )}
          <span className="av-challenges-hero-type">{challenge.type}</span>
        </div>
        <h3 className="av-challenges-hero-title">{challenge.name}</h3>
        {challenge.description && <p className="av-challenges-hero-desc">{challenge.description}</p>}

        <div className="av-challenges-hero-stats">
          <div className="av-challenges-hero-stat">
            <span className="av-challenges-hero-stat-num">{challenge.entryCount}</span>
            <span className="av-challenges-hero-stat-label">Entries</span>
          </div>
          <div className="av-challenges-hero-stat">
            <span className="av-challenges-hero-stat-num">{challenge.voteCount}</span>
            <span className="av-challenges-hero-stat-label">Votes</span>
          </div>
          <div className="av-challenges-hero-stat" data-danger={challenge.flaggedVoteCount > 0}>
            <span className="av-challenges-hero-stat-num">{challenge.flaggedVoteCount}</span>
            <span className="av-challenges-hero-stat-label">Flagged</span>
          </div>
          <div className="av-challenges-hero-stat">
            <span className="av-challenges-hero-stat-num">{rewardTotal.toLocaleString()}</span>
            <span className="av-challenges-hero-stat-label">Lunari at stake</span>
          </div>
        </div>

        {top.length > 0 && (
          <div className="av-challenges-hero-leader">
            {top.map((e, i) => (
              <button
                key={e.userId}
                type="button"
                className="av-challenges-hero-leader-card"
                data-rank={i + 1}
                onClick={() => openPeek(e.userId)}
                title={`${e.username} · ${e.votes} vote${e.votes === 1 ? '' : 's'}`}
              >
                {e.avatar
                  ? <img src={e.avatar} alt="" />
                  : <span>{e.username.slice(0, 1).toUpperCase()}</span>}
                <span className="av-challenges-hero-leader-medal" aria-hidden="true">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                </span>
                <span className="av-challenges-hero-leader-votes">{e.votes}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="av-challenges-hero-actions">
        <button type="button" className="av-btn av-btn-primary av-btn-danger" onClick={() => runAction('close')}>Close now</button>
        <button type="button" className="av-btn av-btn-primary av-btn-danger" onClick={() => runAction('cancel')}>Cancel</button>
        <button type="button" className="av-btn av-btn-ghost" onClick={exportCsv}>Export CSV ↓</button>
        <button type="button" className="av-btn av-btn-ghost" onClick={onCreateClicked} disabled title="An active challenge already exists. Close or cancel this one first.">+ New (busy)</button>
      </div>
    </section>
  );
}
