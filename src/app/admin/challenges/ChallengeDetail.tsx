'use client';

import { useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { usePeek } from '../_components/PeekProvider';
import { useTimezone } from '../_components/TimezoneProvider';
import StructuredEditor from '../_components/StructuredEditor';
import type { Challenge, DetailResponse, ChallengeAction } from './types';

interface Props {
  challengeId: string;
  summary: Challenge;
  onAfterMutation: () => void;
}

type Sub = 'rankings' | 'entries' | 'votes' | 'meta';

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

export default function ChallengeDetail({ challengeId, summary, onAfterMutation }: Props) {
  const toast = useToast();
  const pending = usePendingAction();
  const { openPeek } = usePeek();
  const { fmtRel, absolute } = useTimezone();

  const [sub, setSub] = useState<Sub>('rankings');
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/challenges/${encodeURIComponent(challengeId)}`, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setData(body as DetailResponse);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [challengeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') setSub('rankings');
      else if (e.key === '2') setSub('entries');
      else if (e.key === '3') setSub('votes');
      else if (e.key === '4') setSub('meta');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const runClose = () => {
    pending.queue({
      label: `Close · ${summary.name}`,
      detail: 'Tallies votes, pays rewards, posts results embed.',
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        try { await putAction(summary._id, 'close'); toast.show({ tone: 'success', title: 'Closed', message: summary.name }); onAfterMutation(); }
        catch (e) { toast.show({ tone: 'error', title: 'Close failed', message: (e as Error).message }); }
      },
    });
  };

  const runCancel = () => {
    pending.queue({
      label: `Cancel · ${summary.name}`,
      detail: 'Destroys state. No rewards paid.',
      delayMs: 6000,
      tone: 'danger',
      run: async () => {
        try { await putAction(summary._id, 'cancel'); toast.show({ tone: 'success', title: 'Cancelled', message: summary.name }); onAfterMutation(); }
        catch (e) { toast.show({ tone: 'error', title: 'Cancel failed', message: (e as Error).message }); }
      },
    });
  };

  const removeEntry = (userId: string, username: string) => {
    pending.queue({
      label: `Remove entry · ${username}`,
      detail: 'Their votes (cast and received) are also cleaned up.',
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        try {
          await putAction(summary._id, 'remove_entry', { userId });
          toast.show({ tone: 'success', title: 'Entry removed', message: username });
          await load();
          onAfterMutation();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Remove failed', message: (e as Error).message });
        }
      },
    });
  };

  const removeVote = (voterId: string, votedForUserId: string, voterName: string) => {
    pending.queue({
      label: `Remove vote · ${voterName}`,
      detail: `Votes for ${votedForUserId}`,
      delayMs: 4500,
      tone: 'danger',
      run: async () => {
        try {
          await putAction(summary._id, 'remove_vote', { voterId, votedForUserId });
          toast.show({ tone: 'success', title: 'Vote removed', message: voterName });
          await load();
          onAfterMutation();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Remove failed', message: (e as Error).message });
        }
      },
    });
  };

  if (loading && !data) return <div className="av-inbox-transcript-loading">Loading detail…</div>;
  if (error)             return <div className="av-inbox-transcript-empty"><strong>Detail unavailable.</strong> {error}</div>;
  if (!data)             return null;

  const rewardByRank = new Map<number, number>();
  for (const t of summary.reward?.tiers ?? []) rewardByRank.set(t.rank, t.amount);

  return (
    <div className="av-challenges-drawer">
      <nav className="av-shops-tabs av-challenges-drawer-tabs" role="tablist">
        {(['rankings', 'entries', 'votes', 'meta'] as Sub[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={sub === k}
            className={`av-shops-tab${sub === k ? ' av-shops-tab--active' : ''}`}
            onClick={() => setSub(k)}
          >
            <div className="av-shops-tab-meta">
              <span className="av-shops-tab-name">{k === 'rankings' ? 'Rankings' : k === 'entries' ? `Entries · ${data.entries.length}` : k === 'votes' ? `Votes · ${data.votes.length}` : 'Meta'}</span>
            </div>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {summary.status === 'active' && (
          <>
            <button type="button" className="av-btn av-btn-primary av-btn-danger" onClick={runClose}>Close</button>
            <button type="button" className="av-btn av-btn-primary av-btn-danger" onClick={runCancel}>Cancel</button>
          </>
        )}
      </nav>

      {sub === 'rankings' && (
        <>
          <div className="av-challenges-podium">
            {data.rankings.slice(0, 3).map((r, i) => (
              <div key={r.userId} className="av-challenges-podium-card" data-rank={i + 1}>
                <button type="button" className="av-challenges-podium-avatar" onClick={() => openPeek(r.userId)} title={`Open ${r.username}`}>
                  {r.avatar
                    ? <img src={r.avatar} alt="" />
                    : <span>{r.username.slice(0, 1).toUpperCase()}</span>}
                  <span className="av-challenges-podium-medal" aria-hidden="true">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                  </span>
                </button>
                <div className="av-challenges-podium-meta">
                  <strong>{r.username}</strong>
                  <span className="av-challenges-podium-votes">{r.votes} vote{r.votes === 1 ? '' : 's'}</span>
                  {rewardByRank.get(i + 1) && (
                    <span className="av-challenges-podium-reward">{rewardByRank.get(i + 1)!.toLocaleString()} Lunari</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {data.rankings.length > 3 && (
            <div className="av-challenges-rank-list">
              {data.rankings.slice(3).map((r) => (
                <div key={r.userId} className="av-challenges-rank-row">
                  <span className="av-challenges-rank-num">#{r.rank}</span>
                  <button type="button" className="av-inbox-userlink" onClick={() => openPeek(r.userId)}>{r.username}</button>
                  <span className="av-challenges-rank-votes">{r.votes} votes</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {sub === 'entries' && (
        <>
          {data.entries.length === 0 && <div className="av-inbox-transcript-empty">No entries yet — the arena awaits its first contender.</div>}
          <div className="av-challenges-entries">
            {data.entries.map((e) => (
              <div key={e.userId} className="av-challenges-entry-card">
                <div className="av-challenges-entry-media">
                  {e.imageUrl
                    ? <img src={e.imageUrl} alt="" loading="lazy" />
                    : e.content
                      ? <div className="av-challenges-entry-text">{e.content}</div>
                      : <span className="av-challenges-entry-glyph" aria-hidden="true">✎</span>}
                </div>
                <div className="av-challenges-entry-meta">
                  <button type="button" className="av-inbox-userlink" onClick={() => openPeek(e.userId)}>{e.username}</button>
                  <span className="av-challenges-entry-time" title={absolute(e.submittedAt)}>{fmtRel(e.submittedAt)}</span>
                </div>
                {summary.status === 'active' && (
                  <button
                    type="button"
                    className="av-challenges-entry-remove"
                    onClick={() => removeEntry(e.userId, e.username)}
                    title="Remove this entry"
                  >× Remove</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {sub === 'votes' && (
        <>
          {data.votes.length === 0 && <div className="av-inbox-transcript-empty">No votes cast — the people have not yet spoken.</div>}
          <div className="av-challenges-votes-list">
            {data.votes.map((v, i) => (
              <div key={`${v.voterId}-${i}`} className={`av-challenges-vote-row${v.flagged ? ' av-challenges-vote-row--flagged' : ''}`}>
                <div className="av-challenges-vote-voter">
                  <button type="button" className="av-inbox-userlink" onClick={() => openPeek(v.voterId)}>{v.voterName}</button>
                  <span className="av-challenges-vote-age">{v.voterAccountAge >= 0 ? `${v.voterAccountAge}d old` : '—'}</span>
                </div>
                <span className="av-challenges-vote-arrow" aria-hidden="true">→</span>
                <div className="av-challenges-vote-target">
                  <button type="button" className="av-inbox-userlink" onClick={() => openPeek(v.votedForUserId)}>{v.votedForUsername}</button>
                </div>
                <span className="av-challenges-vote-time" title={absolute(v.votedAt)}>{fmtRel(v.votedAt)}</span>
                {v.flagged && (
                  <span className="av-challenges-vote-flag" title={v.flagReason ?? undefined}>flagged{v.flagReason ? ` · ${v.flagReason}` : ''}</span>
                )}
                {summary.status === 'active' && (
                  <button
                    type="button"
                    className="av-challenges-entry-remove"
                    onClick={() => removeVote(v.voterId, v.votedForUserId, v.voterName)}
                    title="Remove this vote"
                  >×</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {sub === 'meta' && (
        <div className="av-challenges-meta-wrap">
          <StructuredEditor value={data.challenge as any} onChange={() => {}} />
          <p className="av-challenges-meta-hint">Read-only view of the stored document. Direct edits happen through the create dialog or the row actions.</p>
        </div>
      )}
    </div>
  );
}
