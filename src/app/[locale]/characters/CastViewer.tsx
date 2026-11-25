'use client';

import { ArchiveName } from '@/components/ArchiveName';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { approvedPortraitFor, parseCharacterName } from '@/lib/cinematic/people-art';
import type { Character, Locale } from '@/types';
import { CinematicArtwork } from '../cinematic-people/CinematicArtwork';
import s from './cast-viewer.module.css';

interface Props {
  records: Character[];
  locale: Locale;
  selectedId: string | null;
  onSelect: (id: string) => void;
  factionName: (id: string) => string;
  openRecord: (character: Character, opener: HTMLElement) => void;
}

export function CastViewer({ records, locale, selectedId, onSelect, factionName, openRecord }: Props) {
  const ar = locale === 'ar';
  const [detail, setDetail] = useState(false);
  const [shot, setShot] = useState<{to:string; from:string; direction:number; serial:number} | null>(null);
  const surface = useRef<HTMLButtonElement>(null);
  const serial = useRef(0);
  const film = useRef<HTMLDivElement>(null);
  const focusFilmAfterTurn = useRef(false);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const at = Math.max(0, records.findIndex(record => record.id === selectedId));
  const character = records[at];
  useEffect(() => {
    if (!shot) return;
    const timer=window.setTimeout(()=>setShot(null),720);
    return ()=>clearTimeout(timer);
  }, [shot]);
  useLayoutEffect(() => {
    if (!focusFilmAfterTurn.current) return;
    focusFilmAfterTurn.current = false;
    film.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({preventScroll:true});
  }, [character?.id]);
  if (!character) return null;

  const art = approvedPortraitFor(character.imageUrl);
  const { name, subtitle } = parseCharacterName(character.name[locale]);
  const number = (value: number) => value.toLocaleString(locale);
  const count = records.length;
  const start = Math.min(Math.max(0, at - 2), Math.max(0, count - 5));
  const strip = records.slice(start, start + 5);
  const forward = ar ? -1 : 1;

  function select(next: number, delta: number, focusFilm = false) {
    if (count < 2) return;
    const index = (next + count) % count;
    if (index===at) return;
    focusFilmAfterTurn.current = focusFilm && index!==at;
    const previous = surface.current?.querySelector<HTMLImageElement>('[data-current-portrait]');
    if (previous?.complete && previous.naturalWidth && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShot({to:records[index].id,from:previous.currentSrc,direction:Math.sign(delta || 1)*forward,serial:++serial.current});
    } else setShot(null);
    onSelect(records[index].id);
  }

  function navigateKeys(event: KeyboardEvent<HTMLElement>, focusFilm: boolean) {
    if (event.altKey || event.ctrlKey || event.metaKey || count < 2) return;
    const delta = event.key === 'ArrowRight' ? forward : event.key === 'ArrowLeft' ? -forward : 0;
    if (!delta && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = delta ? at + delta : event.key === 'Home' ? 0 : count - 1;
    select(next, delta || next - at, focusFilm);
  }

  function startGesture(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function clearDrag(button: HTMLButtonElement) {
    delete button.dataset.dragging;
    for (const property of ['--drag-x','--drag-far','--drag-roll','--drag-light','--drag-lamp']) button.style.removeProperty(property);
  }

  function finishGesture(event: PointerEvent<HTMLButtonElement>) {
    const startPoint = gesture.current;
    gesture.current = null;
    clearDrag(event.currentTarget);
    if (!startPoint || startPoint.id !== event.pointerId) return;
    const dx = event.clientX - startPoint.x;
    const dy = event.clientY - startPoint.y;
    if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    suppressClickUntil.current = performance.now() + 550;
    const delta = (dx < 0 ? 1 : -1) * forward;
    select(at + delta, delta);
  }

  function pointLight(event: PointerEvent<HTMLButtonElement>) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start=gesture.current;
    if (start && start.id===event.pointerId && count>1) {
      const dx=event.clientX-start.x, dy=event.clientY-start.y;
      if (Math.abs(dx)>5 && Math.abs(dx)>Math.abs(dy)*1.2) {
        const pull=Math.max(-150,Math.min(150,dx));
        const button=event.currentTarget;
        button.dataset.dragging='true';
        button.style.setProperty('--drag-x',(pull*.40)+'px');
        button.style.setProperty('--drag-far',(-pull*.19)+'px');
        button.style.setProperty('--drag-roll',(pull/64)+'deg');
        button.style.setProperty('--drag-light',String(Math.min(.8,Math.abs(pull)/160)));
        button.style.setProperty('--drag-lamp',(50+pull*.26)+'%');
      }
      return;
    }
    if (event.pointerType !== 'mouse' || event.buttons) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    event.currentTarget.style.setProperty('--portrait-yaw', ((x - .5) * 3).toFixed(2) + 'deg');
    event.currentTarget.style.setProperty('--portrait-pitch', ((.5 - y) * 2).toFixed(2) + 'deg');
  }

  function flatten(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.style.removeProperty('--portrait-yaw');
    event.currentTarget.style.removeProperty('--portrait-pitch');
  }

  const changing=shot?.to===character.id ? shot : null;
  const turnButton=(step:number)=><button type="button" key={step} data-cast-step={step} disabled={count<2}
    aria-label={step<0?(ar?'الصورة السابقة':'Previous portrait'):(ar?'الصورة التالية':'Next portrait')}
    onClick={()=>select(at+step,step)}>{step*forward<0?'←':'→'}</button>;
  return <div className={s.viewer} data-cast-viewer={character.id} data-frame={detail ? 'detail' : 'whole'}
    data-changing={!!changing} data-direction={changing?.direction??1}>
    <div className={s.viewerMount}>
      <button type="button" className={s.viewerSurface} data-character-id={character.id} ref={surface}
        aria-label={character.name[locale]} aria-haspopup="dialog"
        onKeyDown={event => navigateKeys(event, false)}
        onPointerDown={startGesture} onPointerUp={finishGesture} onPointerCancel={event => { gesture.current = null;clearDrag(event.currentTarget); }}
        onPointerMove={pointLight} onPointerLeave={flatten}
        onClick={event => {
          if (event.detail && performance.now() < suppressClickUntil.current) return;
          openRecord(character, event.currentTarget);
        }}>
        <span className={s.stageRoom} data-portrait-backdrop aria-hidden="true"><CinematicArtwork approved={art?.thumb} original={character.imageUrl} alt="" draggable={false} width={140} height={210}/></span>
        <span className={s.viewerGlass} data-portrait-glass>
          <span key={character.id} className={s.viewerArrival} data-cast-arrival>
            <CinematicArtwork approved={art?.medium} original={character.imageUrl} alt={character.name[locale]} data-current-portrait draggable={false}
              width={600} height={900} sizes="(max-width:760px) 87vw, 41vw" className={s.viewerImage} />
          </span>
        </span>
        {changing && <span key={changing.serial} className={s.departure} aria-hidden="true">
          <img src={changing.from} alt="" draggable={false} className={s.departingImage} data-cast-outgoing/>
          <span className={s.travellingLight} data-cast-light/>
        </span>}
        <span className={s.pullLight} aria-hidden="true"/>
      </button>
      <div className={s.mountTools} data-mount-tools>{turnButton(-1)}<div className={s.frameControls} role="group" aria-label={ar ? 'تأطير الصورة' : 'Portrait framing'}>
        <button type="button" aria-pressed={!detail} onClick={() => setDetail(false)}>{ar ? 'الصورة كاملة' : 'Full portrait'}</button>
        <button type="button" aria-pressed={detail} onClick={() => setDetail(true)}>{ar ? 'تقريب التفاصيل' : 'Closer detail'}</button>
      </div>{turnButton(1)}</div>
    </div>
    <div className={s.viewerCopy}>
      <div className={s.viewerMeta}><span>{factionName(character.faction)}</span><bdi>{number(at + 1)} / {number(count)}</bdi></div>
      <h3 data-viewer-name><ArchiveName>{name}</ArchiveName></h3>
      {subtitle && <p className={s.viewerSubtitle}>{subtitle}</p>}
      {character.lore?.[locale] && <p className={s.viewerLore}>{character.lore[locale]}</p>}
      <button type="button" className={s.viewerOpen} data-open-portrait aria-haspopup="dialog"
        onClick={event => openRecord(character, event.currentTarget)}>{ar ? 'افتح ملف الشخصية' : 'Open character record'} <span aria-hidden="true">↗</span></button>
      <div className={s.viewerReel}>
        <div className={s.reelHeading}>
          <span>{ar ? 'شريط الصور' : 'Portrait filmstrip'}</span>
          <div className={s.reelArrows}>
            {([-1,1] as const).map(turnButton)}
          </div>
        </div>
        <div className={s.filmstrip} ref={film} role="group" aria-label={ar ? 'اختيار صورة من الشريط' : 'Choose a portrait from the filmstrip'}
          onKeyDown={event => navigateKeys(event, true)}>
          {strip.map((entry, i) => <button type="button" key={entry.id} data-portrait-choice={entry.id}
            tabIndex={entry.id === character.id ? 0 : -1} aria-pressed={entry.id === character.id}
            aria-label={entry.name[locale]} title={entry.name[locale]} onClick={() => select(start + i, start + i - at)}>
            <CinematicArtwork approved={approvedPortraitFor(entry.imageUrl)?.thumb} original={entry.imageUrl} alt=""
              width={120} height={180} sizes="(max-width:760px) 16vw, 7vw" />
          </button>)}
        </div>
      </div>
      <span role="status" className={s.screenReaderOnly}>{name} · {number(at + 1)} / {number(count)}</span>
    </div>
  </div>;
}

