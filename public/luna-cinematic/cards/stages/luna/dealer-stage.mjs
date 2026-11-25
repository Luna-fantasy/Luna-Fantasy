/* Luna Fantasy opening only. Measured card fabric, camera and motion score
   are ported from approved luna-hero-v8.js. React owns the poster and copy. */
import { createDealerRoom } from './dealer-room.mjs';
const D=Math.PI/180, clip=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)),mix=(a,b,t)=>a+(b-a)*t,ease=x=>x*x*(3-2*x),gate=(x,a,b)=>ease(clip((x-a)/(b-a)));
const pt=(ctx,p)=>{ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);for(let j=1;j<p.length;j++)ctx.lineTo(p[j][0],p[j][1]);ctx.closePath()};
export function parseCard(buf){
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
export function score(i,p,portrait){
 const a=i-2;
 return sample([[0,[-.14-.038*i,.72+.025*i,.13,.25,54,151-i*8,-57+5*i]],
 [.22,[(portrait ? .46 : .49)+a*.105,.65+Math.abs(a)*.047,.06+(2-Math.abs(a))*.012,.30,26,18+a*11,a*14-6]],
 [.43,[.5+a*(portrait ? .195 : .176),.45+Math.abs(a)*.096,.10+(2-Math.abs(a))*.076,.37,-12,a*21,a*16]],
 [.65,[.47+a*.25,.52+Math.abs(a)*.105,.02+(2-Math.abs(a))*.125,.43,-4,a*29,a*19-5]],
 [.82,[.49+a*.169,.59+Math.abs(a)*.036,.12+(2-Math.abs(a))*.017,.265,19,a*9,a*7]],
 [1,[.54+.083*a,.64-.031*i,.012,.19,58,1,a*5]]],p);
}

// The calibrated five landing quads from approved court/cards.json, in the
// authored 1152×768 table reference plane. The photograph remains immutable.
export const landing = [
 [[255,481],[398,427],[590,592],[420,678]],
 [[421,396],[558,364],[683,535],[521,582]],
 [[600,358],[728,344],[813,513],[672,534]],
 [[750,333],[888,330],[965,495],[805,503]],
 [[945,331],[1097,349],[1106,498],[931,482]],
];
const ids=['LUNA-0264','LUNA-0335','LUNA-0293','LUNA-0384','LUNA-0305'];
const introDuration=1900;
export function timelinePose(scroll,elapsed,returning,history=false) {
 const fraction=clip(scroll);
 const intro=returning?gate(fraction,0,.07):history?1:gate(elapsed,30,introDuration);
 return .205*intro+(.995-.205*intro)*fraction;
}
export function touchIntent(dx,dy){
 const x=Math.abs(dx),y=Math.abs(dy);
 if(y>=8&&y>=x)return 'scroll';
 return x>=8&&x>=y*1.25?'inspect':'pending';
}
function image(url,signal,View){
 return new Promise((resolve,reject)=>{
  const img=new View.Image();
  const clean=()=>{img.onload=img.onerror=null;signal.removeEventListener('abort',abort);};
  const abort=()=>{clean();img.removeAttribute('src');reject(signal.reason);};
  if(signal.aborted){abort();return;}
  signal.addEventListener('abort',abort,{once:true});
  img.onload=()=>{clean();resolve(img);};
  img.onerror=()=>{clean();reject(new Error('Dealer image unavailable'));};
  img.src=url;
 });
}
async function asset(name,signal){
 const r=await fetch(new URL(name,import.meta.url),{signal});
 if(!r.ok)throw new Error('Dealer optical asset unavailable');
 return r;
}

/** The SSR entrance remains intact until the optical stage is fully ready. */
export function mountLunaDealer({hero,holder,wrap,photo,cards,reduced}) {
 const doc=holder.ownerDocument,view=doc.defaultView;
 const abort=new AbortController(),{signal}=abort;
 let stopMounted;
 const dispose=()=>{abort.abort();stopMounted?.();stopMounted=undefined;};
 const fallback=()=>{
  if(!signal.aborted){stopMounted?.();stopMounted=undefined;holder.dataset.gameStage='static-full-original';abort.abort();}
 };
 const start=async()=>{
  if(reduced.matches||!view.ResizeObserver||!view.IntersectionObserver){ fallback();return; }
  if(cards.map(({id})=>id).join(',')!==ids.join(','))throw Error('Unexpected stage identities');
  holder.dataset.gameStage='initializing';
  const load=url=>image(url,signal,view);
  const firstLoads=cards.map(({front,thumb})=>
   view.navigator.connection?.saveData?load(thumb):load(front).catch(error=>{
    if(signal.aborted)throw error;
    return load(thumb);
   })
  );
  const [g,faces,backs]=await Promise.all([
   asset('measured-card.glb',signal).then(r=>r.arrayBuffer()).then(parseCard),
   Promise.all(firstLoads),
   Promise.all(cards.map(({back,originalBack})=>load(back).catch(error=>{
    if(!originalBack||originalBack===back)throw error;
    return load(originalBack);
   }))),
   Promise.resolve(photo.decode?.()).catch(error=>{if(!photo.naturalWidth)throw error;}),
  ]);
  if(signal.aborted)return;
  if(reduced.matches||!photo.naturalWidth){fallback();return;}
  const canvas=doc.createElement('canvas');canvas.dataset.dealerCardsCanvas='';canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');
  if(!ctx){fallback();return;}
  stopMounted=runScene({hero,holder,wrap,photo,doc,view,ctx,canvas,g,faces,backs,reduced,signal,fallback,load});
 };
 return {ready:start().catch(fallback),dispose};
}

function runScene({hero,holder,wrap,photo,doc,view,ctx,canvas,g,faces,backs,reduced,signal,fallback,load}){
 const started=view.performance.now();
 const rafFrame=view.requestAnimationFrame.bind(view),cancelFrame=view.cancelAnimationFrame.bind(view);
 const historyLoad=view.performance.getEntriesByType?.('navigation')?.[0]?.type==='back_forward';
 let W,H,F,short,device,runway,vis=true,paused=false,raf=0,last=-99,grab=null,pointer=null,camX=0,camPitch=0,active=[],screenPhoto=null;
 let previousOffset=Math.max(0,-hero.getBoundingClientRect().top),returning=false,restoredTop=historyLoad&&previousOffset<=1,restoreFrames=historyLoad?2:0;
 let room=null,groundMat=null,draws=0,cost=0;
 const cardYaw=new Array(ids.length).fill(0), cleanup=[];
 let closed=false;
 function listen(node,type,handler,options){
  node.addEventListener(type,handler,options);
  cleanup.push(()=>node.removeEventListener(type,handler,options));
 }
 function kick(){
  if(!raf&&!closed&&vis&&!paused&&!doc.hidden&&!reduced.matches)raf=rafFrame(now=>{
   try{render(now);}catch{fallback();}
  });
 }
 function resize(){
  const b=holder.getBoundingClientRect();W=b.width;H=b.height;if(!W||!H)return;
  short=Math.min(W,H*1.44);F=Math.max(W,H)*1.08;
  device=Math.max(1,Math.min(2,view.devicePixelRatio||1,Math.sqrt(2900000/(W*H))));
  const cw=Math.max(1,Math.round(W*device)),ch=Math.max(1,Math.round(H*device));
  if(canvas.width!==cw)canvas.width=cw;if(canvas.height!==ch)canvas.height=ch;
  runway=Math.max(1,Math.round(view.innerHeight*1.26));
  hero.style.setProperty('--dealer-runway',runway+'px');
  hero.style.setProperty('--dealer-pin-height',wrap.offsetHeight+'px');
  repaint();
 }
 const floor=(x,y,w,hh,a)=>{ctx.save();ctx.translate(x,y);ctx.scale(Math.max(1,w),Math.max(1,hh));const r=ctx.createRadialGradient(0,0,0,0,0,1);r.addColorStop(0,'rgba(3,5,8,'+a+')');r.addColorStop(.55,'rgba(3,5,8,'+(.57*a)+')');r.addColorStop(1,'rgba(3,5,8,0)');ctx.fillStyle=r;ctx.fillRect(-1,-1,2,2);ctx.restore()};
 function project(x,y,z){
  // A real camera orbits around the center of the projected volume, not a generic element rotation.
  let ax=camX*D,ay=camPitch*D,dx=x-W/2,dy=y-H*.59,depth=z,xx=dx*Math.cos(ax)-depth*Math.sin(ax),zz=depth*Math.cos(ax)+dx*Math.sin(ax),yy=dy*Math.cos(ay)+zz*Math.sin(ay);zz=zz*Math.cos(ay)-dy*Math.sin(ay);const k=F/(F-zz);return [W/2+xx*k,H*.59+yy*k,zz];
 }
 function photoRect(p){
  const width=photo.naturalWidth||1672,height=photo.naturalHeight||941;let scale=Math.min(W/width,H/height);const portrait=W/H<1&&W<=620;
  const swell=gate(p,.22,.55)*(1-gate(p,.78,1));
  if(portrait){
   // The mobile shot begins as an optical portrait crop, passes through a
   // full-width camera calibration, and lands on the entire collector tableau.
   const establish=1-gate(p,.235,.34);
   const push=gate(p,.44,.57)*(1-gate(p,.74,.91));
   const exposure=Math.max(establish,push);
   const cover=Math.max(W/width,H/height);scale=mix(scale,cover,exposure);const w=width*scale,h=height*scale;
   const x=(W-w)*(.65+.06*swell*exposure)-camX*W*.00055,y=(H-h)*.015;
   return {x,y,w,h};
  }
  const zoom=1+.12*swell,w=width*scale*zoom,h=height*scale*zoom;
  const x=(W-w)/2-.022*W*swell-camX*W*.0007,y=(H-h)*.48+swell*.04*H;
  return {x,y,w,h};
 }
 function face(model,p){
  const i=model.i,v=model.v,w=v[3]*short,xx=v[0]*W,yy=v[1]*H,zz=v[2]*F,rx=v[4]*D,ry=(v[5]+cardYaw[i])*D,rz=v[6]*D,cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
  const lock=gate(p,.88,1)*(grab===null&&!cardYaw[i]&&Math.abs(camX)<.01?1:0);
  const uvtarget=landing[i];
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
  if(restoreFrames)restoredTop=y<=1;
  else if(previousOffset>1&&previousOffset-y>.25)returning=true;
  previousOffset=y;
  return y<=1?0:y;
 };
 function render(now){
  raf=0;
  if(closed||!vis||!W||!H||paused||doc.hidden||reduced.matches)return;
  const scroll=clip(sceneOffset()/runway);
  const p=timelinePose(scroll,now-started,returning||restoredTop,historyLoad);
  if(restoreFrames&&--restoreFrames)kick();
  if(Math.abs(p-last)<.00013&&grab===null&&now-started>introDuration+40)return;
  last=p;
  const t0=view.performance.now();active=[];
  ctx.setTransform(device,0,0,device,0,0);ctx.clearRect(0,0,W,H);
  screenPhoto=photoRect(p);
  const {x,y,w,h}=screenPhoto;
  photo.style.width=w+'px';photo.style.height=h+'px';photo.style.transform='translate3d('+x+'px,'+y+'px,0)';
  const travel=gate(p,.25,.54)*(1-gate(p,.74,.98));
  const yaw=camX*.48+travel*4.2,pitch=camPitch*.35-travel;
  let paintedRoom=false;
  if(room&&Math.abs(yaw)+Math.abs(pitch)>=.12){
   try{paintedRoom=room.draw(W,H,Math.min(device,1.3),screenPhoto,yaw,pitch)===true;}catch{}
  }
  holder.dataset.roomPaint=String(paintedRoom);
  if(W/H<1&&groundMat){
   const boundary=Math.min(H,y+h-.75),rem=H-boundary;
   if(rem>6){
    ctx.save();ctx.beginPath();ctx.rect(0,boundary,W,rem);ctx.clip();
    for(let band=0;band<24;band++){
     const v=band/24,V=(band+1)/24,tr=.32+.68*(.5+V*.5),srcW=groundMat.width*tr,srcX=(groundMat.width-srcW)*.5,srcY=v*groundMat.height*.94;
     ctx.drawImage(groundMat,srcX,srcY,srcW,Math.max(1,(V-v)*groundMat.height),0,boundary+v*rem,W,(V-v)*rem+1);
    }
    const shade=ctx.createLinearGradient(0,boundary,0,H);
    shade.addColorStop(0,'rgba(8,14,12,.69)');shade.addColorStop(.46,'rgba(11,16,22,.32)');shade.addColorStop(1,'rgba(4,9,14,.52)');
    ctx.fillStyle=shade;ctx.fillRect(0,boundary,W,rem);ctx.restore();
   }
  }
  const staging=faces.map((_,i)=>({i,v:score(i,clip((p-i*.011)/(1-i*.011)),W/H<1)}));
  for(const m of staging){const r=m.v;floor(W*r[0]+r[3]*short*.03,Math.min(H*.95,r[1]*H+.18*H),r[3]*short*.52,H*(.018+.02*r[2]),.14+.12*gate(p,.5,1));}
  for(const m of staging.sort((a,b)=>a.v[2]-b.v[2]))face(m,p);
  holder.dataset.painted='true';holder.dataset.motionProgress=p.toFixed(3);holder.dataset.motionScroll=scroll.toFixed(3);
  holder.dataset.cameraYaw=camX.toFixed(1);holder.dataset.keyBindings=String(active.length);
  holder.dataset.motionMetrics=(++draws)+':'+((cost+=view.performance.now()-t0)/draws).toFixed(2);
  if(!returning&&!restoredTop&&!historyLoad&&now-started<introDuration+50)kick();
 }
 // A browser scroll, cancelled touch, BFCache or React leave never keeps a grabbed card or camera.
 const repaint=()=>{last=-99;kick();};
 function releaseGesture(){
  const id=pointer?.id;pointer=null;grab=null;holder.dataset.grabbing='false';
  if(id!==undefined&&holder.hasPointerCapture?.(id))try{holder.releasePointerCapture(id);}catch{}
 }
 function clearInspection(){
  releaseGesture();cardYaw.fill(0);camX=camPitch=0;
  delete holder.dataset.inspectYaw;delete holder.dataset.inspectedObject;
 }
 function beginInspect(e){
  grab=pointer.target;
  if(typeof grab==='number')holder.dataset.inspectedObject=String(grab);
  try{holder.setPointerCapture(e.pointerId);}catch{}
  holder.dataset.grabbing='true';
 }
 listen(holder,'dragstart',e=>e.preventDefault());
 listen(holder,'pointerdown',e=>{
  if(!holder.dataset.painted||pointer||e.button!==0||e.isPrimary===false)return;
  const b=holder.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;
  const m=active.slice().reverse().find(q=>x>=q.x0&&x<=q.x1&&y>=q.y0&&y<=q.y1);
  const target=m?m.i:'camera';
  pointer={id:e.pointerId,target,x:e.clientX,y:e.clientY,camX,camPitch,yaw:typeof target==='number'?cardYaw[target]:0};
  if(e.pointerType!=='touch'){if(e.pointerType==='mouse')e.preventDefault();beginInspect(e);}
 });
 listen(holder,'pointermove',e=>{
  const a=pointer;if(!a||e.pointerId!==a.id)return;
  const dx=e.clientX-a.x,dy=e.clientY-a.y;
  if(grab===null){
   const intent=touchIntent(dx,dy);
   if(intent==='scroll'){clearInspection();repaint();return;}
   if(intent==='pending')return;
   beginInspect(e);
  }
  if(Math.abs(dx)<3&&Math.abs(dy)<3)return;
  if(grab==='camera'){
   camX=clip(a.camX+dx/W*46,-23,23);camPitch=clip(a.camPitch-dy/H*20,-10,10);
  }else{
   cardYaw[grab]=a.yaw+dx*.95;holder.dataset.inspectYaw=cardYaw[grab].toFixed(1);
  }
  repaint();
 });
 listen(holder,'pointerup',e=>{if(pointer?.id!==e.pointerId)return;const moved=grab!==null;releaseGesture();if(moved)repaint();});
 const cancel=e=>{if(pointer?.id===e.pointerId){clearInspection();repaint();}};
 listen(holder,'pointercancel',cancel);
 listen(holder,'lostpointercapture',cancel);
 function stopFrame(){if(raf){cancelFrame(raf);raf=0;}}
 function suspend(){paused=true;clearInspection();last=-99;stopFrame();}
 function resume(){paused=false;clearInspection();restoreFrames=2;resize();repaint();}
 const observe=new view.ResizeObserver(resize);
 const intersects=new view.IntersectionObserver(([entry])=>{
  vis=entry?.isIntersecting??true;
  if(vis)repaint();else{clearInspection();stopFrame();}
 });
 observe.observe(wrap);observe.observe(holder);intersects.observe(hero);
 listen(view,'scroll',()=>{sceneOffset();clearInspection();repaint();},{passive:true});
 listen(view,'pagehide',suspend);
 listen(view,'pageshow',e=>{if(e.persisted)resume();});
 listen(doc,'visibilitychange',()=>{if(doc.hidden)suspend();else resume();});
 // Canvas and listeners are detached before any replacement mount can commence.
 const dispose=()=>{
  closed=true;stopFrame();clearInspection();observe.disconnect();intersects.disconnect();
  for(const off of cleanup)off();
  room?.dispose();canvas.remove();
  for(const attr of ['width','height','transform'])photo.style.removeProperty(attr);
  for(const prop of ['--dealer-runway','--dealer-pin-height'])hero.style.removeProperty(prop);
  delete hero.dataset.dealerLive;
  for(const key of ['artReady','painted','roomPaint','grabbing','motionProgress','motionScroll','cameraYaw','keyBindings','motionMetrics','approvedFrontIds','motionScene','modelTriangles','scenicRenderer','gameStage'])delete holder.dataset[key];
 };
 holder.append(canvas);
 // No sticky runway until the scene is able to draw full, approved assets.
 hero.dataset.dealerLive='true';
 holder.dataset.approvedFrontIds=ids.join(',');holder.dataset.artReady='true';holder.dataset.gameStage='interactive';
 holder.dataset.motionScene='the-dealers-table';holder.dataset.modelTriangles=String(g.tris);holder.dataset.scenicRenderer='static-plate';
 resize();
 load(new URL('luna-fantasy-ground.webp',import.meta.url).href).then(im=>{if(!closed){groundMat=im;repaint();}}).catch(()=>{});
 asset('luna-fantasy-shell.json',signal).then(r=>r.json()).then(data=>{
  if(!closed){room=createDealerRoom(holder,photo,data,repaint);repaint();}
 }).catch(()=>{});
 return dispose;
}
