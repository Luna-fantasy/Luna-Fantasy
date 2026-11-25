'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Character, Locale } from '@/types';
import { approvedPortraitFor, parseCharacterName, wrapPeopleIndex } from '@/lib/cinematic/people-art';
import { CinematicArtwork } from './CinematicArtwork';
import { PortraitDepth } from '@/components/cinematic/motion/PortraitDepth';

interface Props {
  items: Character[];
  locale: Locale;
  factionName: (id: string) => string;
  openCharacter: (character: Character, control: HTMLElement) => void;
}

const featuredIds = ['mastermind', 'bod-aban-luna-champion', 'movarth-chaos-king', 'luna-knight', 'avelle-adar', 'draconis', 'umbra'];

export function PortraitTheater({ items, locale, factionName, openCharacter }: Props) {
  const ar = locale === 'ar';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasTurned, setHasTurned] = useState(false);
  const at = Math.max(0, items.findIndex(item=>item.id===selectedId));
  const selected = items[at];
  const stage = useRef<HTMLDivElement>(null);
  const direction = useRef(1);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => {
    const node = stage.current;
    if (!node || !hasTurned || typeof node.animate !== 'function') return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches || document.hidden) return;
    const side = direction.current;
    const art = node.querySelector<HTMLElement>('.luna-portrait-depth');
    if (!art) return;
    const animation = art.animate([
      { clipPath: side > 0 ? 'inset(0 18% 0 0)' : 'inset(0 0 0 18%)', transform: 'translateX(' + (side * 7) + 'px) scale(1.024)', opacity: .8 },
      { clipPath: 'inset(0)', transform: 'translateX(0) scale(1)', opacity: 1 }
    ], { duration: 450, easing: 'cubic-bezier(.22,1,.36,1)' });
    animation.id = 'luna-portrait-settle';
    const controller = new AbortController();
    const cancel = () => animation.cancel();
    window.addEventListener('pagehide', cancel, { signal: controller.signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); }, { signal: controller.signal });
    reduced.addEventListener('change', cancel, { signal: controller.signal });
    return () => { controller.abort(); cancel(); };
  }, [at, hasTurned]);

  if (!selected) return null;
  const move = (next: number, side: number) => {
    direction.current = Math.sign(side || 1) * (ar ? -1 : 1);
    setHasTurned(true);
    setSelectedId(items[wrapPeopleIndex(next, items.length)].id);
  };
  function beginSwipe(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    if (event.target instanceof Element) event.target.setPointerCapture(event.pointerId);
  }
  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    gesture.current = null;
    if (items.length < 2) return;
    const dx = event.clientX - start.x;
    const threshold = Math.max(34, Math.min(64, event.currentTarget.clientWidth * .23));
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(event.clientY - start.y) * 1.4) return;
    const step = (dx < 0) !== ar ? 1 : -1;
    move(at + step, step);
  }
  const onKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey || /^(INPUT|TEXTAREA|SELECT)$/.test((event.target as HTMLElement).tagName)) return;
    const step = event.key === 'ArrowRight' ? (ar ? -1 : 1) : event.key === 'ArrowLeft' ? (ar ? 1 : -1) : 0;
    if (!step && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = step ? at + step : event.key === 'Home' ? 0 : items.length - 1;
    move(next, step || next - at);
  };
  const name = parseCharacterName(selected.name[locale]).name;
  const art = approvedPortraitFor(selected.imageUrl);
  const featured = featuredIds.map(id => items.findIndex(item => item.id === id)).filter(i => i >= 0);
  const shortcuts = featured.length ? featured : items.slice(0, 7).map((_, i) => i);
  return (
    <section id="c7-portrait-archive" className="c6-theater" tabIndex={-1} aria-labelledby="people-theater-title" aria-describedby="c6-keyhint" onKeyDown={onKeys}>
      <p className="c6-kicker" aria-hidden="true">{ar ? 'تصفّح سجلّ لونا' : 'The archives of Luna'}</p>
      <h2 id="people-theater-title" className="c7-archive-title">{ar ? 'مسرح الشخصيات' : 'Portrait Theater'}</h2>
      <p id="c6-keyhint" className="c6-hidden-descriptor">{ar ? 'انتقل بين الشخصيات بأزرار الأسهم أو القائمة.' : 'Use the arrow keys or the list to choose a character.'}</p>
      <div className="c6-shell">
        <div className="c6-exhibit">
          <div className="portrait-gallery" data-turn={direction.current} data-portrait-gallery={selected.id}>
            {items.length>1 && (items.length===2 ? [1] : [-1,1]).map(step=>{
              const item=items[wrapPeopleIndex(at+step,items.length)];
              const title=parseCharacterName(item.name[locale]).name;
              return <button key={step} className="portrait-wing" data-side={(step<0)!==ar?'left':'right'} data-portrait-step={step}
                type="button" aria-label={(step<0?(ar?'السابق · ':'Previous · '):(ar?'التالي · ':'Next · '))+title} onClick={()=>move(at+step,step)}>
                <CinematicArtwork key={item.id} approved={approvedPortraitFor(item.imageUrl)?.thumb} original={item.imageUrl} alt="" width={240} height={360}/>
                <span>{title}</span>
              </button>;
            })}
          <div className="c6-aperture" ref={stage} data-feature-stage
            onPointerDown={beginSwipe} onPointerUp={finishSwipe} onPointerCancel={(event) => { if (gesture.current?.id === event.pointerId) gesture.current = null; }}>
            <PortraitDepth key={selected.id}>
              <CinematicArtwork approved={art?.medium} original={selected.imageUrl} alt={name} width={900} height={1350} draggable={false} />
            </PortraitDepth>
            {hasTurned && <span key={'edge-' + selected.id} aria-hidden="true" className="luna-contact-edge"
              data-side={direction.current < 0 ? 'left' : 'right'} />}
          </div>
          </div>
          <div className="c6-note">
            <span className="c6-count" aria-hidden="true">{String(at + 1).padStart(3, '0')} / {items.length}</span>
            <p data-theater-group>{factionName(selected.faction)}</p>
            <h3>{name}</h3>
            <button type="button" className="c6-open" onClick={event => openCharacter(selected, event.currentTarget)}>{ar ? 'عرض السجلّ' : 'Open character record'}</button>
          </div>
        </div>
        {items.length > 1 && <div className="c6-controls">
          <label className="c6-picker-label">
            {ar ? 'اختر من جميع الشخصيات' : 'Choose from all characters'}
            <select className="c6-picker" value={at} onChange={(event) => move(Number(event.target.value), Number(event.target.value) - at)}>
              {items.map((item, i) => <option key={item.id} value={i}>{parseCharacterName(item.name[locale]).name}</option>)}
            </select>
          </label>
          <div className="c6-steps">
            <button type="button" onClick={() => move(at - 1, -1)} aria-label={ar ? 'الشخصية السابقة' : 'Previous character'}>{ar ? '›' : '‹'}</button>
            <button type="button" onClick={() => move(at + 1, 1)} aria-label={ar ? 'الشخصية التالية' : 'Next character'}>{ar ? '‹' : '›'}</button>
          </div>
          <div className="c6-quick">
            {shortcuts.map(i => {
              const item = items[i];
              return <button type="button" key={item.id} className="c6-tab" aria-label={parseCharacterName(item.name[locale]).name} aria-pressed={at === i} onClick={() => move(i, i - at)}>
                <CinematicArtwork approved={approvedPortraitFor(item.imageUrl)?.thumb} original={item.imageUrl} width={56} height={61} alt="" />
              </button>;
            })}
          </div>
        </div>}
      </div>
      <a className="c6-browse" href="#c6-gallery">{ar ? 'معرض الشخصيات الكامل' : 'Browse the full gallery'}</a>
      <p className="c6-live" role="status" aria-live="polite" aria-atomic="true">{hasTurned && `${ar ? "الشخصية" : "Character"} ${at + 1} / ${items.length} · ${name}`}</p>
    </section>
  );
}
