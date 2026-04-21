'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: ReactNode;
  delay?: number;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
}

export default function Tooltip({ content, delay = 250, side = 'top', children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const id = useId();

  const compute = () => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let x = rect.left + rect.width / 2;
    let y = rect.top;
    if (side === 'bottom') y = rect.bottom;
    if (side === 'left') { x = rect.left; y = rect.top + rect.height / 2; }
    if (side === 'right') { x = rect.right; y = rect.top + rect.height / 2; }
    setPos({ x, y });
  };

  const onEnter = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      compute();
      setOpen(true);
    }, delay);
  };
  const onLeave = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onScroll = () => compute();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <>
      <span
        ref={wrapRef}
        className="av-tooltip-trigger"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
        aria-describedby={open ? id : undefined}
      >
        {children}
      </span>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          id={id}
          role="tooltip"
          className={`av-tooltip av-tooltip-${side}`}
          style={{ left: pos.x, top: pos.y }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
}
