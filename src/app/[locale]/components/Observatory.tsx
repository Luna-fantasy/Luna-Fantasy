'use client';
import { useEffect, useRef, useState } from 'react';
import { mountHarbourReflection } from '@/lib/cinematic/harbour-reflection';
import { Astrolabe } from './Astrolabe';
import { createFrameClock, perFrame } from '@/lib/cinematic/getlayers-frame';
import { useLocale } from 'next-intl';
const plates = '/luna-cinematic/home-story/observatory';
const landmarks = [
    { en: 'Harbour', ar: 'المرفأ', x: 0.18, y: 0.68 },
    { en: 'Citadel', ar: 'القلعة', x: 0.43, y: 0.42 },
    { en: 'Observatory', ar: 'المرصد', x: 0.86, y: 0.34 },
];
// Each brass band is a circle in its own plane. Project its circumference
// through the same camera and paint segments back-to-front at their true depth.
function drawInstrument(canvas: HTMLCanvasElement, yaw: number, pitch: number) {
    const size = Math.min(300, Math.round((canvas.clientWidth || 76) * Math.min(2, window.devicePixelRatio || 1)));
    if (size < 1)
        return;
    if (canvas.width !== size)
        canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return;
    ctx.clearRect(0, 0, size, size);
    const segments: {
        near: number;
        x: number;
        y: number;
        ex: number;
        ey: number;
        band: number;
    }[] = [];
    for (let band = 0; band < 4; band++) {
        const tilt = [.16, 1.12, 1.49, .78][band], axis = [-.4, .08, 1.4, -1.02][band];
        let before: number[] | undefined;
        for (let step = 0; step <= 84; step++) {
            const a = step * Math.PI * 2 / 84, radius = 1 - band * .055;
            const u = Math.cos(a) * radius, v = Math.sin(a) * radius;
            const vx = u * Math.cos(axis) - v * Math.cos(tilt) * Math.sin(axis);
            const vy = u * Math.sin(axis) + v * Math.cos(tilt) * Math.cos(axis);
            const vz = v * Math.sin(tilt);
            const x = vx * Math.cos(yaw) + vz * Math.sin(yaw), z0 = -vx * Math.sin(yaw) + vz * Math.cos(yaw);
            const y = vy * Math.cos(pitch) - z0 * Math.sin(pitch), z = vy * Math.sin(pitch) + z0 * Math.cos(pitch);
            const scale = size * .385 / (1 - z * .14);
            const point = [size / 2 + x * scale, size / 2 - y * scale, z];
            if (before)
                segments.push({ near: (before[2] + z) / 2, x: before[0], y: before[1], ex: point[0], ey: point[1], band });
            before = point;
        }
    }
    for (const seg of segments.sort((a, b) => a.near - b.near)) {
        const light = Math.round(34 + 43 * (seg.near + 1) / 2 + 8 * (1 - seg.y / size));
        ctx.strokeStyle = 'hsl(' + (seg.band === 2 ? 38 : 18) + ' 45% ' + light + '%)';
        ctx.lineWidth = size * (seg.band === 0 ? .022 : .014);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(seg.x, seg.y);
        ctx.lineTo(seg.ex, seg.ey);
        ctx.stroke();
    }
}
export function Observatory() {
    const ar = useLocale() === 'ar';
    const [selected, select] = useState(1);
    const gesture = useRef<{
        x: number;
        y: number;
    } | null>(null);
    function choose(index: number) { select(index); if (root.current)
        root.current.dataset.aiming = 'true'; }
    const root = useRef<HTMLDivElement>(null);
    const instrument = useRef<HTMLCanvasElement>(null);
    const aim = useRef(1);
    const animate = useRef<() => void>(() => { });
    useEffect(() => { aim.current = selected; animate.current(); }, [selected]);
    useEffect(() => {
        const node = root.current, dial = instrument.current, hero = node?.closest<HTMLElement>('.hero');
        if (!hero || !node || !dial)
            return;
        const water = node.querySelector<HTMLCanvasElement>('.observatory-water'), photo = node.querySelector<HTMLImageElement>('.observatory-city');
        const stopWater = water && photo ? mountHarbourReflection(water, photo, node) : () => { };
        const media = matchMedia('(prefers-reduced-motion: reduce)');
        const clock = createFrameClock();
        let visible = true, frame = 0, mx = 0, my = 0, x = 0, y = 0, focus = 1;
        function draw(now: number) {
            frame = 0;
            if (!node || !dial || !visible)
                return;
            const { dt } = clock.tick(now);
            const ease = media.matches ? 1 : perFrame(.115, dt);
            focus += (aim.current - focus) * ease;
            x += (mx - x) * ease;
            y += (my - y) * ease;
            const lower = Math.max(0, Math.min(1, Math.floor(focus)));
            const fraction = focus - lower;
            const lx = landmarks[lower].x * (1 - fraction) + landmarks[lower + 1].x * fraction;
            const ly = landmarks[lower].y * (1 - fraction) + landmarks[lower + 1].y * fraction;
            node.style.setProperty('--look-x', (lx * 100).toFixed(2) + '%');
            node.style.setProperty('--look-y', (ly * 100).toFixed(2) + '%');
            node.style.setProperty('--sky-x', ((.43 - lx) * 8 + x * 1.12).toFixed(3) + '%');
            node.style.setProperty('--sky-y', (y * .76).toFixed(3) + '%');
            node.style.setProperty('--glass-x', (-x * 15).toFixed(2) + 'px');
            node.style.setProperty('--glass-y', (-y * 9).toFixed(2) + 'px');
            const area = node.querySelector<HTMLElement>('picture');
            if (area) {
                const w = area.clientWidth, h = area.clientHeight;
                const scale = 1.085 + Math.abs(focus - 1) * .112;
                const fit = Math.max(w / 3840, h / 2160), ih = fit * 2160;
                const pan = (.43 - lx) * .08 + x * .0112;
                const screenX = w * (lx + pan);
                const screenY = ((h - ih) * .49 + ih * ly - h * ly) * scale + h * ly + h * y * .0076;
                node.style.setProperty('--photo-scale', scale.toFixed(4));
                node.style.setProperty('--sight-x', screenX.toFixed(1) + 'px');
                node.style.setProperty('--sight-y', screenY.toFixed(1) + 'px');
            }
            drawInstrument(dial, -.42 + focus * .64 + x * .22, .21 + y * .16);
            if (Math.abs(focus - aim.current) + Math.abs(x - mx) + Math.abs(y - my) > .002)
                schedule();
            else
                clock.reset();
        }
        function schedule() { if (visible && !frame)
            frame = requestAnimationFrame(draw); }
        function point(e: PointerEvent) {
            if (!hero || media.matches || e.pointerType === 'touch')
                return;
            const box = hero.getBoundingClientRect();
            mx = Math.max(-1, Math.min(1, (e.clientX - box.left) / box.width * 2 - 1));
            my = Math.max(-1, Math.min(1, (e.clientY - box.top) / box.height * 2 - 1));
            schedule();
        }
        function reset() { mx = my = 0; schedule(); }
        const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) {
            clock.reset();
            schedule();
        } });
        io.observe(hero);
        const resize = new ResizeObserver(schedule);
        resize.observe(node);
        animate.current = schedule;
        hero.addEventListener('pointermove', point, { passive: true });
        hero.addEventListener('pointerleave', reset);
        media.addEventListener('change', reset);
        schedule();
        return () => { stopWater(); cancelAnimationFrame(frame); io.disconnect(); resize.disconnect(); hero.removeEventListener('pointermove', point); hero.removeEventListener('pointerleave', reset); media.removeEventListener('change', reset); animate.current = () => { }; };
    }, []);
    return <div ref={root} className="observatory" data-landmark={selected}>
    <div className="observatory-view" aria-hidden="true">
      <picture><img className="observatory-city" src={plates + '/atlas-dusk-1600.webp'} srcSet={[960, 1600, 2560, 3840].map(w => plates + '/atlas-dusk-' + w + '.webp ' + w + 'w').join(', ')} sizes="100vw" width="3840" height="2160" alt="" fetchPriority="high"/></picture>
      <canvas className="observatory-water" aria-hidden="true"/>
      <div className="observatory-glass"/>
      <div className="observatory-sights"><i /></div>
      <div className="observatory-shade"/>
    </div>
    <div className="observatory-pan" aria-hidden="true" onPointerDown={e => {
            if (e.button !== 0)
                return;
            gesture.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
        }} onPointerCancel={() => { gesture.current = null; }} onPointerUp={e => {
            const start = gesture.current;
            gesture.current = null;
            if (!start)
                return;
            const dx = e.clientX - start.x, dy = e.clientY - start.y;
            if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.35)
                choose(Math.max(0, Math.min(2, selected + (dx < 0 ? 1 : -1))));
        }}/>
    <div className="observatory-dock" role="group" aria-label={ar ? 'معالم مدينة لونا' : 'Landmarks of Luna'}>
      <Astrolabe ar={ar} dial={instrument}/>
      <div className="observatory-presets">{landmarks.map((place, i) => <button key={place.en} type="button" aria-pressed={i === selected} onClick={() => choose(i)}>{ar ? place.ar : place.en}</button>)}</div>
    </div>
  </div>;
}
