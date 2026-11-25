'use client';

import { useEffect, useRef, type ReactNode } from 'react';

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

export function CharactersAisle({ cinematic, children }: { cinematic: boolean; children: ReactNode }) {
  const runwayRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const runway = runwayRef.current;
    const hero = heroRef.current;
    if (!cinematic || !runway || !hero) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const controller = new AbortController();
    const { signal } = controller;
    let frame = 0;
    let suspended = false;
    let away = false;
    runway.dataset.c7Ready = 'true';
    const paint = () => {
      frame = 0;
      if (suspended || document.hidden) return;
      const reach = Math.max(1, runway.offsetHeight - hero.offsetHeight);
      const t = reduced.matches ? 1 : clamp(-runway.getBoundingClientRect().top / reach);
      hero.style.setProperty('--c7-open', smooth(t / .44).toFixed(4));
      hero.style.setProperty('--c7-glow', smooth((t - .29) / .44).toFixed(4));
      hero.style.setProperty('--c7-quiet', smooth((t - .61) / .39).toFixed(4));
      hero.dataset.phase = t < .28 ? 'threshold' : t < .68 ? 'light-beam' : 'opened-archive';
      if (reduced.matches) return;
      if (t >= .28) away = true;
      else if (t === 0 && away) {
        away = false;
        for (const animation of hero.getAnimations({ subtree: true })) {
          if (animation instanceof CSSAnimation && ['c7-dawn-opening', 'c7-slide-left', 'c7-slide-right'].includes(animation.animationName)) {
            animation.currentTime = 0;
            animation.play();
          }
        }
      }
    };
    const queue = () => { if (!frame && !suspended && !document.hidden) frame = requestAnimationFrame(paint); };
    const cancel = () => { cancelAnimationFrame(frame); frame = 0; };
    window.addEventListener('scroll', queue, { passive: true, signal });
    window.addEventListener('resize', queue, { passive: true, signal });
    window.addEventListener('pagehide', () => { suspended = true; cancel(); }, { signal });
    window.addEventListener('pageshow', () => { suspended = false; queue(); }, { signal });
    document.addEventListener('visibilitychange', () => document.hidden ? cancel() : queue(), { signal });
    reduced.addEventListener('change', queue, { signal });
    paint();
    return () => { controller.abort(); cancel(); delete runway.dataset.c7Ready; };
  }, [cinematic]);

  if (!cinematic) return <section className="characters-hero">{children}</section>;
  return (
    <div ref={runwayRef} className="c7-runway">
      <section ref={heroRef} className="characters-hero cinematic-people-characters c7-aisle">
        {children}
        <span aria-hidden="true" className="c7-light" />
        <span aria-hidden="true" className="c7-arch c7-arch-left" />
        <span aria-hidden="true" className="c7-arch c7-arch-right" />
        <span aria-hidden="true" className="c7-lintel" />
      </section>
    </div>
  );
}
