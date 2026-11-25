'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import styles from './night-journey.module.css';

type Entry = { id: string; title: string; panel: ReactNode };
type Drag = { pointer: number; startX: number; offset: number; index: number; moved: boolean };

function motionBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
}

export function JourneyAtlas({ entries, locale }: { entries: Entry[]; locale: string }) {
  const track = useRef<HTMLDivElement>(null);
  const indexNav = useRef<HTMLElement>(null);
  const drag = useRef<Drag | null>(null);
  const [selected, setSelected] = useState(0);
  const [ready, setReady] = useState(false);
  const rtl = locale === 'ar';
  const last = entries.length - 1;
  const number = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false });

  useEffect(() => {
    setReady(true);
    const node = track.current;
    if (!node) return;
    let restoreFrame = 0;
    let width = node.clientWidth;
    let visible = 0;
    const synchronize = () => {
      if (!node.clientWidth) return;
      visible = Math.min(last, Math.round(Math.abs(node.scrollLeft) / node.clientWidth));
      setSelected(visible);
    };
    node.addEventListener('scroll', synchronize, { passive: true });
    node.addEventListener('scrollend', synchronize);
    document.addEventListener('visibilitychange', synchronize);
    const observer = new ResizeObserver(() => {
      if (width !== node.clientWidth) {
        width = node.clientWidth;
        node.scrollTo({ left: visible * width * (rtl ? -1 : 1), behavior: 'instant' });
      }
      synchronize();
    });
    observer.observe(node);
    const saved = history.state?.lunaJourneyReturn;
    if (saved?.url === location.href && Number.isInteger(saved.index) && Number.isFinite(saved.top)) {
      const panel = node.children[saved.index];
      const link = panel?.querySelector<HTMLAnchorElement>('a[href]');
      if (panel instanceof HTMLElement && link) {
        node.scrollTo({ left: saved.index * width * (rtl ? -1 : 1), behavior: 'instant' });
        restoreFrame = requestAnimationFrame(() => {
          panel.inert = false;
          link.focus({ preventScroll: true });
          window.scrollBy({ top: link.getBoundingClientRect().top - saved.top, behavior: 'instant' });
          const { lunaJourneyReturn, ...state } = history.state ?? {};
          if (lunaJourneyReturn?.url === location.href) history.replaceState(state, '');
        });
      }
    }
    synchronize();
    return () => {
      cancelAnimationFrame(restoreFrame);
      observer.disconnect();
      node.removeEventListener('scroll', synchronize);
      node.removeEventListener('scrollend', synchronize);
      document.removeEventListener('visibilitychange', synchronize);
    };
  }, [last, rtl]);

  useEffect(() => {
    const nav = indexNav.current;
    const anchor = nav?.querySelector<HTMLAnchorElement>(`a[data-index="${selected}"]`);
    if (!nav || !anchor) return;
    Array.from(track.current?.children ?? []).forEach((panel, index) => {
      if (!(panel instanceof HTMLElement)) return;
      const inactive = ready && selected !== index;
      if (inactive && panel.contains(document.activeElement)) anchor.focus({ preventScroll: true });
      panel.inert = inactive;
    });
    const item = anchor.getBoundingClientRect();
    const frame = nav.getBoundingClientRect();
    const delta = item.left < frame.left ? item.left - frame.left : Math.max(0, item.right - frame.right);
    if (delta) nav.scrollBy({ left: delta, behavior: motionBehavior() });
  }, [ready, selected]);

  function choose(index: number, focusLink = false) {
    const node = track.current;
    if (!node) return;
    const target = Math.min(last, Math.max(0, index));
    const distance = Math.abs(Math.abs(node.scrollLeft) / node.clientWidth - target);
    const behavior = distance > 1.1 || document.hidden ? 'instant' : motionBehavior();
    node.scrollTo({ left: target * node.clientWidth * (rtl ? -1 : 1), behavior });
    if (behavior === 'instant') setSelected(target);
    if (focusLink) indexNav.current?.querySelector<HTMLAnchorElement>(`a[data-index="${target}"]`)?.focus({ preventScroll: true });
  }

  function rememberDeparture(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link || link.origin !== location.origin || link.pathname === location.pathname || link.target === '_blank') return;
    history.replaceState({ ...history.state, lunaJourneyReturn: {
      url: location.href, index: selected, top: link.getBoundingClientRect().top,
    } }, '');
  }

  function navigate(event: KeyboardEvent, index: number) {
    const keys: Record<string, number> = { Home: 0, End: last, ArrowRight: index + (rtl ? -1 : 1), ArrowLeft: index + (rtl ? 1 : -1) };
    if (!(event.key in keys)) return;
    event.preventDefault();
    choose(keys[event.key], true);
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return;
    const el = event.target instanceof Element ? event.target : null;
    if (!el?.closest('[data-journey-art]') || el.closest('[role="button"],button,a,input,[contenteditable]')) return;
    const node = event.currentTarget;
    drag.current = { pointer: event.pointerId, startX: event.clientX, offset: node.scrollLeft, index: selected, moved: false };
    node.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointer !== event.pointerId) return;
    const distance = event.clientX - state.startX;
    if (!state.moved && Math.abs(distance) < 6) return;
    state.moved = true;
    const node = event.currentTarget;
    node.dataset.dragging = 'true';
    node.scrollLeft = state.offset - distance;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointer) return;
    drag.current = null;
    const node = event.currentTarget;
    delete node.dataset.dragging;
    if (node.hasPointerCapture(state.pointer)) node.releasePointerCapture(state.pointer);
    if (!state.moved) return;
    const distance = (state.startX - event.clientX) * (rtl ? -1 : 1);
    const threshold = Math.min(84, node.clientWidth * 0.16);
    choose(event.type === 'pointerup' && Math.abs(distance) > threshold ? state.index + Math.sign(distance) : state.index);
  }

  return (
    <div className={styles.atlas} data-journey-atlas data-ready={ready}>
      <div className={styles.viewport} id="journey-scenes" ref={track} data-journey-track
        onClickCapture={rememberDeparture} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        {entries.map((entry, index) => (
          <div id={`journey-${entry.id}`} className={styles.slide} key={entry.id}>
            {entry.panel}
          </div>
        ))}
      </div>
      <div className={styles.console}>
        <nav ref={indexNav} className={styles.index} aria-labelledby="journey-title">
          <ol>
            {entries.map((entry, index) => (
              <li key={entry.id}>
                <a href={`#journey-${entry.id}`} aria-controls={`journey-${entry.id}`} data-index={index}
                  aria-current={selected === index ? 'location' : undefined}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    choose(index);
                  }}
                  onKeyDown={(event) => navigate(event, index)}>
                  <span aria-hidden="true" className={styles.indexNumber}>{number.format(index + 1)}</span>
                  <span>{entry.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className={styles.steppers}>
          <button type="button" aria-controls="journey-scenes" aria-label={rtl ? 'الوجهة السابقة' : 'Previous destination'}
            aria-disabled={selected === 0} data-direction="previous" onClick={() => choose(selected - 1)}>
            <i aria-hidden="true" className={styles.arrow} />
          </button>
          <button type="button" aria-controls="journey-scenes" aria-label={rtl ? 'الوجهة التالية' : 'Next destination'}
            aria-disabled={selected === last} data-direction="next" onClick={() => choose(selected + 1)}>
            <i aria-hidden="true" className={styles.arrow} />
          </button>
        </div>
      </div>
    </div>
  );
}

