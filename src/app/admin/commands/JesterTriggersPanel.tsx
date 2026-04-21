'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import ToggleCard from '../games/fields/ToggleCard';
import RoleChips from '../_components/RoleChips';
import ChipEditor from './ChipEditor';
import CopyValue from '../_components/CopyValue';
import InlineNewCommandDialog from './InlineNewCommandDialog';

export interface CommandEntry {
  triggers: string[];
  enabled: boolean;
  allowedRoles: string[];
}

export type CommandsDoc = Record<string, CommandEntry>;

interface Props {
  data: CommandsDoc;
  onChange: (next: CommandsDoc) => void;
}

// Keys owned by the Games page — do not surface here.
// Keep in sync with src/app/admin/games/game-schema.ts Jester games + the
// emergency "stop" command + the "votegame" mechanic. The three "*Fantasy*"
// entries aren't in the live Mongo doc today but they exist in the schema
// so reserve their ids to prevent accidental shadowing.
// Exported so other panels can also reject collisions against these ids.
export const GAME_COMMAND_KEYS = new Set([
  'roulette', 'mafia', 'rps', 'bombroulette', 'guessthecountry',
  'mines', 'LunaFantasy', 'LunaFantasyEvent', 'GrandFantasy', 'FactionWar',
  'stop', 'votegame',
]);

/** Default shape for a brand-new command entry. */
export const NEW_COMMAND_ENTRY: CommandEntry = { triggers: [], enabled: true, allowedRoles: [] };

export default function JesterTriggersPanel({ data, onChange }: Props) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  const entries = useMemo(
    () =>
      Object.entries(data ?? {})
        .filter(([id]) => !GAME_COMMAND_KEYS.has(id))
        .sort((a, b) => a[0].localeCompare(b[0])),
    [data],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter(([id, e]) =>
      id.toLowerCase().includes(term) ||
      e.triggers.some((t) => t.toLowerCase().includes(term)),
    );
  }, [entries, q]);

  const patch = (id: string, next: Partial<CommandEntry>) => {
    const current = data[id] ?? { triggers: [], enabled: true, allowedRoles: [] };
    onChange({ ...data, [id]: { ...current, ...next } });
  };

  const remove = (id: string) => {
    const nextDoc = { ...data };
    delete nextDoc[id];
    onChange(nextDoc);
  };

  const create = (id: string) => {
    onChange({ ...data, [id]: { ...NEW_COMMAND_ENTRY } });
    setAdding(false);
  };

  const takenIds = useMemo(() => {
    const s = new Set<string>(GAME_COMMAND_KEYS);
    for (const id of Object.keys(data ?? {})) s.add(id);
    return s;
  }, [data]);

  return (
    <section className="av-commands">
      <div className="av-commands-pointer">
        <span className="av-commands-pointer-glyph" aria-hidden="true">◈</span>
        <div>
          <div className="av-commands-pointer-title">Non-game triggers only</div>
          <p className="av-commands-pointer-body">
            Game commands (<code>!roulette</code>, <code>!stop</code>, etc.) are edited on the{' '}
            <Link href="/admin/games" className="av-commands-pointer-link">Games page</Link>.
            This panel holds utility commands — <code>!brimor</code>, <code>!seluna</code>, <code>!zoldar</code>, admin shortcuts.
          </p>
        </div>
      </div>

      <div className="av-commands-controls">
        <input
          className="av-audit-input"
          placeholder="Filter by command name or trigger word…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {adding ? (
          <InlineNewCommandDialog
            takenIds={takenIds}
            onCreate={create}
            onClose={() => setAdding(false)}
          />
        ) : (
          <button type="button" className="av-commands-add" onClick={() => setAdding(true)}>+ New command</button>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="av-commands-empty">Nothing matches “{q}”.</div>
      )}

      <div className="av-commands-list">
        {filtered.map(([id, entry]) => (
          <article key={id} className={`av-commands-card${entry.enabled ? '' : ' av-commands-card--dim'}`}>
            <header className="av-commands-card-head">
              <div className="av-commands-id">
                <CopyValue value={id} label="command id"><code>{id}</code></CopyValue>
              </div>
              <div className="av-commands-toggle-row">
                <ToggleCard
                  value={Boolean(entry.enabled)}
                  onChange={(v) => patch(id, { enabled: v })}
                  onLabel="Enabled"
                  offLabel="Disabled"
                />
                <button
                  type="button"
                  className="av-commands-delete"
                  onClick={() => remove(id)}
                  title={`Delete ${id}`}
                  aria-label={`Delete ${id}`}
                >🗑</button>
              </div>
            </header>

            <div className="av-commands-row-grid">
              <div>
                <label className="av-games-field-label">Triggers</label>
                <p className="av-games-field-help">Words the bot responds to with <code>!word</code>. First match wins; case-insensitive.</p>
                <ChipEditor
                  value={entry.triggers ?? []}
                  onChange={(next) => patch(id, { triggers: next })}
                  placeholder="Add a trigger word — Arabic or English"
                  emptyText="No triggers. Command cannot be invoked until you add one."
                />
              </div>

              <div>
                <label className="av-games-field-label">Allowed roles</label>
                <p className="av-games-field-help">Restrict by role ID. Leave empty so anyone can run it.</p>
                <RoleChips
                  value={entry.allowedRoles ?? []}
                  onChange={(next) => patch(id, { allowedRoles: next })}
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
