import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const base = 'public/luna-cinematic/cards/stages/luna/';
const path = base + 'dealer-stage.mjs';
const runtime = async () => {
  assert.ok(existsSync(path), 'a scoped measured-renderer module must be mounted for Luna opening');
  return import(pathToFileURL(resolve(path)));
};

test('opening uses same measured card rig and turns back to the exact authored opening pose', async () => {
  const { parseCard, score, timelinePose } = await runtime();
  const raw=readFileSync(base+'measured-card.glb');
  const g=parseCard(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
  assert.deepEqual([g.tris, g.edges.length, g.ring, g.pos.length], [360, 4, 36, 650]);
  assert.equal(timelinePose(0,0,false),0);
  assert.equal(timelinePose(0,1950,false),.205);
  assert.equal(timelinePose(0,4000,true),0);
  assert.ok(timelinePose(.50,2200,false)>.50);
  assert.equal(timelinePose(1,2200,false),.995);
  assert.deepEqual(score(2,.43,false),[.5,.45,.252,.37,-12,0,0]);
  assert.notDeepEqual(score(0,.43,false),score(0,.43,true));
});

test('touch intent follows native vertical scroll, engages only horizontal movement, and does not consume diagonal micro-gestures', async () => {
  const { touchIntent } = await runtime();
  assert.equal(touchIntent(2,15),'scroll');
  assert.equal(touchIntent(15,2),'inspect');
  assert.equal(touchIntent(7,0),'pending');
  assert.equal(touchIntent(10,9),'pending');
});

test('Next keeps the original SSR poster eager and mounts only the Luna runtime from the cinematic branch', async () => {
  const ui=readFileSync('src/components/cinematic-games/CinematicGames.tsx','utf8');
  const page=readFileSync('src/app/[locale]/luna-fantasy/CardsContent.tsx','utf8');
  assert.match(ui, /player\.mountLunaDealer/);
  assert.match(ui, /loading="eager"/);
  assert.match(ui, /stageHandle\?\.dispose\(\)/);
  assert.match(page, /cinematic \? <LunaDealerScene/);
  assert.match(page, /editId="luna-fantasy-hero-bg"/);
});

test('the prereviewed main photo and five twin-tier face IDs remain exact pinned bytes', async()=>{
  const get=(p)=>createHash('sha256').update(readFileSync(p)).digest('hex').slice(0,16);
  assert.equal(get(base+'table.webp'),'04369e97e4d1c786');
  for(const [id,heavy,small] of [
    ['0264','19330c90a440d8c9','b7a5d21cd1d56e25'],
    ['0335','16f07f2c6a46831e','95dd4e609ff47f43'],
    ['0293','01c585dcc6363bce','f50f8be0ee57d990'],
    ['0384','43d26bf04d69618f','6f0d0915c3d07fd2'],
    ['0305','dba91681547b54f8','3dae6885a6786d9b'],
  ]){
    assert.equal(get(base+'LUNA-'+id+'-face.webp'),heavy);
    assert.equal(get('public/luna-cinematic/cards/fantasy/LUNA-'+id+'/thumb.webp'),small);
  }
});

const glbUrl = new URL('../'+base+'measured-card.glb',import.meta.url);
const groundUrl = new URL('../'+base+'luna-fantasy-ground.webp',import.meta.url);
const shellUrl = new URL('../'+base+'luna-fantasy-shell.json',import.meta.url);
test('header hall, calibrated shell, floor and measured mesh are exact immutable bytes',()=>{
  for (const [url,sha] of [
    [glbUrl,'df240525d43aafdecbe3ee8540eb9ea89420653091a303828699c52bf2eb33e6'],
    [groundUrl,'b66dd1b58101d1e963b00f6c68bfdcc080ad6bbcc6c6490ec24fe68d80599a03'],
    [shellUrl,'60b81c8ec8a78af03fb947b3a79a63d0cdd41528e39042eb8e800e37618b7a92'],
  ]) assert.equal(createHash('sha256').update(readFileSync(url)).digest('hex'),sha);
});

class Style {
  setProperty(k,v){this[k]=v;}
  removeProperty(k){delete this[k];}
}
function harness({width=1280,height=620,offline=false,noCanvas=false,saveData=false,restore=false,failFront=false}={}){
  let time=0, offset=0, nextFrame=0;
  const frames=new Map(), canvasCalls={face:0,room:0}, captures=new Set(), seen=new Set(), watchers=[];
  const ctx = new Proxy({}, {get:(_,k)=>{
    if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>({addColorStop(){}});
    if(k==='drawImage')return i=>{
      if(i===photo)canvasCalls.room++;
      if(i.src?.includes('/faces/')||i.src?.includes('/verso/')||i.src?.includes('/small/'))canvasCalls.face++;
    };
    return ()=>{};
  }});
  class Et extends EventTarget {
    constructor(doc){super();this.dataset={};this.style=new Style();this.ownerDocument=doc;this.children=[];this.added=0;this.removed=0;}
    addEventListener(...args){this.added++;super.addEventListener(...args);}
    removeEventListener(...args){this.removed++;super.removeEventListener(...args);}
    getBoundingClientRect(){return {width,height,top:0,left:0};}
    append(el){this.children.push(el);el.parent=this;}
    querySelector(){return this.children.find(el=>Object.hasOwn(el.dataset,'dealerCardsCanvas'));}
    insertBefore(el,ref){const i=this.children.indexOf(ref);if(i<0)this.append(el);else {this.children.splice(i,0,el);el.parent=this;}}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(el=>el!==this);}
    getContext(type){return type==='2d'&&!noCanvas?ctx:null;}
    setAttribute(){}
    hasPointerCapture(i){return captures.has(i);}
    setPointerCapture(i){captures.add(i);}
    releasePointerCapture(i){captures.delete(i);}
  }
  class Img{
   width=640;height=960;
   removeAttribute(){}
   set src(u){this.value=u;seen.add(u);queueMicrotask(()=>failFront&&u.includes('/faces/')?this.onerror?.():this.onload?.());}
   get src(){return this.value;}
  }
  const doc = new Et(),view = new Et(doc);
  doc.defaultView=view; doc.hidden=false; doc.createElement=()=>new Et(doc);
  const hero=new Et(doc),holder=new Et(doc),wrap=new Et(doc),photo=new Et(doc);wrap.offsetHeight=860;
  holder.append(photo);photo.naturalWidth=1536;photo.naturalHeight=1024;photo.decode=async()=>{};
  hero.getBoundingClientRect=()=>({top:-offset});
  for (const k of ['ResizeObserver','IntersectionObserver'])view[k]=class {
    constructor(cb){this.cb=cb;this.disposed=false;watchers.push(this);}
    observe(){}
    disconnect(){this.disposed=true;}
  };
  view.Image=Img;view.navigator={connection:{saveData}};
  view.performance={now:()=>time,getEntriesByType:()=>[{type:restore?'back_forward':'navigate'}]};
  view.innerHeight=800;view.devicePixelRatio=3;
  view.requestAnimationFrame=fn=>{const i=++nextFrame;frames.set(i,fn);return i;};
  view.cancelAnimationFrame=i=>frames.delete(i);
  const opts={hero,holder,wrap,photo,cards:['0264','0335','0293','0384','0305'].map(n=>({id:'LUNA-'+n,front:'/faces/'+n,thumb:'/small/'+n,back:'/verso/'+n})),reduced:{matches:false}};
  const dispatch=(obj,type,props={})=>{
    const ev=new Event(type,{cancelable:true});
    for(const [k,v] of Object.entries(props))Object.defineProperty(ev,k,{value:v});
    obj.dispatchEvent(ev); return ev;
  };
  const flush=(now)=>{time=now;for(const [i,fn] of [...frames]){if(frames.delete(i))fn(now);}};
  const setOffset=v=>{offset=v;dispatch(view,'scroll');};
  const asset=async(url,{signal}={})=>{
    if(signal?.aborted)throw signal.reason;
    if(offline&&url.pathname.endsWith('.glb'))return {ok:false};
    return {ok:true,arrayBuffer:async()=>{const b=readFileSync(url);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);},json:async()=>JSON.parse(readFileSync(url,'utf8'))};
  };
  return {doc,view,opts,holder,hero,photo,frames,captures,seen,watchers,canvasCalls,flush,setOffset,dispatch,asset};
}

test('the five dealer front cards keep their original reverse print when a revised reverse fails to load',async()=>{
  const {mountLunaDealer}=await runtime();
  const h=harness(), saved=globalThis.fetch, BaseImage=h.view.Image;
  h.view.Image=class extends BaseImage {
    set src(url){if(url==='/revised-back'){h.seen.add(url);queueMicrotask(()=>this.onerror?.());}else super.src=url;}
    get src(){return super.src;}
  };
  h.opts.cards[1]={...h.opts.cards[1],originalBack:h.opts.cards[1].back,back:'/revised-back'};
  globalThis.fetch=h.asset;
  try{
    const stage=mountLunaDealer(h.opts);await stage.ready;
    assert.equal(h.holder.dataset.gameStage,'interactive');
    assert.ok(h.seen.has('/revised-back')&&h.seen.has('/verso/0335'));
    stage.dispose();
  }finally{globalThis.fetch=saved;}
});

test('mounted renderer draws actual card texture, scales for DPR, and clears all scoped resources on unmount',async()=>{
  const { mountLunaDealer } = await runtime();
  const h=harness(), original=globalThis.fetch;
  globalThis.fetch=h.asset;
  try {
    const handle=mountLunaDealer(h.opts);await handle.ready;
    await new Promise(r=>setImmediate(r));
    assert.equal(h.holder.dataset.gameStage,'interactive');
    assert.equal(h.holder.dataset.approvedFrontIds,'LUNA-0264,LUNA-0335,LUNA-0293,LUNA-0384,LUNA-0305');
    assert.equal(h.holder.dataset.modelTriangles,'360');
    assert.equal(h.holder.querySelector().width, 2447);
    assert.equal(h.holder.querySelector().getContext('2d')!==null,true);
    assert.equal(h.hero.style['--dealer-runway'],'1008px');
    h.flush(0);assert.equal(h.holder.dataset.motionProgress,'0.000');
    const camera={pointerId:3,button:0,isPrimary:true,pointerType:'mouse',clientX:1270,clientY:5};
    h.dispatch(h.holder,'pointerdown',camera);
    h.dispatch(h.holder,'pointermove',{...camera,clientX:1370});
    h.flush(10);assert.ok(+h.holder.dataset.cameraYaw>0,'grab photography when no cards cover the target');
    h.dispatch(h.holder,'pointercancel',camera);h.flush(15);
    assert.equal(h.holder.dataset.cameraYaw,'0.0');
    h.flush(2000);assert.equal(h.holder.dataset.motionProgress,'0.205');
    h.setOffset(511);h.flush(2100);
    assert.ok(h.canvasCalls.face>0 && h.canvasCalls.room>0, 'paint actual projected faces and software room');
    assert.ok(+h.holder.dataset.keyBindings>=1);
    const touch={pointerId:7,button:0,isPrimary:true,pointerType:'touch',clientX:1200,clientY:5};
    const initial=h.dispatch(h.holder,'pointerdown',touch);
    assert.equal(initial.defaultPrevented,false);
    h.dispatch(h.holder,'pointermove',{...touch,clientY:36});
    assert.equal(h.holder.dataset.grabbing,'false');
    assert.equal(h.captures.size,0);
    h.dispatch(h.holder,'pointerdown',touch);
    h.dispatch(h.holder,'pointermove',{...touch,clientX:1270});
    assert.equal(h.holder.dataset.grabbing,'true');
    h.flush(2125);assert.ok(+h.holder.dataset.inspectYaw>0,'spin the card covering this touch target');
    assert.ok(h.captures.has(7));
    h.dispatch(h.view,'pagehide');assert.equal(h.captures.size,0);assert.equal(h.frames.size,0);
    h.setOffset(0);
    h.dispatch(h.view,'pageshow',{persisted:true});h.flush(2200);h.flush(2250);
    assert.equal(h.holder.dataset.motionProgress,'0.000');
    assert.equal(h.holder.dataset.cameraYaw,'0.0');
    handle.dispose();
    assert.ok(h.watchers.every(w=>w.disposed));
    assert.equal(h.holder.children.length,1);
    assert.equal(h.holder.children[0],h.photo);
    assert.equal(h.photo.style.transform,undefined);
    assert.equal(h.holder.added,h.holder.removed);
    assert.equal(h.view.added,h.view.removed);
    assert.equal(h.doc.added,h.doc.removed);
    assert.equal(h.frames.size,0);
  }finally{globalThis.fetch=original;}
});

test('mobile and browser history draw the real starting photo; Save-Data requests only approved smaller prints',async()=>{
  const { mountLunaDealer } = await runtime();
  const h=harness({width:375,height:650,saveData:true,restore:true}),original=globalThis.fetch;
  globalThis.fetch=h.asset;
  try{
    const handle=mountLunaDealer(h.opts);await handle.ready;
    h.flush(50);h.flush(70);
    assert.equal(h.holder.dataset.motionProgress,'0.000');
    assert.equal(h.photo.style.height,'650px');
    assert.ok(parseFloat(h.photo.style.width)>375);
    assert.equal([...h.seen].filter(x=>x.startsWith('/small/')).length,5);
    assert.equal([...h.seen].filter(x=>x.startsWith('/faces/')).length,0);
    h.setOffset(1008);h.flush(100);assert.equal(h.holder.dataset.motionProgress,'0.995');
    h.setOffset(0);h.flush(130);assert.equal(h.holder.dataset.motionProgress,'0.000');
    handle.dispose();
  }finally{globalThis.fetch=original;}
});

test('missing body, denied CPU context, reduced-motion or unmount during a failed load preserve the SSR poster and no rail',async()=>{
  const { mountLunaDealer }=await runtime(),original=globalThis.fetch;
  try{
    for(const mode of ['offline','noCanvas','reduced','unmount','small-fallback']){
      const h=harness({offline:mode==='offline',noCanvas:mode==='noCanvas',failFront:mode==='small-fallback'});
      h.opts.reduced.matches=mode==='reduced';
      globalThis.fetch=h.asset;
      const handle=mountLunaDealer(h.opts);
      if(mode==='unmount')handle.dispose();
      await handle.ready;
      if(mode==='small-fallback'){
        assert.equal(h.holder.dataset.gameStage,'interactive');
        assert.equal([...h.seen].filter(x=>x.startsWith('/small/')).length,5);
      }else{
        if(mode!=='unmount')assert.equal(h.holder.dataset.gameStage,'static-full-original',mode);
        assert.equal(h.hero.dataset.dealerLive,undefined,mode);
        assert.equal(h.holder.children.length,1,mode);
        assert.equal(h.holder.children[0],h.photo);
        assert.equal(h.frames.size,0,mode);
      }
      handle.dispose();
    }
  }finally{globalThis.fetch=original;}
});
