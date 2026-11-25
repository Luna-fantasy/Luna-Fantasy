'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useLocale } from 'next-intl';
import type { FactionWarFaction } from '@/types/faction-war';
import type { Locale } from '@/types';
import { fantasyCourtBack } from '@/lib/cinematic/fantasy-court-back';
import { councilComposition, councilGroupOrder, councilHall, councilRepresentative, dealerProgress, lunaDealer, nextCouncilIndex } from '@/lib/cinematic-luna-faction';
import styles from './cinematic-games.module.css';

/** Single scheduled draw. No background animation, global DOM adoption, media fetches, or orphaned timers. */
function useSceneTimeline(root: RefObject<HTMLElement>, update: (root: HTMLElement, progress: number, reduced: boolean) => void, intro: number) {
  useEffect(() => {
    const scene = root.current;
    if (!scene) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const started = performance.now();
    let gone = Math.max(0, -scene.getBoundingClientRect().top) > 4;
    let raf = 0, visible = true;
    const draw = (time: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const offset = Math.max(0, -scene.getBoundingClientRect().top);
      const span = Math.max(90, scene.offsetHeight - scene.firstElementChild!.getBoundingClientRect().height);
      if (offset > 4) gone = true;
      const scroll = dealerProgress(offset / span);
      const timeStep = dealerProgress((time - started) / 1500);
      const active = motion.matches ? 0 : (gone ? scroll : Math.max(scroll, intro*timeStep*timeStep*(3-2*timeStep)));
      update(scene, active, motion.matches);
      if (!gone && !motion.matches && timeStep < 1) schedule();
    };
    function schedule() {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(draw);
    }
    const observe = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) schedule();
      else if (raf) { cancelAnimationFrame(raf); raf=0; }
    }, { rootMargin: '80px' }) : null;
    observe?.observe(scene);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('pageshow', schedule);
    document.addEventListener('visibilitychange', schedule);
    motion.addEventListener?.('change', schedule);
    schedule();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      observe?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('pageshow', schedule);
      document.removeEventListener('visibilitychange', schedule);
      motion.removeEventListener?.('change', schedule);
    };
  }, [root, update, intro]);
}

const dealerRenderer = '/luna-cinematic/cards/stages/luna/dealer-stage.mjs?v=2';
const dealerStageCards = lunaDealer.cards.map((card, index) => ({
  ...card,
  back: fantasyCourtBack(index, card.back),
  originalBack: card.back,
  thumb: `/luna-cinematic/cards/fantasy/${card.id}/thumb.webp`,
}));
type DealerHandle = { ready: Promise<void>; dispose: () => void };
type DealerModule = { mountLunaDealer: (stage: {
  hero: HTMLElement;
  holder: HTMLDivElement;
  wrap: HTMLDivElement;
  photo: HTMLImageElement;
  cards: typeof dealerStageCards;
  reduced: MediaQueryList;
}) => DealerHandle };

export function LunaDealerScene({ children }: { children:ReactNode }) {
  const stage = useRef<HTMLElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLImageElement>(null);
  const locale = useLocale();
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let generation = 0;
    let stageHandle: DealerHandle | undefined;
    const start = async () => {
      const attempt = ++generation;
      stageHandle?.dispose();
      stageHandle = undefined;
      const host = holder.current;
      if (!host) return;
      if (reduced.matches) {
        host.dataset.gameStage = 'static-full-original';
        return;
      }
      try {
        const player = await import(/* webpackIgnore: true */ dealerRenderer) as DealerModule;
        if (attempt !== generation || !stage.current || host !== holder.current || !frame.current || !photo.current) return;
        stageHandle = player.mountLunaDealer({
          hero: stage.current, holder: host, wrap: frame.current, photo: photo.current, cards: dealerStageCards, reduced,
        });
        await stageHandle.ready;
      } catch {
        if (attempt === generation && host === holder.current)
          host.dataset.gameStage = 'static-full-original';
      }
    };
    void start();
    reduced.addEventListener?.('change', start);
    return () => {
      ++generation;
      reduced.removeEventListener?.('change', start);
      stageHandle?.dispose();
    };
  }, []);
  return (
    <section className={styles.dealer} data-cinematic-game="luna-fantasy" ref={stage}>
      <div className={styles.dealerFrame} ref={frame}>
        <div className={styles.dealerVisual} ref={holder}>
          {/* eslint-disable-next-line @next/next/no-img-element -- keep the exact approved table bytes in SSR and Canvas. */}
          <img className={styles.dealerTable} ref={photo} src={lunaDealer.poster}
            alt={locale === 'ar' ? 'طاولة لونا فانتاسي وعليها خمس بطاقات' : 'The Luna Fantasy dealer’s table with five cards'}
            fetchPriority="high" loading="eager" decoding="async" width={1536} height={1024} draggable={false} />
        </div>
        {children}
      </div>
    </section>
  );
}

function drawCouncil(scene: HTMLElement, progress: number, reduced: boolean) {
  const time = reduced ? .90 : Math.max(.20,progress);
  scene.dataset.sceneMotion = reduced ? 'still' : 'reversible';
  scene.dataset.councilPhase = String(time<.43?1:time<.78?2:3);
  scene.style.setProperty('--council-p', time.toFixed(4));
}

const beats = {
  en:['Council summons','Standards unfurl','Faction tableau'],
  ar:['نداء المجلس','رفع الرايات','تشكيل الفصائل'],
};

export function FactionCouncilScene({ children, factions, locale, onOpenFaction }: {
  children: ReactNode; factions: FactionWarFaction[]; locale: Locale; onOpenFaction: (id:string) => void;
}) {
  const scene = useRef<HTMLElement>(null);
  const [chosen,setChosen] = useState<string>();
  const groups = councilGroupOrder.flatMap(id=>{
    const group = factions.find(f=>f.id===id);
    return group ? [group] : [];
  });
  const groupIds = groups.map(g=>g.id);
  const current = Math.max(0,groupIds.indexOf(chosen ?? 'knights'));
  const selection = groups[current];
  useSceneTimeline(scene,drawCouncil,.67);
  const composition = councilComposition(groupIds,current,chosen===undefined).map(id=>{
    const faction = groups.find(g=>g.id===id)!;
    return { faction, art: councilRepresentative(id, faction.cards) };
  });
  const step = (dir:number) => {
    if (!groups.length) return;
    setChosen(groups[nextCouncilIndex(current,dir,groups.length)].id);
  };
  const count = selection ? new Intl.NumberFormat(locale).format(selection.cards.length) : '';
  const ar = locale==='ar';
  return (
    <section className={styles.council} data-cinematic-game="faction-war" ref={scene} data-selected-faction={selection?.id}>
      <div className={styles.councilFrame}>
        <div className={styles.councilVisual}>
          <picture aria-hidden="true">
            <source media="(max-width: 780px)" srcSet={councilHall.mobile} />
            <img className={styles.councilHall} src={councilHall.desktop} alt="" width={1672} height={941} fetchPriority="high" draggable={false} />
          </picture>
          <svg className={styles.councilMap} viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
            <path pathLength="1" d="M220 492C315 461 380 509 488 482S682 389 803 469S885 468 960 432M419 538C529 526 506 451 668 453S792 539 939 511" />
          </svg>
          <div className={styles.councilFlags} aria-hidden="true">
            {composition.map(({ faction, art },i) => (
              <div className={styles.councilFlag} key={faction.id} style={{'--council-color':faction.color,'--rank':i} as CSSProperties}>
                {art?.seal ? <img src={art.seal} alt="" width={86} height={86} draggable={false} /> : <span className={styles.councilOrnament} />}
                <b>{String(groupIds.indexOf(faction.id)+1).padStart(2,'0')}</b>
              </div>
            ))}
          </div>
          <div className={styles.councilCards} role="group" aria-label={ar ? 'بطاقات الفصائل في المجلس' : 'Faction cards at the council'}>
            {composition.map(({ faction, art }, i) => {
              if (!art) return null;
              const selected = faction.id === selection?.id;
              const name = faction.name[locale];
              return (
                <button
                  type="button" key={faction.id} className={styles.councilCard}
                  data-council-card={art.id} data-council-seat={faction.id}
                  data-council-seat-action={selected ? 'open' : 'choose'} data-slot={i}
                  aria-label={selected ? (ar ? 'عرض بطاقات ' + name : 'View cards for ' + name) : (ar ? 'اختيار ' + name : 'Select ' + name)}
                  onClick={() => selected ? onOpenFaction(faction.id) : setChosen(faction.id)}
                >
                  <img src={art.card} alt="" width={640} height={960} draggable={false} />
                  <span className={styles.seatLabel} aria-hidden="true">{name}</span>
                </button>
              );
            })}
          </div>
          {children}
        </div>
        {selection && (
          <div className={styles.councilControls}>
            <ol aria-label={ar?'مراحل المجلس':'Council stages'} className={styles.councilBeats}>
              {beats[locale].map((label,i)=> <li key={label} data-beat={i+1}>{label}</li>)}
            </ol>
            <div className={styles.councilRoster} role="group" aria-label={ar?'اختيار الفصيل':'Choose a faction'}
              onKeyDown={e=>{
                if (e.target instanceof HTMLSelectElement || e.altKey||e.ctrlKey||e.metaKey||!['ArrowLeft','ArrowRight'].includes(e.key)) return;
                e.preventDefault();step((e.key==='ArrowRight')!==ar?1:-1);
              }}>
              <button type="button" onClick={()=>step(-1)} aria-label={ar?'الفصيل السابق':'Previous faction'} data-council-step="prev">{ar?'›':'‹'}</button>
              <label className={styles.councilLabel}>
                <strong aria-hidden="true">{selection.name[locale]}</strong>
                <small aria-live="polite">{count} {ar?'بطاقة':'cards'}</small>
                <select data-council-jump aria-label={ar ? 'الانتقال إلى فصيل' : 'Jump to a faction'}
                  value={selection.id} onChange={event => setChosen(event.target.value)}>
                  {groups.map(faction => <option key={faction.id} value={faction.id}>{faction.name[locale]}</option>)}
                </select>
              </label>
              <button type="button" onClick={()=>step(1)} aria-label={ar?'الفصيل التالي':'Next faction'} data-council-step="next">{ar?'‹':'›'}</button>
              <button type="button" className={styles.councilOpen} onClick={()=>onOpenFaction(selection.id)}>{ar?'افتح الفصيل':'Open faction'}</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
