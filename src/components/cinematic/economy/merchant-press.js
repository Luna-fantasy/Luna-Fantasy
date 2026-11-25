import { sceneLifecycle } from './scene-lifecycle';

export function mountMerchantPress(host, key, lang) {
  const {listen,dispose}=sceneLifecycle();
  const copy={
    kael:{en:['KAEL’S LUCKBOX','From vault to card','Six rarity tiers. One sealed draw.','Skip to luckboxes'],ar:['صندوق حظ كايل','من الخزنة إلى البطاقة','ست درجات ندرة. وسحب واحد من الصندوق.','انتقل إلى صناديق الحظ']},
    zoldar:{en:['ZOLDAR’S TICKET PRESS','From roll to ticket','Fed, punched and issued for game events.','Skip to ticket offers'],ar:['مطبعة تذاكر زولدار','من البكرة إلى التذكرة','تُطبع التذاكر وتُجهَّز لدخول فعاليات الألعاب.','انتقل إلى عروض التذاكر']}
  }[key][lang];
  const D=document,NS='http://www.w3.org/2000/svg', cl=x=>Math.max(0,Math.min(1,x)), ease=(x,a,b)=>{let z=cl((x-a)/(b-a));return z*z*(3-2*z);}, n=x=>Number(x.toFixed(3));
  const set=(el,values)=>Object.entries(values).forEach(([k,v])=>el.setAttribute(k,String(v)));
  const node=(tag,cl,parent,txt)=>{const e=D.createElement(tag);e.className=cl; if(txt)e.textContent=txt;parent?.append(e);return e;};
  const sv=(tag,attrs,parent)=>{const v=D.createElementNS(NS,tag);set(v,attrs);parent.append(v);return v;};
  const path=(parent,d,fill='none',stroke='none',sw=1)=>sv('path',{d,fill,stroke,'stroke-width':sw,'stroke-linejoin':'round','stroke-linecap':'round'},parent);
  const rect=(parent,x,y,width,height,rx,fill,stroke='none',sw=1)=>sv('rect',{x,y,width,height,rx,fill,stroke,'stroke-width':sw},parent);
  const circle=(parent,cx,cy,r,fill,stroke='none',sw=1)=>sv('circle',{cx,cy,r,fill,stroke,'stroke-width':sw},parent);
  function grad(d,id,stops,x2='0%',y2='100%') {
    const g=sv('linearGradient',{id,x2,y2},d);
    stops.forEach(([offset,c])=>sv('stop',{offset,'stop-color':c},g)); return 'url(#'+id+')';
  }
  function defs(s,p){
    const d=sv('defs',{},s);
    const metal=grad(d,p+'metal',[[0,'#b97848'],[.17,'#f0c38b'],[.32,'#75543b'],[.48,'#372724'],[.78,'#9d6b46'],[1,'#452e29']]);
    const slate=grad(d,p+'slate',[[0,'#352532'],[.65,'#17151e'],[1,'#0b0b13']]);
    const gold=grad(d,p+'gold',[[0,'#57403d'],[.3,'#af7651'],[.5,'#f3c894'],[.64,'#745039'],[1,'#614237']],'100%','85%');
    const paper=grad(d,p+'paper',[[0,'#8a664d'],[.24,'#e0b57f'],[.61,'#b28054'],[1,'#6c4535']],'100%','85%');
    return {d,metal,slate,gold,paper};
  }
  function kael(s) {
    const {d,metal,slate,gold}=defs(s,'mkzk-');
    const glow=sv('radialGradient',{id:'mkzk-glow'},d);sv('stop',{offset:0,'stop-color':'#ffdca2','stop-opacity':'.78'},glow);sv('stop',{offset:1,'stop-color':'#b87dee','stop-opacity':0},glow);
    sv('ellipse',{cx:480,cy:428,rx:340,ry:62,fill:'#000','fill-opacity':'.46'},s);
    for(const dx of [-36,0,36])path(s,`M${155+dx} 426H${825+dx}`,'none','#805841',.7);
    path(s,'M130 402L205 365H760L830 402L775 433H191Z','#1d1921','#79503e',2);
    path(s,'M130 403L191 434H775L830 403V420L776 450H191L130 420Z','#12111a','#4a342c',2);
    path(s,'M203 367H757L805 398H158Z','#322230','#a16d4b',1.2);
    const box=sv('g',{},s),lid=sv('g',{class:'mkz-kael-lid'},box);
    path(box,'M287 337L325 288H635L675 337L634 368H327Z','#17131b','#c49668',3);
    path(box,'M322 332L345 305H615L643 332L617 348H344Z','#0b0912','#6d443c',1.1);
    const light=sv('ellipse',{cx:480,cy:325,rx:217,ry:110,fill:'url(#mkzk-glow)',opacity:0},box);
    lid.remove();box.append(lid);
    path(lid,'M287 0L325 -66H635L675 0L637 17H323Z',metal,'#d0a17a',2.7);
    path(lid,'M322 -2L345 -50H615L640 -2L617 7H345Z',slate,'#f0b486',1.8);
    path(lid,'M354 -11L374 -38H586L605 -11ZM456 -24L480 -43L504 -24L480 0Z','none','#c49171',1.1);
    for(let i=0;i<10;i++){circle(lid,327+i*34,3,2.5,'#dbb78a');}
    const hinges=[325,635].map(x=>path(box,`M${x} 338V301`,'none','#a5795d',6));
    const draw=sv('g',{class:'mkz-kael-signature'},box);
    path(draw,'M-67 -105Q-69 -117 -57 -118H56Q68 -118 67 -106V101Q67 112 55 113H-56Q-67 112 -67 101Z',slate,'#e4b182',3);
    rect(draw,-60,-111,120,216,9,'none','#7b5162',1.25);
    const back=sv('g',{class:'mkz-kael-back'},draw),front=sv('g',{class:'mkz-kael-face'},draw);
    path(back,'M-40 0L0 -64L40 0L0 58Z M-25 0L0 -38L25 0L0 35Z','none','#be8e62',1.6);
    path(front,'M-40 66V-21Q-39 -55 0 -77Q39 -55 40 -21V66Z','#28203d','#c69769',2);
    path(front,'M-30 58V-20Q-27 -48 0 -62Q27 -48 30 -20V58Z','#161322','#805e72',1);
    path(front,'M-21 27L0 -43L21 27L0 54Z',gold,'#e9bf8e',1.7);
    path(front,'M0 -28L10 24L0 39L-10 24Z','#ead5b3','#ffe3ae',1);
    for(const x of [-1,1]) for(const y of [-1,1])path(draw,`M${x*49} ${y*90}h${x*5}v${y*10}`,'none','#bb936b',1.4);
    const face=sv('g',{},box);
    path(face,'M287 337L327 352H634L675 337L641 400H320Z',metal,'#e4b187',2.5);
    path(face,'M309 354L337 366H621L653 353L633 389H331Z',slate,'#986543',1.4);
    rect(face,465,345,30,39,5,gold,'#ebc695',1.5);path(face,'M480 356v12','none','#261a21',4);
    const stones=['#dfd5bc','#7fb7dc','#b897ff','#ee9b72','#ffd67e','#d8bdff'].map((color,i)=>{
      const x=355+i*50;circle(face,x,375,7.2,'#1e1821','#be8d64',1.45);
      return circle(face,x,375,4,color,'#ead2ae',.55);
    });
    return p=>{
      const lift=ease(p,.05,.40),release=ease(p,.25,.66),flip=ease(p,.53,.83), relock=ease(p,.83,1),angle=180*flip;
      set(lid,{transform:`translate(0 ${n(318-33*lift+20*relock)}) scale(1 ${n(.38+.62*lift-.27*relock)})`});
      set(light,{opacity:n(.76*lift*(1-.72*relock))});
      hinges.forEach((h,i)=>{const x=[325,635][i];set(h,{d:`M${x} 338L${x+(i?8:-8)*lift} ${n(318-33*lift+20*relock)}`,opacity:n(.3+.62*lift)});});
      set(draw,{opacity:n(ease(p,.31,.5)),transform:`translate(480 ${n(320-151*release)}) scale(${n(Math.max(.055,Math.abs(Math.cos(angle/180*Math.PI))))} ${n(.53+.47*release)})`});
      set(back,{opacity:flip<.5?1:0});set(front,{opacity:flip<.5?0:1});
      stones.forEach((a,i)=>set(a,{opacity:n(.23+.77*ease(p,.69+i*.026,.84+i*.026))}));
    };
  }
  function zoldar(s){
    const {d,metal,slate,gold,paper}=defs(s,'mkzz-');
    const media=sv('clipPath',{id:'mkzz-trackclip'},d);
    rect(media,135,263,688,77,9,'white');
    sv('ellipse',{cx:480,cy:429,rx:373,ry:51,fill:'#000','fill-opacity':'.44'},s);
    path(s,'M97 368L158 336H808L861 368L803 418H148Z','#24212a','#8c634a',2);
    path(s,'M97 368L148 397H803L861 368V397L808 433H148L97 399Z','#100f16','#5c443b',2);
    path(s,'M138 380L170 377H773L792 384L768 406H177Z','#3d2627','#ab774e',2);
    const frame=sv('g',{},s);
    rect(frame,288,85,384,244,24,slate,'#c08b63',3);
    rect(frame,308,108,344,184,15,'#13121b','#745348',2);
    rect(frame,306,113,62,178,10,metal,'#bb8c61',2);
    rect(frame,592,113,62,178,10,metal,'#bb8c61',2);
    path(frame,'M330 110V82Q330 54 360 54H602Q632 54 632 82V110Z',metal,'#e0a977',2.8);
    path(frame,'M353 96H608M361 81H600','none','#6f4c3e',2);
    rect(frame,427,75,106,37,5,gold,'#dab187',1.5);
    for(let i=0;i<5;i++)path(frame,`M${439+i*20} 88v11`,'none','#462d2c',2);
    path(s,'M117 270H829V342H117Z','#0e0d15','#7b5541',2);
    const clipped=sv('g',{'clip-path':'url(#mkzz-trackclip)'},s), strip=sv('g',{class:'mkz-zoldar-signature'},clipped);
    function ticket(parent,x,y,w=100,h=54){
      const g=sv('g',{transform:`translate(${x} ${y})`},parent);
      path(g,`M0 0H${w}V18Q${w-9} 27 ${w} 36V${h}H0V36Q9 27 0 18Z`,paper,'#efc18d',1.4);
      rect(g,9,7,w-18,h-14,4,'none','#6d4537',.7);
      path(g,`M${w-26} 6v42M13 13H${w-32}M13 42H${w-32}`,'none','#714737',.8).setAttribute('stroke-dasharray','1.5 2.6');
      path(g,`M${w*.38} 13l9 13-9 12-9-12Z`,'none','#6a3f36',1.4);
      return g;
    }
    for(let i=0;i<17;i++)ticket(strip,i*105,0);
    const stamp=sv('g',{class:'mkz-zoldar-stamp'},s);
    rect(stamp,452,143,56,107,8,metal,'#e8b182',2);
    rect(stamp,415,226,130,34,6,gold,'#e1b283',1.9);
    rect(stamp,407,252,146,12,4,'#2d2027','#ab7957',1.5);
    path(stamp,'M460 235h40M427 256h106','none','#603a35',1.5);
    const seals=sv('g',{opacity:0},s);
    path(seals,'M470 294l10-8 10 8-10 8ZM466 287h-10m38 0h10','none','#744847',1.3);
    const rollers=[184,776].map(x=>{
      const g=sv('g',{},s);
      circle(g,x,307,35,metal,'#e4b686',2);
      circle(g,x,307,27,slate,'#b38263',1.5);
      for(let j=0;j<8;j++)path(g,`M${x} 283V331`,'none','#b5896e',1.8).setAttribute('transform',`rotate(${22.5*j} ${x} 307)`);
      circle(g,x,307,7,gold,'#dbb18b',1.4);
      return [g,x];
    });
    path(s,'M114 335H832V352H114Z',metal,'#b98861',2);path(s,'M128 344H816','none','#513a38',2);
    path(s,'M677 352H814L789 401H665Z',slate,'#8b6046',2);
    const trayClip=sv('clipPath',{id:'mkzz-tray'},d);
    path(trayClip,'M667 348H823L793 405H657Z','white');
    const receipt=ticket(s,0,0,105,54);receipt.setAttribute('clip-path','none');
    const recGroup=sv('g',{'clip-path':'url(#mkzz-tray)'},s);recGroup.append(receipt);
    path(s,'M662 392H793L785 406H656Z',metal,'#ba885e',1.8);
    return p=>{
      const a=ease(p,.06,.46),out=ease(p,.66,.96),press=ease(p,.36,.54)*(1-ease(p,.56,.71));
      set(strip,{transform:`translate(${n(-925+470*a+250*out)} 279)`});
      set(stamp,{transform:`translate(0 ${n(27*press)})`});
      set(seals,{opacity:n(ease(p,.52,.59)*(1-ease(p,.66,.73)))});
      rollers.forEach(([g,x])=>set(g,{transform:`rotate(${n(490*a+225*out)} ${x} 307)`}));
      set(receipt,{opacity:n(ease(p,.68,.79)),transform:`translate(${n(686+12*out)} ${n(327+38*out)}) rotate(${n(2+8*out)} 50 25) scale(1 .77)`});
    };
  }
  const track=node('section','mkz-track');track.dataset.scene=key;track.setAttribute('aria-labelledby','mkz-name');
  const pin=node('div','mkz-pin',track);
  const text=node('div','mkz-copy',pin);node('span','mkz-eyebrow',text,copy[0]);
  const title=node('h2','mkz-title',text,copy[1]);title.id='mkz-name';node('p','mkz-description',text,copy[2]);
  const skip=node('a','mkz-skip',text,copy[3]);skip.href='#merchant-offers';
  const counter=node('div','mkz-counter',text);counter.setAttribute('aria-hidden','true');
  ['01','02','03'].forEach(x=>node('span','mkz-index',counter,x));
  const stage=node('div','mkz-stage',pin);stage.setAttribute('aria-hidden','true');
  const svg=sv('svg',{viewBox:'55 32 850 450',focusable:'false',preserveAspectRatio:'xMidYMid meet'},stage);
  const render=(key==='kael'?kael:zoldar)(svg);
  host.append(track);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,last='',away=false;
  const update=()=>{
    frame=0;
    if(away||document.hidden)return;
    const h=Math.max(1,track.offsetHeight-pin.offsetHeight);
    const p=reduce.matches?1:cl(-track.getBoundingClientRect().top/h);
    const phase=reduce.matches?'resolved':p<.31?'one':p<.69?'two':'three',progress=p.toFixed(3),stamp=phase+progress;
    if(stamp===last)return;
    last=stamp;track.dataset.progress=progress;
    track.dataset.phase=phase;
    render(p);
  };
  function stop(){if(frame)cancelAnimationFrame(frame);frame=0;}
  function schedule(){if(!away&&!document.hidden&&!frame)frame=requestAnimationFrame(update);}
  listen(window,'resize',schedule,{passive:true});
  listen(window,'scroll',schedule,{passive:true});
  listen(window,'pagehide',()=>{away=true;stop()});
  listen(window,'pageshow',()=>{away=false;schedule()});
  listen(document,'visibilitychange',()=>document.hidden?stop():schedule());
  listen(reduce,'change',schedule);
  update();
  return () => { stop(); dispose(); host.replaceChildren(); };
}
