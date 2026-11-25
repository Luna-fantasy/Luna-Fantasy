import cues from './finishing-cues.json';
import './finishing-transitions.css';

type Cue = (typeof cues.routes)[keyof typeof cues.routes];
type Mark = keyof typeof cues.marks;
const easing = 'cubic-bezier(' + cues.easing.join(',') + ')';
const activation = 'a[href],summary,button[aria-pressed],button[aria-expanded],[role="tab"]';
const protectedAreas = 'dialog,[role="dialog"],form,footer,#alliance-letter,[data-live-folio],.night-film-switch,[data-photo-inspector]';
const routeCues: Record<string, Cue> = cues.routes;

function routeSlug(pathname: string) {
  return pathname.split('/').filter(Boolean).slice(1).join('/') || 'home';
}

function sceneLayer(shell: HTMLElement, slug: string): HTMLElement | null {
  const expected: Record<string, string> = {home:'passage',characters:'characters',members:'members',partners:'partners',story:'story',bank:'bank',bazaar:'bazaar',trading:'trading'};
  let selector: string;
  if (expected[slug]) {
    selector = '.night-projection[data-scene="' + expected[slug] + '"]';
  } else if (slug.startsWith('bazaar/')) {
    selector = '[data-night-shop] [class*="shopPortrait"] > img';
  } else if (['about','faq','contact','privacy','terms','refund'].includes(slug)) {
    selector = '[data-luna-motif="' + slug + '"]';
  } else {
    return null;
  }
  const candidates = shell.querySelectorAll<HTMLElement>(selector);
  for (const item of Array.from(candidates)) {
    if (item.closest('footer,dialog,[role="dialog"],[hidden]')) continue;
    const box = item.getBoundingClientRect();
    if (box.width < 120 || box.height < 70 || box.bottom <= 0 || box.top >= innerHeight) continue;
    if (item instanceof HTMLImageElement && (!item.complete || !item.naturalWidth)) continue;
    const image = item.querySelector('img');
    if (image && (!image.complete || !image.naturalWidth)) continue;
    return item;
  }
  return null;
}

function selection(control: HTMLElement) {
  if (control.tagName === 'SUMMARY') return String(control.closest('details')?.open);
  return control.getAttribute('aria-selected') ?? control.getAttribute('aria-pressed') ?? control.getAttribute('aria-expanded');
}

export function mountSceneFinishing(shell: HTMLElement, marker: HTMLElement, pathname: string, enabled: boolean) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const forced = matchMedia('(forced-colors: active)');
  const events = new AbortController();
  const passive = {passive: true, signal: events.signal};
  const slug = routeSlug(pathname);
  const cue = routeCues[slug];
  const markerDrawing = marker.firstElementChild as HTMLElement;
  let mark: Animation | undefined;
  let camera: Animation | undefined;
  let frame = 0;
  let selectionFrame = 0;
  let observer: MutationObserver | undefined;
  let timer = 0;
  const canMove = () => enabled && !reduced.matches && !forced.matches && !document.hidden;

  function hideMark() {
    mark?.cancel();
    mark = undefined;
    delete marker.dataset.mark;
  }
  function clear() {
    hideMark();
    camera?.cancel();
    camera = undefined;
    cancelAnimationFrame(frame);
    cancelAnimationFrame(selectionFrame);
    frame = 0;
    selectionFrame = 0;
  }
  function sync() {
    shell.dataset.lunaFinishingMotion = canMove() ? 'on' : 'off';
    if (!canMove()) clear();
  }
  function drawMark(target: HTMLElement, style: Cue) {
    if (!canMove() || !target.isConnected || !markerDrawing.animate) return;
    const b = target.getBoundingClientRect();
    if (b.width < 10 || b.height < 10 || b.bottom <= 0 || b.top >= innerHeight || b.left >= innerWidth || b.right <= 0) return;
    hideMark();
    const kind = style.mark as Mark;
    marker.dataset.mark = kind;
    marker.style.width = b.width + 'px';
    marker.style.height = b.height + 'px';
    marker.style.transform = 'translate(' + b.left + 'px,' + b.top + 'px)';
    marker.style.setProperty('--finish-ink', style.ink);
    const starts = kind === 'margin' ? ['1 .3','1 1'] : kind === 'register' ? ['.88 .78','1 1'] : ['.16 1','1 1'];
    markerDrawing.style.transformOrigin = kind === 'margin' ? 'center 13%' : getComputedStyle(target).direction === 'rtl' ? 'right center' : 'left center';
    const film = markerDrawing.animate([
      {scale: starts[0], opacity: .48},
      {scale: starts[1], opacity: .9, offset: .66},
      {scale: starts[1], opacity: 0}
    ], {duration: cues.marks[kind], easing});
    mark = film;
    film.id = 'luna-finish-' + kind;
    void film.finished.then(() => { if (mark === film) hideMark(); }, () => {});
  }
  function moveScene(layer: HTMLElement, style: Cue) {
    if (!canMove() || !layer.animate || !style.duration) return;
    camera?.cancel();
    const film = layer.animate([
      {translate: style.x + '% ' + style.y + '%', scale: String(style.scale)},
      {translate: '0% 0%', scale: '1'}
    ], {duration: style.duration, easing});
    camera = film;
    film.id = 'luna-finish-camera-' + slug.replace(/\//g, '-');
    void film.finished.then(() => { if (camera === film) camera = undefined; }, () => {});
  }
  function stopWaiting() {
    observer?.disconnect();
    observer = undefined;
    window.clearTimeout(timer);
    shell.removeEventListener('load', awaitArt, true);
  }
  function awaitArt() {
    if (frame || !cue || !canMove()) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const layer = sceneLayer(shell, slug);
      if (!layer) return;
      stopWaiting();
      moveScene(layer, cue);
    });
  }
  function activate(event: MouseEvent | KeyboardEvent) {
    if (!cue || !canMove() || !(event.target instanceof Element) || event.defaultPrevented || event.target.closest(protectedAreas)) return;
    const keyboard = event instanceof KeyboardEvent;
    if (keyboard && !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    if (!keyboard && (event.button !== 0 || event.ctrlKey || event.altKey || event.shiftKey || event.metaKey)) return;
    const control = event.target.closest<HTMLElement>(activation);
    if (!control || !shell.contains(control) || control.matches(':disabled,[aria-disabled="true"]')) return;
    if (control instanceof HTMLAnchorElement) {
      const destination = new URL(control.href, location.href);
      if (destination.origin !== location.origin || control.hasAttribute('download') || (control.target && control.target !== '_self')) return;
      const destinationCue = routeCues[routeSlug(destination.pathname)] || cue;
      drawMark(control, destinationCue);
      return;
    }
    const before = selection(control);
    cancelAnimationFrame(selectionFrame);
    selectionFrame = requestAnimationFrame(() => {
      selectionFrame = 0;
      const selected = keyboard && document.activeElement instanceof HTMLElement ? document.activeElement : control;
      if (selected === control && selection(selected) === before) return;
      drawMark(selected, cue);
    });
  }

  sync();
  reduced.addEventListener('change', sync, passive);
  forced.addEventListener('change', sync, passive);
  document.addEventListener('visibilitychange', sync, passive);
  if (enabled && cue) {
    if (canMove() && cue.duration) {
      observer = new MutationObserver(awaitArt);
      observer.observe(shell, {childList:true,subtree:true});
      shell.addEventListener('load', awaitArt, {capture:true,signal:events.signal});
      timer = window.setTimeout(stopWaiting, 1200);
      awaitArt();
    }
    shell.addEventListener('click', activate as EventListener, {capture:true,signal:events.signal});
    shell.addEventListener('keydown', activate as EventListener, {capture:true,signal:events.signal});
    window.addEventListener('scroll', hideMark, {capture:true,passive:true,signal:events.signal});
    window.addEventListener('resize', clear, passive);
    window.addEventListener('pagehide', clear, passive);
  }
  return () => {
    events.abort();
    stopWaiting();
    clear();
    delete shell.dataset.lunaFinishingMotion;
  };
}

