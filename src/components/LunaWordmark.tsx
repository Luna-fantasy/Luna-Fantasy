'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useNightMotion } from '@/components/cinematic/NightProjection';

export function LunaWordmark({ children, className }: { children: ReactNode; className?: string }) {
  const motion = useNightMotion();
  const face = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mark = face.current;
    const link = mark?.closest('a');
    if (!mark || !link || !motion) return;
    let timer: ReturnType<typeof setTimeout>;
    function clear() {
      clearTimeout(timer);
      mark?.removeAttribute('data-wordmark-pressed');
    }
    function press(event: PointerEvent) {
      if (event.pointerType === 'mouse' || !event.isPrimary) return;
      clear();
      mark?.setAttribute('data-wordmark-pressed', '');
      timer = setTimeout(clear, 760);
    }
    link.addEventListener('pointerdown', press);
    link.addEventListener('pointercancel', clear);
    return () => {
      clear();
      link.removeEventListener('pointerdown', press);
      link.removeEventListener('pointercancel', clear);
    };
  }, [motion]);

  return (
    <span ref={face} className={className} data-luna-wordmark="" data-wordmark-motion={motion ? 'on' : 'off'}>
      <span className="luna-wordmark-face">{children}</span>
    </span>
  );
}
