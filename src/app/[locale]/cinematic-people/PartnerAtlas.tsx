'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import type { Partner } from '@/lib/partners';
import { partnerDirectoryAnchor } from '@/lib/cinematic/people-art';

export function PartnerAtlas({ partners, locale }: { partners: Partner[]; locale: 'en' | 'ar' }) {
  const ar = locale === 'ar';
  const [selectedId, setSelectedId] = useState<string>();
  const [entered, setEntered] = useState(false);
  const connector = useRef<SVGSVGElement>(null);
  const line = useRef<SVGPathElement>(null);
  const animateChoice = useRef(false);
  const selected = partners.find(p => p.id === selectedId) ?? partners[0];
  const atlas = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const plaque = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const host = atlas.current, focus = plaque.current, feature = panel.current;
    const trail = connector.current, path = line.current;
    if (!host || !focus || !feature || !trail || !path) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const turns: Animation[] = [];
    const cancelTurns = () => { turns.splice(0).forEach(turn => turn.cancel()); };
    const controller = new AbortController();
    const listen = { signal: controller.signal, passive: true };
    let frame = 0, inside = false, suspended = false;
    const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
    const paint = () => {
      frame = 0;
      if (suspended || document.hidden) return;
      const a = host.getBoundingClientRect(), p = feature.getBoundingClientRect(), q = focus.getBoundingClientRect();
      if (!a.width || !a.height) return;
      const x = p.left + p.width / 2 - a.left, y = p.bottom - a.top - 4;
      const u = q.left + q.width / 2 - a.left, v = q.top - a.top + 2;
      const mid = y + (v - y) * .54;
      trail.setAttribute('viewBox', '0 0 ' + a.width + ' ' + a.height);
      path.setAttribute('d', 'M' + x + ' ' + y + ' V' + mid + ' H' + u + ' V' + v);
      if (animateChoice.current && !reduced.matches && feature.animate && path.animate) {
        turns.push(feature.animate([{ transform: 'translateY(5px)', opacity: .70 }, { transform: 'none', opacity: 1 }],
          { duration: 340, easing: 'cubic-bezier(.22,.61,.28,1)' }));
        turns.push(path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
          { duration: 460, easing: 'cubic-bezier(.26,.62,.21,1)' }));
      }
      animateChoice.current = false;
    };
    const queue = () => { if (!frame && !suspended && !document.hidden) frame = requestAnimationFrame(paint); };
    const observer = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => { inside = entry.isIntersecting; setEntered(inside && !suspended && !document.hidden); if (inside) queue(); else cancelTurns(); }, { threshold: [0, .1] })
      : null;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(queue) : null;
    observer?.observe(host);
    ro?.observe(host);
    ro?.observe(feature);
    if (!observer) { inside = true; setEntered(true); }
    window.addEventListener('resize', queue, listen);
    window.addEventListener('pagehide', () => { suspended = true; stop(); cancelTurns(); setEntered(false); }, listen);
    window.addEventListener('pageshow', () => { suspended = false; setEntered(inside); queue(); }, listen);
    document.addEventListener('visibilitychange', () => {
      setEntered(!document.hidden && inside && !suspended);
      if (document.hidden) { stop(); cancelTurns(); } else queue();
    }, listen);
    reduced.addEventListener('change', () => { if (reduced.matches) cancelTurns(); queue(); }, { signal: controller.signal });
    void document.fonts?.ready.then(() => { if (!controller.signal.aborted) queue(); });
    queue();
    return () => { controller.abort(); observer?.disconnect(); ro?.disconnect(); stop(); cancelTurns(); };
  }, [selected?.id, partners]);

  if (!selected) return null;
  const choose = (id: string) => {
    if (selected.id === id) return;
    animateChoice.current = true;
    setSelectedId(id);
  };
  return (
    <section ref={atlas} className={`pa6${entered ? ' pa6-arrived' : ''}`} aria-label={ar ? 'أطلس الشركاء' : 'Partner atlas'}>
      <h2 className="pa6-label">{ar ? 'أطلس الشركاء' : 'Partner atlas'}</h2>
      <div className="pa6-deck">
        <svg className="pa6-engraving" viewBox="0 0 560 230" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path className="pa6-fill" d="M0 206 L0 162 L165 132 L226 76 L334 76 L395 132 L560 162 L560 206 Z" />
          <path className="pa6-trace" pathLength={1} d="M0 162 L165 132 L226 76 H334 L395 132 L560 162 M0 206 H560 M0 187 L168 167 L234 107 H326 L392 167 L560 187" />
          <path className="pa6-etch" d="M40 174 Q88 169 133 159 V206 M94 166 Q148 157 197 121 V206 M201 142 Q231 94 280 93 Q329 94 359 142 V206 M363 121 Q412 157 466 166 V206 M427 159 Q472 169 520 174 V206" />
          <path className="pa6-etch faint" d="M12 215 H548 M50 224 H510 M8 151 L152 124 L218 65 H342 L408 124 L552 151 M51 136 L142 115 L209 54 H351 L418 115 L509 136" />
        </svg>
        <div ref={panel} className="pa6-panel">
          {selected.logo && <div className="pa6-image"><Image src={selected.logo} alt="" width={88} height={88} /></div>}
          <div className="pa6-info" aria-live="polite">
            <p className="pa6-name">{selected.name}</p>
            <p className="pa6-type">{selected.type[locale]}</p>
            <a className="pa6-jump" href={'#' + partnerDirectoryAnchor(selected.id)}>{ar ? 'صفحة الشريك في الدليل' : 'View directory entry'}</a>
          </div>
        </div>
      </div>
      <svg ref={connector} className="pa6-connector" aria-hidden="true" focusable="false"><path ref={line} pathLength={1} /></svg>
      <div className="pa6-index" role="group" aria-label={ar ? 'اختر شريكًا' : 'Choose a partner'}>
        {partners.map((p, i) => <button
          key={p.id} ref={selected.id === p.id ? plaque : undefined}
          type="button" className="pa6-plaque" aria-pressed={selected.id === p.id}
          style={{ '--step': Math.min(i, 8) } as CSSProperties}
          onFocus={() => choose(p.id)} onClick={() => choose(p.id)}
        >
          {p.logo && <span className="pa6-plaque-logo"><Image src={p.logo} alt="" width={32} height={32} /></span>}
          <span className="pa6-plaque-name">{p.name}</span>
        </button>)}
      </div>
    </section>
  );
}
