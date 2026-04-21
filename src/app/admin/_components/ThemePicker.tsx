'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  encodeTheme, THEME_COOKIE, effectiveTheme,
  type ThemeId, type DensityId, type ThemeState,
} from './theme-cookie';

const STORAGE_KEY = 'av-theme';

interface ThemeMeta {
  id: ThemeId;
  label: string;
  flavor: string;
  glyph: string;
  ingot: string; // single muted accent for swatch — NOT a bright halo
}

const THEMES: ThemeMeta[] = [
  { id: 'lunarian',   label: 'Lunarian',   flavor: 'Citizens of Lunvor.',                 glyph: '☾', ingot: '#1e6378' },
  { id: 'sentinel',   label: 'Sentinel',   flavor: 'Royal armor of the high guard.',       glyph: '⚔', ingot: '#6b5025' },
  { id: 'mastermind', label: 'Mastermind', flavor: 'The hidden authority.',                glyph: '◈', ingot: '#3d2768' },
  { id: 'underworld', label: 'Underworld', flavor: 'Crimson and ash.',                     glyph: '✦', ingot: '#5a1f2c' },
  { id: 'siren',      label: 'Siren',      flavor: 'Bioluminescent depths.',               glyph: '◐', ingot: '#0e5b6d' },
  { id: 'seer',       label: 'Seer',       flavor: 'Pale moonlight.',                       glyph: '✧', ingot: '#4a3f63' },
  { id: 'arcane',     label: 'Arcane',     flavor: 'Runes drift over the void.',             glyph: '⟡', ingot: '#3b4a82' },
];

const DENSITIES: { id: DensityId; label: string }[] = [
  { id: 'compact',     label: 'Compact' },
  { id: 'comfortable', label: 'Default' },
  { id: 'spacious',    label: 'Spacious' },
];

function applyToDocument(state: ThemeState) {
  const shell = document.querySelector('.admin-v2-shell') as HTMLElement | null;
  if (!shell) return;
  shell.dataset.theme = effectiveTheme(state);
  shell.dataset.density = state.density;
  shell.dataset.ritual = String(state.ritual);
  shell.dataset.motion = state.motion ? 'on' : 'off';
}

function applyPreviewTheme(themeId: ThemeId | null) {
  const shell = document.querySelector('.admin-v2-shell') as HTMLElement | null;
  if (!shell) return;
  if (themeId) shell.dataset.theme = themeId;
  // Cleared via applyToDocument on picker state change
}

function persist(state: ThemeState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  // 1-year cookie so server-rendered pages get the right theme on first paint
  document.cookie = `${THEME_COOKIE}=${encodeTheme(state)}; path=/; max-age=31536000; samesite=lax`;
}

interface ThemePickerProps {
  /** Server-decoded initial state — passed from layout so SSR matches client. */
  initialState: ThemeState;
}

export default function ThemePicker({ initialState }: ThemePickerProps) {
  const [state, setState] = useState<ThemeState>(initialState);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0, maxHeight: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Compute panel anchor when opening + on resize/scroll while open.
  useEffect(() => {
    if (!open) return;
    const compute = () => {
      const t = triggerRef.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      const top = Math.round(r.bottom + 10);
      const right = Math.round(window.innerWidth - r.right);
      const maxHeight = Math.max(240, window.innerHeight - top - 16);
      setPos({ top, right, maxHeight });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open]);
  // Ref mirror so mouseLeave/blur handlers see the latest state — not the
  // closure captured when they were bound (which caused "picking a theme
  // reverts on mouseleave" bug).
  const stateRef = useRef<ThemeState>(initialState);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Persist + apply on change (skip first render so we don't overwrite cookie with default)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    applyToDocument(state);
    persist(state);
  }, [state]);

  // Auto mode: re-evaluate effective theme every 5 minutes
  useEffect(() => {
    if (!state.auto) return;
    applyToDocument(state);
    const t = window.setInterval(() => applyToDocument(state), 5 * 60_000);
    return () => window.clearInterval(t);
  }, [state]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const effectiveId = effectiveTheme(state);
  const current = THEMES.find((t) => t.id === effectiveId) ?? THEMES[0];

  const panelContent = (
    <div
      ref={panelRef}
      className="av-theme-panel"
      role="dialog" aria-modal="true"
      aria-label="Theme settings"
      style={{ top: pos.top, right: pos.right, maxHeight: pos.maxHeight }}
    >
          <div className="av-theme-section">
            <div className="av-theme-section-label">Faction</div>
            <div className="av-theme-list">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="av-theme-card"
                  aria-pressed={state.theme === t.id && !state.auto}
                  disabled={state.auto}
                  onClick={() => setState((s) => ({ ...s, theme: t.id, auto: false }))}
                  onMouseEnter={() => !stateRef.current.auto && applyPreviewTheme(t.id)}
                  onMouseLeave={() => applyToDocument(stateRef.current)}
                  onFocus={() => !stateRef.current.auto && applyPreviewTheme(t.id)}
                  onBlur={() => applyToDocument(stateRef.current)}
                  style={{ ['--av-ingot' as any]: t.ingot }}
                >
                  <span className="av-theme-card-glyph">{t.glyph}</span>
                  <span className="av-theme-card-meta">
                    <span className="av-theme-card-name">{t.label}</span>
                    <span className="av-theme-card-flavor">{t.flavor}</span>
                  </span>
                  <span className="av-theme-card-ingot" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <div className="av-theme-section">
            <div className="av-theme-section-label">Density</div>
            <div className="av-theme-density">
              {DENSITIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="av-density-btn"
                  aria-pressed={state.density === d.id}
                  onClick={() => setState((s) => ({ ...s, density: d.id }))}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="av-theme-section">
            <div className="av-theme-section-label">Time of day</div>
            <div className="av-theme-toggle">
              <div className="av-theme-toggle-meta">
                <strong>Follow sun</strong>
                <span>Auto-switch between two factions at dawn &amp; dusk.</span>
              </div>
              <button
                type="button"
                className="av-switch"
                aria-checked={state.auto}
                role="switch"
                onClick={() => setState((s) => ({ ...s, auto: !s.auto }))}
              />
            </div>
            {state.auto && (
              <div className="av-theme-daynight">
                <label className="av-theme-dn-field">
                  <span>Day (06:00–18:00)</span>
                  <select
                    className="av-audit-input av-audit-input--sm"
                    value={state.themeDay}
                    onChange={(e) => setState((s) => ({ ...s, themeDay: e.target.value as ThemeId }))}
                  >
                    {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>
                <label className="av-theme-dn-field">
                  <span>Night (18:00–06:00)</span>
                  <select
                    className="av-audit-input av-audit-input--sm"
                    value={state.themeNight}
                    onChange={(e) => setState((s) => ({ ...s, themeNight: e.target.value as ThemeId }))}
                  >
                    {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className="av-theme-section">
            <div className="av-theme-section-label">Chrome</div>
            <div className="av-theme-toggles">
              <div className="av-theme-toggle">
                <div className="av-theme-toggle-meta">
                  <strong>Ritual mode</strong>
                  <span>Engraved cards, mythic typography, ornaments.</span>
                </div>
                <button
                  type="button"
                  className="av-switch"
                  aria-checked={state.ritual}
                  role="switch"
                  onClick={() => setState((s) => ({ ...s, ritual: !s.ritual }))}
                />
              </div>
              <div className="av-theme-toggle">
                <div className="av-theme-toggle-meta">
                  <strong>Motion</strong>
                  <span>Drifting moon, atmosphere, animations.</span>
                </div>
                <button
                  type="button"
                  className="av-switch"
                  aria-checked={state.motion}
                  role="switch"
                  onClick={() => setState((s) => ({ ...s, motion: !s.motion }))}
                />
              </div>
            </div>
          </div>
    </div>
  );

  return (
    <div className="av-theme-picker" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="av-theme-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Theme & display"
      >
        <span className="av-theme-glyph">{current.glyph}</span>
        <span>{current.label}</span>
      </button>

      {open && mounted && createPortal(panelContent, document.body)}
    </div>
  );
}
