export function mountReadingMotion(root: Element, meter: HTMLElement, preference: MediaQueryList) {
  const events = new AbortController(), passive = {passive:true,signal:events.signal};
  const printWindows = Array.from(root.querySelectorAll<HTMLElement>('[data-luna-home] .showcase-media'));
  const onscreen = new Set<HTMLElement>();
  let frame = 0;
  function draw() {
    frame=0;
    if(document.hidden)return;
    const height=innerHeight, range=Math.max(1,document.documentElement.scrollHeight-height);
    const position=Math.max(0,Math.min(1,scrollY/range));
    meter.style.setProperty('--luna-reading', String(position));
    if(preference.matches)return;
    for(const surface of Array.from(onscreen)) {
      const rect=surface.getBoundingClientRect();
      const phase=Math.max(0,Math.min(1,(height-rect.top)/(height+rect.height)));
      const offset=(phase-.5)*2;
      surface.style.setProperty('--luna-print-x', (phase*100).toFixed(1)+'%');
      surface.style.setProperty('--luna-print-shift', (offset*9).toFixed(2)+'px');
    }
  }
  function queue(){if(!frame&&!document.hidden)frame=requestAnimationFrame(draw);}
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries) {
      const item=entry.target as HTMLElement;
      if(entry.isIntersecting)onscreen.add(item);else onscreen.delete(item);
    }
    queue();
  });
  for(const window of printWindows){window.dataset.lunaPrint='';observer.observe(window);}
  const size=new ResizeObserver(queue);size.observe(root);
  window.addEventListener('scroll',queue,passive);window.addEventListener('resize',queue,passive);
  document.addEventListener('visibilitychange',queue,passive);preference.addEventListener('change',queue,passive);
  queue();
  return ()=>{events.abort();observer.disconnect();size.disconnect();cancelAnimationFrame(frame);
    for(const item of printWindows){delete item.dataset.lunaPrint;item.style.removeProperty('--luna-print-x');item.style.removeProperty('--luna-print-shift');}
  };
}

export function mountCatalogDeals(root: Element, preference: MediaQueryList) {
  const active = new Set<Animation>();
  const candidates = new Set<Element>();
  const events=new AbortController();
  const cards='[data-release-card]';
  const accents='.features-grid .feature-card,.faq-grid > *,footer .footer-col';
  const all=cards+','+accents;
  const observer=new IntersectionObserver(entries=>{
    const visible=entries.filter(entry=>entry.isIntersecting);
    for(const [index,entry] of Array.from(visible.entries())){
      const element=entry.target;
      observer.unobserve(element);candidates.delete(element);
      if(index>=8 || preference.matches || document.hidden || !element.isConnected)continue;
      const card=element.matches(cards);
      const painting=card?element.querySelector('img'):element.firstElementChild;
      if(!painting || typeof painting.animate!=='function') continue;
      const side=getComputedStyle(element).direction==='rtl'?-1:1;
      const film=painting.animate(card ? [
        {translate:(side*6)+'px 14px',rotate:(side*2)+'deg',opacity:.67},
        {translate:'0 0',rotate:'0deg',opacity:1}
      ]:[
        {translate:'0 9px',opacity:.77},{translate:'0 0',opacity:1}
      ],{duration:card?380:425,delay:Math.min(index,5)*24,easing:'cubic-bezier(.18,.76,.24,1)'});
      film.id=card?'luna-print-deal':'luna-section-enter';
      active.add(film);void film.finished.finally(()=>active.delete(film)).catch(()=>{});
    }
  },{threshold:.1});
  function add(element:Element) {
    if(element.matches(all)&&!candidates.has(element)){candidates.add(element);observer.observe(element);}
    for(const el of Array.from(element.querySelectorAll(all)))if(!candidates.has(el)){candidates.add(el);observer.observe(el);}
  }
  function drop(element:Element){if(candidates.delete(element))observer.unobserve(element);for(const el of Array.from(element.querySelectorAll(all)))if(candidates.delete(el))observer.unobserve(el);}
  add(root);
  const changes=new MutationObserver(records=>{for(const list of records){for(const el of Array.from(list.removedNodes))if(el instanceof HTMLElement)drop(el);for(const el of Array.from(list.addedNodes))if(el instanceof HTMLElement)add(el);}});
  changes.observe(root,{childList:true,subtree:true});
  function stop(){for(const film of Array.from(active))film.cancel();active.clear();}
  preference.addEventListener('change',()=>{if(preference.matches)stop();},{signal:events.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();},{signal:events.signal});
  return ()=>{events.abort();observer.disconnect();changes.disconnect();candidates.clear();stop();};
}
