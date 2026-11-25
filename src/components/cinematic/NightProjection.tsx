'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import '@/styles/luna-night-projection.css';

export type NightScene = 'passage' | 'characters' | 'partners' | 'story' | 'members' | 'bank' | 'bazaar' | 'trading';

const preferenceKey = 'luna:night-films';
const motionEvent = 'luna:night-film-preference';
let sessionPreference: string | null;

function motionAllowed() {
  try { sessionPreference = window.localStorage.getItem(preferenceKey); } catch { /* private browsing */ }
  if (sessionPreference === 'off') return false;
  if (sessionPreference === 'on') return true;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function subscribe(notify: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', notify);
  window.addEventListener(motionEvent, notify);
  window.addEventListener('storage', notify);
  return () => {
    media.removeEventListener('change', notify);
    window.removeEventListener(motionEvent, notify);
    window.removeEventListener('storage', notify);
  };
}
export function useNightMotion() { return useSyncExternalStore(subscribe, motionAllowed, () => false); }

export function NightFilmSwitch({ ar }: { ar: boolean }) {
  const allowed = useNightMotion();
  const label = allowed ? (ar ? 'إيقاف المشاهد المتحركة' : 'Pause scene films') : (ar ? 'تشغيل المشاهد المتحركة' : 'Play scene films');
  function toggle() {
    sessionPreference = allowed ? 'off' : 'on';
    try { window.localStorage.setItem(preferenceKey, sessionPreference); } catch { /* keep this tab's setting */ }
    window.dispatchEvent(new Event(motionEvent));
  }
  return <button type="button" className="night-film-switch" aria-label={label} title={label} onClick={toggle}>
    <span aria-hidden="true" className={allowed ? 'night-pause-sign' : 'night-play-sign'} />
    <span>{allowed ? (ar ? 'إيقاف الحركة' : 'Pause motion') : (ar ? 'تشغيل الحركة' : 'Play motion')}</span>
  </button>;
}

export function NightProjection({ scene, className = '', position = '50% 50%', priority = false }:
  { scene: NightScene; className?: string; position?: string; priority?: boolean }) {
  const root = useRef<HTMLSpanElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const [showing, setShowing] = useState(false);
  const allowed = useNightMotion();
  const base = '/luna-cinematic/night-worlds/' + scene;
  useEffect(() => {
    const el = root.current, video = player.current;
    if (!el || !video) return;
    let intersects = false, disposed = false, revision = 0, fallback = false;
    const compact = matchMedia('(max-width: 740px)');
    setShowing(false);
    const canFetch = !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    function sync() {
      if (!el || !video || disposed) return;
      const active = allowed && canFetch && intersects && !document.hidden;
      revision += 1;
      const request = revision;
      if (!active) { video.pause(); setShowing(false); return; }
      const source = !fallback && video.canPlayType('video/webm')
        ? base + (compact.matches ? '-mobile.webm' : '-screen.webm') : base + '.mp4';
      if (video.getAttribute('src') !== source) video.setAttribute('src', source);
      video.play().then(() => {
        if (!disposed && request === revision && !video.paused) setShowing(true);
      }).catch(() => { if (!disposed && request === revision) setShowing(false); });
    }
    const io = new IntersectionObserver(([entry]) => { intersects = entry.isIntersecting; sync(); });
    io.observe(el);
    document.addEventListener('visibilitychange', sync);
    const resize = () => { fallback = false; sync(); };
    compact.addEventListener('change', resize);
    const failed = () => {
      setShowing(false);
      if (!fallback && video.getAttribute('src')?.endsWith('.webm')) { fallback = true; sync(); }
    };
    video.addEventListener('error', failed);
    return () => {
      disposed = true;
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      compact.removeEventListener('change', resize);
      video.removeEventListener('error', failed);
      video.pause();
    };
  }, [base, allowed]);
  return <span ref={root} aria-hidden="true" className={'night-projection ' + className} data-scene={scene}
    data-film={showing ? 'playing' : 'poster'} style={{ '--night-framing': position } as CSSProperties}>
    <img src={base + '-1920.webp'} srcSet={base + '-960.webp 960w, ' + base + '-1920.webp 1920w' + (scene === 'passage' ? ', ' + base + '-3840.webp 3840w' : '')}
      sizes="100vw" width="1920" height="1080" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} alt="" decoding="async" />
    <video key={scene} ref={player} preload="none" muted loop playsInline disablePictureInPicture aria-hidden="true" />
  </span>;
}
