import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const pub=new URL('../public/luna-v16/grand/',import.meta.url);
const check=(name)=>{const u=new URL(name,pub);assert.ok(existsSync(u), 'missing approved '+name);return u;};
const asset=(url)=>{assert.ok(url.startsWith('/luna-v16/grand/'), 'isolated asset scope');return new URL(url.split('?')[0].slice('/luna-v16/grand/'.length),pub);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const originals={
 'Printed recto 0':'LUNA-0323','Printed recto 1':'LUNA-0300','Printed recto 2':'LUNA-0386','Printed recto 3':'LUNA-0303',
 'Printed verso 0':'LUNA-0288','Printed verso 1':'LUNA-0333','Printed verso 2':'LUNA-0394','Printed verso 3':'LUNA-0389',
};
const textureSet=()=>import(check('grand-v7/textures.mjs'));
test('Cobra and Phoenix use the restored native prints and preserve the previous printed pages as fallbacks',async()=>{
 const {surfaces}=await textureSet();
 for(const name of ['Printed recto 0','Printed verso 1']){
  const entry=surfaces[name];
  assert.match(entry.url,/final-identity-[0-9a-f]+-detail\.webp/);
  assert.ok(existsSync(asset(entry.fallbackUrl)));
  assert.equal(entry.width,1024);
  assert.equal(entry.height,1536);
 }
 const {backs}=JSON.parse(readFileSync(check('art/game-motion/court/cards.json'),'utf8'));
 assert.equal(backs.length,5);
 for(const [i,src] of backs.entries()){
  assert.ok(existsSync(asset(src)));
  assert.equal(src.includes('-restored-'),[1,2,4].includes(i));
 }
});
test('all eight reviewed folio pages are distinct and use their published hashes',async()=>{
 const {surfaces,airborne}=await textureSet();
 assert.deepEqual(Object.fromEntries(Object.entries(surfaces).map(([key,x])=>[key,x.id])),originals);
 assert.deepEqual(airborne.map(x=>x.id),['LUNA-0252','LUNA-0321','LUNA-0278','LUNA-0280','LUNA-0309']);
 for(const x of [...Object.values(surfaces),...airborne]){
  const displaySource=x.fallbackUrl && airborne.includes(x);
  if(displaySource){
   assert.match(x.url,/^\/luna-cinematic\/cards\/fantasy\/LUNA-(0252|0309)\/[\w-]+-medium\.webp$/);
   assert.ok(existsSync(asset(x.fallbackUrl)));
  }
  const b=readFileSync(displaySource?new URL('../public'+x.url,import.meta.url):asset(x.url));
  assert.equal(sha(b),x.sha256,x.id);
  assert.equal(b.length,x.bytes,x.id);
  assert.equal(b.subarray(8,12).toString(),'WEBP',x.id);
 }
});
test('native folio replaces imported base and legacy emissive card channels together',async()=>{
 const {surfaces}=await textureSet();
 const {applyGrandMaterials}=await import(check('grand-v7/materials.mjs'));
 const meshes=gunzipSync(readFileSync(check('art/game-motion/r4/physical-folio.glb.gz')));
 const scene=JSON.parse(meshes.subarray(20,20+meshes.readUInt32LE(12)));
 const texture=index=>({image:{index},flipY:false,colorSpace:'srgb',wrapS:1,wrapT:1});
 const mats=scene.materials.map(m=>({name:m.name,map:texture(m.pbrMetallicRoughness?.baseColorTexture?.index),emissiveMap:texture(m.emissiveTexture?.index)}));
 const old=new Map(mats.map(m=>[m,{map:m.map,emissiveMap:m.emissiveMap}]));
 const byUrl=new Map(Object.values(surfaces).map(s=>[s.url,s]));
 const oldImage=globalThis.Image,oldDocument=globalThis.document;
 globalThis.Image=class{set src(url){const expected=byUrl.get(url);this.naturalWidth=expected.width;this.naturalHeight=expected.height;this.url=url;queueMicrotask(()=>this.onload());}};
 globalThis.document={createElement(){const calls=[],ctx={drawImage(src,...rects){calls.push({src,rects});},save(){},restore(){},translate(){},scale(){}};return{calls,getContext(){return ctx}};}};
 try{
 const T={CanvasTexture:class{constructor(canvas){this.image=canvas}},LinearMipmapLinearFilter:1,LinearFilter:2};
 await applyGrandMaterials(mats,T,{capabilities:{maxTextureSize:2048,getMaxAnisotropy:()=>8}});
 for(const m of mats){
   if(surfaces[m.name]){
     assert.notEqual(m.map,old.get(m).map,m.name);
     assert.equal(m.map,m.emissiveMap,m.name);
     const calls=m.map.image.calls;
     assert.equal(calls.at(-1).src.url,surfaces[m.name].url,m.name);
     for(const {src,rects} of calls.slice(0,-1)){
      assert.equal(src,old.get(m).map.image);
      const [x,y,w,h]=rects;
      assert.equal(rects.length,8,'each original-paper sample has a source rectangle');
      assert.ok(x+w<=50||x>=450||y+h<=92||y>=688,'legacy ink entered '+m.name);
     }
   }else{assert.equal(m.map,old.get(m).map,m.name);assert.equal(m.emissiveMap,old.get(m).emissiveMap,m.name)}
 }
 }finally{globalThis.Image=oldImage;globalThis.document=oldDocument;}
});

test('the native scan exposes each facing pair on the cover or preceding leaf and pauses between turns',async()=>{
 const T=await import(check('runtime/three.module.min.js'));
 const {bindGrandSpreads,grandLeafFrame}=await import(check('grand-v7/folio-native.mjs'));
 const root=new T.Group(),hinge=new T.Group();
 root.add(hinge);
 const leaves=Array.from({length:4},(_,i)=>{
  const leaf=new T.Group();root.add(leaf);
  for(const side of ['recto','verso']){
   const mesh=new T.Mesh(new T.BufferGeometry(),new T.MeshStandardMaterial({name:'Printed '+side+' '+i}));
   mesh.morphTargetInfluences=Array(33).fill(0);
   leaf.add(mesh);
  }
  leaf.add(new T.Mesh(new T.BufferGeometry(),new T.MeshStandardMaterial({name:'Real uncovered rag-paper edge'})));
  return leaf;
 });
 const openRotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),Math.PI);
 bindGrandSpreads(root,leaves,hinge,openRotation);
 const endpaper=hinge.getObjectByName('Printed front endpaper');
 assert.equal(endpaper.morphTargetInfluences.at(-1),1);
 assert.equal(endpaper.material.name,'Printed verso 0');
 assert.equal(leaves[3].children[1].material.name,'Real uncovered rag-paper edge');
 const checkpoints=[
  [.27,[6,6,6,6]], [.49,[19,null,6,6]],
  [.72,[19,24,null,6]], [.98,[19,24,29,6]],
 ];
 for(const [i,[progress,frames]] of checkpoints.entries()){
  const left=i===0?endpaper:leaves[i-1].children[1];
  assert.deepEqual([left.material.name,leaves[i].children[0].material.name],['Printed verso '+i,'Printed recto '+i]);
  for(const [index,frame] of frames.entries()){
   const actual=grandLeafFrame(index,progress);
   if(frame===null)assert.ok(actual>=6&&actual<=[6,12,18][index]);
   else assert.equal(actual,frame);
  }
 }
});
test('ported stage exposes an isolated lifecycle and locale-independent reduced-motion fallback',async()=>{
 const {mountGrandStage}=await import(check('grand-v7/game-motion.mjs'));
 assert.equal(typeof mountGrandStage,'function');
 const holder={dataset:{},querySelector(){return{decoding:'async'};}};
 const restore=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:true});
 try{
  const stage=mountGrandStage({hero:{},holder,wrap:{},direction:'rtl'});
  await stage.ready;
  assert.equal(holder.dataset.gameStage,'static-full-original');
  assert.doesNotThrow(()=>{stage.dispose();stage.dispose()});
 }finally{globalThis.matchMedia=restore;}
});

test('interactive mount enables the route-local Grand rail and disposal removes it',async()=>{
 const {mountGrandStage}=await import(check('grand-v7/game-motion.mjs'));
 const {airborne}=await textureSet();
 const cards=JSON.parse(readFileSync(check('art/game-motion/court/cards.json'),'utf8'));
 const raw=readFileSync(check('art/game-motion/court/measured-card.glb'));
 const bytes=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
 const backUp = {};
 const rootEvents=new EventTarget();
 const styles=()=>({setProperty(){},removeProperty(){}});
 const photo={style:styles(),decode:async()=>{}};
 const element=()=>Object.assign(new EventTarget(),{dataset:{},style:styles(),getBoundingClientRect:()=>({width:810,height:520,top:0})});
 let attached=0,observed=0,cancelled=0;
 const hero=element();let classes=new Set();hero.classList={add:k=>classes.add(k),remove:k=>classes.delete(k)};
 const holder=element();holder.querySelector=()=>photo;holder.append=()=>{attached++};holder.hasPointerCapture=()=>false;
 const wrap={offsetHeight:615};
 const fakeContext={};
 const install={innerHeight:820,devicePixelRatio:1,matchMedia:()=>({matches:false}),
  document:Object.assign(rootEvents,{hidden:false,createElement(){return {className:'',setAttribute(){},getContext:()=>fakeContext,remove(){attached--},style:styles()}}}),
  window:Object.assign(new EventTarget(),{ResizeObserver:true,IntersectionObserver:true,requestIdleCallback:true,cancelIdleCallback(){}}),
  ResizeObserver:class{observe(){observed++;}disconnect(){observed-=2}},
  IntersectionObserver:class{observe(){observed++;}disconnect(){observed--;}},
  requestAnimationFrame:()=>17,cancelAnimationFrame:()=>{cancelled++},requestIdleCallback:()=>18,
  fetch:async u=>({ok:true,json:async()=>u.split('?')[0].endsWith('cards.json')?cards:{depthMetres:[]},arrayBuffer:async()=>bytes}),
  Image:class{set src(url){if(airborne.some(a=>a.url===url)||url.includes('verso-')||url.endsWith('casting-hand.webp')){this.width=this.naturalWidth=640;this.height=this.naturalHeight=960;queueMicrotask(()=>this.onload());}else{queueMicrotask(()=>this.onerror());}}}
 };
 for(const [k,v] of Object.entries(install)){backUp[k]=globalThis[k];globalThis[k]=v}
 try{
  const stage=mountGrandStage({hero,holder,wrap});
  await stage.ready;
  assert.equal(holder.dataset.gameStage,'interactive');
  assert.equal(holder.dataset.motionScene,'the-jesters-folio');
  assert.equal(classes.has('crown-game-rail'),true);
  assert.equal(attached,1);
  assert.equal(observed,3);
  stage.dispose();
  assert.equal(holder.dataset.gameStage,'static-full-original');
  assert.equal(classes.has('crown-game-rail'),false);
  assert.equal(attached,0);
  assert.equal(observed,0);
  assert.equal(cancelled,1);
 }finally{for(const [k,v] of Object.entries(backUp)){globalThis[k]=v}}
});

test('the no-WebGL scenic fallback draws a distinct corrected pair at every settled opening',async()=>{
 const {surfaces}=await textureSet();
 const {createCpuFolio}=await import(check('grand-v7/book-cpu.mjs'));
 const byUrl=new Map(Object.values(surfaces).map(x=>[x.url,x])), drawCalls=[];
 const oldDocument=globalThis.document, oldImage=globalThis.Image;
 const ctx=new Proxy({},{
  get(target,key){if(key==='drawImage')return img=>drawCalls.push(img.url);if(key==='createImageData')return(w,h)=>({data:new Uint8ClampedArray(4*w*h)});if(key==='createLinearGradient')return()=>({addColorStop(){}});if(!(key in target))return()=>{};return target[key];},
  set(target,key,value){target[key]=value;return true;},
 });
 globalThis.document={createElement(){return{width:0,height:0,getContext:()=>ctx}}};
 globalThis.Image=class{set src(url){const x=byUrl.get(url);this.naturalWidth=x.width;this.naturalHeight=x.height;this.url=url;queueMicrotask(()=>this.onload());}};
 try{
  const cpu=await createCpuFolio({url:'closed'});
  for(const [i,t] of [.29,.50,.72,.95].entries()){
    drawCalls.length=0;
    assert.equal(cpu.draw(ctx,t,0,{x:0,y:0,w:820,h:500}),true);
    assert.deepEqual(new Set(drawCalls),new Set([surfaces['Printed verso '+i].url,surfaces['Printed recto '+i].url]));
  }
 }finally{globalThis.document=oldDocument;globalThis.Image=oldImage;}
});
