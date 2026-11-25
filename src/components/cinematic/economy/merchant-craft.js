import { sceneLifecycle } from './scene-lifecycle';

export function mountMerchantCraft(host, key) {
  const {listen,observe,dispose}=sceneLifecycle();
 const mel=key==='meluna';
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),root=document.createElement('div');
 root.className='merchant-craft '+(mel?'merchant-craft-prism':'merchant-craft-weave');root.setAttribute('aria-hidden','true');
 const prism=`<svg viewBox="0 0 1000 245" preserveAspectRatio="xMidYMid slice" focusable="false">
 <defs>
  <linearGradient id="prism-slate" x2=".8" y2="1"><stop stop-color="#17243b"/><stop offset=".5" stop-color="#354b69"/><stop offset="1" stop-color="#19253a"/></linearGradient>
  <linearGradient id="prism-face" x1="0" y1=".9" x2="1" y2=".05"><stop stop-color="#21354e"/><stop offset=".53" stop-color="#8baec6"/><stop offset="1" stop-color="#334669"/></linearGradient>
  <linearGradient id="prism-ray"><stop stop-color="#567fa6" stop-opacity="0"/><stop offset=".5" stop-color="#d3e9f7"/><stop offset="1" stop-color="#7198b1" stop-opacity="0"/></linearGradient>
 </defs>
 <g class="prism-bench">
 <path d="M35 181H965L899 210H102L35 181Z" fill="#131b27" stroke="#6d6658"/>
 <path d="M144 190H856M173 201H827" fill="none" stroke="#5d5b59" opacity=".64"/>
 <path d="M263 175V166M315 175V168M367 175V166M419 175V168M471 175V166M523 175V168M575 175V166M627 175V168M679 175V166M731 175V168" stroke="#8d8469" opacity=".58"/>
 </g>
 <path class="prism-ray prism-in" pathLength="1" d="M100 121L442 121" stroke="url(#prism-ray)" stroke-width="4" fill="none"/>
 <g class="prism-ray prism-out" stroke="url(#prism-ray)" fill="none" stroke-width="3"><path pathLength="1" d="M548 120L901 58"/><path pathLength="1" d="M548 120L907 118"/><path pathLength="1" d="M548 120L897 170"/></g>
 <g class="prism-jaw prism-west">
 <path d="M449 63L467 39L502 58L489 145L476 175L442 150L431 114Z" fill="url(#prism-slate)" stroke="#728399"/>
 <path d="M467 39L474 87L431 114M474 87L489 145M474 87L502 58" fill="none" stroke="#b4ccdc" stroke-opacity=".55"/>
 </g><g class="prism-jaw prism-east">
 <path d="M501 58L540 37L571 87L557 143L524 177L489 145Z" fill="url(#prism-face)" stroke="#8396b1"/>
 <path d="M540 37L529 90L557 143M529 90L489 145M529 90L571 87" fill="none" stroke="#bfd8e4" stroke-opacity=".58"/>
 </g>
 <path class="prism-core" d="M493 104L518 114L500 135L479 123Z" fill="#cef0ff"/>
 </svg>`;
 const pattern=(count,cb)=>Array.from({length:count},(_,i)=>cb(i)).join('');
 const weave=`<svg viewBox="0 0 1000 245" preserveAspectRatio="xMidYMid slice" focusable="false">
 <defs><linearGradient id="thread-fabric" x2="0" y2="1"><stop stop-color="#433520"/><stop offset=".53" stop-color="#3b2b25"/><stop offset="1" stop-color="#1b181d"/></linearGradient><clipPath id="woven-crop"><path class="weave-window" d="M323 51H678V177L500 216L323 177Z"/></clipPath></defs>
 <g stroke="#81705a" fill="#231c19"><path d="M265 47H735V57H265Z M309 58H322V177H309Z M678 58H691V177H678Z"/>
 <path d="M280 36H294V68H280Z M706 36H720V68H706Z" fill="#9d8053"/></g>
 <path d="M323 51H678V177L500 216L323 177Z" fill="#191616" opacity=".82"/>
 <g clip-path="url(#woven-crop)">
 <g class="weave-fill"><rect x="323" y="51" width="355" height="165" fill="url(#thread-fabric)"/>
 ${pattern(25,i=>`<path d="M${330+i*14} 52V220" stroke="#9c805c" stroke-width=".65" opacity=".35"/>`)}
 ${pattern(18,i=>`<path d="M323 ${56+i*9}H677" stroke="#c0a37e" stroke-width="${i%4===0?1.25:.55}" opacity="${i%4===0?.52:.19}"/>`)}
 <path d="M347 66H654V168L500 202L347 168Z M379 88H621V153L500 180L379 153Z M469 80H531L550 106L531 140H469L449 106Z" fill="none" stroke="#b39a69" stroke-width="1.6"/>
 <path d="M500 90L521 111L500 130L479 111Z" fill="#bc9b6e" opacity=".85"/>
 </g></g>
 <g class="weave-shuttle"><path d="M352 110H628L659 121L628 134H352L321 121Z" fill="#1e1715" stroke="#b49862"/><path d="M423 116H571V127H423Z" fill="#bd9b65" opacity=".78"/></g>
 <path class="weave-finish" pathLength="1" d="M323 52H677V177L501 216L323 177Z" stroke="#bca272" fill="none" stroke-width="2"/>
 </svg>`;
 const image=mel?'/luna-cinematic/economy/meluna-specimens.webp':'/luna-cinematic/economy/brimor-loom.webp';
 root.innerHTML='<img class="merchant-craft-photo" src="'+image+'" alt="" width="1320" height="744" loading="lazy" decoding="async" draggable="false"><div class="merchant-craft-photo-detail" style="--merchant-photo:url('+image+')"></div>'+(mel?prism:weave);
 host.append(root);
 const clamp=(x)=>Math.min(1,Math.max(0,x)),ease=(x)=>(x=clamp(x))*x*(3-2*x);
 let visible=!('IntersectionObserver' in window),raf=0,away=false;
 function stop(){if(raf)cancelAnimationFrame(raf);raf=0;}
 function paint(){raf=0;if(!visible||away||document.hidden||motion.matches)return;
  const r=root.getBoundingClientRect(),p=ease((innerHeight*.83-r.top)/(innerHeight*.54));
  const set=(key,n)=>root.style.setProperty(key,n.toFixed(4));
  root.dataset.craftProgress=p.toFixed(4);
  if(mel){set('--prism-close',ease((p-.08)/.59));set('--prism-input',ease(p/.41));set('--prism-split',ease((p-.57)/.38));set('--prism-scan',ease((p-.16)/.69));}
  else{set('--weave-height',ease((p-.12)/.72));set('--weave-shuttle',1-2*Math.abs((p*2.4)%1-.5));set('--weave-thread',ease((p-.54)/.45));set('--weave-tool',1-ease((p-.68)/.31));}
 }
 function queue(){if(visible&&!away&&!raf&&!document.hidden&&!motion.matches)raf=requestAnimationFrame(paint)}
 if(typeof IntersectionObserver==='function')observe(([e])=>{visible=e.isIntersecting;if(visible)queue();else stop()},{rootMargin:'11% 0px'}).observe(root);
 for(const k of ['scroll','resize'])listen(window,k,queue,{passive:true});
 listen(window,'pagehide',()=>{away=true;stop()});
 listen(window,'pageshow',()=>{away=false;queue()});
 listen(document,'visibilitychange',()=>document.hidden?stop():queue());
 listen(motion,'change',()=>motion.matches?stop():queue());queue();
  return () => { stop(); dispose(); host.replaceChildren(); };
}
