'use client';

import { ArchiveName } from '@/components/ArchiveName';
import { useLayoutEffect, useRef, useState } from 'react';
import type { Character, Faction, Locale } from '@/types';
import { approvedPortraitFor, parseCharacterName } from '@/lib/cinematic/people-art';
import { CinematicArtwork } from '../cinematic-people/CinematicArtwork';
import { CastViewer } from './CastViewer';
import s from '../night-worlds/night-worlds.module.css';

interface Props {
  records: Character[]; factions: Faction[]; locale: Locale; faction: string; query: string;
  onFaction: (id: string) => void; onQuery: (text: string) => void;
  factionName: (id: string) => string; openRecord: (character: Character, control: HTMLElement) => void;
}
export function CastArchive({records, factions, locale, faction, query, onFaction, onQuery, factionName, openRecord}: Props) {
  const ar = locale === 'ar';
  const [mode, setMode] = useState<'viewer'|'sheets'|'index'>('viewer');
  const [featuredId, setFeaturedId] = useState('');
  const index = mode === 'index';
  const results = useRef<HTMLDivElement>(null);
  const focusNextPage = useRef(false);
  const [page, setPage] = useState({filter:'', at:0});
  const filter = faction + '/' + query + '/' + mode;
  const size = index ? 36 : 12;
  const pages = Math.max(1,Math.ceil(records.length/size));
  const at = page.filter === filter ? Math.min(page.at,pages-1) : 0;
  const number = (v: number) => v.toLocaleString(locale);
  const countLabel = ar ? (new Intl.PluralRules('ar').select(records.length)==='few'?'شخصيات':'شخصية')
    : (records.length===1?'character':'characters');
  useLayoutEffect(() => {
    if (!focusNextPage.current) return;
    focusNextPage.current = false;
    results.current?.scrollIntoView({block:'start',behavior:'instant'});
    results.current?.querySelector('button')?.focus({preventScroll:true});
  },[at,filter]);
  const turn = (next: number) => {
    focusNextPage.current = true;
    setPage({filter,at:next});
  };
  const open = (character: Character, control: HTMLElement) => {
    setFeaturedId(character.id);
    openRecord(character, control);
  };
  return <section className={s.archive} id="c7-portrait-archive" tabIndex={-1} aria-labelledby="cast-archive-title" data-night-archive data-mode={mode}>
    <div id="c6-gallery" className={s.anchor}/>
    <div className={s.archiveHead}><h2 id="cast-archive-title">{ar ? 'سجلّ الشخصيات' : 'Portrait archive'}</h2>
      <div className={s.switcher} role="group" aria-label={ar?'طريقة العرض':'Display style'}>
        <button type="button" data-cast-mode="viewer" aria-pressed={mode==='viewer'} onClick={()=>setMode('viewer')}>{ar?'عارض الصور':'Portrait viewer'}</button>
        <button type="button" data-cast-mode="sheets" aria-pressed={mode==='sheets'} onClick={()=>setMode('sheets')}>{ar?'لوحات الصور':'Portrait sheets'}</button>
        <button type="button" data-cast-mode="index" aria-pressed={index} onClick={()=>setMode('index')}>{ar?'فهرس الأسماء':'Name index'}</button>
      </div>
    </div>
    <div className={s.castTools}>
      <label className={s.castSearch} htmlFor="catalog-search-input">{ar?'ابحث عن شخصية':'Find a character'}
        <input id="catalog-search-input" type="search" autoComplete="off" placeholder={ar?'اكتب الاسم…':'Search by name…'} value={query} onChange={e=>onQuery(e.target.value)}/>
      </label>
      <div className={s.factions} role="group" aria-label={ar?'الفصيل':'Faction'}>{factions.map(f=>
        <button key={f.id} type="button" aria-pressed={f.id===faction} onClick={()=>onFaction(f.id)}>{f.name[locale]}</button>
      )}</div>
    </div>
    <p className={s.stripInfo} role="status">{number(records.length)} {countLabel}</p>
    {records.length && mode==='viewer' ? <CastViewer records={records} locale={locale} selectedId={featuredId} onSelect={setFeaturedId} factionName={factionName} openRecord={open}/> : records.length ? <div key={filter+'/'+at} ref={results} className={index?s.nameIndex:s.castGrid}>
      {records.slice(at*size,(at+1)*size).map(c=>{
        const name=parseCharacterName(c.name[locale]);
        return <button type="button" key={c.id} data-character-id={c.id} aria-haspopup="dialog" aria-label={c.name[locale]} onClick={e=>open(c,e.currentTarget)}>
          <span className={s.castFrame}><CinematicArtwork approved={approvedPortraitFor(c.imageUrl)?.thumb} original={c.imageUrl}
            alt="" width={240} height={360} sizes={index?'38px':'(max-width:430px) 43vw, (max-width:1070px) 24vw, 16vw'} /></span>
          <span className={s.castCaption}>
            <strong><ArchiveName>{name.name}</ArchiveName></strong>
            {name.subtitle && <small>{name.subtitle}</small>}
            <small>{factionName(c.faction)}</small>
          </span>
        </button>;
      })}
    </div> : <div className={s.emptyLine}>{ar?'لا توجد شخصيات مطابقة.':'No matching characters.'} <button type="button" className={s.clearButton} onClick={()=>{onFaction('all');onQuery('')}}>{ar?'مسح المرشّحات':'Clear filters'}</button></div>}
    {mode!=='viewer'&&pages>1&&<nav className={s.pager} aria-label={ar?'صفحات السجل':'Archive pages'}>
      <button type="button" disabled={!at} onClick={()=>turn(at-1)}>{ar?'السابق':'Previous'}</button>
      <span aria-live="polite">{number(at+1)} / {number(pages)}</span>
      <button type="button" disabled={at>=pages-1} onClick={()=>turn(at+1)}>{ar?'التالي':'Next'}</button>
    </nav>}
  </section>;
}

