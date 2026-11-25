// Lunvor opening. A registered photographic editorial sequence followed by an original film frame bank.
// No wheel interception, timed intro, independent playback clock, or pretend 3D.
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=v=>{v=clamp(v); return v*v*(3-2*v)};
const asset=n=>'/luna-cinematic/home-story/home/'+n;
const dims=[1040,585], aspect=dims[0]/dims[1], sceneUrl=(s,w)=>asset(s+'-'+w+'.webp');
const sections=[
 // Order belongs to the settlement terraces, not two full-frame opacity layers.
 {start:.137,end:.213,axis:[-.31,1],poly:[[629,342],[703,318],[782,324],[824,365],[893,372],[955,405],[1002,430],[939,463],[826,498],[744,502],[674,475],[619,431]]},
 {start:.172,end:.259,axis:[-.13,1],poly:[[744,301],[800,296],[850,291],[886,297],[942,293],[969,247],[1040,237],[1040,386],[1006,407],[966,388],[935,404],[900,374],[858,410],[832,363],[776,359],[724,341]]},
 {start:.229,end:.364,axis:[.59,.94],poly:[[496,245],[531,233],[570,237],[611,253],[635,256],[669,283],[702,278],[750,302],[763,295],[798,309],[805,358],[784,408],[735,435],[651,433],[605,408],[558,377],[528,347],[491,330],[474,284]]},
 {start:.266,end:.405,axis:[.35,1],poly:[[138,193],[141,156],[175,152],[202,143],[232,126],[267,125],[283,104],[318,111],[333,124],[375,125],[395,159],[463,169],[486,190],[532,215],[549,258],[522,285],[497,289],[464,309],[416,296],[384,275],[353,261],[302,251],[257,248],[203,247],[170,247],[139,229]]}
];
const openImg=(url)=>new Promise((resolve,reject)=>{
 const img=new Image(); img.decoding='async';img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Unavailable frame'));img.src=url;
});
export function mountHomeScene(stage){
 const owner=new AbortController();
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const watch=(el,ev,fn,passive=true)=>el.addEventListener(ev,fn,{signal:owner.signal,passive});
 let teardown=null,epoch=0;
async function init(){
 if(owner.signal.aborted||!stage||teardown||reduce.matches||!window.ResizeObserver)return;
 const ticket=++epoch, poster=stage.querySelector('picture img'), hero=stage.closest('.hero'), run=hero?.parentElement, canvas=stage.querySelector('canvas');
 if(!poster||!hero||!run||!canvas)return;
 const natural=await (poster.complete&&poster.naturalWidth ? Promise.resolve(poster) :
   poster.decode?.().then(()=>poster).catch(()=>null));
 if(ticket!==epoch||owner.signal.aborted||reduce.matches||!natural?.naturalWidth||teardown)return;
 const ctx=canvas.getContext('2d',{alpha:false,desynchronized:false}); if(!ctx)return;
 run.dataset.homeReady='true';
 const scenePoster=stage.querySelector('picture');
 const ac=new AbortController(), signal=ac.signal, on=(el,ev,fn,passive=true)=>el.addEventListener(ev,fn,{signal,passive});
 let raf=0,suspended=false,current=0,w0=0,h0=0,phone=false,assetWidth,pendingStage=false,gateThumb=null,seq=0,portraitTop=0,protectedFrame=-1;
 const stills=new Map(), developing=new Set(), frames=new Map(), gateErrors=new Set();let gateLoading=0;
 function still(key,width){
   const id=key+width;if(developing.has(id)||stills.has(id))return;developing.add(id);
   openImg(sceneUrl(key,width)).then(img=>{if(signal.aborted)return;stills.set(id,img);schedule()}).catch(()=>{}).finally(()=>developing.delete(id));
 }
 function offscreen(r){return r.bottom<=0||r.top>=innerHeight}
 function cancelFrame(){if(raf)cancelAnimationFrame(raf);raf=0}
 function schedule(){if(!signal.aborted&&!suspended&&!document.hidden&&!raf)raf=requestAnimationFrame(render)}
 function geom(){
   let r=run.getBoundingClientRect(); if(offscreen(r))return null;
   const h=Math.max(1,hero.offsetHeight), w=Math.max(1,hero.offsetWidth);
   current=clamp(-r.top/Math.max(1,run.offsetHeight-h));phone=w/h<=1;
   const pixelBudget=phone ? 3350000 : 7450000;
   const dpr=Math.min(devicePixelRatio||1,phone?3:2.5,Math.sqrt(pixelBudget/(w*h)));
   if(phone)portraitTop=Math.max(0,(scenePoster?.getBoundingClientRect().top-stage.getBoundingClientRect().top||Math.min(108,h*.155))*dpr);
   const cw=Math.round(w*dpr),ch=Math.round(h*dpr);
   if(cw!==w0||ch!==h0){canvas.width=w0=cw;canvas.height=h0=ch;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high'}
   const ideal=phone?cw:Math.max(cw,ch*aspect);
   const size=ideal<=900?960:ideal<=1480?1600:2560;
   if(size!==assetWidth){assetWidth=size;still('natural',size); if(pendingStage){still('settled',size);still('quay',size)}}
   return {w:cw,h:ch};
 }
 function prepare(){
   if(pendingStage)return;pendingStage=true;still('settled',assetWidth||1600);still('quay',assetWidth||1600);
   openImg(asset('gate-still-hd.webp')).then(img=>{if(!signal.aborted){gateThumb=img;schedule()}}).catch(()=>{});
 }
 function sizeBox(w,h,z,fx,fy){
   if(phone){
     // A real portrait layout, not a zoom into the middle of a landscape crop.
     // The approved 16:9 image is fully visible at every point, including the native Gate frames.
     const width=Math.min(w,h*aspect),height=width/aspect;
     const top=clamp(portraitTop,0,h-height),center=Math.max(top,(h-height)*.46);
     return {x:(w-width)*.5,y:top+(center-top)*smooth((current-.12)/.62),width,height};
   }
   const width=Math.max(w,h*aspect)*z,height=width/aspect;
   return {x:Math.min(0,Math.max(w-width,(w-width)*fx)),y:Math.min(0,Math.max(h-height,(h-height)*fy)),width,height};
 }
 function blit(img,b){ctx.drawImage(img,b.x,b.y,b.width,b.height)}
 function known(s){return stills.get(s+assetWidth)||stills.get(s+1600)||stills.get(s+960)||stills.get(s+2560)}
 function clipRegion(gr,p,b){
   const {axis,poly,start,end}=gr, t=smooth((p-start)/(end-start));
   const [vx,vy]=axis,nx=-vy,ny=vx,l=2600;
   const vals=poly.map(([x,y])=>x*vx+y*vy), high=Math.max(...vals),low=Math.min(...vals), plane=high-(high-low+4)*t;
   const cc=1/(vx*vx+vy*vy),sx=vx*plane*cc,sy=vy*plane*cc;
   const pt=(x,y)=>[b.x+b.width*x/dims[0],b.y+b.height*y/dims[1]];
   ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(...pt(x,y)):ctx.moveTo(...pt(x,y)));ctx.closePath();ctx.clip();
   const pts=[[sx+nx*l,sy+ny*l],[sx-nx*l,sy-ny*l],[sx-nx*l+vx*l,sy-ny*l+vy*l],[sx+nx*l+vx*l,sy+ny*l+vy*l]];
   ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(...pt(x,y)):ctx.moveTo(...pt(x,y)));ctx.closePath();ctx.clip();
 }
 function island(p,w,h){
   const q=smooth(p/.58), terrace=smooth((p-.105)/.112)*(1-smooth((p-.232)/.132));
   const b=sizeBox(w,h,1.005+.085*q,phone?.405+.065*q+.24*terrace:.43+.17*q,.43+.09*q);
   blit(known('natural')||natural,b);
   const city=known('settled');
   if(city&&p>.137)for(const gr of sections){if(p<=gr.start)continue;ctx.save();clipRegion(gr,p,b);blit(city,b);ctx.restore()}
 }
 const framePath=i=>asset('gate-frames/'+String(i).padStart(3,'0')+'.webp');
 function acquire(i){
   if(i<0||i>96||frames.has(i)||gateErrors.has(i)||gateLoading>=(phone?4:5))return;
   // Budget decoded frames before requesting more; never evict the chosen presentation frame.
   const cap=phone?8:12;
   while(frames.size>=cap){
     const removable=[...frames].filter(([n,r])=>r.img&&n!==protectedFrame).sort((a,b)=>a[1].when-b[1].when);
     if(!removable.length)return;
     frames.delete(removable[0][0]);
   }
   gateLoading++;frames.set(i,{when:++seq,img:null});
   openImg(framePath(i)).then(img=>{
    if(signal.aborted)return;gateLoading--;frames.set(i,{when:++seq,img});if(current>=.727)schedule();
   }).catch(()=>{gateLoading--;frames.delete(i);gateErrors.add(i);if(current>=.727)schedule()});
 }
 function gate(p,w,h){
   const q=clamp((p-.767)/.233),i=Math.round(96*q);
   protectedFrame=i;
   const warm=[i,i+1,i-1,i+2,i-2,i+4,i-4];
   warm.forEach(acquire);
   let chosen=frames.get(i)?.img, actual=i;
   if(!chosen){
    const ready=[...frames.entries()].filter(([,v])=>v.img).sort(([k],[j])=>Math.abs(k-i)-Math.abs(j-i)||k-j);
    if(ready.length){actual=ready[0][0];chosen=ready[0][1].img}else {actual=-1;chosen=gateThumb||known('quay')||natural}
   }
   const cached=frames.get(actual);if(cached)cached.when=++seq;
   const b=sizeBox(w,h,1.002,phone?.226+.328*smooth(q/.78):.50,.50);
   blit(chosen,b);
   stage.dataset.frame=String(i);stage.dataset.drawnFrame=String(actual);stage.dataset.framePixels=chosen.naturalWidth+'×'+chosen.naturalHeight;
 }
 function render(){
   raf=0;if(suspended||document.hidden)return;const g=geom();if(!g)return;
   const {w,h}=g,p=current;
   if(p>.012)prepare();
   if(p>.55){[0,1,2,4,8,14,24].forEach(acquire)}
   const reveal=1-smooth((p-.06)/.24);
   hero.style.setProperty('--atlas-reveal',reveal.toFixed(3));
   hero.style.setProperty('--atlas-visibility',reveal===0?'hidden':'visible');
   hero.toggleAttribute('data-atlas-covered',reveal===0);
   const words=1-smooth(p/.185);hero.style.setProperty('--words',words.toFixed(3));
   hero.style.setProperty('--lift',(-16*(1-words)).toFixed(2)+'px');
   hero.style.setProperty('--wash',(.10+.90*words).toFixed(3));
   hero.style.setProperty('--links',p<.18?'auto':'none');
   stage.dataset.progress=p.toFixed(6);
   let shot='island';
   if(phone){
    const matte=ctx.createLinearGradient(0,0,0,h);
    matte.addColorStop(0,'#101a28');matte.addColorStop(.40,'#182737');matte.addColorStop(1,'#090f19');
    ctx.fillStyle=matte;
   }else ctx.fillStyle='#12202d';
   ctx.fillRect(0,0,w,h);
   stage.dataset.presentation=phone?'portrait-full-frame':'desktop-cinema';
   if(p<.575){shot=p<.137?'island':p<.405?'settlement':'city';island(p,w,h)}
   else if(p<.767){
    shot='quay';const q=smooth((p-.575)/.192),img=known('quay');
    if(img){const b=sizeBox(w,h,1+.065*q,phone?.58+.08*q:.53+.11*q,.51);blit(img,b)}
    else {island(.575,w,h)}
   }else{shot='gate';gate(p,w,h)}
   if(shot!=='gate'){delete stage.dataset.frame;delete stage.dataset.drawnFrame;delete stage.dataset.framePixels;}
   stage.dataset.shot=shot;stage.dataset.engine=shot==='gate'?'original-film-frames':'registered-photographic-plates';
   canvas.setAttribute('data-drawn','');
 }
 const obs=new ResizeObserver(schedule);obs.observe(hero);obs.observe(run);
 on(window,'scroll',schedule);on(window,'resize',schedule);
 on(window,'pagehide',()=>{suspended=true;cancelFrame()});
 on(window,'pageshow',()=>{suspended=false;schedule()});
 on(document,'visibilitychange',()=>document.hidden?cancelFrame():schedule());
 on(window,'hashchange',schedule);
 const idle='requestIdleCallback' in window;
 const job=idle?window.requestIdleCallback(()=>{if(!signal.aborted)prepare()},{timeout:1600}):window.setTimeout(()=>{if(!signal.aborted)prepare()},800);
 schedule();
 teardown=()=>{epoch++;ac.abort();obs.disconnect();cancelFrame();
  if(idle)window.cancelIdleCallback?.(job);else clearTimeout(job);
  delete run.dataset.homeReady;canvas.removeAttribute('data-drawn');
  hero.removeAttribute('data-atlas-covered');
  for(const k of ['words','lift','wash','links','atlas-reveal','atlas-visibility'])hero.style.removeProperty('--'+k);
  for(const k of ['progress','shot','engine','frame','drawnFrame','presentation','framePixels'])delete stage.dataset[k];
  teardown=null;
 };
}
 function enable(){init().catch(()=>{teardown?.()})}
 watch(reduce,'change',()=>{if(reduce.matches){epoch++;teardown?.()}else enable()});
 const openingPoster=stage.querySelector('picture img');
 if(openingPoster){
  watch(openingPoster,'error',()=>{epoch++;teardown?.()});
  watch(openingPoster,'load',enable);
 }
 const page=stage.closest('[data-luna-home]');
 const stops=[...page?.querySelectorAll('#overview .showcase-row')||[]];
 let frame=0,paused=false;
 function stopPaint(){if(frame)cancelAnimationFrame(frame);frame=0}
 function paintStops(){
  frame=0;if(paused||document.hidden||owner.signal.aborted)return;
  for(const row of stops){
   const a=row.getBoundingClientRect(),ht=innerHeight;
   if(a.bottom<0||a.top>ht*1.2)continue;
   const t=reduce.matches?1:clamp((ht*.94-a.top)/(Math.min(ht*.68,a.height*.9)+1)),k=1-t;
   row.style.setProperty('--stop-cut',(8*k).toFixed(1)+'%');
   row.style.setProperty('--stop-z',(1+.09*k).toFixed(4));
   row.style.setProperty('--stop-y',(1.35*k).toFixed(3)+'%');
   row.style.setProperty('--stop-t',(21*k).toFixed(1)+'px');
  }
 }
 function queueStops(){if(!frame&&!paused&&!document.hidden&&!owner.signal.aborted)frame=requestAnimationFrame(paintStops)}
 if(stops.length){
  watch(window,'scroll',queueStops);watch(window,'resize',queueStops);
  watch(window,'pagehide',()=>{paused=true;stopPaint()});watch(window,'pageshow',()=>{paused=false;queueStops()});
  watch(document,'visibilitychange',()=>document.hidden?stopPaint():queueStops());watch(reduce,'change',queueStops);
 }
 enable();queueStops();
 return ()=>{
  epoch++;owner.abort();teardown?.();stopPaint();
  for(const row of stops)for(const prop of ['--stop-cut','--stop-z','--stop-y','--stop-t'])row.style.removeProperty(prop);
 };
}
