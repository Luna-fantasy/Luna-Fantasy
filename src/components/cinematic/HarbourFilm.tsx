'use client';

import { useEffect, useRef, useState } from 'react';
import type { HarbourFilmName } from '@/lib/cinematic/section-window';
import styles from './SectionWindow.module.css';

const smallDisplay = '(max-width: 767px)';
const largeDisplay = '(min-width: 2000px), (min-width: 1050px) and (min-resolution: 1.6dppx)';
const sceneDialogChange = 'luna:section-art-dialog';

export function notifySceneDialogChange() {
  document.dispatchEvent(new Event(sceneDialogChange));
}

function candidates(base: string, stem: string, widths: number[]) {
  return widths.map(width => base + stem + '-' + width + '.webp ' + width + 'w').join(', ');
}

export function HarbourFilm({ name, poster, running, priority }: {
  name: HarbourFilmName;
  poster: string;
  running: boolean;
  priority: boolean;
}) {
  const base = '/luna-cinematic/harbour-films/' + name + '/';
  const quay = name === 'quayside';
  const filmExtension = quay || name === 'night-market' ? '.mp4?cut=2' : '.mp4';
  const player = useRef<HTMLVideoElement>(null);
  const [hasFrame, setHasFrame] = useState(false);
  useEffect(() => {
    const video = player.current;
    if (!video) return;
    const small = matchMedia(smallDisplay);
    const large = matchMedia(largeDisplay);
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let current = true;
    function sync() {
      if (!video) return;
      const rendition = quay ? small.matches ? 'mobile' : large.matches ? 'wide' : 'wide-hd' : 'scene';
      const url = base + rendition + filmExtension;
      const previous = video.getAttribute('src');
      const inspecting = document.querySelector('dialog[data-section-art-dialog][open]');
      if (!running || document.hidden || connection?.saveData || inspecting) {
        video.pause();
        if (previous && previous !== url) {
          setHasFrame(false);
          video.removeAttribute('src');
          video.load();
        }
        return;
      }
      if (previous !== url) {
        setHasFrame(false);
        video.setAttribute('src', url);
      }
      void video.play().catch(() => {
        if (current && video.error) setHasFrame(false);
      });
    }
    sync();
    document.addEventListener(sceneDialogChange, sync);
    small.addEventListener('change', sync);
    large.addEventListener('change', sync);
    return () => {
      current = false;
      document.removeEventListener(sceneDialogChange, sync);
      small.removeEventListener('change', sync);
      large.removeEventListener('change', sync);
      video.pause();
    };
  }, [base, filmExtension, quay, running]);

  return <div className={styles.filmFrame} data-harbour-film={name} data-decoded={hasFrame}>
    <picture>
      {quay && <source media={smallDisplay} srcSet={candidates(base, 'mobile', [720, 1280])} sizes="100vw" />}
      <img src={poster}
        srcSet={quay ? candidates(base, 'wide', [1280, 1920, 2560, 3840]) : candidates(base, 'scene', [960, 1942])}
        sizes="100vw" width={quay ? 3840 : 1942} height={quay ? 1040 : 808}
        loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" alt="" />
    </picture>
    <video ref={player} muted loop playsInline preload="none" disablePictureInPicture
      onPlaying={event => { if (!event.currentTarget.paused) setHasFrame(true); }}
      onError={() => setHasFrame(false)} />
  </div>;
}
