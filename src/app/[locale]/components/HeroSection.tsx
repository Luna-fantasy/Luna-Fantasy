'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/routing';
import { E } from '@/components/edit-mode/EditableText';
import { NightFilmSwitch, NightProjection, useNightMotion } from '@/components/cinematic/NightProjection';
import { SectionWindow } from '@/components/cinematic/SectionWindow';
import { additionalWindows } from '@/lib/cinematic/section-window';
import { HarbourChart } from './HarbourChart';
import '@/styles/luna-night-passage.css';
import '@/styles/luna-watergate-poster.css';

const berths = [
  { scene:'passage', en:'The Watergate', ar:'البوّابة المائية', href:'/story', linkEn:'Read the chronicles', linkAr:'اقرأ السجلات', position:'72% 48%' },
  { scene:'bazaar', en:'Night Bazaar', ar:'البازار الليلي', href:'/bazaar', linkEn:'Meet the merchants', linkAr:'تعرّف على التجّار', position:'51% 47%' },
  { scene:'bank', en:'The Treasury', ar:'دار الخزينة', href:'/bank', linkEn:'Visit the bank', linkAr:'ادخل البنك', position:'56% 48%' },
] as const;
const facts=[['statStory','statStoryLabel','/story'],['statCards','statCardsLabel','/luna-fantasy'],['statCommunity','statCommunityLabel','/members']] as const;

export function HeroSection() {
  const ar=useLocale()==='ar',t=useTranslations('hero');
  const [index,select]=useState(0);
  const place=berths[index], frame=useRef<HTMLElement>(null);
  const tabs=useRef<Array<HTMLButtonElement|null>>([]);
  const gesture=useRef<{x:number;y:number}|null>(null);
  const motion=useNightMotion();
  useEffect(()=>{
    const el=frame.current;if(!el)return;
    if(!motion){el.style.removeProperty('--passage-x');el.style.removeProperty('--passage-y');return;}
    let af=0, x=0, y=0;
    const draw=()=>{af=0;el.style.setProperty('--passage-x',x.toFixed(2)+'px');el.style.setProperty('--passage-y',y.toFixed(2)+'px');};
    const schedule=()=>{if(!af)af=requestAnimationFrame(draw);};
    const move=(e:PointerEvent)=>{if(e.pointerType==='touch')return;const b=el.getBoundingClientRect();x=((e.clientX-b.left)/b.width-.5)*11;y=((e.clientY-b.top)/b.height-.5)*7;schedule();};
    const leave=()=>{x=0;y=0;schedule();};
    el.addEventListener('pointermove',move,{passive:true});el.addEventListener('pointerleave',leave);
    return ()=>{cancelAnimationFrame(af);el.removeEventListener('pointermove',move);el.removeEventListener('pointerleave',leave);};
  },[motion]);
  function arrows(e:React.KeyboardEvent<HTMLButtonElement>,current:number){
    const direction=ar?-1:1;
    const inc=e.key==='ArrowRight'?direction:e.key==='ArrowLeft'?-direction:0;
    if(!inc&&e.key!=='Home'&&e.key!=='End')return;
    e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(current+inc+berths.length)%berths.length;
    select(next);tabs.current[next]?.focus({preventScroll:true});
  }
  return <section className="luna-passage" aria-labelledby="passage-name">
    <header className="passage-screen" data-active-berth={place.scene} ref={frame}
      onPointerDown={e=>{if(e.target instanceof Element && !e.target.closest('a,button,[contenteditable]'))gesture.current={x:e.clientX,y:e.clientY};}}
      onPointerCancel={()=>{gesture.current=null;}} onPointerUp={e=>{
        const start=gesture.current;gesture.current=null;if(!start)return;
        const dx=e.clientX-start.x,dy=e.clientY-start.y;
        if(Math.abs(dx)>58 && Math.abs(dx)>Math.abs(dy)*1.6){
          const next = ar ? dx>0 : dx<0;
          select((index+(next?1:berths.length-1))%berths.length);
        }
      }}>
      <div className="passage-photograph" key={place.scene}>
        {place.scene==='passage' ? <NightProjection scene="passage" priority position={place.position}/>
          : <SectionWindow scene={place.scene==='bazaar'?additionalWindows['home-market']:additionalWindows['home-bank']} priority/>}
      </div>
      <div className="passage-exposure" aria-hidden="true"/>
      <div className="passage-mast">
        <div className="passage-lettering">
          <p className="passage-kicker"><E ns="hero" k="badge">{t('badge')}</E></p>
          <h1 id="passage-name" lang={/^[a-z ]+$/i.test(t('title')) ? 'en' : undefined}><E ns="hero" k="title">{t('title')}</E></h1>
          <p className="passage-lede"><E ns="hero" k="desc">{t('desc')}</E></p>
          <div className="passage-actions">
            <a href="#overview" className="passage-primary"><E ns="hero" k="exploreBtn">{t('exploreBtn')}</E><span aria-hidden="true">↓</span></a>
            <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer" className="passage-secondary"><E ns="hero" k="joinBtn">{t('joinBtn')}</E><span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </div>
      <div className="passage-caption" aria-live="polite"><span>{ar?place.ar:place.en}</span><Link href={place.href}>{ar?place.linkAr:place.linkEn}<b aria-hidden="true">{ar?'←':'→'}</b></Link></div>
    </header>
    <div className="passage-bench">
      <div className="passage-berths">
        <div className="passage-chart-head"><h2>{ar?'مرافئ لونا':'Harbours of Luna'}</h2><NightFilmSwitch ar={ar}/></div>
        <div className="passage-stops" role="group" aria-label={ar?'اختر وجهتك':'Choose your destination'}>
          {berths.map((b,i)=><button type="button" key={b.scene} aria-pressed={i===index} data-berth={b.scene}
            ref={node=>{tabs.current[i]=node;}} onClick={()=>select(i)} onKeyDown={e=>arrows(e,i)}>
            <i aria-hidden="true"/><span>{ar?b.ar:b.en}</span></button>)}
        </div>
        <Link className="passage-mobile-link" href={place.href}>{ar?place.linkAr:place.linkEn}<span aria-hidden="true">{ar?'←':'→'}</span></Link>
      </div>
      <div className="passage-chart"><HarbourChart selected={index} onSelect={select} ar={ar}/><span>{ar?'اسحب لتدوير المجسّم':'Drag to turn the relief'}</span></div>
    </div>
    <nav className="passage-facts" aria-label={ar?'استكشف عالم لونا':'Explore Luna'}>
      {facts.map(([value,label,href])=><Link key={href} href={href}><E ns="hero" k={value}>{t(value)}</E>{' '}<E ns="hero" k={label}>{t(label)}</E><i aria-hidden="true">{ar?'↖':'↗'}</i></Link>)}
    </nav>
  </section>;
}
