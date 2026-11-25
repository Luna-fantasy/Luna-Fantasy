'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { E } from '@/components/edit-mode/EditableText';
import { partnerDirectoryAnchor } from '@/lib/cinematic/people-art';
import type { Partner } from '@/lib/partners';
import { WorldStage } from '../night-worlds/WorldStage';
import s from '../night-worlds/night-worlds.module.css';

const socialNames={instagram:'Instagram',x:'X',tiktok:'TikTok',youtube:'YouTube',whatsapp:'WhatsApp'} as const;
const socialKeys=Object.keys(socialNames) as (keyof typeof socialNames)[];

export function PartnersContent({locale}:{locale:'en'|'ar'}) {
  const t=useTranslations('partnersPage'), ar=locale==='ar';
  const [partners,setPartners]=useState<Partner[]>([]);
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [round,setRound]=useState(0),[letter,setLetter]=useState(false);
  const [letterHandled, setLetterHandled] = useState(false);
  function toggleLetter() {
    setLetterHandled(true);
    setLetter(open => !open);
  }
  useEffect(()=>{
    const controller=new AbortController();
    setState('loading');
    fetch('/api/partners',{signal:controller.signal}).then(async result=>{
      if(!result.ok)throw Error(String(result.status));
      const data:Partner[]=await result.json();
      if(!Array.isArray(data))throw Error('Invalid partner list');
      if(!controller.signal.aborted){setPartners(data);setState('ready')}
    }).catch(()=>{if(!controller.signal.aborted)setState('error')});
    return()=>controller.abort();
  },[round]);
  useEffect(()=>{
    const openAnchor=()=>{if(location.hash==='#alliance-letter')setLetter(true)};
    openAnchor();window.addEventListener('hashchange',openAnchor);return()=>window.removeEventListener('hashchange',openAnchor);
  },[]);
  return <main>
    <WorldStage world="partners" locale={locale}
      title={<E ns="partnersPage" k="title">{t('title')}</E>}
      description={<E ns="partnersPage" k="subtitle">{t('subtitle')}</E>}
      secondary={<a href="#alliance-letter" onClick={()=>setLetter(true)}>{ar?'استفسر عن شراكة':'Partnership enquiries'}</a>}/>
    <section id="alliance-register" className={s.accord} aria-labelledby="alliance-heading">
      <div className={s.accordHead}><h2 id="alliance-heading"><E ns="partnersPage" k="meetPartners">{t('meetPartners')}</E></h2>
        <p><E ns="partnersPage" k="meetPartnersDesc">{t('meetPartnersDesc')}</E></p>
      </div>
      <div className={s.allianceLayout}>
        <div className={s.ledger}>
          <div className={s.ledgerRule}><span>{ar?'سجلّ التحالفات':'Register of alliances'}</span>
            {state==='ready'&&<span>{partners.length.toLocaleString(locale)}</span>}</div>
          {state==='loading'?<p role="status" className={s.ledgerEmpty}>{ar?'جارٍ فتح السجلّ…':'Opening the register…'}</p>:
            state==='error'?<div className={s.ledgerEmpty} role="status">{ar?'تعذّر تحميل سجلّ الشركاء.':'The partner register could not be loaded.'} <button className={s.retry} type="button" onClick={()=>setRound(n=>n+1)}>{ar?'أعد المحاولة':'Try again'}</button></div>:
            !partners.length?<p className={s.ledgerEmpty}>{ar?'لا توجد شراكات منشورة في السجلّ حاليًا.':'No partnerships have been published in the register yet.'}</p>:<>
              {partners.length>1&&<nav className={s.partnerLinks} aria-label={ar?'انتقل إلى شريك':'Jump to a partner'}>
                {partners.map(p=><a key={p.id} href={'#'+partnerDirectoryAnchor(p.id)}>{p.name}</a>)}</nav>}
              {partners.map(p=><article key={p.id} id={partnerDirectoryAnchor(p.id)} className={s.partnerRecord}>
                {p.logo&&<Image src={p.logo} alt={p.name} width={100} height={100}/>}
                <div><h3>{p.name}</h3><small>{p.type[locale]}</small><p>{p.description[locale]}</p><div className={s.partnerLinks}>
                  {socialKeys.map(key=>p.socials?.[key]?<a key={key} href={p.socials[key]} target="_blank" rel="noopener noreferrer">{socialNames[key]} ↗</a>:null)}
                  {p.website&&<a href={p.website} target="_blank" rel="noopener noreferrer"><E ns="partnersPage" k="visitWebsite">{t('visitWebsite')}</E> ↗</a>}
                </div></div>
              </article>)}
            </>}
        </div>
        <aside className={s.letter} id="alliance-letter" data-open={letter||undefined} data-letter-handled={letterHandled||undefined}>
          <button type="button" className={s.letterToggle} aria-expanded={letter} aria-controls="alliance-invitation" onClick={toggleLetter}>
            <span className={s.envelopeStage} aria-hidden="true">
              <span className={s.envelopeFrame}>
                <span className={s.envelopeBack}/>
                <span className={s.envelopeFlap} data-paper-flap><span/></span>
                <span className={s.enclosedSheet}/>
                <span className={s.envelopePocket}/>
                <span className={s.envelopeFlecks}/>
                <img className={s.ribbonWax} data-ribbon-wax src="/images/partner-ribbon-wax-v19.webp" alt="" width={416} height={416} draggable={false}/>
              </span>
            </span>
            <span className={s.letterCommand}>{letter ? (ar ? 'اطوِ الدعوة' : 'Fold the invitation') : (ar ? 'افتح دعوة الشراكة' : 'Open the partnership invitation')}</span>
          </button>
          <div id="alliance-invitation" className={s.letterBody} hidden={!letter}>
            <h3><E ns="partnersPage" k="ctaTitle">{t('ctaTitle')}</E></h3>
            <p><E ns="partnersPage" k="ctaDesc">{t('ctaDesc')}</E></p>
            <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer"><E ns="partnersPage" k="ctaBtn">{t('ctaBtn')}</E> ↗</a>
          </div>
        </aside>
      </div>
    </section>
  </main>;
}
