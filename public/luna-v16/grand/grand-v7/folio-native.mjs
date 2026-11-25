/* Optional actual free-orbit render of the same deforming scanned book used by Cycles.
   No substitute cube-model and no animation baked into a flat image on this path. */
import * as T from '../runtime/three.module.min.js';
import {loadGLB} from '../runtime/load-glb.mjs';
import { applyGrandMaterials } from './materials.mjs?art=final-comparison-3';
import { folioTurns as turns } from './folio-timing.mjs';

// A facing spread combines the back of the preceding leaf with the front of the next.
// The first left print belongs to the inside cover. The fourth leaf stays bound on the right.
export function bindGrandSpreads(root, leaves, hinge, openRotation) {
 const versos = leaves.map((leaf, i) => leaf.children.find(mesh => mesh.material?.name === 'Printed verso ' + i));
 const insideCover = versos[0].clone();
 insideCover.name = 'Printed front endpaper';
 insideCover.morphTargetInfluences.fill(0);
 insideCover.morphTargetInfluences[insideCover.morphTargetInfluences.length - 1] = 1;
 // Keep the inside print just above the scanned leather lip at the binding.
 insideCover.position.y += .0002;
 leaves[0].add(insideCover);
 const closedRotation = hinge.quaternion.clone();
 hinge.quaternion.copy(openRotation);
 root.updateMatrixWorld(true);
 hinge.attach(insideCover);
 hinge.quaternion.copy(closedRotation);
 const prints = versos.map(mesh => mesh.material);
 for (let i = 0; i < leaves.length - 1; i++) versos[i].material = prints[i + 1];
 versos.at(-1).material = leaves.at(-1).children.find(mesh => mesh.material?.name === 'Real uncovered rag-paper edge').material;
 return insideCover;
}

const clamp01 = value => Math.max(0, Math.min(1, value));
// Zero-based morph keys in the scanned GLB. The early common lift keeps the stack in order.
export function grandLeafFrame(index, progress) {
 const rest = 6 * clamp01(progress / .20);
 const turn = turns[index];
 if (!turn) return rest;
 const lift = clamp01((progress - turn.start + .06) / .06);
 const startFrame = rest + lift * (turn.first - rest);
 return startFrame + (turn.last - startFrame) * clamp01((progress - turn.start) / (turn.end - turn.start));
}

export async function createFolio(holder){
 const res=await fetch('/luna-v16/grand/art/game-motion/r4/physical-folio.glb.gz');if(!res.ok)throw Error('folio');
 const b=await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),d=new DataView(b),len=d.getUint32(12,true),j=JSON.parse(new TextDecoder().decode(new Uint8Array(b,20,len))),bo=28+len;
 const u=URL.createObjectURL(new Blob([b],{type:'model/gltf-binary'}));let root;try{root=await loadGLB(u)}finally{URL.revokeObjectURL(u)}
 const arg={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};const floats=i=>{const a=j.accessors[i],v=j.bufferViews[a.bufferView];if(a.componentType!==5126)throw Error('Unsupported folio accessor');return new Float32Array(b,bo+(v.byteOffset||0)+(a.byteOffset||0),a.count*arg[a.type])};
 const map=j.nodes.map(n=>root.getObjectByName(n.name));const mats=[],morphs=[];
 for(let k=0;k<j.nodes.length;k++){const n=j.nodes[k],obj=map[k];if(n.mesh==null||!obj)continue;j.meshes[n.mesh].primitives.forEach((pr,ix)=>{const o=obj.children[ix];if(!o)return;o.castShadow=true;o.receiveShadow=true;if(pr.targets){for(const [semantic,key] of [['POSITION','position'],['NORMAL','normal']])if(pr.targets[0][semantic]!=null)o.geometry.morphAttributes[key]=pr.targets.map(t=>new T.BufferAttribute(floats(t[semantic]),3));o.geometry.morphTargetsRelative=true;o.updateMorphTargets();morphs.push(o)}if(o.material.map){o.material.map.anisotropy=4;}mats.push(o.material)})}
 const tracks=[];for(const a of j.animations||[])for(const c of a.channels){const s=a.samplers[c.sampler],n=c.target.node,path=c.target.path,t=floats(s.input),v=floats(s.output);tracks.push({n,path,t,v,size:v.length/t.length})}
 const leaves=Array.from({length:4},(_,i)=>root.getObjectByName('Bound collection leaf '+i));
 const hinge=root.getObjectByName('Measured binding hinge.001');
 const hingeTrack=tracks.find(q=>map[q.n]===hinge&&q.path==='rotation');
 hinge.quaternion.fromArray(hingeTrack.v,0);
 const openRotation=new T.Quaternion().fromArray(hingeTrack.v,hingeTrack.v.length-4);
 const insideCover=bindGrandSpreads(root,leaves,hinge,openRotation);
 for(const track of tracks) {
  const leafIndex=leaves.indexOf(map[track.n]);
  if(track.path==='weights'&&leafIndex>=0) track.leafIndex=leafIndex;
 }
 const spec=j.cameras[0].perspective,camera=new T.PerspectiveCamera(spec.yfov*180/Math.PI,spec.aspectRatio,spec.znear,spec.zfar),ci=j.nodes.findIndex(n=>n.camera===0),stage=new T.Scene();stage.add(root);
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});try{await applyGrandMaterials(mats,T,renderer);}catch(error){renderer.dispose();throw error;}renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;const c=renderer.domElement;c.className='crown-native-folio';c.style.cssText='position:absolute;top:0;left:0;z-index:2;pointer-events:none;display:none;max-width:none';c.setAttribute('aria-hidden','true');holder.append(c);
 stage.add(new T.HemisphereLight(0xffe2be,0x546077,1.05));const key=new T.DirectionalLight(0xffdbb0,2.15);key.position.set(-1.8,3.3,2.5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-1.4;key.shadow.camera.right=1.4;key.shadow.camera.top=1.25;key.shadow.camera.bottom=-1.25;key.shadow.camera.near=.05;key.shadow.camera.far=10;key.shadow.bias=-.0003;key.shadow.normalBias=.002;stage.add(key);const edge=new T.DirectionalLight(0xc7c7ff,1.03);edge.position.set(1.8,2.2,-1.6);stage.add(edge);
 const qa=new T.Quaternion(),qb=new T.Quaternion(),axis=new T.Vector3(0,1,0),pivot=new T.Vector3(-.15,.14,0),pos=new T.Vector3();
 return {dispose(){
  const geometry=new Set(),material=new Set(),textures=new Set();
  root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material])){material.add(m);for(const p of Object.values(m))if(p?.isTexture)textures.add(p);}}});
  for(const x of geometry)x.dispose();for(const x of textures)x.dispose();for(const x of material)x.dispose();
  renderer.dispose();renderer.forceContextLoss();c.remove();
 },hide(){c.style.display='none'},draw(progress,az,rect,dpr){
  if(renderer.getContext().isContextLost()){c.style.display='none';return false;}
  insideCover.visible=progress<turns[0].end-.005;
  for(const q of tracks){const {n,path,t,v,size}=q,node=map[n];if(!node)continue;
   const phase=q===hingeTrack?clamp01(progress*2.3):progress;
   const elapsed=q.leafIndex===undefined?phase:grandLeafFrame(q.leafIndex,progress)/(t.length-1);
   const sec=t[0]+(t[t.length-1]-t[0])*elapsed;
   let a=0;while(a<t.length-2&&t[a+1]<sec)a++;const b=t.length===1?a:a+1,u=Math.max(0,Math.min(1,(sec-t[a])/(t[b]-t[a]||1))),f=k=>v[a*size+k]*(1-u)+v[b*size+k]*u;
   if(path==='rotation'){qa.fromArray(v,a*size);qb.fromArray(v,b*size);node.quaternion.slerpQuaternions(qa,qb,u)}
   else if(path==='translation')node.position.set(f(0),f(1),f(2));
   else if(path==='weights')for(const leaf of node.children)if(leaf.morphTargetInfluences)for(let k=0;k<size;k++)leaf.morphTargetInfluences[k]=f(k);
  }
  root.updateMatrixWorld(true);const base=map[ci];base.getWorldPosition(camera.position);base.getWorldQuaternion(camera.quaternion);
  if(az){const q=new T.Quaternion().setFromAxisAngle(axis,az*Math.PI/180);camera.position.sub(pivot).applyQuaternion(q).add(pivot);camera.quaternion.premultiply(q)}
  const w=Math.max(2,Math.round(rect.w)),h=Math.max(2,Math.round(rect.h));const px=Math.min(2,dpr||1,Math.sqrt(2900000/(w*h)));const size=w+':'+h+':'+px.toFixed(3);if(c.dataset.sz!==size){renderer.setPixelRatio(px);renderer.setSize(w,h,false);c.style.width=w+'px';c.style.height=h+'px';c.dataset.sz=size}
  c.style.transform='translate3d('+rect.x+'px,'+rect.y+'px,0)';c.style.display='block';renderer.render(stage,camera);holder.dataset.bookRenderer='native-morph-glb';return true;
 }};
}
