'use client';

import type { FieldSection, GameSpec } from './game-schema';
import GameFieldRow from './GameFieldRow';

interface Props {
  game: GameSpec;
  gameValue: any;
  onGamePatch: (next: any) => void;
}

const SECTION_ORDER: FieldSection[] = [
  'General',
  'Cost & Reward',
  'Timing',
  'Limits',
  'Rules',
  'Permissions',
];

export default function GameEditor({ game, gameValue, onGamePatch }: Props) {
  const grouped = new Map<FieldSection, typeof game.fields>();
  for (const f of game.fields) {
    if (!grouped.has(f.section)) grouped.set(f.section, []);
    grouped.get(f.section)!.push(f);
  }

  const ordered = SECTION_ORDER.filter((s) => grouped.has(s));

  if (ordered.length === 0) {
    return <p className="av-games-empty">No tunable fields for this game yet.</p>;
  }

  return (
    <>
      {ordered.map((section) => {
        const fields = grouped.get(section)!;
        return (
          <section key={section} className="av-games-section">
            <header className="av-games-section-head-wrap">
              <h3 className="av-games-section-head">{section}</h3>
            </header>
            <div className="av-games-section-body">
              {fields.map((f) => (
                <GameFieldRow
                  key={f.key}
                  game={game}
                  field={f}
                  gameValue={gameValue}
                  onPatch={onGamePatch}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
