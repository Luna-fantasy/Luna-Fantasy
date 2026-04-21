/**
 * Theme persistence via cookie — read by the server layout for first-paint
 * accuracy (no flash from default → saved theme).
 *
 * The cookie value is `lunarian|comfortable|false|on` (joined with `|`)
 * to keep parsing trivial on both ends.
 */

export type ThemeId = 'lunarian' | 'sentinel' | 'mastermind' | 'underworld' | 'siren' | 'seer' | 'arcane';
export type DensityId = 'compact' | 'comfortable' | 'spacious';

export interface ThemeState {
  theme: ThemeId;
  density: DensityId;
  ritual: boolean;
  motion: boolean;
  auto: boolean;         // follow time of day
  themeDay: ThemeId;     // theme while day
  themeNight: ThemeId;   // theme while night
}

export const THEME_COOKIE = 'av-theme';
export const DEFAULT_STATE: ThemeState = {
  theme: 'lunarian',
  density: 'comfortable',
  ritual: false,
  motion: true,
  auto: false,
  themeDay: 'sentinel',
  themeNight: 'lunarian',
};

const VALID_THEMES: ThemeId[] = ['lunarian', 'sentinel', 'mastermind', 'underworld', 'siren', 'seer', 'arcane'];
const VALID_DENSITIES: DensityId[] = ['compact', 'comfortable', 'spacious'];

function coerceTheme(v: string | undefined, fallback: ThemeId): ThemeId {
  return (v && VALID_THEMES.includes(v as ThemeId)) ? (v as ThemeId) : fallback;
}

export function encodeTheme(s: ThemeState): string {
  return [
    s.theme,
    s.density,
    s.ritual ? '1' : '0',
    s.motion ? '1' : '0',
    s.auto ? '1' : '0',
    s.themeDay,
    s.themeNight,
  ].join('|');
}

export function decodeTheme(raw: string | undefined | null): ThemeState {
  if (!raw) return DEFAULT_STATE;
  const parts = raw.split('|');
  const [theme, density, ritual, motion, auto, themeDay, themeNight] = parts;
  return {
    theme: coerceTheme(theme, 'lunarian'),
    density: (VALID_DENSITIES.includes(density as DensityId) ? density : 'comfortable') as DensityId,
    ritual: ritual === '1',
    motion: motion !== '0', // default ON
    auto: auto === '1',
    themeDay: coerceTheme(themeDay, 'sentinel'),
    themeNight: coerceTheme(themeNight, 'lunarian'),
  };
}

/** Compute effective theme based on auto mode + current hour (0-23). */
export function effectiveTheme(state: ThemeState, hour = new Date().getHours()): ThemeId {
  if (!state.auto) return state.theme;
  const isDay = hour >= 6 && hour < 18;
  return isDay ? state.themeDay : state.themeNight;
}
