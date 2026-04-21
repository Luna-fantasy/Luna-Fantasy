'use client';

import { useEffect, useRef, useState } from 'react';

interface CounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  format?: (n: number) => string;
}

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

const defaultFormat = (n: number, decimals: number) =>
  n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export default function Counter({ value, duration = 1100, decimals = 0, format }: CounterProps) {
  const [shown, setShown] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const toRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = shown;
    toRef.current = value;
    startRef.current = null;

    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / duration);
      const eased = easeOutExpo(t);
      const current = fromRef.current + (toRef.current - fromRef.current) * eased;
      setShown(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setShown(toRef.current);
      }
    };

    if (typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      rafRef.current = requestAnimationFrame(step);
    } else {
      setShown(value);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const fmt = format ?? ((n: number) => defaultFormat(n, decimals));
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(shown)}</span>;
}
