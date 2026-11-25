'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
const path = '/luna-cinematic/home-story/observatory/';
export function Astrolabe({ ar, dial }: {
    ar: boolean;
    dial: RefObject<HTMLCanvasElement>;
}) {
    const [open, setOpen] = useState(false), [playing, setPlaying] = useState(false), [position, setPosition] = useState(0);
    const video = useRef<HTMLVideoElement>(null), trigger = useRef<HTMLButtonElement>(null), shell = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open)
            return;
        const node = video.current;
        if (!node)
            return;
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
            void node.play().catch(() => { });
        const close = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') {
            setOpen(false);
            trigger.current?.focus({ preventScroll: true });
        } };
        const outside = (e: PointerEvent) => { if (e.target instanceof Node && !shell.current?.contains(e.target))
            setOpen(false); };
        const offscreen = new IntersectionObserver(([e]) => { if (!e.isIntersecting)
            setOpen(false); });
        if (shell.current)
            offscreen.observe(shell.current);
        document.addEventListener('keydown', close);
        document.addEventListener('pointerdown', outside);
        return () => { offscreen.disconnect(); document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', outside); };
    }, [open]);
    function scrub(value: number) { const v = video.current; if (!v || !Number.isFinite(v.duration))
        return; v.pause(); v.currentTime = value * v.duration / 100; setPosition(value); }
    return <div className="astrolabe" ref={shell}>
    <button type="button" className="astrolabe-trigger" ref={trigger} aria-expanded={open} aria-label={ar ? 'افحص الإسطرلاب' : 'Inspect the astrolabe'} title={ar ? 'افحص الإسطرلاب' : 'Inspect the astrolabe'} onClick={() => { setPosition(0); setOpen(!open); }}>
      <canvas ref={dial} aria-hidden="true"/>
    </button>
    {open && <div className="astrolabe-detail" role="group" aria-label={ar ? 'حركة الإسطرلاب' : 'Astrolabe movement'}>
      <video ref={video} muted playsInline preload="metadata" poster={path + 'armillary-poster.webp'} src={path + 'armillary-rose.webm'} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={e => { const v = e.currentTarget; if (v.duration)
            setPosition(100 * v.currentTime / v.duration); }}/>
      <div className="astrolabe-controls">
        <button type="button" aria-label={ar ? (playing ? 'إيقاف الحركة' : 'تشغيل الحركة') : (playing ? 'Pause movement' : 'Play movement')} onClick={() => { const v = video.current; if (!v)
            return; if (playing)
            v.pause();
        else
            void v.play().catch(() => { }); }}>{playing ? 'Ⅱ' : '▷'}</button>
        <input type="range" min="0" max="100" step=".2" value={position} aria-label={ar ? 'زاوية الإسطرلاب' : 'Astrolabe angle'} onChange={e => scrub(Number(e.target.value))}/>
        <button type="button" aria-label={ar ? 'إغلاق المكبّر' : 'Close detail'} onClick={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }}>×</button>
      </div>
    </div>}
  </div>;
}
