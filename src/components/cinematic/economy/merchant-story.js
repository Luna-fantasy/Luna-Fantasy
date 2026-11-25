import { sceneLifecycle } from './scene-lifecycle';

export function mountMerchantStory(host, key, lang) {
  const {listen,observe,dispose}=sceneLifecycle();
 const ar=lang==='ar', sel=key==='seluna';
 const rm=matchMedia('(prefers-reduced-motion: reduce)');
 const copy=sel ? (ar?['طقس الظهور','ترحال','نافذة قصيرة','رحيل']:['The travelling stall','Arrival','A brief showing','Departure']) : (ar?['داخل صالة ميلز','إضاءة الصالة','خلفيات الملف','خلفيات الرتبة']:['Inside Mells’s gallery','Light the gallery','Profile backgrounds','Rank backgrounds']);
 const glass=sel ? `<path d="M40 323 337 267 683 323v83H40z" fill="#132134"/><path d="M93 249V127h492v122" fill="none" stroke="#7392aa" stroke-width="6"/>
 <path class="mc-sel-left" d="M92 128Q167 80 339 132V278L188 345 91 308Z" fill="url(#mcCurtain)" stroke="#608298" stroke-width="4"/>
 <path class="mc-sel-right" d="M588 128Q504 80 339 132V278L493 345 590 308Z" fill="url(#mcCurtain)" stroke="#608298" stroke-width="4"/>
 <path d="M91 133 155 66h369l65 67z" fill="#203754" stroke="#8e9fb4" stroke-width="4"/><path d="M72 344h540m-511 15h480" stroke="#8396af" stroke-width="2"/>
 <g class="mc-sel-crystal"><path d="M340 140l49 79-17 67-30 26-34-26-18-67z" fill="url(#mcJewel)" stroke="#ace5c2" stroke-width="3"/><path fill="none" stroke="#c5f7da" d="m340 140-16 105 18 67 18-67-20-105m-50 79 34 26 36 0 29-26"/></g>
 <g class="mc-sel-lantern" fill="#ffc985"><path d="M172 230h30v52h-30zM474 230h30v52h-30z"/><path d="m172 230 15-17 15 17m272 0 15-17 15 17" stroke="#dbac78" fill="none"/></g>` :
 `<path d="M0 0h680v385H0z" fill="#101820"/><path d="m0 83 339 100L680 83v243l-341 79L0 326z" fill="url(#mcGallery)"/>
 <path d="M0 325l339-71 341 71m-341-71v166M0 83l339 100L680 83" fill="none" stroke="#8a7965" stroke-width="2"/>
 <g class="mc-mells-light"><path d="M180 36 60 324h326L230 36zM478 31 306 324h339L525 31z" fill="url(#mcBeam)"/></g>
 <g class="mc-mells-first"><path d="m70 132 224 63v101L70 337Z" fill="#392f42" stroke="#c69762" stroke-width="9"/><path d="m85 145 192 57v82L85 316Z" fill="#182331" stroke="#ead1a1" stroke-width="2"/><path d="m102 290 47-62 36 30 26-23 50 29v9l-159 28Z" fill="#668696"/><path d="m101 302 53-29 48 3 59-3-1 8-159 24Z" fill="#ad9a80"/></g>
 <g class="mc-mells-second"><path d="m610 132-224 63v101l224 41Z" fill="#3a3140" stroke="#c69762" stroke-width="9"/><path d="m595 148-192 55v82l192 32Z" fill="#22333d" stroke="#ead1a1" stroke-width="2"/><path d="M565 294v-53l-33-47-24 44-28 8-20 44zm-45-86v80m-100-21 39 8 45-29 38 36 41-31" fill="#9c7b76" stroke="#bd9a80" stroke-width="3"/></g>`;
 const el=document.createElement('section');el.dataset.merchCinema=key;el.className='mc-story'; el.setAttribute('aria-label',copy[0]);
 el.innerHTML=`<header class="mc-head"><h2>${copy[0]}</h2>${sel ? `<p>${ar ? "مشهد من القصة، ولا يعبّر عن حالة المتجر." : "A story vignette, not the current shop status."}</p>` : ""}</header><div class="mc-layout"><svg class="mc-graphic" viewBox="0 0 680 420" aria-hidden="true"><defs>
 <linearGradient id="mcCurtain"><stop stop-color="#163453"/><stop offset=".46" stop-color="#38597c"/><stop offset=".72" stop-color="#294362"/><stop offset="1" stop-color="#152743"/></linearGradient>
 <linearGradient id="mcJewel" x2="0" y2="1"><stop stop-color="#c4f5a0"/><stop offset="1" stop-color="#267a61"/></linearGradient>
 <linearGradient id="mcGallery" x2="0" y2="1"><stop stop-color="#352d2d"/><stop offset="1" stop-color="#101820"/></linearGradient>
 <linearGradient id="mcBeam" x2="0" y2="1"><stop stop-color="#ffe1a0" stop-opacity=".76"/><stop offset="1" stop-color="#ffdeaa" stop-opacity=".03"/></linearGradient>
 </defs>${glass}</svg><p class="mc-beat" aria-hidden="true"></p></div>`;
 host.append(el);
 const beat=el.querySelector('.mc-beat'), clamp=(n)=>Math.min(1,Math.max(0,n));
 const soft=(v,a,b)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
 let visible=!('IntersectionObserver' in window),frame=0,active=-1,elapsed=0,last=null,readingAnchor=null,scrubbed=false,away=false;
 const p=(v)=>{ const s=rm.matches?Math.round(v*2)/2:v, idx=s<.27?0:s<.74?1:2;
   el.style.setProperty('--mc-p',s.toFixed(3)); if(sel){
    const open=soft(s,.04,.44)*(1-soft(s,.72,1));
    el.style.setProperty('--mc-door',(148*open).toFixed(1)+'px');el.style.setProperty('--mc-lift',(-34*open).toFixed(1)+'px');el.style.setProperty('--mc-lamp',(.16+.84*open).toFixed(2));
   }else{
    el.style.setProperty('--mc-light',(.18+.77*soft(s,.06,.57)).toFixed(2));
    el.style.setProperty('--mc-first',(soft(s,.12,.52)*86-soft(s,.60,.98)*136).toFixed(1)+'px');
    el.style.setProperty('--mc-second',(64-soft(s,.53,1)*145).toFixed(1)+'px');
   }
   if(idx!==active){active=idx;beat.textContent=copy[idx+1];}
 };
 function stop(){if(frame)cancelAnimationFrame(frame);frame=0;last=null;}
 function queue(){if(visible&&!frame&&!away&&!document.hidden&&!rm.matches)frame=requestAnimationFrame(draw);}
 function draw(now){
   frame=0;
   if(!visible||away||document.hidden||rm.matches)return;
   const r=el.getBoundingClientRect();
   if(r.bottom<=0||r.top>=innerHeight){last=null;return;}
   if(readingAnchor!==null&&Math.abs(r.top-readingAnchor*innerHeight)>2)scrubbed=true;
   if(readingAnchor===null)readingAnchor=r.top/innerHeight;
   const scrollProgress=clamp((innerHeight*Math.min(.75,readingAnchor)-r.top)/(Math.min(innerHeight,r.height)*.90+40));
   if(!scrubbed&&last!==null)elapsed+=Math.max(0,now-last);
   const intro=clamp(elapsed/3200);
   const playing=!scrubbed&&intro<1;
   last=playing?now:null;
   p(scrubbed?scrollProgress:intro);
   if(playing)queue();
 }
 listen(document,'visibilitychange',()=>document.hidden?stop():queue());
 listen(window,'pagehide',()=>{away=true;stop()});
 listen(window,'pageshow',()=>{away=false;queue()});
 for(const name of ['scroll','resize'])listen(window,name,queue,{passive:true});
 listen(rm,'change',()=>{stop();if(rm.matches)p(.5);else if(visible)queue();else p(0);});
 p(rm.matches?.5:0);
 if('IntersectionObserver' in window){
   observe(([e])=>{visible=e.isIntersecting;if(visible)queue();else{stop();if(scrubbed&&e.boundingClientRect.top>=innerHeight*.75)p(0);}},{threshold:.27}).observe(el);
 }else queue();
  return () => { stop(); dispose(); host.replaceChildren(); };
}
