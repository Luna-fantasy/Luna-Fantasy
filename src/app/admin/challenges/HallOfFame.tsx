'use client';

import { usePeek } from '../_components/PeekProvider';
import { useTimezone } from '../_components/TimezoneProvider';
import type { HoFWinner } from './types';

interface Props {
  winners: HoFWinner[];
}

export default function HallOfFame({ winners }: Props) {
  const { openPeek } = usePeek();
  const { fmtRel, absolute } = useTimezone();

  if (winners.length === 0) {
    return (
      <details className="av-surface av-challenges-hof">
        <summary>
          <span className="av-challenges-hof-title">Hall of Fame</span>
          <span className="av-challenges-hof-count">Empty — winners land here when challenges close.</span>
        </summary>
      </details>
    );
  }

  return (
    <details className="av-surface av-challenges-hof">
      <summary>
        <span className="av-challenges-hof-title">Hall of Fame</span>
        <span className="av-challenges-hof-count">{winners.length} champion{winners.length === 1 ? '' : 's'}</span>
      </summary>
      <div className="av-challenges-hof-strip">
        {winners.map((w, i) => {
          const username = w.winnerUsername ?? '—';
          const userId   = w.winnerUserId ?? '';
          return (
            <div key={`${userId || 'unknown'}-${i}`} className="av-challenges-hof-card" data-rank={Math.min(3, i + 1)}>
              <button
                type="button"
                className="av-challenges-hof-avatar"
                onClick={() => userId && openPeek(userId)}
                title={`Open ${username}`}
                disabled={!userId}
              >
                {w.winnerImageUrl
                  ? <img src={w.winnerImageUrl} alt="" loading="lazy" />
                  : <span>{username.slice(0, 1).toUpperCase()}</span>}
                <span className="av-challenges-hof-medal" aria-hidden="true">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
              </button>
              <div className="av-challenges-hof-meta">
                <strong className="av-challenges-hof-name">{username}</strong>
                <span className="av-challenges-hof-challenge">{w.challengeName ?? '—'}</span>
                <span className="av-challenges-hof-stats">
                  {(w.voteCount ?? 0)} votes · {(w.totalParticipants ?? 0)} participants
                </span>
                {w.closedAt && (
                  <span className="av-challenges-hof-date" title={absolute(w.closedAt)}>{fmtRel(w.closedAt)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
