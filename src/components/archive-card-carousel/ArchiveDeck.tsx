'use client';

import { useRef, type CSSProperties, type PointerEvent } from 'react';
import type { ArchiveCardEntry } from './ArchiveCardCarousel';

type Props = {
  entries: Map<string, ArchiveCardEntry>;
  ids: readonly string[];
  current: number;
  rtl: boolean;
  choose: (id: string, direction: -1 | 1) => void;
  inspect: (trigger: HTMLButtonElement) => void;
};

export function ArchiveDeck({ entries, ids, current, rtl, choose, inspect }: Props) {
  const start = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const swiped = useRef(false);
  if (current < 0 || ids.length < 2) return null;

  const count = Math.min(ids.length, 7);
  const before = Math.floor((count - 1) / 2);
  const offsetId = (offset: number) => ids[(current + offset + ids.length) % ids.length];

  function beginSwipe(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    swiped.current = false;
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    (target ?? event.currentTarget).setPointerCapture(event.pointerId);
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    start.current = null;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dx) < 32 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    swiped.current = true;
    const step = (dx < 0) !== rtl ? 1 : -1;
    choose(offsetId(step), step);
  }

  return (
    <div className="archive-deck" role="group" dir="ltr"
      aria-label={rtl ? 'رزمة المجموعة' : 'Collection deck'}
      onPointerDown={beginSwipe} onPointerUp={finishSwipe}
      onPointerCancel={() => { start.current = null; }}>
      {Array.from({ length: count }, (_, index) => {
        const step = index - before;
        const entry = entries.get(offsetId(step));
        if (!entry) return null;
        const side = rtl ? -step : step;
        const depth = Math.abs(side);
        const style = { '--slot': side, '--depth': depth, zIndex: 5 - depth } as CSSProperties;
        const selected = step === 0;
        return (
          <button key={entry.id} type="button" style={style} data-offset={step}
            aria-current={selected ? 'true' : undefined}
            aria-label={selected ? (rtl ? 'افحص الكرت ' : 'Inspect ') + entry.name : entry.name}
            onClick={event => {
              if (swiped.current && event.detail) {
                swiped.current = false;
                return;
              }
              if (selected) inspect(event.currentTarget);
              else choose(entry.id, step < 0 ? -1 : 1);
            }}>
            <img src={selected ? entry.visualFix || entry.detail || entry.thumb : entry.thumb || entry.detail}
              alt="" width={84} height={126} loading="lazy" draggable={false} />
          </button>
        );
      })}
    </div>
  );
}
