'use client';

import { useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import SliderNumberInput from '../games/fields/SliderNumberInput';
import NumberUnitInput from '../games/fields/NumberUnitInput';
import ChannelPicker from '../_components/ChannelPicker';
import type { ChallengeConfig } from './types';

interface Props {
  initial: ChallengeConfig;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function saveConfig(patch: Partial<ChallengeConfig>): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/challenges/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ config: patch }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

export default function SettingsCard({ initial }: Props) {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();
  const [cfg, setCfg] = useState<ChallengeConfig>(initial);
  const committedRef = useRef<ChallengeConfig>(initial);

  const patch = (next: Partial<ChallengeConfig>) => {
    const nextCfg = { ...cfg, ...next };
    setCfg(nextCfg);
    const before = committedRef.current;

    pending.queue({
      label: 'Save challenge settings',
      detail: Object.keys(next).join(', '),
      delayMs: 4500,
      run: async () => {
        try {
          // Send only the changed subset to keep the PUT minimal
          await saveConfig(next);
          committedRef.current = nextCfg;
          toast.show({ tone: 'success', title: 'Saved', message: 'Challenge settings' });
          undo.push({
            label: 'Restore challenge settings',
            detail: 'Rolled back to prior values',
            revert: async () => {
              await saveConfig(before);
              committedRef.current = before;
              setCfg(before);
              toast.show({ tone: 'success', title: 'Reverted', message: 'Challenge settings' });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  return (
    <details className="av-surface av-challenges-settings">
      <summary>
        <span className="av-challenges-settings-title">Anti-alt · cooldowns · Hall of Fame</span>
        <span className="av-challenges-settings-hint">Tune voter trust thresholds and output.</span>
      </summary>

      <div className="av-challenges-settings-body">
        <div className="av-games-field">
          <div className="av-games-field-head">
            <label className="av-games-field-label">Minimum join age</label>
            <p className="av-games-field-help">How long a member must have been in the guild before they can vote. Catches very fresh joiners.</p>
          </div>
          <SliderNumberInput
            value={Math.round(cfg.minJoinAgeMs / 3600_000)}
            onChange={(v) => patch({ minJoinAgeMs: Math.max(0, v) * 3600_000 })}
            unit="hours"
            min={0} max={720} step={1}
          />
        </div>

        <div className="av-games-field">
          <div className="av-games-field-head">
            <label className="av-games-field-label">Minimum account age</label>
            <p className="av-games-field-help">How old a Discord account must be to vote. 7 days catches most throwaways.</p>
          </div>
          <SliderNumberInput
            value={Math.round(cfg.minAccountAgeMs / 86400_000)}
            onChange={(v) => patch({ minAccountAgeMs: Math.max(0, v) * 86400_000 })}
            unit="days"
            min={0} max={90} step={1}
          />
        </div>

        <div className="av-games-field">
          <div className="av-games-field-head">
            <label className="av-games-field-label">Suspicious-vote threshold</label>
            <p className="av-games-field-help">If this many new accounts vote for the same target within 24 h, flag them for review.</p>
          </div>
          <SliderNumberInput
            value={cfg.suspiciousVoteThreshold}
            onChange={(v) => patch({ suspiciousVoteThreshold: v })}
            unit="votes"
            min={2} max={20} step={1}
          />
        </div>

        <div className="av-games-field">
          <div className="av-games-field-head">
            <label className="av-games-field-label">Max guild votes / sec</label>
            <p className="av-games-field-help">Throttles incoming votes as a whole. Lower if you see rapid-fire spam.</p>
          </div>
          <SliderNumberInput
            value={cfg.maxGuildVotesPerSec}
            onChange={(v) => patch({ maxGuildVotesPerSec: v })}
            unit="votes/s"
            min={1} max={100} step={1}
          />
        </div>

        <div className="av-games-field">
          <div className="av-games-field-head">
            <label className="av-games-field-label">Command cooldown</label>
            <p className="av-games-field-help">Per-user cooldown between /challenge commands.</p>
          </div>
          <NumberUnitInput
            type="number-ms-as-seconds"
            value={cfg.cmdCooldownMs}
            onChange={(v) => patch({ cmdCooldownMs: v })}
            unit="seconds"
            min={0} max={60}
          />
        </div>

        <div className="av-games-field">
          <div className="av-games-field-head">
            <label className="av-games-field-label">Vote change window</label>
            <p className="av-games-field-help">After casting, how long the voter has to switch their pick before it's locked.</p>
          </div>
          <NumberUnitInput
            type="number-ms-as-seconds"
            value={cfg.voteChangeWindowMs}
            onChange={(v) => patch({ voteChangeWindowMs: v })}
            unit="seconds"
            min={0} max={600}
          />
        </div>

        <div className="av-games-field">
          <div className="av-games-field-head">
            <label className="av-games-field-label">Voting panel refresh</label>
            <p className="av-games-field-help">How often the live panel updates its counts and top-5 list.</p>
          </div>
          <NumberUnitInput
            type="number-ms-as-seconds"
            value={cfg.updateIntervalMs}
            onChange={(v) => patch({ updateIntervalMs: v })}
            unit="seconds"
            min={10} max={300}
          />
        </div>

        <div className="av-games-field">
          <div className="av-games-field-head">
            <label className="av-games-field-label">Top entries shown</label>
            <p className="av-games-field-help">How many contenders appear in the voting dropdown. Hides the long tail.</p>
          </div>
          <SliderNumberInput
            value={cfg.maxTopEntriesShown}
            onChange={(v) => patch({ maxTopEntriesShown: v })}
            unit="entries"
            min={1} max={25} step={1}
          />
        </div>

        <div className="av-games-field av-games-field--full">
          <div className="av-games-field-head">
            <label className="av-games-field-label">Hall of Fame channel</label>
            <p className="av-games-field-help">Where the bot posts "Champion unlocked" embeds when a challenge closes. Leave empty to disable.</p>
          </div>
          <ChannelPicker
            value={cfg.hallOfFameChannelId ?? ''}
            onChange={(v) => patch({ hallOfFameChannelId: v || null })}
            filter="text"
            placeholder="Select channel (or leave empty to disable)"
          />
        </div>
      </div>
    </details>
  );
}
