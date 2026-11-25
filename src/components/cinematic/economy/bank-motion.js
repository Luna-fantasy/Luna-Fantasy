import { sceneLifecycle } from './scene-lifecycle';

export function mountBankArt(host, role) {
  const {listen,observe,dispose}=sceneLifecycle();
const anchor=host.closest('section');
const NS='http://www.w3.org/2000/svg';
const clamp=(p)=>Math.max(0,Math.min(1,p));
const e=(p)=>p*p*(3-2*p);
const ease=(p,a,b)=>e(clamp((p-a)/(b-a)));
const scaleAt=(s,x,y)=>`translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`;
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const tier=matchMedia('(max-width: 700px)');
const entries=[];
function mount(anchor,role,viewBox,contents){
 if(!anchor) return;

 const s=document.createElementNS(NS,'svg');
 s.setAttribute('viewBox',viewBox);s.setAttribute('focusable','false');
 s.innerHTML=contents;
 host.append(s);
 const view={anchor,host,s,role,elapsed:0,last:null,previous:null,scrubbed:false};
 entries.push(view);return view;
}
const pin=(x,y)=>`<circle cx="${x}" cy="${y}" r="3" fill="#b89669" stroke="#26252a"/>`;
const arch='M69 252V143C69 72 159 42 260 42S451 72 451 143V252Z';
const leaf=(x)=>`<path d="M${x} 111 H${x+166} V238 H${x}Z" fill="url(#v3vaultDoor)" stroke="#ba9c72" stroke-width="2"/>
<path d="M${x+13} 125 H${x+155}V223 H${x+13}Z" fill="none" stroke="#8b826b" stroke-width="1.4"/>
<path d="M${x+23} 135H${x+146}V214H${x+23}Z" fill="none" stroke="#514b48"/>
${[15,38,64,100,126,152].map(dx=>pin(x+dx,115)+pin(x+dx,233)).join('')}`;
const vault=mount(role==='vault' && anchor,'vault','0 0 520 306',`
<defs>
<linearGradient id="v3vaultRock" x2="1" y2="1"><stop stop-color="#394355"/><stop offset=".52" stop-color="#191e2b"/><stop offset="1" stop-color="#080b14"/></linearGradient>
<linearGradient id="v3vaultDoor" x2="1" y2="1"><stop stop-color="#4a5363"/><stop offset=".53" stop-color="#252c3a"/><stop offset="1" stop-color="#10141e"/></linearGradient>
<linearGradient id="v3vaultGold" x2=".7" y2="1"><stop stop-color="#d9ba85"/><stop offset=".5" stop-color="#82704e"/><stop offset="1" stop-color="#d0aa76"/></linearGradient>
<radialGradient id="v3vaultLight"><stop stop-color="#b2cce6" stop-opacity=".82"/><stop offset=".83" stop-color="#546e98" stop-opacity=".29"/><stop offset="1" stop-color="#526f9e" stop-opacity="0"/></radialGradient>
<clipPath id="v3vaultWindow"><path d="${arch}"/></clipPath>
</defs>
<path d="M39 274V144C39 50 141 18 260 18s221 32 221 126v130z" fill="url(#v3vaultRock)" stroke="#575b67" stroke-width="2"/>
<path d="M55 261V142C55 57 151 31 260 31s205 26 205 111v119z" fill="#101522" stroke="url(#v3vaultGold)" stroke-width="3"/>
<g clip-path="url(#v3vaultWindow)">
 <path d="${arch}" fill="#0a101d"/>
 <g data-v3="chamber">
 <ellipse cx="260" cy="168" rx="164" ry="145" fill="url(#v3vaultLight)"/>
 <path d="M156 249V153Q260 65 364 153V249M185 248V163Q260 99 335 163V248M213 247V177Q260 130 307 177v70" fill="none" stroke="#a9c5e4" stroke-width="2" opacity=".6"/>
 <path d="M199 248 237 205h46l39 43M226 248l16-34h36l16 34M254 215v34m13-34v34" fill="#26394f" stroke="#7b98ba" stroke-width="2"/>
 <path d="M241 179v31h38v-31q-19-24-38 0z" fill="#89a5c6" opacity=".62"/>
 </g>
 <g data-v3="leaf-left">${leaf(94)}<rect x="231" y="122" width="27" height="107" rx="4" fill="url(#v3vaultGold)" opacity=".57"/></g>
 <g data-v3="leaf-right">${leaf(260)}
 <rect x="260" y="122" width="27" height="107" rx="4" fill="url(#v3vaultGold)" opacity=".6"/>
 <g data-v3="bolts" fill="#c7a575" stroke="#73694f"><rect x="270" y="166" width="136" height="9" rx="4"/><rect x="272" y="190" width="136" height="9" rx="4"/></g>
 <g data-v3="wheel"><circle cx="338" cy="179" r="38" fill="#272d38" stroke="url(#v3vaultGold)" stroke-width="8"/>
 <path d="M338 143V214M302 179h72M312 153l52 52m0-52-52 52" fill="none" stroke="#cdb17c" stroke-width="5"/>
 <circle cx="338" cy="179" r="13" fill="#544b3a" stroke="#ddb987" stroke-width="2"/>
 </g></g>
</g>
<path d="${arch}" fill="none" stroke="url(#v3vaultGold)" stroke-width="2.6"/>
<path d="M58 251h404v19H58zM75 269h370v14H75z" fill="url(#v3vaultRock)" stroke="#6f6656" stroke-width="2"/>
<path data-v3="lintel" d="M112 88Q260 2 407 88" fill="none" stroke="#d2b884" stroke-width="2" pathLength="100" stroke-dasharray="100"/>
`);
const ledger=mount(role==='ledger' && anchor,'ledger','0 0 520 155',`
<defs><linearGradient id="v3paper" x2="0" y2="1"><stop stop-color="#3b4755"/><stop offset="1" stop-color="#1d2433"/></linearGradient></defs>
<path d="M14 134h492M35 143h450" stroke="#586277" stroke-width="2"/>
<path d="M54 122V35Q120 16 251 40Q373 14 453 37V123Q371 101 251 128Q123 103 54 122Z" fill="#141a26" stroke="#776850" stroke-width="2"/>
<path d="M62 115 60 31Q127 12 250 41v78Q137 98 62 115Zm188 4V41Q363 10 444 32l4 82q-82-17-198 5Z" fill="url(#v3paper)" stroke="#a69067" stroke-width="1.7"/>
<path d="M250 41v77" stroke="#c4ad80" stroke-width="2"/>
<g fill="none" stroke="#c3ad81" stroke-width="1.4">
${[0,1,2,3,4].map((n)=>`<path data-v3-line="" d="M${81+n*3} ${44+n*11}q57-5 ${135-n*9} 9m${67+n*9} 0q64-15 123-8" pathLength="100" stroke-dasharray="100"/>`).join('')}
</g>
<g fill="#6d5b3d" stroke="#d8b681" stroke-width="2.1">
${[0,1,2,3].map((n)=>`<ellipse data-v3-coin="" cx="${337+n*28}" cy="${109-n*4}" rx="12" ry="5"/>`).join('')}
</g>
<path data-v3="ledger-ruler" d="M74 73h153m43 0h152" stroke="#b7c4e3" stroke-width="2" opacity="0"/>
`);
const seal=mount(role==='seal' && anchor,'seal','0 0 520 132',`
<path d="M22 113h476M39 120h442" stroke="#5a6271" stroke-width="2"/>
<path d="M64 29h278l63 56v24H64z" fill="#262c38" stroke="#94805c" stroke-width="2"/>
<path d="M86 50h226M86 65h196M86 80h217" stroke="#8d806a" stroke-width="1.5"/>
<path data-v3="impress-trace" d="M103 92h220" pathLength="100" stroke-dasharray="100" stroke="#c3a77b" stroke-width="2"/>
<g data-v3="impression"><path d="M359 73 368 65 383 66 393 63 409 70 417 82 415 95 407 105 394 109 383 105 368 108 356 98 351 87z" fill="#894e57" stroke="#c38a85" stroke-width="2"/>
<circle cx="385" cy="86" r="15" fill="#512d45" stroke="#dc9d91" stroke-width="1.6"/><path d="m377 87 8-9 9 9-9 6z" fill="none" stroke="#dca892" stroke-width="1.6"/></g>
<g data-v3="press"><path d="M364 29h40l6 39h-53z" fill="#4a5161" stroke="#b3976b" stroke-width="2"/><rect x="370" y="10" width="28" height="23" rx="6" fill="#5d4b36" stroke="#c0a378" stroke-width="2"/><rect x="350" y="65" width="69" height="9" rx="4" fill="#bf9d70" stroke="#a58b63"/></g>
`);
const f=(node,key)=>node?.querySelector(`[data-v3="${key}"]`);
const put=(node,k,v)=>node?.setAttribute(k,typeof v==='number'?v.toFixed(3):v);
for(const stage of entries){
 const keys={vault:['chamber','leaf-left','leaf-right','bolts','wheel','lintel'],ledger:['ledger-ruler'],seal:['impression','impress-trace','press']}[stage.role];
 stage.visual=Object.fromEntries(keys.map(k=>[k,f(stage.s,k)]));
 if(stage===ledger){stage.lines=[...stage.s.querySelectorAll('[data-v3-line]')];stage.coins=[...stage.s.querySelectorAll('[data-v3-coin]')];}
}
function paint(stage,p,intro,introEnvelope){
 const a=stage.visual;
 if(stage.role==='vault'){
  const unlock=ease(p,.02,.35), open=ease(p,.28,.93), power=ease(p,.21,.76);
  put(a.wheel,'transform',`rotate(${unlock*148+introEnvelope*62} 338 179)`);
  put(a.bolts,'transform',`translate(${unlock*38+introEnvelope*8} 0)`);
  const n=open*155+introEnvelope*5;
  put(a['leaf-left'],'transform',`translate(${-n} 0)`);
  put(a['leaf-right'],'transform',`translate(${n} 0)`);
  put(a.chamber,'opacity',.24+power*.76);
  put(a.lintel,'stroke-dashoffset',100-100*Math.max(ease(p,.04,.46),intro*.94));
 }else if(stage.role==='ledger'){
  for(const [i,line] of stage.lines.entries()){
   const progress=Math.max(ease(p,.05+i*.093,.42+i*.097),introEnvelope*(.37-i*.044));
   put(line,'stroke-dashoffset',100-100*progress);
  }
  for(const [i,coin] of stage.coins.entries()){
   const progress=Math.max(ease(p,.24+i*.1,.47+i*.1),introEnvelope*(.54-i*.12));
   put(coin,'transform',`translate(${(-55+i*9)*(1-progress)} ${(-32-i*7)*(1-progress)})`);
   put(coin,'opacity',progress);
  }
  put(a['ledger-ruler'],'transform',`translate(0 ${36*ease(p,.05,.95)-22})`);
  put(a['ledger-ruler'],'opacity',.6*(ease(p,.02,.25)-ease(p,.62,.94))+.28*introEnvelope);
 }else{
  const press=ease(p,.23,.53)-ease(p,.54,.82);
  const heat=ease(p,.50,.72);
  put(a.press,'transform',`translate(0 ${press*23+introEnvelope*11})`);
  put(a.impression,'transform',scaleAt(.42+.58*heat,385,86));
  put(a.impression,'opacity',heat);
  put(a['impress-trace'],'stroke-dashoffset',100-100*ease(p,.54,.92));
 }
 stage.host.dataset.progress=p.toFixed(3);
}
let raf=0,observer=null,away=false;
const visible=new Set();
function stop(){
 if(raf)cancelAnimationFrame(raf);
 raf=0;
 for(const stage of entries)stage.last=null;
}
function request(){if(!raf&&!away&&!reduce.matches&&!document.hidden&&visible.size)raf=requestAnimationFrame(draw)}
function draw(t){
 raf=0;
 if(away||reduce.matches||document.hidden)return;
 const h=document.documentElement.clientHeight;
 let animating=false;
 for(const stage of visible){
  const b=stage.host.getBoundingClientRect();
  const a=stage.anchor.getBoundingClientRect();
  const p=stage===vault?
    clamp(-a.top/Math.max(300,Math.min(a.height,h)*.73)):
    clamp((h*.79-b.top)/Math.max(220,h*.70));
  const inFrame=b.top<h&&b.bottom>0;
  if(stage===vault?p>.006:stage.previous!==null&&Math.abs(b.top-stage.previous)>2)stage.scrubbed=true;
  if(inFrame&&stage.previous===null)stage.previous=b.top;
  const T=stage===vault?2600:(tier.matches?1060:1460);
  if(!stage.scrubbed&&inFrame&&stage.last!==null)stage.elapsed+=Math.max(0,t-stage.last);
  const intro=stage.scrubbed?0:clamp(stage.elapsed/T);
  const playing=!stage.scrubbed&&inFrame&&intro<1;
  stage.last=playing?t:null;
  const envelope=(ease(intro,.03,.42)-ease(intro,.58,1))*(1-ease(p,.12,.65));
  const welcome=stage===vault?.59*ease(intro,.03,1):0;
  // The untouched landing has the same welcome animation. Once scroll has
  // control, p=0 restores every part of the original vault frame, not just its data value.
  paint(stage,stage===vault?welcome+p*(1-welcome):p,intro,stage===vault?0:envelope);
  animating||=playing;
 }
 if(animating)request();
}
function setup(){
 observer?.disconnect();visible.clear();stop();
 if(reduce.matches||!('IntersectionObserver' in window)){
  for(const stage of entries)paint(stage,stage===vault?.59:1,1,0);
  return;
 }
 observer=observe(records=>{
   for(const item of records){
    const track=entries.find(s=>s.host===item.target);
    if(!track)continue;
    if(item.isIntersecting)visible.add(track);
    else{visible.delete(track);track.last=null;}
   }
   request();
 },{rootMargin:'80px 0px'});
 for(const stage of entries){paint(stage,0,0,0);observer.observe(stage.host);}
}
if(entries.length){
 setup();
 listen(reduce,'change',setup);
 listen(window,'scroll',request,{passive:true});
 listen(window,'resize',request,{passive:true});
 listen(window,'pagehide',()=>{away=true;stop()});
 listen(window,'pageshow',()=>{away=false;request()});
 listen(document,'visibilitychange',()=>document.hidden?stop():request());
}
  return () => { stop(); dispose(); host.replaceChildren(); };
}
