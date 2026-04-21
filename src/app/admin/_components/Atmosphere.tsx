'use client';

import RuneField from './RuneField/RuneField';

/**
 * Atmosphere — animated background layer for /admin.
 *
 * Layer order (bottom → top):
 *   1. Arcane RuneField   (WebGL2 drifting glyphs, lazy-loaded for admin only)
 *   2. Crescent moon      (drifts slowly, top-right)
 *   3. Shooting star      (rare diagonal streak)
 *
 * The RuneField gracefully degrades to nothing when prefers-reduced-motion,
 * data-motion="off", or WebGL2 is unavailable.
 */
export default function Atmosphere() {
  return (
    <div className="av-atmosphere" aria-hidden="true">
      {/* Aurora — 4-layer theme-tinted radial mesh (2026) */}
      <div className="av-aurora" />

      {/* Bottom-of-viewport glow — theme-tinted veil so the lower area
          never reads as flat black when content is short of the fold. */}
      <div className="av-atmo-floor" />

      {/* Layer 1: Arcane rune field — WebGL2 instanced glyphs, lazy-loaded */}
      <div className="av-runefield">
        <RuneField />
      </div>

      {/* ──────────────────────────────────────────────────────────────
         Layer 2: Crescent moon, upper-right
         ────────────────────────────────────────────────────────────── */}
      <svg className="av-moon" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="av-moon-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(255, 255, 255, 0.18)" />
            <stop offset="60%"  stopColor="rgba(0, 212, 255, 0.06)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="av-moon-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>
        <circle cx="100" cy="100" r="98" fill="url(#av-moon-glow)" />
        <path
          d="M120 30 a 70 70 0 1 0 0 140 a 55 55 0 1 1 0 -140 z"
          fill="rgba(220, 235, 255, 0.55)"
          filter="url(#av-moon-blur)"
        />
        <path
          d="M120 30 a 70 70 0 1 0 0 140 a 55 55 0 1 1 0 -140 z"
          fill="none"
          stroke="rgba(0, 212, 255, 0.35)"
          strokeWidth="0.5"
        />
      </svg>

      {/* Layer 3: Shooting star — periodic diagonal streak */}
      <div className="av-shooting-star" />
    </div>
  );
}
