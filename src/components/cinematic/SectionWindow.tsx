'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNightMotion } from './NightProjection';
import { HarbourFilm } from './HarbourFilm';
import type { SectionWindowScene } from '@/lib/cinematic/section-window';
import styles from './SectionWindow.module.css';

export function SectionWindow({scene, priority = false}: {scene: SectionWindowScene; priority?: boolean}) {
  const root = useRef<HTMLDivElement>(null);
  const motion = useNightMotion();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element || !motion) return;
    let onscreen = false;
    const update = () => setVisible(onscreen && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { onscreen = entry.isIntersecting; update(); });
    observer.observe(element);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [motion]);
  const palette = {
    '--effect-x': scene.x + '%', '--effect-y': scene.y + '%',
    '--travel': scene.travel + 'px', '--period': scene.seconds + 's'
  } as CSSProperties;
  return <div ref={root} aria-hidden="true" className={styles.window} style={palette}
    data-section-window={scene.id} data-motion-profile={scene.profile} data-material={scene.material} data-running={motion && visible}>
    {scene.film ? <HarbourFilm key={scene.film} name={scene.film} poster={scene.art} running={motion && visible} priority={priority} /> : <>
      <img className={styles.plate} alt="" src={scene.art} loading={priority ? 'eager' : 'lazy'} decoding="async" />
      <span className={styles.effect}/>
    </>}
  </div>;
}
