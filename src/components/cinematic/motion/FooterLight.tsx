'use client';

import { useEffect, useRef } from 'react';
import { useEditMode } from '@/lib/edit-mode/context';

interface Point { x: number; y: number }
function bezier(t: number, a: number, b: number, c: number, d: number) {
  const k = 1-t;
  return k*k*k*a + 3*k*k*t*b + 3*k*t*t*c + t*t*t*d;
}

export function FooterLight() {
  const layer = useRef<HTMLCanvasElement>(null);
  const { editMode } = useEditMode();
  useEffect(() => {
    const canvas = layer.current, footer = canvas?.closest('footer');
    if (!canvas || !footer || editMode || !footer.closest('[data-luna-shell="cinematic"]')) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const direction = getComputedStyle(footer).direction === 'rtl' ? -1 : 1;
    const events = new AbortController(), passive = {passive:true,signal:events.signal};
    let width = 0, height = 0, visible = false, frame = 0, started = -2000, last = 0;
    let from: Point = { x:0,y:0 }, target: Point = { x:0,y:0 }, point: Point = {...target};
    let chosen: HTMLElement | null = null, layoutDirty = true, settled = false;
    function layout() {
      const box=footer!.getBoundingClientRect(), mark=footer!.querySelector('.footer-logo')?.getBoundingClientRect();
      width=box.width;height=box.height;
      const ratio=Math.min(1.5,devicePixelRatio||1);
      canvas!.width=Math.max(1,Math.round(width*ratio));canvas!.height=Math.max(1,Math.round(height*ratio));
      ctx!.setTransform(ratio,0,0,ratio,0,0);
      from = mark ? {x:mark.x-box.x+mark.width/2,y:mark.y-box.y+mark.height*.70} : {x:width*.5,y:height*.14};
      const b = chosen?.getBoundingClientRect();
      target = b ? {x:b.x-box.x+b.width*.5,y:b.bottom-box.y+3} : {x:direction>0?width*.90:width*.10,y:Math.min(height*.68,165)};
      if (!settled) {point={...target};settled=true;}
      layoutDirty=false;
    }
    function draw(now:number) {
      frame=0;
      if (!visible || document.hidden || preference.matches) return;
      if (layoutDirty) layout();
      const dt = Math.min(80,Math.max(1,now-last));last=now;
      const smoothing=1-Math.exp(-dt/96);
      point.x+=(target.x-point.x)*smoothing;point.y+=(target.y-point.y)*smoothing;
      const age=Math.min(1,Math.max(0,(now-started)/1360));
      ctx!.clearRect(0,0,width,height);
      const end=point, mid=(from.x+end.x)/2;
      const rise=Math.min(70,height*.22);
      const control1={x:from.x+(mid-from.x)*.98, y:Math.max(7,Math.min(from.y,end.y)-rise)};
      const control2={x:end.x+(mid-end.x)*.43, y:Math.min(height-8,end.y+rise*.60)};
      for(let i=0;i<3;i++){
        const line=ctx!.createLinearGradient(from.x,from.y,end.x,end.y+.01);
        line.addColorStop(0,'rgba(251,217,188,.70)');line.addColorStop(.36,'rgba(216,157,142,.79)');
        line.addColorStop(.68,'rgba(188,129,123,.70)');line.addColorStop(1,'rgba(252,206,167,.78)');
        const thread=i-1,wave=thread*(4+Math.sin(age*Math.PI)*4);
        ctx!.beginPath();ctx!.moveTo(from.x,from.y);
        ctx!.bezierCurveTo(control1.x,control1.y+wave,control2.x,control2.y-wave,end.x,end.y+thread*1.4);
        ctx!.globalAlpha=(i===1?.51:.25)*(chosen?1:.76);ctx!.strokeStyle=line;ctx!.lineWidth=i===1?1.35:.7;ctx!.stroke();
      }
      if(age<1){
        const x=bezier(age,from.x,control1.x,control2.x,end.x),y=bezier(age,from.y,control1.y,control2.y,end.y);
        const halo=ctx!.createRadialGradient(x,y,0,x,y,11);halo.addColorStop(0,'#fff1dd');halo.addColorStop(.18,'#efc5b2b8');halo.addColorStop(1,'#c3897800');
        ctx!.globalAlpha=.85*Math.sin(age*Math.PI);ctx!.fillStyle=halo;ctx!.fillRect(x-11,y-11,22,22);
      }
      ctx!.globalAlpha=1;
      if(age<1 || Math.abs(target.x-point.x)+Math.abs(target.y-point.y)>.22) schedule();
    }
    function schedule(){if(!frame&&visible&&!document.hidden&&!preference.matches)frame=requestAnimationFrame(draw);}
    function select(el: HTMLElement|null) {
      if (chosen===el && settled) return;
      chosen=el;layoutDirty=true;started=performance.now();schedule();
    }
    function pointTo(e:Event) {
      const hit=e.target instanceof Element ? e.target.closest<HTMLElement>('a,button,.footer-brand-row') : null;
      if(hit && footer!.contains(hit)) select(hit);
    }
    function leave(){select(null);}
    function reset(){cancelAnimationFrame(frame);frame=0;if(preference.matches) ctx!.clearRect(0,0,width,height);else schedule();}
    const resize=new ResizeObserver(()=>{layoutDirty=true;schedule();});resize.observe(footer);
    const observation=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(visible){started=performance.now();schedule();} else reset();},{rootMargin:'35px'});
    observation.observe(footer);
    footer.addEventListener('pointerover',pointTo,passive);footer.addEventListener('focusin',pointTo,passive);
    footer.addEventListener('pointerdown',pointTo,passive);footer.addEventListener('pointerleave',leave,passive);
    footer.addEventListener('focusout',e=>{if(!footer.contains(e.relatedTarget as Node|null))leave();},passive);
    document.addEventListener('visibilitychange',reset,passive);preference.addEventListener('change',reset,passive);
    return ()=>{events.abort();resize.disconnect();observation.disconnect();cancelAnimationFrame(frame);};
  },[editMode]);
  return editMode ? null : <canvas ref={layer} className="luna-footer-ribbon" aria-hidden="true" />;
}