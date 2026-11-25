'use client';

import { useEffect, useRef, useState } from 'react';
import { EImg } from '@/components/edit-mode/EditableImage';
import { useEditMode } from '@/lib/edit-mode/context';
import { lunaBrandMark, lunaBrandMotion } from '@/lib/luna-brand';
import { useNightMotion } from '@/components/cinematic/NightProjection';

export function NavBrandMark() {
  const { editMode } = useEditMode();
  const motion = useNightMotion();
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const clip = video.current;
    const link = clip?.closest('a');
    if (!clip || !link || editMode) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    function sync() {
      if (!clip) return;
      if (!motion || reduced.matches || document.hidden) {
        clip.pause();
        return;
      }
      if (!clip.paused && !clip.ended) return;
      if (!clip.hasAttribute('src')) clip.src = lunaBrandMotion;
      if (clip.ended) clip.currentTime = 0;
      void clip.play().catch(() => setPlaying(false));
    }

    sync();
    link.addEventListener('pointerenter', sync);
    link.addEventListener('focus', sync);
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      link.removeEventListener('pointerenter', sync);
      link.removeEventListener('focus', sync);
      reduced.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      clip.pause();
    };
  }, [editMode, motion]);

  return (
    <span className="luna-nav-mark" data-playing={playing && !editMode || undefined}>
      <EImg editId="nav-brand-logo" src={lunaBrandMark} alt="Luna" width={40} height={40}
        className="brand-logo-img" />
      {!editMode && (
        <video ref={video} muted playsInline preload="none" aria-hidden="true" tabIndex={-1}
          onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)} onError={() => setPlaying(false)} />
      )}
    </span>
  );
}
