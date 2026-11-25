'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { E } from '@/components/edit-mode/EditableText';
import LunariIcon from '@/components/LunariIcon';
import type { MemberListItem, MembersResponse } from '@/types/members';
import { WorldPicture, WorldStage } from '../night-worlds/WorldStage';
import s from '../night-worlds/night-worlds.module.css';

const sorts=['newest','oldest','level','lunari','cards'] as const;

export default function MembersContent() {
  const locale=useLocale(), ar=locale==='ar', t=useTranslations('membersPage');
  const [search,setSearch]=useState('');
  const [request,setRequest]=useState({term:'',sort:'newest',page:1});
  const [round,setRound]=useState(0);
  const [data,setData]=useState<MembersResponse>({members:[],total:0,page:1,totalPages:1});
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [list,setList]=useState(false);
  const [broken,setBroken]=useState<Set<string>>(new Set());
  useEffect(()=>{
    const id=window.setTimeout(()=>setRequest(previous=>previous.term===search.trim()?previous:{...previous,term:search.trim(),page:1}),350);
    return()=>window.clearTimeout(id);
  },[search]);
  useEffect(()=>{
    const controller=new AbortController();
    const params=new URLSearchParams({page:String(request.page),sort:request.sort});
    if(request.term)params.set('search',request.term);
    setState('loading');
    fetch('/api/members?'+params.toString(),{signal:controller.signal}).then(async res=>{
      if(!res.ok)throw Error(String(res.status));
      const result:MembersResponse=await res.json();
      if(!Array.isArray(result.members))throw Error('Invalid member directory');
      if(!controller.signal.aborted){setData(result);setState('ready')}
    }).catch(()=>{if(!controller.signal.aborted)setState('error')});
    return()=>controller.abort();
  },[request,round]);
  const num=(n:number)=>n.toLocaleString(locale);
  const turn=(direction:number)=>setRequest(prev=>({...prev,page:Math.max(1,Math.min(data.page+direction,data.totalPages))}));
  function reset(){setSearch('');setRequest(prev=>({...prev,term:'',page:1}))}
  function resident(m: MemberListItem) {
    return <Link key={m.discordId} className={s.resident} href={'/profile?discordId='+encodeURIComponent(m.discordId)} data-member-id={m.discordId}>
      <span className={s.residentAvatar}>{m.image&&!broken.has(m.discordId)
        ? <Image src={m.image} width={64} height={64} alt="" onError={()=>setBroken(old=>new Set(old).add(m.discordId))}/>
        : <span aria-hidden="true">{m.name.charAt(0).toUpperCase()}</span>}</span>
      <strong>{m.name}</strong>{m.username&&<small dir="auto">@{m.username}</small>}
      <span className={s.residentStats}>
        {m.level>0&&<span>{(ar?'مستوى ':'Lv. ')+num(m.level)}</span>}
        <span aria-label={(ar?'لوناري ':'Lunari ')+num(m.lunari)}><LunariIcon size={12}/>{num(m.lunari)}</span>
        <span aria-label={(ar?'بطاقات ':'Cards ')+num(m.cardCount)}>▤ {num(m.cardCount)}</span>
      </span>
    </Link>;
  }
  return <main>
    <WorldStage world="members" locale={locale} title={<E ns="membersPage" k="title">{t('title')}</E>}
      description={<E ns="membersPage" k="subtitle">{t('subtitle')}</E>}/>
    <section id="members-directory" className={s.directory} aria-labelledby="night-members-title" data-night-directory>
      <div className={s.directoryHead}><div><h2 id="night-members-title">{ar?'دليل الأعضاء':'Member directory'}</h2>
        {state==='ready'&&<p role="status">{t('totalMembers',{count:data.total})}</p>}
      </div>
        {state==='ready' && data.members.length>0 && <div className={s.switcher} role="group" aria-label={ar?'عرض الدليل':'Directory layout'}>
          <button type="button" aria-pressed={!list} onClick={()=>setList(false)}>{ar?'النوافذ':'Windows'}</button>
          <button type="button" aria-pressed={list} onClick={()=>setList(true)}>{ar?'السجلّ':'Ledger'}</button>
        </div>}
      </div>
      <div className={s.directoryTools}>
        <label htmlFor="members-search">{ar?'اسم العضو':'Member name'}<input id="members-search" type="search" value={search} placeholder={t('searchPlaceholder')} autoComplete="off" onChange={e=>setSearch(e.target.value)}/></label>
        <label>{ar?'ترتيب الأعضاء':'Sort members'}<select value={request.sort} onChange={e=>setRequest(prev=>({...prev,sort:e.target.value,page:1}))}>
          {sorts.map(k=><option key={k} value={k}>{t('sort.'+k)}</option>)}
        </select></label>
      </div>
      {state==='ready'&&data.members.length ? <>
        <div className={s.windows+' '+(list?s.listResidents:'')}>{data.members.map(resident)}</div>
        {data.totalPages>1&&<nav className={s.pager} aria-label={ar?'صفحات الأعضاء':'Member pages'}>
          <button type="button" disabled={data.page<=1} onClick={()=>turn(-1)}>{ar?'السابق':'Previous'}</button>
          <span>{num(data.page)} / {num(data.totalPages)}</span>
          <button type="button" disabled={data.page>=data.totalPages} onClick={()=>turn(1)}>{ar?'التالي':'Next'}</button>
        </nav>}
      </> : <div className={s.memberEmpty} data-member-state={state}>
        <div className={s.memberEmptyArt} aria-hidden="true"><WorldPicture world="members"/></div>
        <div role="status">{state==='loading' ? <p>{ar?'جارٍ فتح الدليل…':'Opening the directory…'}</p> :
          state==='error' ? <><p>{ar?'تعذّر تحميل دليل الأعضاء.':'The member directory could not be loaded.'}</p>
            <button type="button" onClick={()=>setRound(n=>n+1)}>{ar?'أعد المحاولة':'Try again'}</button></> :
          <><p><E ns="membersPage" k="noResults">{t('noResults')}</E></p>
            {request.term?<button type="button" onClick={reset}>{ar?'مسح البحث':'Clear search'}</button>
              :<Link href="/profile" className={s.profileLink}>{ar?'ملفي الشخصي':'My profile'}</Link>}</>}
        </div>
      </div>}
    </section>
  </main>;
}
