'use client';

import React from 'react';
import type { ArchiveCardEntry } from './ArchiveCardCarousel';

type Props = {
  entries: readonly ArchiveCardEntry[];
  selected: number;
  rtl: boolean;
  onSelect: (index: number) => void;
  onScrub?: (index: number) => void;
  scrub?: boolean;
};

export function ArchiveContactSheet({ entries, selected, rtl, onSelect, onScrub, scrub = false }: Props) {
  if (entries.length < 2 || selected < 0) return null;
  const count = Math.min(entries.length, 7);
  const start = Math.min(Math.max(0, selected - Math.floor(count / 2)), entries.length - count);
  const format = new Intl.NumberFormat(rtl ? 'ar' : 'en');
  const label = rtl ? 'شريط الكروت' : 'Card strip';
  return (
    <div className="archive-contact-sheet" role="group" aria-label={label}>
      <div className="archive-contact-prints">
        {entries.slice(start, start + count).map((card, offset) => {
          const index = start + offset;
          return <button type="button" key={card.id} data-sheet-index={index}
            aria-label={card.name} title={card.name} aria-current={index === selected ? 'true' : undefined}
            onClick={() => onSelect(index)}>
            <img src={card.thumb || card.detail} width={56} height={81} alt="" loading="lazy" draggable={false} />
            <span aria-hidden="true">{format.format(index + 1)}</span>
          </button>;
        })}
      </div>
      {scrub && entries.length > count && <input type="range" className="archive-contact-range"
        dir={rtl ? 'rtl' : 'ltr'} min={0} max={entries.length - 1} step={1} value={selected}
        aria-label={rtl ? 'انتقل إلى كرت من المجموعة' : 'Jump to a card in the collection'}
        aria-valuetext={entries[selected]?.name}
        onKeyDown={event => event.stopPropagation()}
        onChange={event => (onScrub ?? onSelect)(Number(event.currentTarget.value))} />}
    </div>
  );
}
