'use client';

import { ArchiveName } from '@/components/ArchiveName';
import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { Character, Locale } from '@/types';
import { selectedLinkedCardIndex, type LinkedCard } from './linked-card-records';
import { inspectorArtworkViewerSrc } from '@/lib/cinematic/native-art-inspector';
import { parseCharacterName } from '@/lib/cinematic/people-art';
import { CinematicArtwork } from '../cinematic-people/CinematicArtwork';
import s from './cast-viewer.module.css';

interface CharacterLinkedCardsProps {
  person: Character;
  cardId?: string;
  entries: LinkedCard[];
  locale: Locale;
  onSelect: (entry: LinkedCard, step: number) => void;
}

export function CharacterLinkedCards({person, cardId, entries, locale, onSelect}: CharacterLinkedCardsProps) {
  const ar = locale === 'ar';
  const translations = useTranslations('cardsPage');

  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement | null>(null);
  const index = selectedLinkedCardIndex(entries, person.id, cardId);
  const item = entries[index];
  const turn = (step: number) => {
    if (index >= 0 && entries.length > 1) onSelect(entries[(index + step + entries.length) % entries.length], step);
  };
  const open = (from: HTMLButtonElement) => {
    launcher.current = from;
    setExpanded(true);
    dialog.current?.showModal();
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement | HTMLDialogElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (dialog.current?.open) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        dialog.current.close();
        return;
      }
      if (event.key === 'Tab') {
        const buttons = dialog.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (first && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    }
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (direction) {
      event.preventDefault();
      event.stopPropagation();
      turn(ar ? -direction : direction);
    }
  };
  const controls = () => <div className={s.cardTurns} role="group" aria-label={ar?'التنقل بين البطاقات':'Card navigation'}>
    <button type="button" data-linked-card-step="-1" disabled={entries.length<2} onClick={()=>turn(-1)}>{ar?'البطاقة السابقة':'Previous card'}</button>
    <span aria-live="polite">{(index+1).toLocaleString(locale)} / {entries.length.toLocaleString(locale)}</span>
    <button type="button" data-linked-card-step="1" disabled={entries.length<2} onClick={()=>turn(1)}>{ar?'البطاقة التالية':'Next card'}</button>
  </div>;
  if (!item) return <section className={s.cardSection} data-linked-card-empty>
    <h3>{ar?'بطاقة Luna Fantasy المرتبطة':'Linked Luna Fantasy card'}</h3>
    <div className={s.noCard}><p>{ar?'لا توجد بطاقة مرتبطة بهذه الشخصية في أرشيف Luna Fantasy.':'The Luna Fantasy archive has no linked card for this character.'}</p>
      {entries.length>0 && <button type="button" onClick={()=>onSelect(entries[0], 1)}>{ar?'استعرض بطاقات نتائج البحث':'Browse cards in these results'}</button>}
    </div>
  </section>;
  const name = item.card.name[locale];
  const characterName = parseCharacterName(item.character.name[locale]).name;
  const rarity = translations('filters.'+item.card.rarity);
  return <section className={s.cardSection} data-linked-card={item.card.id} data-linked-owner={item.character.id}>
    <h3>{ar?'بطاقة Luna Fantasy المرتبطة':'Linked Luna Fantasy card'}</h3>
    <div onKeyDown={onKey}>
      <div className={s.cardTeaser}>
        <button type="button" onClick={e=>open(e.currentTarget)} aria-haspopup="dialog" aria-label={(ar?'تكبير بطاقة ':'Enlarge card ')+name}>
          <CinematicArtwork key={item.card.id} approved={item.artwork?.thumb} original={item.artwork?.detail ?? '/images/logo.png'} alt="" width={150} height={210}/>
        </button>
        <div><strong><ArchiveName>{name}</ArchiveName></strong><small><ArchiveName>{characterName}</ArchiveName> · {rarity}</small>
          <button className={s.cardOpen} type="button" data-open-linked-card onClick={e=>open(e.currentTarget)} aria-haspopup="dialog">{ar?'افتح البطاقة':'Open card'}</button>
        </div>
      </div>
      {controls()}
    </div>
    <dialog ref={dialog} className={s.reader} data-linked-card-dialog aria-labelledby="cast-card-reader-name"
      onClose={()=>{setExpanded(false);launcher.current?.focus({preventScroll:true})}} onKeyDown={onKey} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}>
      <div className={s.readerHead}><div><h3 id="cast-card-reader-name"><ArchiveName>{name}</ArchiveName></h3><p><ArchiveName>{characterName}</ArchiveName> · {rarity}</p></div>
        <button type="button" autoFocus className={s.readerClose} aria-label={ar?'إغلاق البطاقة':'Close card'} onClick={()=>dialog.current?.close()}>×</button>
      </div>
      {expanded && <CinematicArtwork key={item.card.id} nativeDetail={inspectorArtworkViewerSrc(item.artwork?.releaseId)} approved={item.artwork?.detail}
        original={item.artwork?.detail ?? '/images/logo.png'} alt={name} width={800} height={1200} className={s.readerFace}/>}
      {controls()}
    </dialog>
  </section>;
}
