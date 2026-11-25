// Canonical passport faction vocabulary. Must stay identical to
// VALID_FACTIONS in api/admin/users/[discordId]/passport/route.ts —
// the passport GET returns that list for the edit dialog, and these
// glyphs/filter options render it everywhere else.
export const PASSPORT_FACTIONS = [
  'Beasts', 'Colossals', 'Dragons', 'Knights', 'Lunarians', 'Moon Creatures',
  'Mythical Creatures', 'Strange Beings', 'Supernatural', 'Underworld', 'Warriors',
] as const;

export const FACTION_TONES: Record<(typeof PASSPORT_FACTIONS)[number], string> = {
  'Beasts':            '#84cc16',
  'Colossals':         '#a78bfa',
  'Dragons':           '#ef4444',
  'Knights':           '#fbbf24',
  'Lunarians':         '#0ea5e9',
  'Moon Creatures':    '#818cf8',
  'Mythical Creatures':'#f472b6',
  'Strange Beings':    '#10b981',
  'Supernatural':      '#c084fc',
  'Underworld':        '#f59e0b',
  'Warriors':          '#eab308',
};

const FACTION_GLYPH: Record<string, string> = {
  beasts: '🐾', colossals: '⛰', dragons: '🜲', knights: '⚔', lunarians: '☾',
  'moon creatures': '◐', 'mythical creatures': '✧', 'strange beings': '❖',
  supernatural: '✦', underworld: '♆', warriors: '🛡',
};

export function factionGlyph(faction?: string | null): string {
  return FACTION_GLYPH[(faction ?? '').toLowerCase()] ?? '◯';
}
