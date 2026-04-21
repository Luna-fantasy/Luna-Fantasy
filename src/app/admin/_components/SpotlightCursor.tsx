'use client';

import { useEffect } from 'react';

/**
 * Spotlight cursor — tracks mouse position on .av-main via CSS custom
 * properties (--spotlight-x / --spotlight-y). CSS in admin-v2.css paints
 * a subtle radial gradient following the cursor. rAF-throttled, passive.
 */
export default function SpotlightCursor() {
  useEffect(() => {
    const main = document.querySelector('.av-main') as HTMLElement | null;
    if (!main) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Use viewport coords since .av-main::before is position:fixed now
        main.style.setProperty('--spotlight-x', `${e.clientX}px`);
        main.style.setProperty('--spotlight-y', `${e.clientY}px`);
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
