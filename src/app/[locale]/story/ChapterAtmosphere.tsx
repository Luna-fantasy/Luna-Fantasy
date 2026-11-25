'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import s from './FolioMotion.module.css';

export const harbourFilm = '/luna-cinematic/home-story/story/lunvor-harbour-c881b497.mp4';
export const harbourPoster = '/luna-cinematic/home-story/story/lunvor-harbour-c881b497.webp';

export function departureImage(mount: HTMLDivElement, plate: HTMLImageElement) {
  const still = plate.currentSrc || plate.src;
  const video = mount.querySelector<HTMLVideoElement>('video[data-harbour-cutaway]');
  if (!video || video.readyState < 2 || !video.videoWidth) return still;
  const opacity = Number(getComputedStyle(video).opacity);
  if (opacity < .03) return still;
  // Preserve the actual film frame and its letterboxing when a reader turns mid-cutaway.
  const frame = document.createElement('canvas');
  frame.width = Math.min(960,plate.naturalWidth);
  frame.height = Math.round(frame.width*plate.naturalHeight/plate.naturalWidth);
  const brush = frame.getContext('2d');
  if (!brush) return still;
  try {
    brush.drawImage(plate,0,0,frame.width,frame.height);
    brush.globalAlpha=opacity;
    brush.fillStyle='#17151b';
    brush.fillRect(0,0,frame.width,frame.height);
    const scale=Math.min(frame.width/video.videoWidth,frame.height/video.videoHeight);
    const width=video.videoWidth*scale,height=video.videoHeight*scale;
    brush.drawImage(video,(frame.width-width)/2,(frame.height-height)/2,width,height);
    return frame.toDataURL('image/webp',.87);
  } catch { return still; }
}

const cinders = [
  [24.9, 45, 4, .2], [26.7, 44, -5, 1.9], [25.5, 42, 2, 3.1],
  [23.4, 45, -4, 4.2], [76.2, 44, -4, 1], [74.8, 46, 2, 2.4],
  [77.1, 43, 5, 3.7], [75.7, 42, -2, 4.8],
];

export function ChapterAtmosphere({ chapter, animated }: { chapter: number; animated: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const reel = useRef<HTMLVideoElement>(null);
  const seen = useRef(false);
  const [running, setRunning] = useState(false);
  const [showShot, setShowShot] = useState(false);
  const cue = chapter===1 ? 'tide' : chapter===2 ? 'ash' : 'rays';

  useEffect(() => {
    const element = frame.current;
    if (!element || !animated) return;
    let onScreen = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setRunning(onScreen && !document.hidden && !reduced.matches);
    const observer = new IntersectionObserver(entries => {
      onScreen = entries[0]?.isIntersecting ?? false;
      sync();
    }, { threshold: .15 });
    observer.observe(element);
    document.addEventListener('visibilitychange',sync);
    reduced.addEventListener('change',sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange',sync);
      reduced.removeEventListener('change',sync);
    };
  },[animated]);

  useEffect(() => {
    const video = reel.current;
    const saveData=(navigator as Navigator & {connection?:{saveData?:boolean}}).connection?.saveData;
    if (!video || !animated || !running || seen.current || saveData) return;
    let cancelled = false;
    // A short cutaway introduces the harbour. Its registered painted plate then returns.
    if (!video.getAttribute('src')) video.src = harbourFilm;
    const stop = () => {
      if (cancelled) return;
      seen.current = true;
      setShowShot(false);
      video.pause();
    };
    const elapsed = () => { if (video.currentTime >= 4.8) stop(); };
    const playing = () => { if (!cancelled) setShowShot(true); };
    video.addEventListener('playing',playing);
    video.addEventListener('timeupdate',elapsed);
    video.addEventListener('ended',stop);
    void video.play().catch(() => { if (!cancelled) setShowShot(false); });
    return () => {
      cancelled = true;
      video.removeEventListener('playing',playing);
      video.removeEventListener('timeupdate',elapsed);
      video.removeEventListener('ended',stop);
      video.pause();
      setShowShot(false);
    };
  },[animated,running]);

  return <div ref={frame} aria-hidden="true" className={s.atmosphere}
    data-scene-cue={cue} data-running={animated && running || undefined}>
    {chapter===1 && <>
      <i className={s.tide}/><i className={s.falls}/>
      {animated && <video ref={reel} className={s.cutaway} data-harbour-cutaway=""
        data-showing={showShot || undefined} poster={harbourPoster} muted playsInline preload="none" />}
    </>}
    {chapter===2 && <>
      <i className={s.torchlight}/><i className={s.vapour}/>
      {cinders.map(([x,y,drift,delay]) => <i className={s.ember} key={delay} style={{
        '--x':x+'%', '--y':y+'%', '--drift':drift+'px', '--delay':-delay+'s',
      } as CSSProperties}/>)}
    </>}
    {chapter===3 && <><i className={s.rayOne}/><i className={s.rayTwo}/><i className={s.rayDust}/></>}
  </div>;
}
