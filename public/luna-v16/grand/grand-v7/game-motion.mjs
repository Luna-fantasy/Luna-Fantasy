/* Four optical assemblies: three native perspective game stages, and the archive-detail loupe.
   The real measured GLB supplies the curved perimeter, front/back normals and four stock/bevel
   bands. This self-contained CPU projection remains available if WebGL is denied or lost. */
// Approved Grand hero renderer adapted to route-owned DOM references. Internal assets
// are isolated from the production catalog, dashboard renderer, and root styles.
export function mountGrandStage({hero,holder,wrap,direction='ltr'}) {
const slug='grand-fantasy',isLuna=false,isGrand=true,isWar=false;
const base='/luna-v16/grand/art/game-motion/court/',newBase='/luna-v16/grand/art/game-motion/r4/',reduced=matchMedia('(prefers-reduced-motion:reduce)');
const lifetime = new AbortController(), cleanups=[];
const signed=direction==='rtl'?-1:1;
const alive=()=>!lifetime.signal.aborted;
const keep=(cleanup)=>alive()?cleanups.push(cleanup):cleanup();
const listen=(target,event,handler,options={})=>target.addEventListener(event,handler,{...options,signal:lifetime.signal});
const fetchOK=async (url)=>{const res=await fetch(url,{signal:lifetime.signal});if(!res.ok)throw Error('Grand stage resource');return res;};
const reset=()=>{
 const photo=holder?.querySelector('img');
 hero?.classList?.remove('crown-game-rail');
 for(const key of ['--runway','--game-pin-height'])hero?.style?.removeProperty(key);
 for(const key of ['--poster-size','--poster-pos'])holder?.style?.removeProperty(key);
 for(const key of ['width','height','transform'])photo?.style?.removeProperty(key);
 if(holder){
  for(const key of ['painted','roomPaint','artReady','bookRenderer','bookPose','bookCamera','grabbing'])delete holder.dataset[key];
  holder.dataset.gameStage='static-full-original';
 }
};
function dispose(){
 if(!alive())return;lifetime.abort();
 for(const cleanup of cleanups.reverse()){try{cleanup()}catch{}}
 reset();
}
const D=Math.PI/180, clip=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)),mix=(a,b,t)=>a+(b-a)*t,ease=x=>x*x*(3-2*x),gate=(x,a,b)=>ease(clip((x-a)/(b-a)));
const io=url=>new Promise((ok,bad)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=bad;im.src=url;});
const pt=(ctx,p)=>{ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);for(let j=1;j<p.length;j++)ctx.lineTo(p[j][0],p[j][1]);ctx.closePath()};
function parseCard(buf){
 const v=new DataView(buf),jlen=v.getUint32(12,true),j=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,20,jlen))),start=28+jlen;
 const ac=j.accessors[j.meshes[0].primitives[0].attributes.POSITION],bv=j.bufferViews[ac.bufferView],f=new Float32Array(buf,start+(bv.byteOffset||0),ac.count*3),width=j.meshes[0].extras.cardWidthMetres;
 const pos=Array.from({length:ac.count},(_,i)=>[f[i*3]/width,-f[i*3+1]/width,f[i*3+2]/width]);
 const ring=j.meshes[0].extras.ringSamples,edges=j.meshes[0].primitives.slice(2).map(pr=>{const ac=j.accessors[pr.indices],vw=j.bufferViews[ac.bufferView],idx=new Uint16Array(buf,start+vw.byteOffset,ac.count);return Array.from({length:ac.count/6},(_,i)=>[idx[i*6],idx[i*6+1],idx[i*6+2],idx[i*6+5]]);});
 return {pos,ring,edges,z:pos[0][2],tris:j.meshes[0].primitives.reduce((s,p)=>s+j.accessors[p.indices].count/3,0)};
}
// Perspective-correct piecewise planar UV sampling of an actual face bounded by its curved GLB ring.
function tri(c,img,s,t){
 const [a,b,d]=s,[A,B,D]=t,ax=b[0]-a[0],ay=b[1]-a[1],bx=d[0]-a[0],by=d[1]-a[1],det=ax*by-ay*bx;if(Math.abs(det)<.001)return;
 const ux=B[0]-A[0],uy=B[1]-A[1],vx=D[0]-A[0],vy=D[1]-A[1],aa=(ux*by-vx*ay)/det,cc=(ax*vx-bx*ux)/det,bb=(uy*by-vy*ay)/det,dd=(ax*vy-bx*uy)/det;
 const x=(A[0]+B[0]+D[0])/3,y=(A[1]+B[1]+D[1])/3,ext=t.map(p=>{const dx=p[0]-x,dy=p[1]-y,l=Math.hypot(dx,dy)||1;return [p[0]+dx*.60/l,p[1]+dy*.60/l]});
 c.save();pt(c,ext);c.clip();c.transform(aa,bb,cc,dd,A[0]-aa*a[0]-cc*a[1],A[1]-bb*a[0]-dd*a[1]);c.drawImage(img,0,0);c.restore();
}
const sample=(st,t)=>{let k=0;while(k<st.length-2&&t>st[k+1][0])k++;const u=ease(clip((t-st[k][0])/(st[k+1][0]-st[k][0])));return st[k][1].map((n,i)=>mix(n,st[k+1][1][i],u));};
const layouts={
 'luna-fantasy':'the-dealers-table','grand-fantasy':'the-jesters-folio','faction-war':'the-muster'
};
// Staging coordinates: x and y fraction of available plate; front width fraction of the
// shorter ground dimension; range is camera distance, NOT a screen-space z-index.
function score(i,p,portrait){
 const a=i-2,b=i-3,L=isLuna,G=isGrand;
 if(L)return sample([[0,[-.14-.038*i,.72+.025*i,.13,.25,54,151-i*8,-57+5*i]],
 [.22,[(portrait?.46:.49)+a*(portrait?.105:.105),.65+Math.abs(a)*.047,.06+(2-Math.abs(a))*.012,.30,26,18+a*11,a*14-6]],
 [.43,[.5+a*(portrait?.195:.176),.45+Math.abs(a)*.096,.10+(2-Math.abs(a))*.076,.37,-12,a*21,a*16]],
 [.65,[.47+a*.25,.52+Math.abs(a)*.105,.02+(2-Math.abs(a))*.125,.43,-4,a*29,a*19-5]],
 [.82,[.49+a*.169,.59+Math.abs(a)*.036,.12+(2-Math.abs(a))*.017,.265,19,a*9,a*7]],
 [1,[.54+.083*a,.64-.031*i,.012,.19,58,1,a*5]]],p);
 if(G)return sample([[0,[.16,.66,.02,.034,35,76,-69]],
 [.22,[.24+i*.115,.64+(.045*Math.sin(i*1.35)),.05+i*.016,.15+.012*i,-18,-56+i*13,-49+i*19]],
 [.42,[[.04,.22,.52,.77,.94][i],[.57,.36,.71,.52,.27][i],[.10,.12,.24,.13,.035][i],.22+(i===2?.19:0),-15+i*6,-46+i*15,[-37,-19,7,21,36][i]]],
 [.59,[[.10,.29,.51,.73,.90][i],.64+Math.abs(a)*.04,.05+(2-Math.abs(a))*.057,.26,23,7+a*12,a*11]],
 [.77,[[.14,.25,.39,.56,.70][i],.77-i*.021,.04,.17,52,31-i*8,-29+5*i]],
 [1,[.12+a*.12,.99+Math.abs(a)*.06,-.08,.09,88,37,a*11]]],p);
 return sample([[0,[.91+.135*(i%3),.93+.052*b,-.14-i*.006,.12,42,72-3*i,34-b*3]],
 [.22,[.74+b*(portrait?.066:.065),.77+Math.abs(b)*.031,-.04+.010*i,.21,7,45-b*12,-7+b*9]],
 [.44,[[.04,.23,.39,.52,.65,.80,.97][i],[.76,.53,.66,.79,.64,.51,.72][i],[.05,-.05,.08,.14,.09,-.065,.05][i],.26+(i===3?.088:0),-7,b*14,b*6]],
 [.65,[[.15,.22,.35,.54,.67,.82,.93][i],[.72,.63,.53,.53,.66,.58,.69][i],[.14,.04,.012,.22,.035,.064,.13][i],i===3?.39:.26,-9,b*17,b*9]],
 [.83,[[.14,.24,.32,.51,.68,.77,.86][i],.69+Math.abs(b)*.010,.033+(3-Math.abs(b))*.038,i===3?.31:.20,13,b*8,b*5]],
 [1,[[.18,.25,.32,.5,.68,.75,.82][i],.73+Math.abs(b)*.025,.016+(3-Math.abs(b))*.035,i===3?.29:.17,23,b*9,b*6]]],p);
}
async function mount(){
 if(!holder||!wrap||!hero)return;
 holder.dataset.gameStage='initializing';
 const photo=holder.querySelector('img');
 if(!photo||reduced.matches||!window.ResizeObserver||!window.IntersectionObserver){holder.dataset.gameStage='static-full-original';return}
 photo.fetchPriority='high';photo.loading='eager';photo.decoding='sync';
 const sources=await fetchOK(base+'cards.json?art=final-comparison-3').then(r=>r.json()),names=isLuna?sources.fantasy.slice(0,5):isGrand?sources.fantasy.slice(5):sources.faction;
 const grandV7=await import('./textures.mjs?art=final-comparison-3');
 const [g,faces,backs,matte]=await Promise.all([fetchOK(base+'measured-card.glb').then(r=>r.arrayBuffer()).then(parseCard),Promise.all(names.map((_,i)=>grandV7.loadApprovedTexture(grandV7.airborne[i],io))),isWar?[]:Promise.all(names.map((_,i)=>{const original=base+'verso-'+i+'.webp',url=sources.backs?.[i]||original;return grandV7.loadApprovedTexture({url,fallbackUrl:url!==original?original:undefined},io)})),Promise.all((isWar?['knight','axeman']:[]).map(n=>io(newBase+n+'.webp'))),photo.decode().catch(()=>{})]);
 if(!alive())return;
 const canvas=document.createElement('canvas');canvas.className='crown-stage-render';canvas.setAttribute('aria-hidden','true');
 const ctx=canvas.getContext('2d');if(!ctx||reduced.matches){holder.dataset.gameStage='static-full-original';return}
 // Only reserve a sticky scroll runway after critical assets and drawing are available.
 hero.classList.add('crown-game-rail');holder.draggable=false;photo.draggable=false;holder.append(canvas);keep(()=>canvas.remove());
 let W,H,F,short,device,runway,vis=true,raf=0,last=-99,progress=0,grab=null,pointer=null,camX=0,camPitch=0,active=[],bookArea=null,bookBias=0,draws=0,cost=0,screenPhoto=null;
 const started=performance.now(),introDuration=1900,cardYaw=Array(names.length).fill(0);
 const historyLoad=performance.getEntriesByType?.('navigation')?.[0]?.type==='back_forward';
 let previousOffset=0,returning=false,restoredTop=false,restoreFrames=historyLoad?2:0;
 let room=null,camScene=[0,0],liveBook=null,askedBook=false,groundMat=null,closedBook=null,cpuBook=null;
 // Use the current plate under a card to occlude it. A second painted hand would drift
 // away from the actor on resize and could come from a different edition of the photograph.
 const castingGlove = typeof Path2D === 'function' ? new Path2D(
  'M 557 116 Q 549 112 540 111 L 520 106 Q 511 103 502 92 L 495 80 ' +
  'Q 491 75 488 80 Q 486 83 491 91 L 498 99 Q 501 103 497 104 ' +
  'Q 491 106 484 104 L 465 101 Q 455 99 454 103 Q 453 106 461 107 ' +
  'L 486 112 Q 488 114 482 114 L 458 117 Q 450 119 451 124 Q 452 126 458 124 ' +
  'L 484 121 Q 487 122 480 125 L 466 131 Q 458 135 462 136 Q 464 137 469 135 ' +
  'L 489 128 Q 493 127 487 131 L 478 137 Q 474 141 477 142 Q 479 143 485 139 ' +
  'L 500 132 Q 507 130 518 130 L 541 144 L 554 154 Z'
 ) : null;
 function revealCastingGlove(rect) {
  if (!castingGlove) return;
  ctx.save();
  ctx.translate(rect.x, rect.y);
  ctx.scale(rect.w / 960, rect.h / 540);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(castingGlove);
  ctx.restore();
 }
 const armNativeBook=()=>{if(askedBook||!alive())return;askedBook=true;import('./folio-native.mjs?art=final-comparison-3').then(m=>alive()?m.createFolio(holder):null).then(b=>{if(!b)return;keep(()=>b.dispose());if(!alive())return;liveBook=b;last=-99;kick()}).catch(()=>{if(alive()){holder.dataset.bookRenderer='v7-closed-safe';last=-99;kick()}})};
 io('/luna-v16/grand/grand-v7/closed-book.webp').then(im=>{if(!alive())return;closedBook=im;last=-99;kick();return import('./book-cpu.mjs?art=final-comparison-3').then(m=>alive()?m.createCpuFolio(im):null).then(b=>{if(alive()&&b){cpuBook=b;last=-99;kick()}})}).catch(()=>{});
 io(newBase+slug+'-ground.webp').then(im=>{if(alive()){groundMat=im;last=-99;kick()}}).catch(()=>{});
 holder.dataset.scenicRenderer='static-plate';import('../art/game-motion/r4/projection.mjs').then(m=>alive()?m.createSet(holder,photo,slug):null).then(m=>{if(m){keep(()=>m.dispose());if(alive()){room=m;last=-99;kick()}}}).catch(()=>{});
 if('requestIdleCallback' in window){const job=requestIdleCallback(armNativeBook,{timeout:1300});keep(()=>window.cancelIdleCallback?.(job));}else{const job=setTimeout(armNativeBook,250);keep(()=>clearTimeout(job));}
 const floor=(x,y,w,hh,a)=>{ctx.save();ctx.translate(x,y);ctx.scale(Math.max(1,w),Math.max(1,hh));const r=ctx.createRadialGradient(0,0,0,0,0,1);r.addColorStop(0,'rgba(3,5,8,'+a+')');r.addColorStop(.55,'rgba(3,5,8,'+(.57*a)+')');r.addColorStop(1,'rgba(3,5,8,0)');ctx.fillStyle=r;ctx.fillRect(-1,-1,2,2);ctx.restore()};
 function resize(){const b=holder.getBoundingClientRect();W=b.width;H=b.height;if(!W||!H)return;short=Math.min(W,H*1.44);F=Math.max(W,H)*1.08;device=Math.max(1,Math.min(2,devicePixelRatio||1,Math.sqrt(2900000/(W*H))));const cw=Math.max(1,Math.round(W*device)),ch=Math.max(1,Math.round(H*device));if(canvas.width!==cw)canvas.width=cw;if(canvas.height!==ch)canvas.height=ch;runway=Math.round(innerHeight*(isLuna?1.26:isGrand?1.76:1.46));hero.style.setProperty('--runway',runway+'px');hero.style.setProperty('--game-pin-height',wrap.offsetHeight+'px');last=-99;kick()}
 function kick(){if(alive()&&!raf&&vis&&!document.hidden&&!reduced.matches)raf=requestAnimationFrame(render)}
 function project(x,y,z){
  // A real camera orbits around the center of the projected volume, not a generic element rotation.
  let ax=camX*D,ay=camPitch*D,dx=x-W/2,dy=y-H*.59,depth=z,xx=dx*Math.cos(ax)-depth*Math.sin(ax),zz=depth*Math.cos(ax)+dx*Math.sin(ax),yy=dy*Math.cos(ay)+zz*Math.sin(ay);zz=zz*Math.cos(ay)-dy*Math.sin(ay);const k=F/(F-zz);return [W/2+xx*k,H*.59+yy*k,zz];
 }
 function photoRect(p){
  const width=photo.naturalWidth||1672,height=photo.naturalHeight||941;let scale=Math.min(W/width,H/height);const portrait=W/H<1&&W<=620;
  const swell=gate(p,.22,.55)*(1-gate(p,.78,1));
  if(portrait){
   // The opening is an intentional, optically framed exploration camera, NOT a horizontal
   // miniature centred in a tall empty viewport. Faction starts on all seven identities.
   // All routes pass an original-aspect, complete-width calibration beat, then open up
   // for the final collector tableau (also complete-width, never crop a catalog print).
   const establish=isWar?gate(p,.24,.39):1-gate(p,.235,.34);
   const push=isWar?1-gate(p,.65,.88):gate(p,.44,.57)*(1-gate(p,.74,.91));
   const exposure=isWar?establish*push:Math.max(establish,push);
   const cover=Math.max(W/width,H/height);scale=mix(scale,cover,exposure);const w=width*scale,h=height*scale;
   const focal=isLuna?.65:isGrand?.42:.50, drift=(isLuna?.06:isGrand?.08:-.09)*swell*exposure;
   const x=(W-w)*(focal+drift)-camX*W*.00055,y=(H-h)*.015;
   return {x,y,w,h};
  }
  const zoom=1+(isLuna?.12:isGrand?.095:.12)*swell,w=width*scale*zoom,h=height*scale*zoom;
  const x=(W-w)/2+(isGrand?-.027:isWar?.033:-.022)*W*swell-camX*W*.0007,y=(H-h)*.48-swell*(isLuna?-.04:.015)*H;
  return {x,y,w,h};
 }
 function face(model,p){
  const i=model.i,v=model.v,w=v[3]*short,xx=v[0]*W,yy=v[1]*H,zz=v[2]*F,rx=v[4]*D,ry=(v[5]+cardYaw[i])*D,rz=v[6]*D,cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
  const lock=isLuna?gate(p,.88,1)*(grab===null&&!cardYaw[i]&&Math.abs(camX)<.01?1:0):0;
  const uvtarget=isLuna?sources.table[i]:null;
  const P=(u,v,z)=>{const X=u*w,Y=v*w,Z=z*w,y1=Y*cx-Z*sx,z1=Y*sx+Z*cx,x2=X*cy+z1*sy,z2=-X*sy+z1*cy,wp=project(xx+x2*cz-y1*sz,yy+x2*sz+y1*cz,zz+z2);if(lock){let aa=clip(u+.5),bb=clip(v/1.5+.5);const [a,b,c,d]=uvtarget;let tx=mix(mix(a[0],b[0],aa),mix(d[0],c[0],aa),bb),ty=mix(mix(a[1],b[1],aa),mix(d[1],c[1],aa),bb);wp[0]=mix(wp[0],screenPhoto.x+screenPhoto.w*tx/1152,lock);wp[1]=mix(wp[1],screenPhoto.y+screenPhoto.h*ty/768,lock)}return wp};
  const sightA=P(-.45,-.60,g.z),sightB=P(.45,-.60,g.z),sightC=P(.45,.60,g.z),front=(sightB[0]-sightA[0])*(sightC[1]-sightA[1])-(sightB[1]-sightA[1])*(sightC[0]-sightA[0])>=0;
  const pp=g.pos.map(v=>P(...v)),ref=front?0:g.ring+1,path=pp.slice(ref,ref+g.ring),x0=Math.min(...path.map(q=>q[0])),x1=Math.max(...path.map(q=>q[0])),y0=Math.min(...path.map(q=>q[1])),y1=Math.max(...path.map(q=>q[1]));if(x1<-1||x0>W+1||y1<0||y0>H)return;
  const tex=front?faces[i]:backs[i%5];
  const materials=['#c1ae87','#75654e','#a69a7d','#6b6052'];
  g.edges.forEach((band,k)=>{ctx.fillStyle=materials[k];ctx.beginPath();for(const q of band){const [a,b,c,d]=q.map(j=>pp[j]);ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.lineTo(d[0],d[1]);ctx.closePath()}ctx.fill()});
  ctx.save();pt(ctx,path);ctx.clip();ctx.fillStyle=tex?'#393429':'#8c8273';ctx.fillRect(x0-1,y0-1,x1-x0+2,y1-y0+2);
  if(tex){
   const invert=front?1:-1,z=front?g.z:-g.z,nx=(Math.abs(cy)<.9?3:2),ny=4;
   for(let u=0;u<nx;u++)for(let v=0;v<ny;v++){
    const uv=[[u/nx,v/ny],[(u+1)/nx,v/ny],[(u+1)/nx,(v+1)/ny],[u/nx,(v+1)/ny]],s=uv.map(([a,b])=>[a*tex.width,b*tex.height]),t=uv.map(([a,b])=>P((a-.5)*invert,(b-.5)*1.5,z));tri(ctx,tex,[s[0],s[1],s[2]],[t[0],t[1],t[2]]);tri(ctx,tex,[s[0],s[2],s[3]],[t[0],t[2],t[3]]);
   }
  }
  const grazing=1-Math.abs(cy*cx),lg=ctx.createLinearGradient(x0,y0,x1+.01,y1+.01);lg.addColorStop(0,'rgba(253,235,195,'+(.025+.15*grazing)+')');lg.addColorStop(.52,'rgba(220,218,214,0)');lg.addColorStop(1,'rgba(5,9,15,'+(.035+.12*grazing)+')');ctx.fillStyle=lg;ctx.fillRect(x0-1,y0-1,x1-x0+2,y1-y0+2);ctx.restore();
  active.push({i,x0,x1,y0,y1,front,depth:v[2],cont:path});
 }
 const sceneOffset=()=>{
  const y=Math.max(0,-hero.getBoundingClientRect().top);
  if(restoreFrames){restoredTop=y<=1}
  else if(previousOffset>1&&previousOffset-y>.25){returning=true}
  previousOffset=y;
  return y<=1?0:y;
 };
 function render(now){
  raf=0;if(!alive()||!vis||!W||document.hidden||reduced.matches)return;
  const scroll=clip(sceneOffset()/runway);
  // Keep the authored cold intro. A return eases back through the final few percent
  // to the actual opening frame, not the .205 hold the cold intro reaches at rest.
  const intro=returning||restoredTop?gate(scroll,0,.07):historyLoad?1:gate(now-started,30,introDuration);
  const p=.205*intro+(.995-.205*intro)*scroll;
  if(restoreFrames&&--restoreFrames)kick();
  if(Math.abs(p-last)<.00013&&grab===null&&now-started>introDuration+40)return;last=progress=p;
  const t0=performance.now();active=[];bookArea=null;if(isGrand&&p<=.51){delete holder.dataset.bookPose;delete holder.dataset.bookCamera;}if(p>.39)armNativeBook();if(liveBook)liveBook.hide();ctx.setTransform(device,0,0,device,0,0);ctx.clearRect(0,0,W,H);
  screenPhoto=photoRect(p);const {x,y,w,h}=screenPhoto;photo.style.width=w+'px';photo.style.height=h+'px';photo.style.transform='translate3d('+x+'px,'+y+'px,0)';holder.style.setProperty('--poster-size',w+'px '+h+'px');holder.style.setProperty('--poster-pos',x+'px '+y+'px');
  const travel=gate(p,.25,.54)*(1-gate(p,.74,.98));camScene=[camX*.48+travel*(isLuna?4.2:isGrand?-3.0:4.2),camPitch*.35+travel*(isLuna?-1.0:isGrand?.4:.6)];const spatial=room&&Math.abs(camScene[0])+Math.abs(camScene[1])>=.12;if(spatial){try{holder.dataset.roomPaint=room.draw(W,H,Math.min(device,1.3),screenPhoto,...camScene)===true?'true':'false'}catch{holder.dataset.roomPaint='false'}}else{holder.dataset.roomPaint='false'};if(W/H<1&&groundMat){const start=Math.min(H,y+h-.75),rem=H-start;if(rem>6){ctx.save();ctx.beginPath();ctx.rect(0,start,W,rem);ctx.clip();for(let band=0;band<24;band++){
    const v=band/24,V=(band+1)/24,tr=.32+.68*(.5+V*.5),srcW=groundMat.width*tr,srcX=(groundMat.width-srcW)*.5,srcY=v*groundMat.height*.94;
    ctx.drawImage(groundMat,srcX,srcY,srcW,Math.max(1,(V-v)*groundMat.height),0,start+v*rem,W,(V-v)*rem+1)
   }const shade=ctx.createLinearGradient(0,start,0,H);shade.addColorStop(0,isLuna?'rgba(8,14,12,.69)':isGrand?'rgba(18,12,26,.80)':'rgba(13,23,32,.74)');shade.addColorStop(.46,'rgba(11,16,22,.32)');shade.addColorStop(1,'rgba(4,9,14,.52)');ctx.fillStyle=shade;ctx.fillRect(0,start,W,rem);ctx.restore()}}const st=faces.map((_,i)=>({i,v:score(i,clip((p-i*(isGrand?.017:.011))/(1-i*(isGrand?.017:.011))),W/H<1)}));
  const under=isGrand?gate(p,.48,.76):0,matteDraw=j=>{
   if(!room||Math.abs(camScene[0])<.12){ctx.drawImage(matte[j],x,y,w,h);return}
   const im=matte[j],{focalWidth:fx,aspect:ar,orbitTarget:t}=room.data,depth=isGrand?1.47:j===0?3.65:3.80;
   const a=camScene[0]*D,b=camScene[1]*D,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
   const backP=(u,v)=>{const X=(u-.5)*depth/fx,Y=(.5-v)*depth/fx/ar,Z=t-depth,xx=ca*X+sa*Z,z1=-sa*X+ca*Z,yy=cb*Y+sb*z1,z2=-sb*Y+cb*z1-t;return [x+w*(.5+fx*xx/(-z2)),y+h*(.5-fx*ar*yy/(-z2))]};
   for(let i=0;i<3;i++)for(let j=0;j<3;j++){const uv=[[i/3,j/3],[(i+1)/3,j/3],[(i+1)/3,(j+1)/3],[i/3,(j+1)/3]],s=uv.map(([u,v])=>[im.width*u,im.height*v]),t=uv.map(q=>backP(...q));tri(ctx,im,[s[0],s[1],s[2]],[t[0],t[1],t[2]]);tri(ctx,im,[s[0],s[2],s[3]],[t[0],t[2],t[3]])}
  };
  for(const m of st){const r=m.v;floor(W*r[0]+r[3]*short*.03,Math.min(H*.95,r[1]*H+(isLuna?.18:.24)*H),r[3]*short*.52,H*(.018+.02*r[2]),(.14+.12*gate(p,.5,1))*(1-under))}
  const order=st.sort((a,b)=>a.v[2]-b.v[2]);
  if(isWar){
   // Two measured silhouette mattes from THIS new picture: the lower ranks really pass behind
   // the near knight and axeman. They remain paintings; only the archival cards are physical.
   const behind=p>.28&&p<.77;for(const m of order.filter(q=>behind&&[1,5].includes(q.i)))face(m,p);if(behind&&active.length){
    // Only over the footprints of the physically recessed cards. NEVER paint an extra photographic
    // actor over adjacent visible scenery (which would create duplicate shoulder/head silhouettes).
    ctx.save();ctx.beginPath();for(const m of active){ctx.moveTo(m.cont[0][0],m.cont[0][1]);for(let j=1;j<m.cont.length;j++)ctx.lineTo(m.cont[j][0],m.cont[j][1]);ctx.closePath()}ctx.clip();matteDraw(0);matteDraw(1);ctx.restore();
   }for(const m of order.filter(q=>!behind||![1,5].includes(q.i)))face(m,p)
  }else{
   ctx.save();if(isGrand)ctx.globalAlpha=1-gate(p,.69,.86);for(const m of order)face(m,p);ctx.restore();
   if(isGrand && p < .31 && active.length && holder.dataset.roomPaint !== 'true') revealCastingGlove(screenPhoto);
  }
  if(p>.51){
   const rise=gate(p,.51,.70),t=clip((p-.57)/.415);
   const port=W/H<1,bw=port?Math.min(W*1.14,H*1.64):Math.min(W*.96,H*1.64),bh=bw*574/942,bx=(W-bw)/2,by=H-bh+(1-rise)*H*.90;
   ctx.save();ctx.globalAlpha=1;floor(bx+bw*.50,by+bh*.80,bw*.33,H*.042,.39);
   let nativeRendered=false;if(liveBook){try{nativeRendered=liveBook.draw(t,bookBias,{x:bx,y:by,w:bw,h:bh},device)===true}catch{liveBook.hide()}}
   if(!nativeRendered&&cpuBook){nativeRendered=cpuBook.draw(ctx,t,bookBias,{x:bx,y:by,w:bw,h:bh});if(nativeRendered)holder.dataset.bookRenderer='v7-printed-canvas'}
   if(!nativeRendered&&closedBook){ctx.imageSmoothingQuality='high';ctx.drawImage(closedBook,bx,by,bw,bh);holder.dataset.bookRenderer='v7-closed-safe'}
   ctx.restore();bookArea={x0:bx+bw*.1,x1:bx+bw*.9,y0:by+bh*.12,y1:by+bh*.85};holder.dataset.bookPose=String(Math.round(t*32));holder.dataset.bookCamera=bookBias>4?'R':bookBias< -4?'L':'C';
  }
  holder.dataset.painted='true';holder.dataset.motionProgress=p.toFixed(3);holder.dataset.motionScroll=scroll.toFixed(3);holder.dataset.cameraYaw=camX.toFixed(1);holder.dataset.keyBindings=String(active.length);holder.dataset.motionMetrics=(++draws)+':'+((cost+=performance.now()-t0)/draws).toFixed(2);if(!returning&&!restoredTop&&!historyLoad&&now-started<introDuration+50)kick();
 }
 const aim=e=>{const b=holder.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top]},hit=(x,y,m)=>x>=m.x0&&x<=m.x1&&y>=m.y0&&y<=m.y1;
 const repaint=()=>{last=-99;kick()};
 function releaseGesture(){
  const id=pointer?.id;pointer=null;grab=null;
  holder.dataset.grabbing='false';
  if(id!==undefined&&holder.hasPointerCapture?.(id))try{holder.releasePointerCapture(id)}catch{}
 }
 function clearInspection(){
  releaseGesture();cardYaw.fill(0);camX=camPitch=bookBias=0;
  delete holder.dataset.inspectYaw;delete holder.dataset.inspectedObject;
 }
 function beginInspect(e){
  grab=pointer.target;
  if(typeof grab==='number')holder.dataset.inspectedObject=String(grab);
  try{holder.setPointerCapture(e.pointerId)}catch{}
  holder.dataset.grabbing='true';
 }
 listen(holder,'dragstart',e=>e.preventDefault());
 listen(holder,'pointerdown',e=>{
  if(pointer||e.button!==0||e.isPrimary===false)return;
  const [x,y]=aim(e),m=active.slice().reverse().find(q=>hit(x,y,q));
  const target=bookArea&&hit(x,y,bookArea)?'book':m?m.i:'camera',touch=e.pointerType==='touch';
  pointer={id:e.pointerId,target,x:e.clientX,y:e.clientY,camX,camPitch,bookBias,yaw:typeof target==='number'?cardYaw[target]:0};
  if(!touch){if(e.pointerType==='mouse')e.preventDefault();beginInspect(e)}
 });
 listen(holder,'pointermove',e=>{
  const a=pointer;if(!a||e.pointerId!==a.id)return;
  const dx=e.clientX-a.x,dy=e.clientY-a.y,ax=Math.abs(dx),ay=Math.abs(dy);
  if(grab===null){
   // Vertical touch is browser scrolling, not a camera orbit or card spin.
   if(ay>=8&&ay>=ax){clearInspection();repaint();return}
   if(ax<8||ax<ay*1.25)return;
   beginInspect(e);
  }
  if(ax<3&&ay<3)return;
  if(grab==='camera'){camX=clip(a.camX+dx/W*46,-23,23);camPitch=clip(a.camPitch-dy/H*20,-10,10)}
  else if(grab==='book'){bookBias=clip(a.bookBias+dx/W*90,-33,33);if(Math.abs(bookBias)>3)armNativeBook()}
  else{const v=score(grab,progress,W/H<1);cardYaw[grab]=isWar?clip(a.yaw+dx*1.08,-83-v[5],83-v[5]):a.yaw+dx*.95;holder.dataset.inspectYaw=cardYaw[grab].toFixed(1)}
  repaint();
 });
 listen(holder,'pointerup',e=>{if(pointer?.id!==e.pointerId)return;const moved=grab!==null;releaseGesture();if(moved)repaint()});
 const cancel=e=>{if(pointer?.id===e.pointerId){clearInspection();repaint()}};
 listen(holder,'pointercancel',cancel);listen(holder,'lostpointercapture',cancel);
 const stopFrame=()=>{if(raf){cancelAnimationFrame(raf);raf=0}};
 function suspend(){clearInspection();last=-99;stopFrame()}
 function resume(){clearInspection();restoreFrames=2;resize();repaint()}
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(wrap);resizeObserver.observe(holder);keep(()=>resizeObserver.disconnect());keep(suspend);
 listen(window,'scroll',()=>{sceneOffset();clearInspection();repaint()},{passive:true});
 listen(window,'pagehide',suspend);
 listen(window,'pageshow',e=>{if(e.persisted)resume()});
 const visObserver=new IntersectionObserver(e=>{vis=e[0].isIntersecting;if(vis)repaint();else{clearInspection();stopFrame()}});visObserver.observe(hero);keep(()=>visObserver.disconnect());
 listen(document,'visibilitychange',()=>{if(document.hidden)suspend();else resume()});
 holder.dataset.artReady='true';holder.dataset.gameStage='interactive';holder.dataset.motionScene=layouts[slug];holder.dataset.modelTriangles=g.tris;resize();kick();
}
const ready=mount().catch(e=>{
 if(!alive())return;
 dispose();
 if(holder)holder.dataset.motionFallback=e?.name||'native-art';
});
return {ready,dispose};
}
