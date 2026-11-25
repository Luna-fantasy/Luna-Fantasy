'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { mountChapterMotion } from './chapter-motion';
import { mountRoseDetails } from './rose-details';
import { mountReadingMotion, mountCatalogDeals } from './reading-motion';
import { useNightMotion } from '../NightProjection';
import { mountSceneFinishing } from '../finishing-transitions';
import { useEditMode } from '@/lib/edit-mode/context';

const shelfTargets = [
  '[data-release-card]', '[data-card-id]', '[data-inspection-face]', '.merchant-card', '.luckbox-card',
  '.ticket-card', '.gem-box-card', '.brimor-card', '.mells-card', '.pa6-plaque', '.c6-tab',
  '.showcase-media .media-frame', '.feature-card', '.faq-item', 'footer .footer-links a', 'footer .footer-legal a', '.salary-card', '.service-card', '.loan-tier', '.game-card', '.tier-card', '.marketplace-card',
  'main a[class*="btn"]', 'main button:not(:disabled)', '.hero-cta a', '.footer-socials a'
].join(',');
const heroTargets = '.bazaar-hero, .bank-hero, .partners-hero, .characters-hero, .hero, .trading-hero, .showcase-media';

export function WorldMotion() {
  const pathname = usePathname();
  const { editMode } = useEditMode();
  const allowed = useNightMotion();
  const meter = useRef<HTMLDivElement>(null);
  const route = useRef<HTMLDivElement>(null);
  const light = useRef<HTMLDivElement>(null);
  const sun = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pulse = route.current, glass = light.current, cast = sun.current;
    const root = pulse?.closest<HTMLElement>('[data-luna-shell="cinematic"]');
    if (!root || !pulse || !glass || !cast || !meter.current) return;
    const stopFinishing = mountSceneFinishing(root, pulse, pathname || '/', allowed && !editMode);
    if (editMode || !allowed) return stopFinishing;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const stopReading = mountReadingMotion(root, meter.current, preference);
    const stopDeals = mountCatalogDeals(root, preference);
    const stopDetails = mountRoseDetails(root);
    const stopChapter = mountChapterMotion(root, pathname || '/');
    let frame = 0, timeout = 0;
    let surface: HTMLElement | null = null, scene: HTMLElement | null = null;
    let x = 0, y = 0, keyboard = false;
    const controller = new AbortController(), opts = { passive: true, signal: controller.signal };
    function resetScene() {
      cast!.removeAttribute('data-cast');
      if (!scene) return;
      scene.style.removeProperty('--luna-scene-x');
      scene.style.removeProperty('--luna-scene-y');
      scene.removeAttribute('data-directed-light');
      scene.style.removeProperty('--luna-frame-tilt');
      scene = null;
    }
    function clear() {
      cancelAnimationFrame(frame);
      frame = 0;
      surface = null;
      glass!.removeAttribute('data-lit');
      resetScene();
    }
    function draw() {
      frame = 0;
      if (preference.matches || document.hidden) return clear();
      if (surface?.isConnected) {
        const r = surface.getBoundingClientRect();
        const px = keyboard ? .5 : Math.min(1, Math.max(0, (x - r.x) / Math.max(1, r.width)));
        const py = keyboard ? .5 : Math.min(1, Math.max(0, (y - r.y) / Math.max(1, r.height)));
        glass!.style.width = r.width + 'px';
        glass!.style.height = r.height + 'px';
        glass!.style.transform = 'translate3d(' + r.left + 'px,' + r.top + 'px,0)';
        glass!.style.borderRadius = getComputedStyle(surface).borderRadius;
        glass!.style.setProperty('--glass-x', (px * 100).toFixed(1) + '%');
        glass!.style.setProperty('--glass-y', (py * 100).toFixed(1) + '%');
        glass!.style.setProperty('--glass-angle', (100 + px * 38 - py * 12).toFixed(1) + 'deg');
        glass!.dataset.lit = keyboard ? 'focus' : 'pointer';
      } else glass!.removeAttribute('data-lit');
      if (scene?.isConnected) {
        const r = scene.getBoundingClientRect();
        scene.style.setProperty('--luna-scene-x', (Math.max(-1, Math.min(1, (x - r.left) / r.width * 2 - 1)) * 6).toFixed(2) + 'px');
        scene.style.setProperty('--luna-scene-y', (Math.max(-1, Math.min(1, (y - r.top) / r.height * 2 - 1)) * 4).toFixed(2) + 'px');
        if (scene.classList.contains('showcase-media')) {
          const u = Math.max(-1,Math.min(1,(x-r.x)/r.width*2-1)), v = Math.max(-1,Math.min(1,(y-r.y)/r.height*2-1));
          const tilt = Math.min(1,Math.hypot(u,v))*4.6;
          scene.style.setProperty('--luna-frame-tilt', (-v).toFixed(2)+' '+(u||.01).toFixed(2)+' 0 '+tilt.toFixed(2)+'deg');
        }
        scene.dataset.directedLight = 'on';
        cast!.style.width = r.width + 'px';
        cast!.style.height = r.height + 'px';
        cast!.style.transform = 'translate3d('+r.x+'px,'+r.y+'px,0)';
        cast!.style.setProperty('--cast-x', ((x-r.x)/r.width*100).toFixed(1)+'%');
        cast!.style.setProperty('--cast-y', ((y-r.y)/r.height*100).toFixed(1)+'%');
        cast!.dataset.cast = scene.matches('.bazaar-hero') ? 'market' : scene.matches('.bank-hero') ? 'vault' : 'archive';
      }
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
    function target(event: PointerEvent) {
      if (!event.isPrimary || preference.matches || !(event.target instanceof Element)) return;
      const element = event.target;
      if (element.closest('dialog[open],[role="dialog"],form,input,textarea,select,[contenteditable="true"]')) { clear(); return; }
      if (event.pointerType !== 'mouse' && event.type === 'pointermove') return;
      const next = element.closest<HTMLElement>(shelfTargets);
      surface = next && root!.contains(next) ? next : null;
      const hero = (event.pointerType === 'mouse' || event.pointerType === 'pen' || event.type === 'pointerdown') ? element.closest<HTMLElement>(heroTargets) : null;
      if (hero !== scene) { resetScene(); scene = hero; }
      keyboard = false; x = event.clientX; y = event.clientY;
      if (surface || scene || glass!.hasAttribute('data-lit')) schedule();
    }
    function endTouch(event: PointerEvent) {
      if (event.pointerType === 'mouse') return;
      window.clearTimeout(timeout);timeout = window.setTimeout(clear, 190);
    }
    function focus(event: FocusEvent) {
      const node = event.target;
      if (!(node instanceof HTMLElement) || !node.matches(':focus-visible') || node.closest('dialog,[role="dialog"],form')) return;
      const next = node.closest<HTMLElement>(shelfTargets);
      if (!next || !root!.contains(next)) return;
      resetScene();surface = next;keyboard = true;schedule();
    }
    root.addEventListener('pointermove', target as EventListener, opts);
    root.addEventListener('pointerdown', target as EventListener, opts);
    root.addEventListener('pointerleave', clear, opts);
    root.addEventListener('focusin', focus as EventListener, opts);
    root.addEventListener('focusout', clear, opts);
    window.addEventListener('pointerup', endTouch, opts);
    window.addEventListener('pointercancel', clear, opts);
    function scroll() {
      if (keyboard) { if(surface) schedule(); return; }
      const at = document.elementFromPoint(x, y);
      if (surface && !surface.contains(at)) surface = null;
      if (scene && !scene.contains(at)) resetScene();
      if (surface || scene || glass!.hasAttribute('data-lit')) schedule();
    }
    window.addEventListener('scroll', scroll, opts);
    window.addEventListener('resize', clear, opts);
    window.addEventListener('pagehide', clear, opts);
    const pause = () => { if (document.hidden || preference.matches) clear(); };
    document.addEventListener('visibilitychange',pause,opts);
    preference.addEventListener('change',pause,opts);
    return () => {
      stopFinishing();
      stopDetails();
      stopChapter();
      stopReading();
      stopDeals();
      controller.abort();
      clear();
      window.clearTimeout(timeout);
    };
  }, [allowed, editMode, pathname]);
  return <><div ref={meter} aria-hidden="true" className="luna-reading-progress" /><div ref={sun} aria-hidden="true" className="luna-scene-caustic" /><div ref={light} aria-hidden="true" className="luna-surface-light" />
    <div ref={route} aria-hidden="true" className="luna-finish-mark"><i /></div></>;
}
