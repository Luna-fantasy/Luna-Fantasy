'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { NightFilmSwitch } from './NightProjection';
import { SectionWindow } from './SectionWindow';
import { sectionWindowFor } from '@/lib/cinematic/section-window';
import '@/styles/luna-night-footer.css';

const SectionArtDialog = dynamic(() => import('./SectionArtDialog').then(module => module.SectionArtDialog), { ssr: false });

export function FooterHarbour() {
  const scene = sectionWindowFor(usePathname() ?? '/');
  return <div aria-hidden="true" className="footer-night-window" data-section-footer={scene.id}>
    <SectionWindow scene={scene}/><i/>
  </div>;
}
export function FooterReturn({ar}:{ar:boolean}){
  const scene = sectionWindowFor(usePathname() ?? '/');
  const opener = useRef<HTMLButtonElement>(null);
  const [openScene, setOpenScene] = useState<string | null>(null);
  const isOpen = openScene === scene.id;
  useEffect(() => { setOpenScene(null); }, [scene.id, ar]);
  return <div className="footer-return"><button type="button" onClick={()=>{
    const start=document.querySelector<HTMLElement>('main h1')??document.querySelector<HTMLElement>('main');
    if(start){if(!start.hasAttribute('tabindex'))start.tabIndex=-1;start.focus({preventScroll:true});}
    window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }}><i aria-hidden="true">↑</i>{ar?'العودة إلى أعلى الصفحة':'Back to the top'}</button>
    <NightFilmSwitch ar={ar}/>
    <button type="button" ref={opener} data-section-art-trigger aria-haspopup="dialog" aria-expanded={isOpen}
      onClick={() => setOpenScene(scene.id)}>
      <span aria-hidden="true">⤢</span>{ar ? 'تفحّص لوحة القسم' : 'Inspect the scene'}
    </button>
    {isOpen && <SectionArtDialog scene={scene} ar={ar} onDismiss={() => {
      setOpenScene(null);
      opener.current?.focus({ preventScroll: true });
    }} />}
  </div>;
}
