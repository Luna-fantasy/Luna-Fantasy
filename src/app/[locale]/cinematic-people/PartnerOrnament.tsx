'use client';

import { useEffect, useRef } from 'react';

const scores = {
  council: [1.12, .94, 0, .26, .24, .83, .76, 1],
  accord: [.92, .89, .03, .45, .36, .82, .76, .99],
} as const;

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function PartnerOrnament({ kind }: { kind: keyof typeof scores }) {
  const ornament = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ornament.current;
    const anchor = node?.parentElement;
    if (!node || !anchor) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const controller = new AbortController();
    const { signal } = controller;
    let frame = 0;
    let visible = true;
    const paint = () => {
      frame = 0;
      if (!visible || document.hidden || reduced.matches) return;
      const h = document.documentElement.clientHeight;
      const rtl = document.documentElement.dir === 'rtl' ? -1 : 1;
      const { top, height } = anchor.getBoundingClientRect();
      const [start, end, a, b, c, d, e, f] = scores[kind];
      const t = Math.min(1, Math.max(0, (h * start - top) / (h * start + h * end + Math.min(height, h * 1.18) * .22)));
      const move = smooth((t - c) / (d - c));
      const enter = smooth((t - a) / (b - a));
      const settle = smooth((t - e) / (f - e));
      const values = {
        openness: (17 + smooth(t) * 31).toFixed(2) + '%',
        angle: ((smooth(t) - .5) * 18 * rtl).toFixed(2) + 'deg',
        enter: enter.toFixed(4), settle: settle.toFixed(4), pass: (enter * (1 - settle)).toFixed(4),
        'light-path': (rtl === 1 ? move * 92 + 4 : 96 - move * 92).toFixed(2) + '%',
        travel: ((move - .5) * 120 * rtl).toFixed(2) + 'px',
        'rank-a': ((move * .8 - .4) * 60 * rtl).toFixed(2) + 'px',
        'rank-b': ((.45 - move * .9) * 48 * rtl).toFixed(2) + 'px',
      };
      for (const [key, value] of Object.entries(values)) node.style.setProperty('--g-' + key, value);
    };
    const queue = () => { if (visible && !frame && !document.hidden && !reduced.matches) frame = requestAnimationFrame(paint); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; queue(); }, { rootMargin: '96px 0px' });
    observer.observe(anchor);
    window.addEventListener('resize', queue, { passive: true, signal });
    window.addEventListener('scroll', queue, { passive: true, signal });
    window.addEventListener('pageshow', queue, { signal });
    document.addEventListener('visibilitychange', queue, { signal });
    reduced.addEventListener('change', queue, { signal });
    paint();
    return () => { observer.disconnect(); controller.abort(); cancelAnimationFrame(frame); };
  }, [kind]);
  return <span className="people-partner-ornament" data-kind={kind} ref={ornament} aria-hidden="true"><i /><i /><i /></span>;
}
