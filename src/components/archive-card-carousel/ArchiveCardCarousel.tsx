'use client';
/* eslint-disable @next/next/no-img-element -- card URLs and dimensions already come from the approved projection. */
import { ArchiveName } from '@/components/ArchiveName';
import {
  useEffect, useId, useMemo, useReducer, useRef, useState,
  type KeyboardEvent, type PointerEvent, type Ref,
} from 'react';
import {
  archiveArrowDirection, archiveCarouselReducer, createArchiveCarouselState,
  planArchiveMotion, playArchiveMotion, type ArchiveDirection, type ArchiveKind,
} from './archive-carousel-model';
import { readerDragTransform } from './archive-reader-motion';
import { ArchiveDeck } from './ArchiveDeck';
import { ArchiveContactSheet } from './ArchiveContactSheet';
import styles from './archive-card-carousel.module.css';

export type ArchiveCardEntry = {
  id: string;
  name: string;
  group?: string;
  detail: string;
  thumb?: string;
  releaseId?: string;
  visualFix?: string;
  description?: string;
  width?: number;
  height?: number;
};

export type ArchiveCardCarouselProps = {
  variant: ArchiveKind;
  locale: string;
  entries: readonly ArchiveCardEntry[];
  initialId?: string | null;
  onInspect: (entry: ArchiveCardEntry, trigger: HTMLButtonElement) => void;
  /** Optional controls for the real catalog index; no extra grid or book is rendered here. */
  index?: { open: boolean; controls?: string; onToggle: () => void };
};

const REFERENCE: Record<ArchiveKind, { title: [string, string]; description?: [string, string] }> = {
  luna: {
    title: ['The Dealer’s Table', 'طاولة توزيع الكروت'],
    description: ['The next card lifts from the deck.', 'الكرت التالي يطلع من الرزمة.'],
  },
  grand: {
    title: ['Grand Fantasy Cards', 'كروت جراند فانتسي'],
    description: ['Each new plate is set into the folio.', 'كل كرت يدخل في مكانه داخل السِجل.'],
  },
  faction: {
    title: ['The War Chamber', 'قاعة الفصائل'],
    description: ['Steel shutters reveal the next faction card.', 'مصاريع من الفولاذ تكشف كرت الفصيل التالي.'],
  },
};
const motionQuery = '(prefers-reduced-motion: reduce)';
const getMediaPreference = () => typeof window.matchMedia === 'function' && window.matchMedia(motionQuery).matches;

function useMotionPreference() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(motionQuery);
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

function waitForFace(image: HTMLImageElement, signal: AbortSignal) {
  if (image.complete || signal.aborted) return Promise.resolve();
  return new Promise<void>(resolve => {
    const finish = () => {
      clearTimeout(timer);
      image.removeEventListener('load', finish);
      image.removeEventListener('error', finish);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, 270);
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
    signal.addEventListener('abort', finish, { once: true });
  });
}

function Artwork({ card, imageRef }: { card: ArchiveCardEntry; imageRef?: Ref<HTMLImageElement> }) {
  const preferred = card.visualFix || card.detail || card.thumb || '';
  const [failedSource, setFailed] = useState('');
  const src = failedSource === preferred && card.thumb ? card.thumb : preferred;
  return (
    <img ref={imageRef} src={src} width={card.width ?? 640} height={card.height ?? 960}
      alt="" draggable={false} decoding="async"
      onError={() => { if (src === preferred && card.thumb && card.thumb !== src) setFailed(preferred); }} />
  );
}

function NeighborPrint({ card, hand, label, arriving, onClick }: {
  card: ArchiveCardEntry;
  hand: 'left' | 'right';
  label: string;
  arriving: boolean;
  onClick: () => void;
}) {
  return (
    <button className={styles.neighborPrint} type="button" data-hand={hand}
      data-neighbor-id={card.id} data-arriving={arriving} aria-label={label} onClick={onClick}>
      <img src={card.thumb || card.detail} width={card.width ?? 640} height={card.height ?? 960}
        loading="lazy" decoding="async" alt="" draggable={false} />
    </button>
  );
}

export function ArchiveCardCarousel({ variant, locale, entries, initialId, onInspect, index }: ArchiveCardCarouselProps) {
  const language = locale.toLowerCase().split('-')[0] === 'ar' ? 'ar' : 'en';
  const rtl = language === 'ar';
  const label = (en: string, ar: string) => rtl ? ar : en;
  const headline = useId();
  const [spread, setSpread] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const outgoing = useRef<HTMLDivElement>(null);
  const incoming = useRef<HTMLDivElement>(null);
  const heldPose = useRef<string | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const suppressTap = useRef(false);
  const incomingImage = useRef<HTMLImageElement>(null);
  const upperShutter = useRef<HTMLElement>(null);
  const lowerShutter = useRef<HTMLElement>(null);
  const centerShutter = useRef<HTMLElement>(null);
  const inspectButton = useRef<HTMLButtonElement>(null);
  const requestedTrigger = useRef<HTMLButtonElement | null>(null);
  const latestDelivery = useRef(0);
  const cachedNeighbors = useRef(new Map<string, HTMLImageElement>());

  const byId = useMemo(() => {
    const map = new Map<string, ArchiveCardEntry>();
    for (const card of entries) {
      if (card.id && card.name && (card.detail || card.thumb) && !map.has(card.id)) map.set(card.id, card);
    }
    return map;
  }, [entries]);
  const ids = useMemo(() => Array.from(byId.keys()), [byId]);
  const [state, dispatch] = useReducer(archiveCarouselReducer, { ids, initialId },
    seed => createArchiveCarouselState(seed.ids, seed.initialId));
  useEffect(() => { dispatch({ type: 'sync', ids, seedId: initialId }); }, [ids, initialId]);

  const current = state.currentId ? byId.get(state.currentId) : undefined;
  const target = state.turn ? byId.get(state.turn.to) : undefined;
  const position = current ? ids.indexOf(current.id) : -1;
  const reduced = useMotionPreference();
  const previous = position >= 0 && ids.length > 2 ? byId.get(ids[(position + ids.length - 1) % ids.length]) : undefined;
  const next = position >= 0 && ids.length > 1 ? byId.get(ids[(position + 1) % ids.length]) : undefined;

  useEffect(() => {
    if (position < 0 || ids.length < 2) return;
    const cache = cachedNeighbors.current;
    for (const step of [-1, 1]) {
      const near = byId.get(ids[(position + ids.length + step) % ids.length]);
      const src = near?.visualFix || near?.detail || near?.thumb;
      if (src && !cache.has(src)) {
        const image = new Image();
        image.decoding = 'async';
        image.src = src;
        cache.set(src, image);
      }
    }
    while (cache.size > 6) {
      const oldest = cache.keys().next();
      if (oldest.done) break;
      cache.delete(oldest.value);
    }
  }, [byId, ids, position]);

  useEffect(() => {
    const turn = state.turn;
    if (!turn) return;
    const controller = new AbortController();
    const { signal } = controller;
    const run = async () => {
      try {
        if (reduced || getMediaPreference() || !outgoing.current || !incoming.current) return;
        if (incomingImage.current) await waitForFace(incomingImage.current, signal);
        if (signal.aborted || getMediaPreference() || !outgoing.current || !incoming.current) return;
        const plan = planArchiveMotion(variant, turn.direction, rtl, stage.current?.getBoundingClientRect().width ?? 0);
        const carry = heldPose.current;
        heldPose.current = null;
        if (carry) {
          plan.outgoing.frames[0] = { ...plan.outgoing.frames[0], transform: carry };
          outgoing.current.style.removeProperty('transform');
        }
        const shutters = [upperShutter.current, lowerShutter.current, centerShutter.current].filter((node): node is HTMLElement => !!node);
        await playArchiveMotion(plan, { outgoing: outgoing.current, incoming: incoming.current, shutters }, { signal });
      } catch {
        // Missing native animation capabilities do not stop catalog controls.
      } finally {
        if (!signal.aborted) dispatch({ type: 'finish', token: turn.token });
      }
    };
    void run();
    return () => controller.abort();
  }, [state.turn, rtl, reduced, variant]);

  useEffect(() => {
    const request = state.inspection;
    if (!request || request.token <= latestDelivery.current) return;
    latestDelivery.current = request.token;
    const entry = byId.get(request.id);
    const preferred = requestedTrigger.current;
    const trigger = preferred?.isConnected ? preferred : inspectButton.current;
    requestedTrigger.current = null;
    if (entry && trigger) onInspect(entry, trigger);
  }, [byId, state.inspection, onInspect]);

  const step = (direction: ArchiveDirection) => dispatch({ type: 'step', direction, instant: spread || reduced || getMediaPreference() });
  const beginDrag = (event: PointerEvent<HTMLDivElement>) => {
    if(spread && ids.length>1)return;
    if (!event.isPrimary || event.button !== 0) return;
    suppressTap.current = false;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    // Capture on the original button or stage so an ordinary tap still activates the button.
    if (event.target instanceof Element) event.target.setPointerCapture(event.pointerId);
  };
  const trackDrag = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId || !outgoing.current || state.turn || ids.length < 2 || getMediaPreference()) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) < 5 || Math.abs(dx) < Math.abs(event.clientY - start.y)) return;
    const width = outgoing.current.clientWidth;
    const shown = Math.max(-width * .85, Math.min(width * .85, dx));
    outgoing.current.style.transform = readerDragTransform(shown, width);
    if (stage.current) stage.current.dataset.deckDrag = String(Math.round(shown));
  };
  const releasePose = (continueTurn: boolean) => {
    if (stage.current) delete stage.current.dataset.deckDrag;
    const layer = outgoing.current;
    if (!layer?.style.transform) return;
    const from = getComputedStyle(layer).transform;
    if (continueTurn && !state.turn) { heldPose.current = from; return; }
    layer.style.removeProperty('transform');
    if (layer.animate && !getMediaPreference()) layer.animate([{ transform: from }, { transform: 'none' }], {duration:180,easing:'ease-out'});
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    drag.current = null;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    suppressTap.current = Math.max(Math.abs(dx), Math.abs(dy)) >= 12;
    const move = ids.length > 1 && Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy) * 1.25;
    releasePose(move);
    if (!move) return;
    step((dx < 0) !== rtl ? 1 : -1);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const direction = archiveArrowDirection(event.key, rtl, event.altKey || event.ctrlKey || event.metaKey || event.shiftKey);
    if (direction === null || ids.length < 2 || event.defaultPrevented) return;
    event.preventDefault();
    step(direction);
  };
  const inspect = (trigger: HTMLButtonElement) => {
    requestedTrigger.current = trigger;
    dispatch({ type: 'inspect' });
  };
  const scene = REFERENCE[variant];
  const inspectLabel = label('Inspect card', 'افحص الكرت');
  const counter = useMemo(() => new Intl.NumberFormat(language), [language]);
  const count = current ? label(`${counter.format(position + 1)} of ${counter.format(ids.length)}`,
    `${counter.format(position + 1)} من ${counter.format(ids.length)}`) : '';

  return (
    <section id="card-showcase" className={styles.showcase} data-card-workbench data-kind={variant} data-testid="archive-card-carousel"
      data-current-id={current?.id ?? ''} data-count={ids.length}
      data-phase={state.turn ? 'transition' : 'rest'} dir={rtl ? 'rtl' : 'ltr'}
      tabIndex={ids.length > 1 ? 0 : undefined} aria-labelledby={headline}
      aria-roledescription={label('carousel', 'معرض متتابع')} onKeyDown={onKeyDown}>
      <header className={styles.masthead}>
        <h2 className={styles.heading} id={headline}>{label(...scene.title)}</h2>
        {ids.length > 1 && <div className="archive-view-switch" role="group" aria-label={label('Display', 'طريقة العرض')}>
          <button type="button" aria-pressed={!spread} onClick={() => setSpread(false)}>{label('Single card', 'كرت واحد')}</button>
          <button type="button" aria-pressed={spread} onClick={() => setSpread(true)}>{label('Spread', 'الرزمة')}</button>
        </div>}
      </header>
      <div className={styles.shell}>
        {current && (
          <div className={styles.stage} data-deck-layout={spread && ids.length>1 ? 'spread' : 'single'} ref={stage} onPointerDown={beginDrag} onPointerMove={trackDrag} onPointerUp={endDrag}
            onPointerCancel={() => { drag.current = null; suppressTap.current = true; releasePose(false); }}
            onClickCapture={event => {
              if (event.detail && suppressTap.current) {
                event.preventDefault();
                event.stopPropagation();
                suppressTap.current = false;
              }
            }}>
            {spread && ids.length>1 && (<ArchiveDeck entries={byId} ids={ids} current={position} rtl={rtl} inspect={inspect}
            choose={(id,direction) => dispatch({type:'select',id,direction,instant:true})} />)}
            <div className={styles.rail} aria-hidden="true" />
            {next && (
              <div className={`${styles.stack} ${styles.neighborTray}`} data-neighbor-tray data-moving={!!target}>
                {previous && <NeighborPrint card={previous} hand={rtl ? 'right' : 'left'}
                  label={label('Previous · ', 'السابق · ') + previous.name}
                  arriving={target?.id === previous.id} onClick={() => step(-1)} />}
                <NeighborPrint card={next} hand={rtl ? 'left' : 'right'}
                  label={label('Next · ', 'التالي · ') + next.name}
                  arriving={target?.id === next.id} onClick={() => step(1)} />
              </div>
            )}
            <div className={styles.stack}>
              <div className={styles.face} key={current.id} ref={outgoing} data-card-id={current.id}>
                <Artwork card={current} />
                <button className={styles.stageAction} type="button" tabIndex={-1}
                  aria-haspopup="dialog" aria-label={`${inspectLabel}: ${current.name}`}
                  onClick={event => inspect(event.currentTarget)} />
              </div>
              {target && (
                <div className={`${styles.face} ${styles.incoming}`} key={target.id} ref={incoming}
                  aria-hidden="true" data-card-id={target.id}>
                  <Artwork card={target} imageRef={incomingImage} />
                </div>
              )}
              {target && variant === 'grand' && (
                <div className={styles.gate} aria-hidden="true">
                  <i className={`${styles.matte} ${styles.upper}`} ref={upperShutter} />
                  <i className={`${styles.matte} ${styles.lower}`} ref={lowerShutter} />
                </div>
              )}
            </div>
            {target && variant === 'faction' && (
              <div className={styles.shutter} aria-hidden="true">
                <i ref={upperShutter} className={`${styles.blade} ${styles.west}`} />
                <i ref={lowerShutter} className={`${styles.blade} ${styles.east}`} />
                <i ref={centerShutter} className={`${styles.blade} ${styles.standard}`} />
              </div>
            )}
          </div>
        )}
        <div className={styles.panel}>
          <div className={styles.record} aria-live="polite" aria-atomic="true">
            {current?.group && <p className={styles.group}>{current.group}</p>}
            <h3 className={styles.name}>{current ? <ArchiveName>{current.name}</ArchiveName> : label('No matching cards', 'ما فيه كروت مطابقة')}</h3>
            {current?.description && <p className={styles.description}>{current.description}</p>}
            {count && <span className={styles.count}>{count}</span>}
          </div>
          <div className={styles.navigation} role="group" aria-label={label('Browse cards', 'تصفّح الكروت')}>
            <button type="button" onClick={() => step(-1)} disabled={ids.length < 2}>
              <span className={styles.arrow} aria-hidden="true">{rtl ? '→' : '←'}</span>{label('Previous', 'السابق')}
            </button>
            <button type="button" onClick={() => step(1)} disabled={ids.length < 2}>
              <span className={styles.arrow} aria-hidden="true">{rtl ? '←' : '→'}</span>{label('Next', 'التالي')}
            </button>
          </div>
          <div className={styles.actions} role="group" aria-label={label('Card actions', 'خيارات الكرت')}>
            <button className={styles.inspect} type="button" aria-haspopup="dialog" ref={inspectButton}
              disabled={!current} onClick={event => inspect(event.currentTarget)}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V6A1.5 1.5 0 0 1 7 4.5zm2 5h6m-6 4.5h6m-6 3h4" />
              </svg>
              {inspectLabel}
            </button>
            {index && (
              <button className={styles.index} type="button" aria-expanded={index.open}
                aria-controls={index.controls} onClick={index.onToggle}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M5.5 6h2m3.5 0h7.5M5.5 12h2m3.5 0h7.5m-13 6h2m3.5 0h7.5" />
                </svg>
                {index.open ? label('Hide index', 'اخفِ الفهرس') : label('Show index', 'اعرض الفهرس')}
              </button>
            )}
          </div>
        </div>
      </div>
      {current && <ArchiveContactSheet entries={ids.map(id => byId.get(id)!)} selected={position} rtl={rtl} scrub
        onSelect={to => dispatch({ type: 'select', id: ids[to], direction: to < position ? -1 : 1, instant: spread || reduced || getMediaPreference() })}
        onScrub={to => dispatch({ type: 'select', id: ids[to], direction: to < position ? -1 : 1, instant: true })} />}
    </section>
  );
}

export default ArchiveCardCarousel;
