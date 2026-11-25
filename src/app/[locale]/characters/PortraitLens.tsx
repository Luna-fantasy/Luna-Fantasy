'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

type PortraitLensProps = { children: ReactNode; locale: string; overviewSrc?: string; subject?: 'portrait' | 'scene' };
const clamp = (value: number) => Math.max(0, Math.min(100, value));

function paintedPortrait(frame: HTMLDivElement) {
  const box = frame.getBoundingClientRect();
  const native = frame.querySelector<HTMLImageElement>('img:not([data-lens-preview])');
  const image = native?.naturalWidth ? native : frame.querySelector<HTMLImageElement>('[data-lens-preview]');
  if (!image?.naturalWidth || !image.naturalHeight || !box.width || !box.height) return box;
  const ratio = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
  const width = image.naturalWidth * ratio;
  const height = image.naturalHeight * ratio;
  const [horizontal, vertical] = getComputedStyle(image).objectPosition.split(' ');
  function offset(space: number, value: string) {
    const amount = Number.parseFloat(value);
    if (!Number.isFinite(amount)) return space / 2;
    return value.endsWith('%') ? space * amount / 100 : amount;
  }
  return { left: box.left + offset(box.width - width, horizontal), top: box.top + offset(box.height - height, vertical), width, height };
}

export function PortraitLens({ children, locale, overviewSrc, subject = 'portrait' }: PortraitLensProps) {
  const ar = locale === 'ar';
  const [zoom, setZoom] = useState(false);
  const [nativeReady, setNativeReady] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const point = useRef({ x: 50, y: 38 });

  useEffect(() => {
    const image = frame.current?.querySelector<HTMLImageElement>('img:not([data-lens-preview])');
    if (!overviewSrc || !image) return;
    let mounted = true;
    const ready = () => {
      if (image.naturalWidth) image.decode().then(() => { if (mounted) setNativeReady(true); }).catch(() => {});
    };
    image.addEventListener('load', ready);
    if (image.complete) ready();
    return () => { mounted = false; image.removeEventListener('load', ready); };
  }, [overviewSrc]);

  const focus = useCallback((x: number, y: number) => {
    const root = area.current;
    const surface = frame.current;
    if (!root || !surface) return;
    const target = { x: clamp(x), y: clamp(y) };
    point.current = target;
    const box = surface.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const art = paintedPortrait(surface);
    root.style.setProperty('--map-x', target.x + '%');
    root.style.setProperty('--map-y', target.y + '%');
    root.style.setProperty('--lens-x', (100 * (art.left - box.left) + target.x * art.width) / box.width + '%');
    root.style.setProperty('--lens-y', (100 * (art.top - box.top) + target.y * art.height) / box.height + '%');
  }, []);

  useEffect(() => {
    const surface = frame.current;
    if (!zoom || !surface) return;
    const refresh = () => focus(point.current.x, point.current.y);
    const observer = new ResizeObserver(refresh);
    observer.observe(surface);
    surface.addEventListener('load', refresh, true);
    return () => { observer.disconnect(); surface.removeEventListener('load', refresh, true); };
  }, [zoom, focus]);

  function change(next: boolean) {
    setZoom(next);
    if (!next) focus(50, 38);
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (!zoom) return;
    const step = event.shiftKey ? 2 : 8;
    const changeBy: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const delta = changeBy[event.key];
    if (!delta && event.key !== 'Home' && event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      change(false);
      toggle.current?.focus({ preventScroll: true });
    } else if (event.key === 'Home') {
      focus(50, 50);
    } else {
      focus(point.current.x + delta[0], point.current.y + delta[1]);
    }
  }

  function place(event: PointerEvent<HTMLElement>, map: boolean) {
    if (!zoom || !event.isPrimary || !frame.current) return;
    const box = map ? event.currentTarget.getBoundingClientRect() : paintedPortrait(frame.current);
    if (box.width && box.height) focus((event.clientX - box.left) * 100 / box.width, (event.clientY - box.top) * 100 / box.height);
  }

  return <div className="char-lightbox-img portrait-lens" data-zoom={zoom} ref={area} onKeyDown={key}>
    <div className="portrait-lens-frame" ref={frame}
      onPointerDown={event => {
        if (!zoom || !event.isPrimary || event.button !== 0) return;
        if (event.pointerType !== 'mouse') event.currentTarget.setPointerCapture(event.pointerId);
        place(event, false);
      }}
      onPointerMove={event => {
        if (event.pointerType === 'mouse' || event.buttons) place(event, false);
      }}>
      {children}
      {overviewSrc && !nativeReady && <img data-lens-preview src={overviewSrc} alt="" aria-hidden="true" draggable={false}/>}
    </div>
    <button ref={toggle} type="button" className="portrait-lens-toggle" aria-pressed={zoom} onClick={() => change(!zoom)}>
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5m-12-10h4"/>{!zoom && <path d="M10 8v4"/>}</svg>
      {ar ? (zoom ? (subject === 'scene' ? 'عرض المشهد كاملاً' : 'عرض الشخصية') : 'تكبير التفاصيل')
        : (zoom ? (subject === 'scene' ? 'Full scene' : 'Full portrait') : 'Inspect detail')}
    </button>
    {zoom && overviewSrc && <button type="button" className="portrait-lens-overview"
      aria-label={ar ? 'تحديد موضع التكبير على الصورة المصغّرة. تحرّك بالأسهم أو اضغط Home للوسط.'
        : (subject === 'scene' ? 'Choose a detail on the scene overview. Use the arrow keys to move or Home to centre.' : 'Choose a detail on the portrait overview. Use the arrow keys to move or Home to centre.')}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home Escape"
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        place(event, true);
      }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) place(event, true); }}
      onClick={event => { if (event.detail === 0) focus(50, 50); }}>
      <img src={overviewSrc} alt="" draggable={false}/>
      <span aria-hidden="true"/>
    </button>}
  </div>;
}

