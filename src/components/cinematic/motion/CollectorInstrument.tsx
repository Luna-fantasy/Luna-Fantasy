'use client';

import React, { useEffect, useRef } from 'react';
import type { ArchiveKind } from '@/components/archive-card-carousel/archive-carousel-model';

export function CollectorInstrument({ kind }: { kind: ArchiveKind }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = host.current;
    if (!node?.closest('[data-luna-shell="cinematic"]')) return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const face = node.closest('dialog')?.querySelector<HTMLElement>('.archive-inspector-face');
    const events = new AbortController();
    function foil(event: PointerEvent) {
      if (!face || preference.matches || !event.isPrimary) return;
      const box = face.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (event.clientX - box.left) / Math.max(1,box.width)));
      const y = Math.min(1, Math.max(0, (event.clientY - box.top) / Math.max(1,box.height)));
      face.style.setProperty('--foil-x', x * 100 + '%');
      face.style.setProperty('--foil-y', y * 100 + '%');
      face.style.setProperty('--foil-angle', (107 + x * 24 - y * 9) + 'deg');
      face.style.setProperty('--foil-on', '.74');
    }
    const rest = () => face?.style.removeProperty('--foil-on');
    const passive = { passive: true, signal: events.signal };
    face?.addEventListener('pointermove', foil, passive);
    face?.addEventListener('pointerdown', foil, passive);
    face?.addEventListener('pointerleave', rest, passive);
    face?.addEventListener('pointercancel', rest, passive);
    face?.addEventListener('pointerup', event => { if (event.pointerType !== 'mouse') rest(); }, passive);
    let generation = 0;
    let release: (() => void) | undefined;
    function update() {
      const ticket = ++generation;
      release?.();
      release = undefined;
      if (preference.matches || !node) return;
      void import('./collector-stage').then(({ mountCollectorInstrument }) => {
        if (ticket === generation && node.isConnected) release = mountCollectorInstrument(node, kind);
      }).catch(() => { if (ticket === generation) node.dataset.instrument = 'still'; });
    }
    update();
    preference.addEventListener('change', update);
    return () => { generation++; events.abort(); rest(); preference.removeEventListener('change', update); release?.(); };
  }, [kind]);
  return <div ref={host} className="luna-collector-instrument" data-instrument="still" aria-hidden="true" />;
}
