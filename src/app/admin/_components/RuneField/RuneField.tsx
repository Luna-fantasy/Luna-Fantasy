'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

export interface RuneFieldProps {
  density?: 'low' | 'medium' | 'high';
  drift?: number;
  parallax?: number;
  tone?: string; // CSS color
}

const RuneFieldCanvas = dynamic(() => import('./RuneFieldCanvas'), {
  ssr: false,
  loading: () => null,
});

/**
 * RuneField — client-only R3F arcane atmosphere for the v2 admin shell.
 * Gates on prefers-reduced-motion, data-motion="off", and WebGL2 support so
 * the dashboard never breaks on low-end hardware or for users who opt out.
 * Never rendered on the public site.
 */
export default function RuneField(props: RuneFieldProps) {
  const [gate, setGate] = useState<'pending' | 'render' | 'skip'>('pending');
  const [density, setDensity] = useState<NonNullable<RuneFieldProps['density']>>('medium');

  useEffect(() => {
    // Reduced motion
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setGate('skip'); return; }

    // User-opt-out via shell data attribute
    const shell = document.querySelector('.admin-v2-shell') as HTMLElement | null;
    if (shell?.getAttribute('data-motion') === 'off') { setGate('skip'); return; }

    // Probe WebGL2 — Safari <16 and old mobile fall here
    try {
      const probe = document.createElement('canvas');
      const ctx = probe.getContext('webgl2');
      if (!ctx) { setGate('skip'); return; }
    } catch {
      setGate('skip');
      return;
    }

    // Low-memory devices: halve the instance count instead of hiding
    const mem = (navigator as any).deviceMemory;
    if (typeof mem === 'number' && mem < 4) setDensity('low');

    setGate('render');
  }, []);

  if (gate !== 'render') return null;

  return <RuneFieldCanvas {...props} density={props.density ?? density} />;
}
