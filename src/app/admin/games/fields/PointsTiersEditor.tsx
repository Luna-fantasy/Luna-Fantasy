'use client';

import type { PointsMode } from '../game-schema';

interface Tier {
  players: number;
  points: number;
}

interface Props {
  mode: PointsMode;
  /** For tiers: array. For flat: { [keyBase]: number }. For flat-with-bot: { [keyBase]: n, [keyBase_bot]: n }. For faction-war: the 6 keys. */
  pointsDoc: Record<string, any>;
  keyBase: string;
  onChange: (nextDoc: Record<string, any>) => void;
  title: string;
  help?: string;
}

export default function PointsTiersEditor({ mode, pointsDoc, keyBase, onChange, title, help }: Props) {
  const patch = (patch: Record<string, any>) => onChange({ ...pointsDoc, ...patch });

  if (mode === 'tiers') {
    const tiers: Tier[] = Array.isArray(pointsDoc[keyBase]) ? pointsDoc[keyBase] : [];
    const set = (next: Tier[]) => patch({ [keyBase]: next });

    return (
      <section className="av-games-section av-games-points">
        <header className="av-games-section-head-wrap">
          <h3 className="av-games-section-head">{title}</h3>
          {help && <p className="av-games-section-help">{help}</p>}
        </header>

        {tiers.length === 0 && (
          <div className="av-games-points-empty">No tiers yet — add one below. Tiers apply by player-count threshold.</div>
        )}

        {tiers.length > 0 && (
          <div className="av-games-points-head-row">
            <span>Player count ≥</span>
            <span>Win reward</span>
            <span aria-hidden="true" />
          </div>
        )}

        <div className="av-games-points-rows">
          {tiers.map((t, i) => (
            <div key={i} className="av-games-points-row">
              <input
                className="av-games-field-input av-games-field-input--num"
                type="number" min={1} max={500}
                value={t.players}
                onChange={(e) => {
                  const next = [...tiers];
                  next[i] = { ...t, players: Number(e.target.value) };
                  set(next);
                }}
              />
              <div className="av-games-field-control">
                <input
                  className="av-games-field-input av-games-field-input--num"
                  type="number" min={0} step={100}
                  value={t.points}
                  onChange={(e) => {
                    const next = [...tiers];
                    next[i] = { ...t, points: Number(e.target.value) };
                    set(next);
                  }}
                />
                <span className="av-games-field-unit">Lunari</span>
              </div>
              <button
                type="button"
                className="av-games-points-remove"
                onClick={() => set(tiers.filter((_, idx) => idx !== i))}
                title="Remove tier"
              >×</button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="av-games-points-add"
          onClick={() => {
            const last = tiers[tiers.length - 1];
            const nextPlayers = last ? last.players + 2 : 2;
            const nextPoints = last ? last.points : 1000;
            set([...tiers, { players: nextPlayers, points: nextPoints }]);
          }}
        >+ Add tier</button>
      </section>
    );
  }

  if (mode === 'flat') {
    const v = Number(pointsDoc[keyBase] ?? 0);
    return (
      <section className="av-games-section av-games-points">
        <header className="av-games-section-head-wrap">
          <h3 className="av-games-section-head">{title}</h3>
          {help && <p className="av-games-section-help">{help}</p>}
        </header>
        <div className="av-games-points-single">
          <label className="av-games-points-label">Win reward</label>
          <div className="av-games-field-control">
            <input
              className="av-games-field-input av-games-field-input--num"
              type="number" min={0} step={100}
              value={v}
              onChange={(e) => patch({ [keyBase]: Number(e.target.value) })}
            />
            <span className="av-games-field-unit">Lunari</span>
          </div>
        </div>
      </section>
    );
  }

  if (mode === 'flat-with-bot') {
    const human = Number(pointsDoc[keyBase] ?? 0);
    const bot   = Number(pointsDoc[`${keyBase}_bot`] ?? 0);
    return (
      <section className="av-games-section av-games-points">
        <header className="av-games-section-head-wrap">
          <h3 className="av-games-section-head">{title}</h3>
          {help && <p className="av-games-section-help">{help}</p>}
        </header>
        <div className="av-games-points-matrix av-games-points-matrix--two">
          <div className="av-games-points-cell">
            <label className="av-games-points-label">Human wins</label>
            <div className="av-games-field-control">
              <input
                className="av-games-field-input av-games-field-input--num"
                type="number" min={0} step={100}
                value={human}
                onChange={(e) => patch({ [keyBase]: Number(e.target.value) })}
              />
              <span className="av-games-field-unit">Lunari</span>
            </div>
          </div>
          <div className="av-games-points-cell">
            <label className="av-games-points-label">Bot wins (vs AI)</label>
            <div className="av-games-field-control">
              <input
                className="av-games-field-input av-games-field-input--num"
                type="number" min={0} step={100}
                value={bot}
                onChange={(e) => patch({ [`${keyBase}_bot`]: Number(e.target.value) })}
              />
              <span className="av-games-field-unit">Lunari</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // faction-war mode
  const keys = ['', '_bonus', '_double'] as const;
  const labels = ['Base win', 'Bonus win', 'Double win'] as const;

  return (
    <section className="av-games-section av-games-points">
      <header className="av-games-section-head-wrap">
        <h3 className="av-games-section-head">{title}</h3>
        {help && <p className="av-games-section-help">{help}</p>}
      </header>
      <div className="av-games-points-matrix av-games-points-matrix--fw">
        <div className="av-games-points-cell av-games-points-cell--head">Outcome</div>
        <div className="av-games-points-cell av-games-points-cell--head">Human wins</div>
        <div className="av-games-points-cell av-games-points-cell--head">Bot wins (vs AI)</div>

        {keys.map((suffix, i) => {
          const humanKey = `${keyBase}${suffix}`;
          const botKey   = `${keyBase}${suffix}_bot`;
          return (
            <div key={suffix} className="av-games-points-fw-row">
              <div className="av-games-points-cell av-games-points-cell--label">{labels[i]}</div>
              <div className="av-games-points-cell">
                <div className="av-games-field-control">
                  <input
                    className="av-games-field-input av-games-field-input--num"
                    type="number" min={0} step={500}
                    value={Number(pointsDoc[humanKey] ?? 0)}
                    onChange={(e) => patch({ [humanKey]: Number(e.target.value) })}
                  />
                  <span className="av-games-field-unit">Lunari</span>
                </div>
              </div>
              <div className="av-games-points-cell">
                <div className="av-games-field-control">
                  <input
                    className="av-games-field-input av-games-field-input--num"
                    type="number" min={0} step={500}
                    value={Number(pointsDoc[botKey] ?? 0)}
                    onChange={(e) => patch({ [botKey]: Number(e.target.value) })}
                  />
                  <span className="av-games-field-unit">Lunari</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
