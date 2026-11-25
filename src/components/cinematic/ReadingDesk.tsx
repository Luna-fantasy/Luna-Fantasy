'use client';
import { useLocale } from 'next-intl';
import { useEffect,useRef,useState, type ReactNode } from 'react';
import '@/styles/luna-night-readers.css';

export function ReadingDesk({ children }: {children:ReactNode}) {
  const ar=useLocale()==='ar',body=useRef<HTMLDivElement>(null);
  const [large,setLarge]=useState(false),[headings,setHeadings]=useState<HTMLElement[]>([]),[active,setActive]=useState(0);
  useEffect(()=>{
    const root=body.current;if(!root)return;
    const list=Array.from(root.querySelectorAll<HTMLElement>('h2'));
    setHeadings(list);
    let frame=0;
    function read(){frame=0;let next=0;list.forEach((h,i)=>{if(h.getBoundingClientRect().top<innerHeight*.37)next=i;});setActive(next);}
    function queue(){if(!frame)frame=requestAnimationFrame(read);}
    if(list.length)window.addEventListener('scroll',queue,{passive:true});
    queue();return()=>{window.removeEventListener('scroll',queue);cancelAnimationFrame(frame);};
  },[]);
  function go(heading:HTMLElement){
    heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
  }
  return <div className="luna-reading-desk" data-large-type={large}>
    <aside className="desk-bookmark">
      <div className="desk-ribbon" aria-hidden="true"/>
      <button type="button" className="desk-typesize" aria-pressed={large} onClick={()=>setLarge(!large)}><span aria-hidden="true">A<span>A</span></span>{ar?'تكبير نص الوثيقة':'Large print'}</button>
      {headings.length>1&&<details className="desk-contents"><summary>{ar?'فهرس الوثيقة':'Document contents'}</summary><ol>
        {headings.map((h,i)=><li key={i}><button onClick={()=>go(h)} aria-current={i===active?'location':undefined}>{h.textContent}</button></li>)}
      </ol></details>}
    </aside>
    <div ref={body} className="legal-content">{children}</div>
  </div>;
}
