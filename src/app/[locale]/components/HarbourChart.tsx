'use client';
import { useEffect, useRef } from 'react';
import { drawHarbourChart } from '@/lib/cinematic/harbour-chart';
import { useNightMotion } from '@/components/cinematic/NightProjection';

export function HarbourChart({ selected,onSelect,ar }: { selected:number; onSelect:(n:number)=>void; ar:boolean }) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const state=useRef({selected,onSelect});state.current={selected,onSelect};
  const redraw=useRef<()=>void>(()=>{});
  const motion=useNightMotion();
  useEffect(()=>{
    const c=canvas.current, ctx=c?.getContext('2d');if(!c||!ctx)return;
    const canvasEl=c, context=ctx;
    let width=1,height=1,visible=false,frame=0,stamp=0,yaw=-.11,requested=-.11,time=0;
    let pointer:{id:number;x:number;y:number;start:number}|null=null;
    let markers:[number,number][]=[];
    function paint(now:number) {
      frame=0;
      if(!visible||document.hidden)return;
      const elapsed=stamp?Math.min(64,now-stamp):35;
      if(!motion||elapsed>=32) {
        if(motion)time+=elapsed;
        const desired=requested+(state.current.selected-1)*.1;
        yaw=motion?yaw+(desired-yaw)*(1-Math.exp(-elapsed*.012)):desired;
        markers=drawHarbourChart(context,width,height,yaw,state.current.selected,time);
        stamp=now;
      }
      if(motion)frame=requestAnimationFrame(paint);
    }
    function queue(){ if(!frame&&visible&&!document.hidden)frame=requestAnimationFrame(paint); }
    function resize(){const box=canvasEl.getBoundingClientRect();width=box.width;height=box.height;
      const dpr=Math.min(devicePixelRatio||1,2);canvasEl.width=Math.max(1,Math.round(width*dpr));canvasEl.height=Math.max(1,Math.round(height*dpr));context.setTransform(dpr,0,0,dpr,0,0);stamp=0;queue();}
    function down(e:PointerEvent){if(!e.isPrimary||e.button!==0)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,start:requested};canvasEl.setPointerCapture(e.pointerId);}
    function move(e:PointerEvent){if(!pointer||pointer.id!==e.pointerId)return;requested=Math.max(-.62,Math.min(.62,pointer.start+(e.clientX-pointer.x)/Math.max(100,width)*1.8));queue();}
    function up(e:PointerEvent){
      if(!pointer||e.pointerId!==pointer.id)return;
      if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)<9) {
        const box=canvasEl.getBoundingClientRect(), x=e.clientX-box.left,y=e.clientY-box.top;
        const distances=markers.map(([u,v])=>Math.hypot(u-x,v-y));const closest=Math.min(...distances);
        if(closest<Math.max(25,Math.min(width*.075,45)))state.current.onSelect(distances.indexOf(closest));
      }
      pointer=null;
    }
    function cancel(){pointer=null;}
    function visibility(){stamp=0;if(document.hidden){cancelAnimationFrame(frame);frame=0;}else queue();}
    const ro=new ResizeObserver(resize);ro.observe(canvasEl);
    const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(visible){stamp=0;queue();} else {cancelAnimationFrame(frame);frame=0;}});
    io.observe(canvasEl);redraw.current=()=>{stamp=0;queue();};
    canvasEl.addEventListener('pointerdown',down);canvasEl.addEventListener('pointermove',move);canvasEl.addEventListener('pointerup',up);canvasEl.addEventListener('pointercancel',cancel);
    document.addEventListener('visibilitychange',visibility);
    return ()=>{ro.disconnect();io.disconnect();cancelAnimationFrame(frame);redraw.current=()=>{};canvasEl.removeEventListener('pointerdown',down);canvasEl.removeEventListener('pointermove',move);canvasEl.removeEventListener('pointerup',up);canvasEl.removeEventListener('pointercancel',cancel);document.removeEventListener('visibilitychange',visibility);};
  },[motion]);
  useEffect(()=>{redraw.current();},[selected]);
  return <canvas className="passage-chart-canvas" ref={canvas} role="img" aria-label={ar?'مجسم المرفأ. اختر إحدى الوجهات من الأزرار المجاورة.':'Harbour relief. Choose a destination with the adjacent buttons.'}/>;
}
