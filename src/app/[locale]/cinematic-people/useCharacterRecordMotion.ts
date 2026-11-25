'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';

type Phase = 'open' | 'swap' | 'close';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function useCharacterRecordMotion(id: string | undefined, enabled: boolean, rtl: boolean, opener: RefObject<HTMLElement | null>) {
  const panel = useRef<HTMLDivElement>(null);
  const active = useRef<Animation[]>([]);
  const phase = useRef<Phase>('open');
  const direction = useRef(0);
  const generation = useRef(0);

  function animate(element: Element | null, frames: Keyframe[], duration: number, delay = 0) {
    if (!element) return;
    const animation = element.animate(frames, { duration, delay, fill: 'both', easing: 'cubic-bezier(.18,.75,.19,1)' });
    active.current.push(animation);
    return animation;
  }
  function stop() {
    generation.current++;
    active.current.forEach(animation => animation.cancel());
    active.current = [];
  }
  function canMove() {
    return enabled && !!panel.current && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  useLayoutEffect(() => {
    if (!id || !canMove()) return;
    const portrait = panel.current!.querySelector('.char-lightbox-img');
    // The lens button stays in its final hit area while the artwork arrives.
    const art = portrait?.querySelector('.portrait-lens-frame') ?? portrait;
    const copy = panel.current!.querySelector('.char-lightbox-info');
    const sign = rtl ? -1 : 1;
    if (direction.current) {
      const s = direction.current * sign;
      animate(copy, [{ opacity: .02, transform: `perspective(980px) translateX(${52 * s}px) rotateY(${14 * s}deg)` }, { opacity: 1, transform: 'none' }], 780);
      animate(art, [{ opacity: .05, transform: `translateX(${32 * s}px)` }, { opacity: 1, transform: 'none' }], 560);
    } else {
      const trigger = opener.current?.querySelector('[data-current-portrait]') ?? opener.current?.querySelector('img')
        ?? opener.current?.closest('[data-cast-viewer]')?.querySelector('[data-current-portrait]')
        ?? opener.current?.closest('.char-card,.c6-exhibit')?.querySelector('img');
      const from = trigger?.getBoundingClientRect(), to = portrait?.getBoundingClientRect();
      let x = 0, y = 0, scale = .72;
      if (from && to?.width && from.width && from.top < innerHeight && from.bottom > 0) {
        x = clamp(from.left + from.width / 2 - to.left - to.width / 2, -.65 * innerWidth, .65 * innerWidth);
        y = clamp(from.top + from.height / 2 - to.top - to.height / 2, -.45 * innerHeight, .45 * innerHeight);
        scale = clamp(from.width / to.width, .35, .66);
      }
      animate(art, [{ opacity: .42, transform: `translate3d(${x}px,${y}px,0) scale(${scale})` }, { opacity: 1, transform: 'none' }], 890);
      animate(copy, [{ opacity: 0, transform: `translate3d(${42 * sign}px,15px,0) rotateY(${-18 * sign}deg)` }, { opacity: 0, offset: .18 }, { opacity: 1, transform: 'none' }], 910);
      Array.from(copy?.children ?? []).forEach((child, i) => animate(child, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], 740, 130 + 60 * i));
    }
    direction.current = 0;
    phase.current = 'open';
    return () => { stop(); phase.current = 'open'; };
    // A record's entry animation owns the nodes measured after that record is committed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, rtl, enabled]);

  function turn(step: number, next: () => void) {
    if (phase.current !== 'open') return;
    if (!canMove()) { next(); return; }
    stop();
    phase.current = 'swap';
    const token = generation.current;
    const s = step * (rtl ? -1 : 1);
    const copy = panel.current!.querySelector('.char-lightbox-info');
    const portrait = panel.current!.querySelector('.char-lightbox-img');
    animate(copy, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-30 * s}px)` }], 270);
    const exit = animate(portrait, [{ opacity: 1 }, { opacity: .08 }], 360);
    const change = () => { if (token === generation.current) { direction.current = step; next(); } };
    if (exit) void exit.finished.then(change, () => {});
    else change();
  }
  function close(finish: () => void) {
    if (phase.current === 'close') return;
    stop();
    direction.current = 0;
    if (!canMove()) { finish(); return; }
    phase.current = 'close';
    const token = generation.current;
    const exit = animate(panel.current, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(4vh) scale(.86)' }], 530);
    if (exit) void exit.finished.then(() => { if (generation.current === token) finish(); }, () => {});
    else finish();
  }
  return { panel, turn, close };
}
