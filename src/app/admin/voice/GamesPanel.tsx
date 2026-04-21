'use client';

import { useState } from 'react';
import NumberUnitInput from '../games/fields/NumberUnitInput';
import SliderNumberInput from '../games/fields/SliderNumberInput';
import ToggleCard from '../games/fields/ToggleCard';
import ChipEditor from '../commands/ChipEditor';
import type { TriviaQuestion, VoiceGamesSettings } from './types';

interface Props {
  trivia: TriviaQuestion[];
  sowalef: string[];
  settings: VoiceGamesSettings;
  onTriviaChange: (next: TriviaQuestion[]) => void;
  onSowalefChange: (next: string[]) => void;
  onSettingsChange: (next: VoiceGamesSettings) => void;
}

type Sub = 'trivia' | 'sowalef' | 'rewards' | 'boss';

export default function GamesPanel({ trivia, sowalef, settings, onTriviaChange, onSowalefChange, onSettingsChange }: Props) {
  const [sub, setSub] = useState<Sub>('trivia');

  const patchSettings = (p: Partial<VoiceGamesSettings>) => onSettingsChange({ ...settings, ...p });

  const addTrivia = () => onTriviaChange([...trivia, { q: 'New question?', answers: ['A', 'B', 'C', 'D'], correct: 0 }]);
  const removeTrivia = (i: number) => onTriviaChange(trivia.filter((_, idx) => idx !== i));
  const patchTrivia = (i: number, patch: Partial<TriviaQuestion>) => {
    onTriviaChange(trivia.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  };

  const math = settings.mathOps ?? { enabled: [], rewardMin: 5, rewardMax: 10, timeoutMs: 20000 };
  const quickReact = settings.quickReact ?? { rewardMin: 5, rewardMax: 10, delayMin: 3000, delayMax: 8000, timeoutMs: 10000 };
  const boss = settings.bossChallenge ?? { enabled: false, rewardMin: 500, rewardMax: 1000, cooldownHours: 24, questionCount: 5 };
  const streaks = settings.streakBonuses ?? { '3': 5, '5': 10, '10': 25 };
  const auraMultipliers = settings.auraRewardMultipliers ?? { dormant: 1, flickering: 1.2, glowing: 1.5, radiant: 2, blazing: 3 };
  const triviaReward = settings.triviaReward ?? { autoDropMin: 50, autoDropMax: 200, miniMin: 5, miniMax: 10 };

  return (
    <section className="av-voice-panel">
      <nav className="av-inbox-chipset" role="tablist" aria-label="Games sub">
        {([
          { id: 'trivia' as Sub, label: `Trivia · ${trivia.length}` },
          { id: 'sowalef' as Sub, label: `Sowalef · ${sowalef.length}` },
          { id: 'rewards' as Sub, label: 'Rewards & timing' },
          { id: 'boss' as Sub, label: 'Boss & aura' },
        ]).map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={sub === t.id}
            className={`av-inbox-chip${sub === t.id ? ' av-inbox-chip--active' : ''}`}
            onClick={() => setSub(t.id)}>{t.label}</button>
        ))}
      </nav>

      {sub === 'trivia' && (
        <>
          <div className="av-commands-controls">
            <span className="av-info-map-count">{trivia.length} question{trivia.length === 1 ? '' : 's'}</span>
            <div style={{ flex: 1 }} />
            <button type="button" className="av-commands-add" onClick={addTrivia}>+ New question</button>
          </div>
          {trivia.length === 0 && <div className="av-commands-empty">The question vault is empty — add a question to challenge the residents.</div>}
          <div className="av-voice-trivia-list">
            {trivia.map((t, i) => (
              <article key={i} className="av-commands-card av-voice-trivia-card">
                <header className="av-commands-card-head">
                  <span className="av-commands-reply-num">#{i + 1}</span>
                  <button type="button" className="av-commands-delete" onClick={() => removeTrivia(i)} title="Delete question">🗑</button>
                </header>
                <label className="av-shopf-field av-shopf-field--full">
                  <span>Question</span>
                  <input className="av-shopf-input" value={t.q} onChange={(e) => patchTrivia(i, { q: e.target.value })} dir="auto" />
                </label>
                <div className="av-voice-trivia-answers">
                  {(t.answers ?? ['', '', '', '']).map((a, j) => (
                    <label key={j} className="av-voice-trivia-answer">
                      <input
                        type="radio"
                        name={`trivia-correct-${i}`}
                        checked={t.correct === j}
                        onChange={() => patchTrivia(i, { correct: j })}
                      />
                      <input
                        className="av-shopf-input"
                        value={a}
                        placeholder={`Answer ${j + 1}`}
                        onChange={(e) => {
                          const next = [...(t.answers ?? ['', '', '', ''])];
                          next[j] = e.target.value;
                          patchTrivia(i, { answers: next });
                        }}
                        dir="auto"
                      />
                      {t.correct === j && <span className="av-voice-trivia-correct">✓</span>}
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {sub === 'sowalef' && (
        <article className="av-commands-card">
          <header className="av-commands-card-head"><h4 className="av-sage-card-title">Sowalef prompts</h4></header>
          <p className="av-games-field-help">Questions the bot drops in voice rooms. One per line.</p>
          <textarea
            className="av-shopf-input av-sage-longform-area"
            rows={14}
            value={sowalef.join('\n')}
            onChange={(e) => onSowalefChange(e.target.value.split('\n'))}
            dir="auto"
          />
          <span className="av-sage-longform-count">{sowalef.length} prompts</span>
        </article>
      )}

      {sub === 'rewards' && (
        <>
          <article className="av-commands-card">
            <header className="av-commands-card-head"><h4 className="av-sage-card-title">Trivia rewards</h4></header>
            <div className="av-commands-row-grid">
              <div><label className="av-games-field-label">Auto-drop min</label><NumberUnitInput type="number-coins" value={triviaReward.autoDropMin} onChange={(v) => patchSettings({ triviaReward: { ...triviaReward, autoDropMin: v } })} unit="Lunari" min={0} /></div>
              <div><label className="av-games-field-label">Auto-drop max</label><NumberUnitInput type="number-coins" value={triviaReward.autoDropMax} onChange={(v) => patchSettings({ triviaReward: { ...triviaReward, autoDropMax: v } })} unit="Lunari" min={0} /></div>
              <div><label className="av-games-field-label">Mini-game min</label><NumberUnitInput type="number-coins" value={triviaReward.miniMin} onChange={(v) => patchSettings({ triviaReward: { ...triviaReward, miniMin: v } })} unit="Lunari" min={0} /></div>
              <div><label className="av-games-field-label">Mini-game max</label><NumberUnitInput type="number-coins" value={triviaReward.miniMax} onChange={(v) => patchSettings({ triviaReward: { ...triviaReward, miniMax: v } })} unit="Lunari" min={0} /></div>
              <div><label className="av-games-field-label">Trivia timeout</label><NumberUnitInput type="number-ms-as-seconds" value={settings.triviaTimeoutMs ?? 30000} onChange={(v) => patchSettings({ triviaTimeoutMs: v })} min={5} max={120} /></div>
              <div><label className="av-games-field-label">Session size</label><SliderNumberInput value={settings.triviaSessionSize ?? 10} onChange={(v) => patchSettings({ triviaSessionSize: v })} min={1} max={50} step={1} unit="Q's" /></div>
            </div>
          </article>

          <article className="av-commands-card">
            <header className="av-commands-card-head"><h4 className="av-sage-card-title">Math challenge</h4></header>
            <div className="av-commands-row-grid">
              <div><label className="av-games-field-label">Enabled operations</label>
                <ChipEditor value={math.enabled ?? []} onChange={(next) => patchSettings({ mathOps: { ...math, enabled: next } })} placeholder="add, subtract, multiply…" />
              </div>
              <div><label className="av-games-field-label">Reward min</label><NumberUnitInput type="number-coins" value={math.rewardMin} onChange={(v) => patchSettings({ mathOps: { ...math, rewardMin: v } })} unit="Lunari" min={0} /></div>
              <div><label className="av-games-field-label">Reward max</label><NumberUnitInput type="number-coins" value={math.rewardMax} onChange={(v) => patchSettings({ mathOps: { ...math, rewardMax: v } })} unit="Lunari" min={0} /></div>
              <div><label className="av-games-field-label">Timeout</label><NumberUnitInput type="number-ms-as-seconds" value={math.timeoutMs} onChange={(v) => patchSettings({ mathOps: { ...math, timeoutMs: v } })} min={5} max={120} /></div>
            </div>
          </article>

          <article className="av-commands-card">
            <header className="av-commands-card-head"><h4 className="av-sage-card-title">Quick react</h4></header>
            <div className="av-commands-row-grid">
              <div><label className="av-games-field-label">Reward min</label><NumberUnitInput type="number-coins" value={quickReact.rewardMin} onChange={(v) => patchSettings({ quickReact: { ...quickReact, rewardMin: v } })} unit="Lunari" min={0} /></div>
              <div><label className="av-games-field-label">Reward max</label><NumberUnitInput type="number-coins" value={quickReact.rewardMax} onChange={(v) => patchSettings({ quickReact: { ...quickReact, rewardMax: v } })} unit="Lunari" min={0} /></div>
              <div><label className="av-games-field-label">Delay min</label><NumberUnitInput type="number-ms-as-seconds" value={quickReact.delayMin} onChange={(v) => patchSettings({ quickReact: { ...quickReact, delayMin: v } })} min={1} max={30} /></div>
              <div><label className="av-games-field-label">Delay max</label><NumberUnitInput type="number-ms-as-seconds" value={quickReact.delayMax} onChange={(v) => patchSettings({ quickReact: { ...quickReact, delayMax: v } })} min={1} max={30} /></div>
              <div><label className="av-games-field-label">Timeout</label><NumberUnitInput type="number-ms-as-seconds" value={quickReact.timeoutMs} onChange={(v) => patchSettings({ quickReact: { ...quickReact, timeoutMs: v } })} min={3} max={60} /></div>
            </div>
          </article>

          <article className="av-commands-card">
            <header className="av-commands-card-head"><h4 className="av-sage-card-title">Streak bonuses</h4></header>
            <div className="av-commands-row-grid">
              {(['3', '5', '10'] as const).map((k) => (
                <div key={k}>
                  <label className="av-games-field-label">{k}-streak</label>
                  <NumberUnitInput type="number-coins" value={streaks[k] ?? 0} onChange={(v) => patchSettings({ streakBonuses: { ...streaks, [k]: v } })} unit="Lunari" min={0} />
                </div>
              ))}
            </div>
          </article>

          <article className="av-commands-card">
            <header className="av-commands-card-head"><h4 className="av-sage-card-title">Emoji race</h4></header>
            <ChipEditor value={settings.emojiRaceEmojis ?? []} onChange={(next) => patchSettings({ emojiRaceEmojis: next })} placeholder="Add an emoji" />
          </article>

          <article className="av-commands-card">
            <header className="av-commands-card-head"><h4 className="av-sage-card-title">Cooldowns</h4></header>
            <div className="av-commands-row-grid">
              <div><label className="av-games-field-label">Between games</label><NumberUnitInput type="number-ms-as-seconds" value={settings.gameCooldownMs ?? 10000} onChange={(v) => patchSettings({ gameCooldownMs: v })} min={0} max={600} /></div>
              <div><label className="av-games-field-label">End cooldown</label><NumberUnitInput type="number-ms-as-seconds" value={settings.endCooldownMs ?? 5000} onChange={(v) => patchSettings({ endCooldownMs: v })} min={0} max={600} /></div>
              <div><label className="av-games-field-label">Sowalef session</label><SliderNumberInput value={settings.sowalefSessionSize ?? 10} onChange={(v) => patchSettings({ sowalefSessionSize: v })} min={1} max={50} step={1} unit="prompts" /></div>
              <div><label className="av-games-field-label">Sowalef debounce</label><NumberUnitInput type="number-ms-as-seconds" value={settings.sowalefDebounceMs ?? 5000} onChange={(v) => patchSettings({ sowalefDebounceMs: v })} min={0} max={60} /></div>
            </div>
          </article>
        </>
      )}

      {sub === 'boss' && (
        <>
          <article className="av-commands-card">
            <header className="av-commands-card-head"><h4 className="av-sage-card-title">Boss challenge</h4></header>
            <div className="av-sage-toggles">
              <div className="av-sage-toggle-row">
                <div><strong>Enabled</strong><span>Rare high-stakes challenge that drops in active rooms.</span></div>
                <ToggleCard value={Boolean(boss.enabled)} onChange={(v) => patchSettings({ bossChallenge: { ...boss, enabled: v } })} onLabel="On" offLabel="Off" />
              </div>
            </div>
            <div className="av-commands-row-grid">
              <div><label className="av-games-field-label">Reward min</label><NumberUnitInput type="number-coins" value={boss.rewardMin} onChange={(v) => patchSettings({ bossChallenge: { ...boss, rewardMin: v } })} unit="Lunari" min={0} /></div>
              <div><label className="av-games-field-label">Reward max</label><NumberUnitInput type="number-coins" value={boss.rewardMax} onChange={(v) => patchSettings({ bossChallenge: { ...boss, rewardMax: v } })} unit="Lunari" min={0} /></div>
              <div><label className="av-games-field-label">Cooldown</label><SliderNumberInput value={boss.cooldownHours} onChange={(v) => patchSettings({ bossChallenge: { ...boss, cooldownHours: v } })} min={1} max={168} step={1} unit="hours" /></div>
              <div><label className="av-games-field-label">Question count</label><SliderNumberInput value={boss.questionCount} onChange={(v) => patchSettings({ bossChallenge: { ...boss, questionCount: v } })} min={1} max={20} step={1} unit="Q's" /></div>
            </div>
          </article>

          <article className="av-commands-card">
            <header className="av-commands-card-head"><h4 className="av-sage-card-title">Aura reward multipliers</h4></header>
            <p className="av-games-field-help">Multiplier applied to game rewards based on the room's aura tier.</p>
            <div className="av-commands-row-grid">
              {(['dormant', 'flickering', 'glowing', 'radiant', 'blazing'] as const).map((tier) => (
                <div key={tier}>
                  <label className="av-games-field-label" style={{ textTransform: 'capitalize' }}>{tier}</label>
                  <NumberUnitInput type="number-multiplier" value={auraMultipliers[tier] ?? 1} onChange={(v) => patchSettings({ auraRewardMultipliers: { ...auraMultipliers, [tier]: v } })} unit="×" min={0} max={10} step={0.1} />
                </div>
              ))}
            </div>
          </article>
        </>
      )}
    </section>
  );
}
