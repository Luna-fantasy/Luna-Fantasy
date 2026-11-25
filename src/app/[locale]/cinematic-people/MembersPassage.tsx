'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

const arch = 'M105 278V133Q105 62 263 28Q421 62 421 133V278Z';
const smooth = (p: number) => { const x = Math.max(0, Math.min(1, p)); return x * x * (3 - 2 * x); };

export function MembersPassage({ children }: { children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = track.current;
    if (!root) return;
    const hero = root.querySelector<HTMLElement>('.members-hero');
    if (!hero) return;
    const noMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const abort = new AbortController();
    const listen = { passive: true, signal: abort.signal };
    let frame = 0, active = true, suspended = false, start: number | null = null, scrub = false;
    const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
    const queue = () => { if (!frame && !suspended && !document.hidden && active) frame = requestAnimationFrame(paint); };
    function paint(now: number) {
      frame = 0;
      if (!root || !hero || suspended || document.hidden || !active) return;
      if (start === null) start = now;
      const travel = Math.max(1, root.offsetHeight - hero.offsetHeight);
      const p = Math.max(0, Math.min(1, -root.getBoundingClientRect().top / travel));
      if (p > .006) scrub = true;
      const elapsed = (now - start) / 1000;
      const amount = noMotion.matches ? 1 : scrub ? p : smooth((elapsed - .12) / 2.06);
      const opening = smooth((amount - .15) / .73);
      root.style.setProperty('--people-door-travel', String(opening));
      root.style.setProperty('--people-door-light', String(.31 + smooth((amount - .2) / .63) * .69));
      if (!noMotion.matches && !scrub && elapsed < 2.3) queue();
    }
    window.addEventListener('scroll', queue, listen);
    window.addEventListener('resize', queue, listen);
    window.addEventListener('pagehide', () => { suspended = true; stop(); }, listen);
    window.addEventListener('pageshow', () => { suspended = false; queue(); }, listen);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else queue();
    }, listen);
    noMotion.addEventListener('change', queue, { signal: abort.signal });
    const observer = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => { active = entry.isIntersecting; if (active) queue(); else stop(); })
      : null;
    observer?.observe(root);
    queue();
    return () => {
      abort.abort();
      observer?.disconnect();
      stop();
      root.style.removeProperty('--people-door-travel');
      root.style.removeProperty('--people-door-light');
    };
  }, []);

  return <div ref={track} className="people-member-track">{children}</div>;
}

export function MembersGate() {
  const clip = useId();
  const ash = clip + '-ash';
  const oak = clip + '-oak';
  const lamp = clip + '-lamp';
  return (
    <div className="people-member-stage" aria-hidden="true">
      <svg viewBox="0 0 526 330" focusable="false">
        <defs>
          <linearGradient id={ash} x2="0%" y2="100%"><stop stopColor="#29394c" /><stop offset=".46" stopColor="#151e2e" /><stop offset="1" stopColor="#080d17" /></linearGradient>
          <linearGradient id={oak}><stop stopColor="#282630" /><stop offset=".48" stopColor="#423746" /><stop offset="1" stopColor="#181923" /></linearGradient>
          <linearGradient id={lamp} x2="0%" y2="100%"><stop stopColor="#efce91" /><stop offset="1" stopColor="#4e5564" /></linearGradient>
          <clipPath id={clip}><path d={arch} /></clipPath>
        </defs>
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M62 292h402m-364 15h326" fill="none" stroke="#d6b285" strokeWidth="1.3" opacity=".55" />
          <path d="M86 280V131Q86 51 263 12Q440 51 440 131V280Z" fill="#111725" stroke="#ab926f" strokeWidth="2" />
          <g clipPath={`url(#${clip})`}>
            <path d={arch} fill={`url(#${ash})`} stroke="#b9996f" strokeWidth="2" />
            {[0, 1, 2, 3].map((n) => {
              const v = 14 * n;
              return <path key={n} d={`M${116 + v} 279V${146 + 8 * n}Q${116 + v} ${75 + 12 * n} 263 ${42 + 25 * n}Q${410 - v} ${75 + 12 * n} ${410 - v} ${146 + 8 * n}V279`} fill="none" stroke={n % 2 ? '#61748b' : '#ac9676'} strokeWidth={2.7 - n * .25} opacity={.82 - n * .13} />;
            })}
            <path d="M109 282l95-83h117l95 83M150 282l78-83m148 83-78-83M115 266h296M132 250h262M153 233h224M173 218h177" fill="none" stroke="#7b93ad" strokeWidth="1.2" opacity=".62" />
            {[209, 263, 317].map(x => <g key={x} transform={`translate(${x} 147)`} className="people-member-lamp">
              <path d="M0-24v20 M-10-3h20L7 25H-7Z" fill="#121b25" stroke="#c9a980" strokeWidth="1.5" />
              <path d="M-5 4H5L3 19H-3Z" fill={`url(#${lamp})`} stroke="#eed2a7" strokeWidth=".65" />
            </g>)}
            {[-1, 1].map(side => <g key={side} transform={`translate(${263 + side * 157} 0) scale(${-side} 1)`}>
              <g className="people-member-leaf">
                <path d="M0 280V132Q0 81 158 46V280Z" fill={`url(#${oak})`} stroke="#c2a278" strokeWidth="2.5" />
                <path d="M11 269V137Q12 93 145 61V269Z" fill="none" stroke="#b59874" strokeWidth="1.3" />
                {[0, 1, 2, 3].map(j => <path key={j} d={`M${26 + j * 28} ${122 - j * 14}V261`} stroke="#a08265" opacity=".47" />)}
                <path d="M9 179H149V194H9Z M9 232H149V247H9Z" fill="#352b32" stroke="#a48868" strokeWidth="1.4" />
                <path d="M125 160q9-11 16 0v15h-16Z" fill="#110f19" stroke="#d6b585" strokeWidth="1.9" />
              </g>
            </g>)}
          </g>
          <path d={arch} fill="none" stroke="#d2b18a" strokeWidth="2.1" opacity=".83" />
          {[82, 414].map(x => <path key={x} d={`M${x} 275h30v9h-30zm4-127h22v127h-22zm-4-10h30v10h-30z`} fill="#1a2230" stroke="#bf9c6e" strokeWidth="1.5" />)}
        </g>
      </svg>
    </div>
  );
}
