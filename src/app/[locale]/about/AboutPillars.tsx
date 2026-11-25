'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { E } from '@/components/edit-mode/EditableText';
import { nextPillar, pillars } from './pillars';
import s from './AboutPillars.module.css';

export function AboutPillars() {
  const t=useTranslations('aboutPage');
  const ar=useLocale()==='ar';
  const [selection,setSelection]=useState(0);
  const tabs=useRef<Array<HTMLButtonElement|null>>([]);
  const label=ar?'أركان لوناريان':'Pillars of Lunarian';

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next=nextPillar(index,event.key,ar);
    if (next===undefined) return;
    event.preventDefault();
    setSelection(next);
    tabs.current[next]?.focus({preventScroll:true});
  }
  return <section className={s.atlas} data-about-atlas aria-label={label}>
    <div className={s.tabs} role="tablist" aria-label={label}>
      {pillars.map(({key},i)=><button type="button" role="tab" key={key} id={'pillar-tab-'+key}
        data-pillar={key} aria-selected={selection===i} aria-controls={'pillar-panel-'+key} tabIndex={selection===i?0:-1}
        ref={node=>{tabs.current[i]=node;}} onClick={()=>setSelection(i)} onKeyDown={event=>move(event,i)}>
        <i aria-hidden="true"/><span>{t('pillars.'+key+'.title')}</span></button>)}
    </div>
    {pillars.map(({key,href,art},i)=><div role="tabpanel" key={key} id={'pillar-panel-'+key}
      aria-labelledby={'pillar-tab-'+key} hidden={selection!==i} data-pillar-panel={key} className={s.panel}>
      <div className={s.photograph}><img loading="lazy" src={art} alt="" width="960" height="540"/></div>
      <div className={s.description}>
        <h3><E ns="aboutPage" k={'pillars.'+key+'.title'}>{t('pillars.'+key+'.title')}</E></h3>
        <p><E ns="aboutPage" k={'pillars.'+key+'.desc'}>{t('pillars.'+key+'.desc')}</E></p>
        <Link href={href} aria-label={(ar?'استكشف ':'Explore ')+t('pillars.'+key+'.title')}>{ar?'استكشف القسم':'Explore section'}<span aria-hidden="true">{ar?'←':'→'}</span></Link>
      </div>
    </div>)}
    <noscript><style>{'[data-about-atlas] [role=tablist]{display:none}[data-about-atlas] [data-pillar-panel][hidden]{display:grid!important}'}</style></noscript>
  </section>;
}
