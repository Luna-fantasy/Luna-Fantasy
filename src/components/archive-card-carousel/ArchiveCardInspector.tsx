'use client';
/* eslint-disable @next/next/no-img-element -- the public reader displays the resolved full print at its native aspect. */

import { fantasyCourtBack } from '@/lib/cinematic/fantasy-court-back';
import { ArchiveName } from '@/components/ArchiveName';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type TouchEvent, type KeyboardEvent } from 'react';
import { inspectorArtworkViewerSrc } from '@/lib/cinematic/native-art-inspector';
import { archiveInspectionMotion, reversePrints } from './archive-inspection-motion';
import { playReaderExchange, readerDragTransform } from './archive-reader-motion';
import { ArchiveContactSheet } from './ArchiveContactSheet';
import type { ArchiveCardEntry } from './ArchiveCardCarousel';
import type { LunaSecretCodexSelection } from '@/lib/cinematic/luna-secret-codex';
import { LunaSecretCodexReading } from '@/components/cinematic-games/LunaSecretCodexReading';
import type { ArchiveKind } from './archive-carousel-model';
import { CollectorInstrument } from '@/components/cinematic/motion/CollectorInstrument';

export type ArchiveInspection = { kind: ArchiveKind; id: string; original?: string };
type Props = {
  inspection: ArchiveInspection; alt: string; preferredImageSrc?: string; visualFixImageSrc?: string;
  archiveEntries?: readonly ArchiveCardEntry[];
  readSecret?: (id: string) => LunaSecretCodexSelection | undefined;
  imageSrc: string; title?: string; description?: string; locale?: string; openerElement?: HTMLElement; onClose: () => void;
};

const useDialogLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const timings = { luna: [610, 360], grand: [780, 470], faction: [710, 435] } as const;
const scenes = { luna: 'the-dealers-table', grand: 'the-jesters-folio', faction: 'the-muster' } as const;

export function ArchiveCardInspector({ inspection, alt, title, description, locale, openerElement, imageSrc, preferredImageSrc, visualFixImageSrc, archiveEntries, readSecret, onClose }: Props) {
  const { kind } = inspection;
  const ar = locale === 'ar';
  const format = new Intl.NumberFormat(ar ? 'ar' : 'en');
  const [index, setIndex] = useState(() => Math.max(0, archiveEntries?.findIndex(entry => entry.id === inspection.id) ?? 0));
  const entry = archiveEntries?.[index];
  const id = entry?.id ?? inspection.id;
  const name = entry?.name ?? title ?? alt;
  const narrative = entry?.description ?? (id === inspection.id ? description : undefined);
  const secret = readSecret?.(id);
  const total = archiveEntries?.length || 1;
  const game = ar ? { luna: 'لونا فانتسي', grand: 'جراند فانتسي', faction: 'حرب الفصائل' }[kind]
    : { luna: 'Luna Fantasy', grand: 'Grand Fantasy', faction: 'Faction War' }[kind];
  const [magnifying, setMagnifying] = useState(false);
  const [reference, setReference] = useState<{ id: string; name: string; source: string } | null>(null);
  const lens = useRef<HTMLSpanElement>(null);
  const lensPoint = useRef({ x: .5, y: .5 });
  const turn = useRef<'next' | 'previous'>();
  const arrival = useRef<HTMLDivElement>(null);
  const departure = useRef<HTMLDivElement>(null);
  const glint = useRef<HTMLElement>(null);
  const rebound = useRef<Animation | null>(null);
  const serial = useRef(0);
  const [turning, setTurning] = useState(false);
  const [flight, setFlight] = useState<{ token: number; source: string; width: number; height: number; start: string; direction: number } | null>(null);
  const verso = kind === 'faction' ? undefined : reversePrints[id];
  const back = verso === undefined ? undefined : fantasyCourtBack(verso);
  const originalBack = verso === undefined ? undefined : '/luna-v16/grand/art/game-motion/court/verso-' + verso + '.webp';
  const dialog = useRef<HTMLDialogElement>(null);
  const relief = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const motion = useRef<Animation | null>(null);
  const closing = useRef(false);
  const navigating = useRef(false);
  const drag = useRef<{ id: number; x: number; y: number; yaw: number; pitch: number; dx: number; mode: 'browse' | 'turn' } | null>(null);
  const controlTap = useRef<{ button: HTMLButtonElement; id: number; x: number; y: number } | null>(null);
  const pose = useRef({ yaw: 0, pitch: 0 });
  const finish = useRef(onClose);
  finish.current = onClose;
  const [resetAngleAvailable, setResetAngleAvailable] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const native = useMemo(() => inspectorArtworkViewerSrc(entry?.releaseId), [entry?.releaseId]);
  const candidates = entry ? [entry.visualFix, native, entry.detail, entry.thumb] : [visualFixImageSrc, preferredImageSrc, imageSrc];
  const print = candidates.find((src): src is string => !!src && !failed.includes(src));

  function positionLens(x: number, y: number) {
    const surface = image.current, glass = lens.current;
    if (!surface || !glass) return;
    const width = surface.clientWidth, height = surface.clientHeight;
    const diameter = glass.offsetWidth;
    if (!width || !height || !diameter) return;
    const point = { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
    lensPoint.current = point;
    glass.style.left = clamp(point.x * width, diameter / 2, width - diameter / 2) + 'px';
    glass.style.top = clamp(point.y * height, diameter / 2, height - diameter / 2) + 'px';
    glass.style.backgroundSize = (width * 2.5) + 'px ' + (height * 2.5) + 'px';
    glass.style.backgroundPosition = (diameter / 2 - point.x * width * 2.5) + 'px ' + (diameter / 2 - point.y * height * 2.5) + 'px';
  }
  useDialogLayoutEffect(() => {
    if (!magnifying || !image.current) return;
    const sync = () => positionLens(lensPoint.current.x, lensPoint.current.y);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(image.current);
    return () => observer.disconnect();
  }, [magnifying, print]);

  useDialogLayoutEffect(() => {
    if (!flight || !arrival.current || !departure.current || !glint.current) return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches || !arrival.current.animate) { setFlight(null); return; }
    const animation = playReaderExchange(kind, flight.direction, {
      incoming: arrival.current, outgoing: departure.current, light: glint.current,
    }, flight.start);
    const settle = () => setFlight(value => value?.token === flight.token ? null : value);
    void animation.finished.then(settle, () => {});
    preference.addEventListener('change', settle);
    return () => {
      preference.removeEventListener('change', settle);
      animation.animations.forEach(item => item.cancel());
    };
  }, [flight, kind]);

  function selectPrint(next: number, startPose = 'none', animate = true) {
    if (next === index || next < 0 || next >= total || closing.current) return;
    turn.current = next > index ? 'next' : 'previous';
    const old = image.current;
    const source = print && (old?.currentSrc || print);
    rebound.current?.cancel();
    if (arrival.current) arrival.current.style.removeProperty('transform');
    if (animate && !reference && source && old && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFlight({ token: ++serial.current, source, width: old.clientWidth, height: old.clientHeight,
        start: startPose === 'none' ? 'translateZ(0)' : startPose, direction: (next > index ? 1 : -1) * (ar ? -1 : 1) });
    } else setFlight(null);
    if (dialog.current) delete dialog.current.dataset.readDrag;
    drag.current = null;
    setTurning(false);
    setAngle(0, 0);
    setMagnifying(false);
    lensPoint.current = { x: .5, y: .5 };
    setIndex(next);
  }

  function toggleComparison() {
    if (reference) {
      setReference(null);
      return;
    }
    if (!print || total < 2) return;
    motion.current?.cancel();
    setReference({ id, name, source: image.current?.currentSrc || print });
    selectPrint(index + (index < total - 1 ? 1 : -1), 'none', false);
  }

  function keyboardBrowse(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === 'Tab') {
      const stops = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'button:enabled, a[href], input:enabled, select:enabled, textarea:enabled, [tabindex]',
      )).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (first && last && event.target === (event.shiftKey ? first : last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
      return;
    }
    if (event.shiftKey) return;
    const forward = ar ? 'ArrowLeft' : 'ArrowRight';
    const back = ar ? 'ArrowRight' : 'ArrowLeft';
    const next = event.key === forward ? index + 1 : event.key === back ? index - 1
      : event.key === 'Home' ? 0 : event.key === 'End' ? total - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault();
    selectPrint(next);
  }

  function animatePrint(exit: boolean) {
    const layer = relief.current, art = image.current;
    const trigger = openerElement?.closest('[data-card-id]')?.querySelector('img') ?? openerElement?.querySelector('img') ?? openerElement;
    if (!layer || !art || !trigger?.isConnected || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const a = trigger.getBoundingClientRect(), b = art.getBoundingClientRect();
    if (!a.width || !a.height || !b.width || !b.height || a.bottom <= 0 || a.top >= innerHeight || a.right <= 0 || a.left >= innerWidth) return;
    const x = (a.left + a.width / 2) - (b.left + b.width / 2);
    const y = (a.top + a.height / 2) - (b.top + b.height / 2);
    const k = clamp(Math.min(a.width / b.width, a.height / b.height), .065, 1);
    const current = getComputedStyle(layer).transform;
    motion.current?.cancel();
    const animation = layer.animate(archiveInspectionMotion(kind, x, y, k, ar ? -1 : 1, exit, current), {
      duration: timings[kind][exit ? 1 : 0], easing: 'cubic-bezier(.20,.73,.21,1)', fill: 'both',
    });
    motion.current = animation;
    return animation;
  }
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setFlight(null);
    rebound.current?.cancel();
    drag.current = null;
    if (face.current) {
      face.current.style.transition = 'transform .18s ease-out';
      face.current.style.setProperty('--inspect-x', '0deg');
      face.current.style.setProperty('--inspect-y', '0deg');
    }
    const exit = animatePrint(true);
    if (exit) void exit.finished.then(() => finish.current(), () => { if (!navigating.current) finish.current(); });
    else finish.current();
  };
  useDialogLayoutEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const trigger = openerElement ?? document.activeElement;
    const scroll = { left: window.scrollX, top: window.scrollY, behavior: 'instant' as const };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    d.showModal();
    closeButton.current?.focus({ preventScroll: true });
    const entrance = animatePrint(false);
    if (entrance) void entrance.finished.then(() => entrance.cancel(), () => {});
    const depart = () => { navigating.current = true; finish.current(); };
    window.addEventListener('pagehide', depart);
    return () => {
      window.removeEventListener('pagehide', depart);
      motion.current?.cancel();
      if (d.open) d.close();
      document.body.style.overflow = overflow;
      if (!navigating.current) {
        if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
        window.scrollTo(scroll);
      }
    };
    // Each keyed inspector owns one catalog entry and its initiating element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function setAngle(yaw: number, pitch: number) {
    pose.current = { yaw, pitch };
    const surface = face.current;
    if (!surface) return;
    surface.style.setProperty('--inspect-y', yaw+'deg');
    surface.style.setProperty('--inspect-x', pitch+'deg');
    if (dialog.current) dialog.current.dataset.inspectionYaw = String(Math.round(yaw));
    const canReset = Math.abs(yaw) + Math.abs(pitch) > .5;
    if (canReset !== resetAngleAvailable) setResetAngleAvailable(canReset);
  }
  function resetAngle() {
    drag.current = null;
    if (face.current) face.current.style.transition = 'transform 180ms ease-out';
    setAngle(0,0);
    face.current?.focus({preventScroll: true});
  }
  function turnWithKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || closing.current) return;
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !event.shiftKey) return;
    if (magnifying && event.key.startsWith('Arrow')) {
      const { x, y } = lensPoint.current;
      positionLens(x + (event.key === 'ArrowRight' ? .08 : event.key === 'ArrowLeft' ? -.08 : 0),
        y + (event.key === 'ArrowDown' ? .08 : event.key === 'ArrowUp' ? -.08 : 0));
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const { yaw, pitch } = pose.current;
    const limit = verso === undefined ? 81 : 185;
    const increment = ar ? -12 : 12;
    switch (event.key) {
      case 'ArrowRight': setAngle(clamp(yaw+increment,-limit,limit),pitch); break;
      case 'ArrowLeft': setAngle(clamp(yaw-increment,-limit,limit),pitch); break;
      case 'ArrowUp': setAngle(yaw,clamp(pitch+8,-32,32)); break;
      case 'ArrowDown': setAngle(yaw,clamp(pitch-8,-32,32)); break;
      case '0': resetAngle(); break;
      default: return;
    }
    event.preventDefault();
    event.stopPropagation();
  }
  const begin = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button !== 0 || closing.current) return;
    if (magnifying && image.current) {
      const box = image.current.getBoundingClientRect();
      positionLens((e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    const mode = turning || e.shiftKey ? 'turn' : 'browse';
    if (mode === 'turn' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    rebound.current?.cancel();
    e.currentTarget.style.removeProperty('transition');
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, mode, ...pose.current };
    if (e.pointerType === 'mouse') e.preventDefault();
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (magnifying && image.current && (e.pointerType === 'mouse' || e.currentTarget.hasPointerCapture(e.pointerId))) {
      const box = image.current.getBoundingClientRect();
      positionLens((e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height);
      return;
    }
    const start = drag.current;
    if (!start || start.id !== e.pointerId) return;
    if (start.mode === 'browse') {
      const dx = e.clientX - start.x;
      if (!start.dx && (Math.abs(dx) < 5 || Math.abs(dx) < Math.abs(e.clientY - start.y))) return;
      const next = index + ((dx < 0) !== ar ? 1 : -1);
      const width = image.current?.clientWidth || 240;
      start.dx = dx;
      const shown = clamp(dx * (next < 0 || next >= total ? .24 : 1), -width * .95, width * .95);
      if (arrival.current && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        arrival.current.style.transform = readerDragTransform(shown, width);
        if (dialog.current) dialog.current.dataset.readDrag = String(Math.round(shown));
      }
      return;
    }
    const limit = verso === undefined ? 81 : 185;
    const yaw = clamp(start.yaw + (e.clientX - start.x) * .86, -limit, limit);
    const pitch = clamp(start.pitch - (e.clientY - start.y) * .20, -32, 32);
    setAngle(yaw, pitch);
  };
  function end(e: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || e.pointerId !== start.id) return;
    drag.current = null;
    if (dialog.current) delete dialog.current.dataset.readDrag;
    if (start.mode !== 'browse' || !start.dx || !arrival.current) return;
    const layer = arrival.current;
    const matrix = getComputedStyle(layer).transform;
    const dx = e.clientX - start.x;
    const threshold = Math.min(78, Math.max(30, (image.current?.clientWidth || 280) * .16));
    const next = index + ((dx < 0) !== ar ? 1 : -1);
    if (e.type === 'pointerup' && Math.abs(dx) >= threshold && next >= 0 && next < total) {
      selectPrint(next, matrix);
      return;
    }
    layer.style.removeProperty('transform');
    if (matrix !== 'none' && !matchMedia('(prefers-reduced-motion: reduce)').matches && layer.animate) {
      rebound.current = layer.animate([{transform:matrix},{transform:'none'}], {duration:200,easing:'cubic-bezier(.18,.75,.24,1)'});
    }
  }
  function startControlTap(event: TouchEvent<HTMLDialogElement>) {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    const touch = event.touches[0];
    controlTap.current = target && !target.disabled && event.touches.length === 1
      ? { button: target, id: touch.identifier, x: touch.clientX, y: touch.clientY }
      : null;
  }
  function finishControlTap(event: TouchEvent<HTMLDialogElement>) {
    const start = controlTap.current;
    controlTap.current = null;
    if (!start || event.touches.length) return;
    const touch = Array.from(event.changedTouches).find(point => point.identifier === start.id);
    if (!touch || Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 8
      || document.elementFromPoint(touch.clientX, touch.clientY)?.closest('button') !== start.button) return;
    // Chrome can consume the native click of the first tap immediately after a 3D drag.
    // Activate this stationary control tap once and retain native mouse and keyboard activation.
    if (event.cancelable) event.preventDefault();
    start.button.click();
  }
  return <dialog ref={dialog} role="dialog" className="archive-inspector-dialog" aria-modal="true" aria-label={name}
    dir={ar ? 'rtl' : 'ltr'} data-card-reader data-kind={kind} data-inspection={scenes[kind]}
    data-current-id={id} data-current-index={index} data-collection-size={total} data-secret-codex={secret?.releaseId} data-read-turn={turn.current} data-reader-phase={flight ? 'moving' : 'idle'}
    onKeyDown={keyboardBrowse} onTouchStart={startControlTap} onTouchEnd={finishControlTap}
    onTouchCancel={() => { controlTap.current = null; }} onCancel={event => { event.preventDefault(); close(); }}>
    <div className="archive-inspector-shade" onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <CollectorInstrument kind={kind} />
      <div className="archive-reader-top">
        <span>{game}</span>
        <button ref={closeButton} type="button" className="archive-inspector-dismiss" onClick={close} aria-label={ar ? 'إغلاق' : 'Close'}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <figure className="archive-inspector-plate">
        <div className="archive-reader-table" data-comparing={!!reference}>
          {reference && <figure className="archive-reference-print" data-compare-reference={reference.id}>
            <img src={reference.source} alt={reference.name} draggable={false} referrerPolicy="no-referrer" onError={() => setReference(null)} />
            <figcaption><span>{ar ? 'البطاقة المثبّتة' : 'Pinned print'}</span> <bdi>{reference.name}</bdi></figcaption>
          </figure>}
          <div ref={relief} className="archive-inspector-relief">
            <div ref={arrival} className="archive-reader-arrival">
            <div ref={face} className="archive-inspector-face" data-inspection-face data-magnifying={magnifying}
              tabIndex={0} role="group"
              aria-label={ar ? 'اسحب لتصفح الكروت أو استخدم الأسهم. فعّل عدسة التفاصيل لاستكشاف الرسم.' : 'Swipe or use the arrows to browse cards. Enable the detail lens to explore the artwork.'}
              onKeyDown={turnWithKeys} onPointerDown={begin} onPointerMove={move}
              onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
              {print ? <img ref={image} key={id} className="archive-inspector-art" src={print} alt={name} draggable={false} referrerPolicy="no-referrer"
                onError={() => setFailed(old => old.includes(print) ? old : [...old, print])} />
                : <span role="status">{ar ? 'تعذّر تحميل رسم الكرت.' : 'The card artwork could not be loaded.'}</span>}
              <i ref={glint} className="archive-reader-edge-light" aria-hidden="true" />
              {magnifying && print && <span ref={lens} className="archive-reader-lens" aria-hidden="true"
                style={{ backgroundImage: 'url(' + JSON.stringify(print) + ')' }} />}
              <span className="archive-inspector-back" aria-hidden="true" style={back ? { backgroundImage: back === originalBack ? `url('${back}')` : `url('${back}'), url('${originalBack}')` } : undefined} />
            </div>
            </div>
            {flight && <div className="archive-reader-ghost" aria-hidden="true"><div ref={departure} style={{width:flight.width,height:flight.height}}>
              <img src={flight.source} alt="" draggable={false} />
            </div></div>}
          </div>
        </div>
        <figcaption className="archive-inspector-caption">
          <div className="archive-reader-record" aria-live="polite" aria-atomic="true">
            {entry?.group && <span className="archive-reader-group">{entry.group}</span>}
            <strong><ArchiveName>{name}</ArchiveName></strong>
            {narrative && <p className="archive-inspector-description">{narrative}</p>}
          </div>
          <div className="archive-reader-tools">
            {total > 1 && <button type="button" data-art-compare aria-pressed={!!reference} disabled={!print && !reference} onClick={toggleComparison}>
              <i aria-hidden="true" />{ar ? 'مقارنة البطاقات' : 'Compare prints'}
            </button>}
            <button type="button" data-art-turn aria-pressed={turning} onClick={() => { setMagnifying(false); setTurning(value => !value); setAngle(0, 0); }}>
              <i aria-hidden="true" />{ar ? 'تدوير الكرت' : 'Turn card'}
            </button>
            <button type="button" data-art-lens aria-pressed={magnifying} disabled={!print}
              onClick={() => { setTurning(false); setAngle(0, 0); lensPoint.current = {x: .5, y: .5}; setMagnifying(value => !value); }}>
              <i aria-hidden="true" />{ar ? 'عدسة التفاصيل' : 'Detail lens'}
            </button>
            {resetAngleAvailable && <button type="button" className="archive-inspector-reset" onClick={resetAngle}>
              {ar ? 'إعادة زاوية العرض' : 'Reset angle'}
            </button>}
          </div>
          {secret && <LunaSecretCodexReading key={id} className="archive-reader-codex" selection={secret} />}
          {archiveEntries && <ArchiveContactSheet entries={archiveEntries} selected={index} rtl={ar} onSelect={selectPrint} />}
        </figcaption>
      </figure>
      <nav className="archive-reader-nav" aria-label={ar ? 'تصفح الكروت' : 'Browse cards'}>
        <button type="button" data-read-step="previous" aria-disabled={index === 0} onClick={() => selectPrint(index - 1)}>
          <i aria-hidden="true" />{ar ? 'السابق' : 'Previous'}
        </button>
        <span className="archive-reader-count" aria-live="polite" aria-atomic="true">
          {format.format(index + 1)} <span>{ar ? 'من' : 'of'}</span> {format.format(total)}
        </span>
        <button type="button" data-read-step="next" aria-disabled={index >= total - 1} onClick={() => selectPrint(index + 1)}>
          {ar ? 'التالي' : 'Next'}<i aria-hidden="true" />
        </button>
      </nav>
    </div>
  </dialog>;
}
