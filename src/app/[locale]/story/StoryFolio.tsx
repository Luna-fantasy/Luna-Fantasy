'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { E } from '@/components/edit-mode/EditableText';
import { EImg } from '@/components/edit-mode/EditableImage';
import { StoryCoverImage } from '@/components/edit-mode/StoryCoverImage';
import { useEditMode } from '@/lib/edit-mode/context';
import { NightFilmSwitch, NightProjection, useNightMotion } from '@/components/cinematic/NightProjection';
import { STORY_COVER_BASE, storyCoverPresentationSrc } from '@/lib/cinematic/v19-visual-fix-src';
import { followChapterLink, observeChapters } from './folio-navigation';
import { ChapterAtmosphere, departureImage, harbourFilm, harbourPoster } from './ChapterAtmosphere';
import s from './FolioMotion.module.css';

const chapters = [1,2,3] as const;
const plates = ['/luna-cinematic/home-story/story/lunvor-original-remastered.webp','/luna-cinematic/home-story/story/movarth-original-remastered.webp'];
const names = {en:['Lunvor Before Chaos','Movarth’s Reign','Bod Aban Prevails'], ar:['لونفور قبل الفوضى','عهد موفارث','انتصار بود أبان']};
type Turn = { src: string; from: number; chapter: number; hinge: 'left'|'right' };

export function StoryFolio({ locale }: { locale: string }) {
  const t = useTranslations('storyPage');
  const hero = useTranslations('hero');
  const ar = locale==='ar';
  const {editMode} = useEditMode();
  const allowMotion = useNightMotion();
  const animated = allowMotion && !editMode;
  const [active,setActive] = useState(1);
  const [hydrated,setHydrated] = useState(false);
  const [turn,setTurn] = useState<Turn|null>(null);
  const [sceneChapter,setSceneChapter] = useState(0);
  const [zoom,setZoom] = useState('');
  const [filmOpen,setFilmOpen] = useState(false);
  const picture = useRef<HTMLDivElement>(null);
  const zoomDialog = useRef<HTMLDialogElement>(null);
  const filmDialog = useRef<HTMLDialogElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const focusAfterNavigation = useRef<HTMLAnchorElement|'heading'|null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const filmTitle = ar?'ميناء لونفور قبل الحرب':'Lunvor Harbour Before the War';
  const alt = names[ar?'ar':'en'][active-1];
  const forwardArrow = ar?'←':'→';
  const backArrow = ar?'→':'←';
  const sceneLabel = active===2 ? (ar?'أشعل مجامر العرش':'Light the throne braziers') : (ar?'اكشف ضوء النصر':'Reveal the victory light');

  useEffect(() => {
    setHydrated(true);
    return observeChapters(setActive);
  },[]);
  useEffect(() => {
    if (!hydrated || !/^#chapter-[123]$/.test(location.hash)) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({block:'start',behavior:'instant'});
  },[hydrated]);
  useEffect(() => {
    if (!turn) return;
    if (!animated || turn.chapter!==active) { setTurn(null); return; }
    const release = window.setTimeout(()=>setTurn(null),1230);
    return ()=>window.clearTimeout(release);
  },[active,animated,turn]);
  useEffect(() => {
    setSceneChapter(0);
    const nextFocus = focusAfterNavigation.current;
    focusAfterNavigation.current = null;
    if (!nextFocus) return;
    const frame = requestAnimationFrame(()=>{
      const target = nextFocus==='heading' ? heading.current : nextFocus;
      target?.focus({preventScroll:true});
    });
    return ()=>cancelAnimationFrame(frame);
  },[active]);
  useEffect(() => { if (zoom && !zoomDialog.current?.open) zoomDialog.current?.showModal(); },[zoom]);

  function turnPage(event: MouseEvent<HTMLAnchorElement>) {
    const link = event.currentTarget;
    const contents = link.closest('nav') && !link.hasAttribute('data-folio-step');
    followChapterLink(event,chapter => {
      if (chapter===active) {
        requestAnimationFrame(()=>(contents?link:heading.current)?.focus({preventScroll:true}));
        return;
      }
      const mount = picture.current;
      const image = mount?.querySelector('img');
      if (animated && mount && image?.complete && image.naturalWidth) {
        setTurn({src:departureImage(mount,image),from:active,chapter,hinge:(chapter>active)!==ar?'left':'right'});
      } else setTurn(null);
      focusAfterNavigation.current = contents ? link : 'heading';
      setActive(chapter);
    });
  }
  function enlarge() {
    const image = picture.current?.querySelector('img');
    if (image) setZoom(image.currentSrc || image.src);
  }
  function chapterKeys(event: KeyboardEvent<HTMLAnchorElement>, current: number) {
    const step = event.key==='ArrowRight' ? (ar?-1:1) : event.key==='ArrowLeft' ? (ar?1:-1) : 0;
    const chapter = event.key==='Home' ? 1 : event.key==='End' ? 3 : step ? Math.min(3,Math.max(1,current+step)) : 0;
    if (!chapter) return;
    event.preventDefault();
    const target = event.currentTarget.closest('nav')?.querySelector<HTMLAnchorElement>('a[href="#chapter-'+chapter+'"]');
    target?.focus({preventScroll:true});
    target?.click();
  }
  function playHarbour() {
    if (!filmDialog.current || !player.current) return;
    setFilmOpen(true);
    filmDialog.current.showModal();
    void player.current.play().catch(()=>{ /* The native player retains its play control. */ });
  }
  function closeHarbour() {
    if (player.current) { player.current.pause(); player.current.currentTime=0; }
    setFilmOpen(false);
  }
  function textLeaf(chapter: number, live: boolean) {
    const prefix = 'chapter'+chapter+'.';
    const field = (key: string) => live ? <E ns="storyPage" k={prefix+key}>{t(prefix+key)}</E> : t(prefix+key);
    return <div className={s.textLeaf} data-folio-text={chapter}>
      <span className={s.printLabel}>{field('label')}</span>
      <h2 className={s.chapterHeading} id={live?'night-chapter-title':undefined}
        ref={live?heading:undefined} tabIndex={live?-1:undefined}>{field('title')}</h2>
      <p>{field('p1')}</p><p>{field('p2')}</p><blockquote>{field('quote')}</blockquote><p>{field('p3')}</p>
    </div>;
  }
  function sceneActions() {
    return <div className={s.actions}>
      {active===1 ? <button className={s.play} type="button" data-folio-play onClick={playHarbour} aria-haspopup="dialog">
        <i aria-hidden="true"/>{ar?'شاهد ميناء لونفور':'Watch Lunvor Harbour'}</button>
        : <button className={s.sceneControl} data-folio-scene-control type="button" aria-pressed={sceneChapter===active}
          aria-controls="chapter-scene" onClick={()=>setSceneChapter(sceneChapter===active?0:active)}>
          <i aria-hidden="true"/>{sceneLabel}</button>}
      <button className={s.enlarge} type="button" data-folio-enlarge onClick={enlarge} aria-haspopup="dialog">
        {ar?'كبّر اللوحة':'Enlarge illustration'}<i aria-hidden="true">⤢</i></button>
    </div>;
  }

  return <main className={s.room} data-night-story data-motion-allowed={animated||undefined}>
    <header className={s.overture} data-night-world="story">
      <div className={s.overtureFilm} aria-hidden="true"><NightProjection scene="story" priority position="60% 48%"/></div>
      <div className={s.overtureCopy}>
        <p className={s.edition}><E ns="hero" k="badge">{hero('badge')}</E></p>
        <h1><E ns="storyPage" k="title">{t('title')}</E></h1>
        <p className={s.dek}><E ns="storyPage" k="desc">{t('desc')}</E></p>
        <a className={s.begin} href="#chapter-1" onClick={turnPage}>{ar?'ابدأ القراءة':'Begin reading'}<span aria-hidden="true">↓</span></a>
      </div>
      {!editMode && <div className={s.switch}><NightFilmSwitch ar={ar}/></div>}
    </header>
    <section className={s.book} data-live-folio aria-labelledby="story-contents">
      {chapters.map(n=><span className={s.anchor} id={hydrated?'chapter-'+n:undefined} key={n}/>)}
      <div className={s.contents}>
        <h2 id="story-contents">{ar?'فهرس الحكاية':'Table of contents'}</h2>
        <nav className={s.chapters} aria-label={ar?'فهرس الفصول':'Chapters'}>
          {chapters.map(n=><a className={s.currentTab} href={'#chapter-'+n} onClick={turnPage} onKeyDown={event=>chapterKeys(event,n)} key={n}
            aria-current={active===n?'page':undefined}><span>{t('chapter'+n+'.label')}</span><b>{t('chapter'+n+'.title')}</b></a>)}
        </nav>
      </div>
      <article className={s.paper} aria-labelledby="night-chapter-title" data-night-chapter={active}
        data-animated={animated||undefined} data-turning={animated&&turn?.chapter===active?turn.hinge:undefined}>
        <div className={s.spread} data-folio-incoming data-imprint={active} key={active}>
          <div className={s.imageLeaf}>
            <div className={s.mount} ref={picture} id="chapter-scene" data-revealed={sceneChapter===active||undefined}>
              {active===3 ? <StoryCoverImage editId="storyPage.chapter3.image" alt={alt} width={1536} height={1024} loading="eager"/>
                : <EImg editId={'storyPage.chapter'+active+'.image'} src={plates[active-1]} alt={alt} width={1536} height={1024}
                  sizes="(max-width: 780px) 95vw, 56vw" loading="eager"/>}
              {!editMode && <ChapterAtmosphere key={active} chapter={active} animated={animated&&!filmOpen&&!zoom}/>}
            </div>
            {!editMode && sceneActions()}
          </div>
          {textLeaf(active,true)}
        </div>
        {animated && turn?.chapter===active &&
          <div data-folio-outgoing data-hinge={turn.hinge} aria-hidden="true" className={s.departure}
            onAnimationEnd={event=>{if(event.target===event.currentTarget)setTurn(null);}}>
            <div className={s.spread} data-imprint={turn.from}>
              <div className={s.imageLeaf}><div className={s.mount}><img src={turn.src} alt=""/></div></div>
              {textLeaf(turn.from,false)}
            </div>
          </div>}
      </article>
      <nav className={s.pageNav} aria-label={ar?'التنقل بين الفصول':'Turn the page'}>
        {active>1?<a href={'#chapter-'+(active-1)} onClick={turnPage} data-folio-step="previous"><i aria-hidden="true">{backArrow}</i>{ar?'الفصل السابق':'Previous chapter'}</a>:<span/>}
        <span className={s.pageCount}>{active.toLocaleString(locale)} <i>/</i> {(3).toLocaleString(locale)}</span>
        {active<3?<a href={'#chapter-'+(active+1)} onClick={turnPage} data-folio-step="next">{ar?'الفصل التالي':'Next chapter'}<i aria-hidden="true">{forwardArrow}</i></a>:<span/>}
      </nav>
    </section>
    <noscript>
      <style>{'[data-live-folio]{display:none!important}'}</style>
      <section className={s.book} aria-label={ar?'فصول الحكاية':'Story chapters'}>
        {chapters.map(n=><article className={s.paper} key={n} id={'chapter-'+n}>
          <div className={s.spread} data-imprint={n}>
            <div className={s.imageLeaf}><div className={s.mount}><img src={n===3?storyCoverPresentationSrc()||STORY_COVER_BASE:plates[n-1]} alt={names[ar?'ar':'en'][n-1]} width="1536" height="1024"/></div></div>
            {textLeaf(n,false)}
          </div>
        </article>)}
      </section>
    </noscript>
    <aside className={s.afterword}><div><h2><E ns="storyPage" k="moreChapters">{t('moreChapters')}</E></h2>
      <p><E ns="storyPage" k="moreChaptersDesc">{t('moreChaptersDesc')}</E></p></div>
      <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer"><E ns="hero" k="joinBtn">{hero('joinBtn')}</E><span aria-hidden="true">{ar?'↖':'↗'}</span></a>
    </aside>
    <dialog ref={filmDialog} className={s.dialog} aria-label={filmTitle} onClose={closeHarbour}
      onClick={event=>{if(event.target===event.currentTarget)filmDialog.current?.close();}}>
      <div className={s.dialogBar}><span>{filmTitle}</span><button type="button" onClick={()=>filmDialog.current?.close()}>{ar?'إغلاق':'Close'}</button></div>
      <video ref={player} controls playsInline preload="none" poster={harbourPoster} aria-label={filmTitle} width="1920" height="1080" src={harbourFilm}/>
    </dialog>
    <dialog ref={zoomDialog} className={s.dialog} aria-label={alt} onClose={()=>setZoom('')}
      onClick={event=>{if(event.target===event.currentTarget)zoomDialog.current?.close();}}>
      {zoom&&<><div className={s.dialogBar}><span>{alt}</span><button type="button" onClick={()=>zoomDialog.current?.close()}>{ar?'إغلاق':'Close'}</button></div>
        <img src={zoom} alt={alt}/></>}
    </dialog>
  </main>;
}

