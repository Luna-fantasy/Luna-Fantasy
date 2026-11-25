'use client';
import { ArchiveName } from '@/components/ArchiveName';
import { PortraitLens } from './PortraitLens';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import { E } from '@/components/edit-mode/EditableText';
import { approvedPortraitFor, parseCharacterName } from '@/lib/cinematic/people-art';
import { canonicalCharacterFaction } from '@/lib/cinematic/character-faction';
import { inspectorArtworkViewerSrc } from '@/lib/cinematic/native-art-inspector';
import { linkedCardsFor, type LinkedCard } from './linked-card-records';
import { useEditMode } from '@/lib/edit-mode/context';
import { CinematicArtwork, EditableCinematicArtwork } from '../cinematic-people/CinematicArtwork';
import { WorldStage } from '../night-worlds/WorldStage';
import { CastArchive } from './CastArchive';
import night from '../night-worlds/night-worlds.module.css';
import { CharactersAisle } from '../cinematic-people/CharactersAisle';
import { useCharacterRecordMotion } from '../cinematic-people/useCharacterRecordMotion';
import { ArchiveCardSearch } from '@/components/cinematic-games/ArchiveCardSearch';
import { CharacterLinkedCards } from './CharacterLinkedCards';
import cast from './cast-viewer.module.css';
import { archiveLabelMatcher } from '@/lib/cinematic/archive-card-search';
import { EDb } from '@/components/edit-mode/EditableDbText';
import type { Character, Faction, Card, Locale } from '@/types';

interface CharactersContentProps {
  characters: Character[];
  factions: Faction[];
  cards: Card[];
  locale: Locale;
  cinematicPresentation: boolean;
}

export function CharactersContent({ characters, factions, cards, locale, cinematicPresentation }: CharactersContentProps) {
  const t = useTranslations('charactersPage');
  const showcase = useTranslations('showcase');
  const hero = useTranslations('hero');
  const { editMode } = useEditMode();
  const cinematic = cinematicPresentation && !editMode;

  const [activeFaction, setActiveFaction] = useState<string>('all');
  const [archiveQuery, setArchiveQuery] = useState('');
  const [selection, setSelection] = useState<{ characterId: string; cardId?: string } | null>(null);
  const selectedCharacter = selection && characters.find(character => character.id === selection.characterId);
  const recordIsOpen = Boolean(selectedCharacter);

  const modalClose = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openerScroll = useRef({ left: 0, top: 0 });
  const recordMotion = useCharacterRecordMotion(selectedCharacter?.id, cinematic, locale === 'ar', opener);
  const closeRecord = () => recordMotion.close(() => setSelection(null));
  const openCharacter = (character: Character, control: HTMLElement) => {
    opener.current = control;
    openerScroll.current = { left: window.scrollX, top: window.scrollY };
    setSelection({ characterId: character.id });
  };
  const matchesName = archiveLabelMatcher(editMode ? '' : archiveQuery);
  const matches = characters.filter(character => matchesName(character.name[locale], character.name.en));

  // Get factions that have characters (exclude "all" for grouping)
  const factionsWithCharacters = factions.filter(f =>
    f.id !== 'all' && characters.some(c => canonicalCharacterFaction(c.faction) === f.id)
  );

  // Filter characters based on active faction
  const filteredCharacters = activeFaction === 'all'
    ? matches
    : matches.filter(c => canonicalCharacterFaction(c.faction) === activeFaction);

  // Group characters by faction (for "all" view)
  const charactersByFaction = factionsWithCharacters.map(faction => ({
    faction,
    characters: matches.filter(c => canonicalCharacterFaction(c.faction) === faction.id)
  })).filter(group => group.characters.length > 0);
  const visibleRecords = activeFaction === 'all' && !cinematic ? charactersByFaction.flatMap(group => group.characters) : filteredCharacters;
  const selectedIndex = visibleRecords.findIndex(character => character.id === selectedCharacter?.id);
  const canTurnRecord = selectedIndex >= 0 && visibleRecords.length > 1;
  const turnRecord = (step: number) => {
    if (!canTurnRecord) return;
    const character = visibleRecords[(selectedIndex + step + visibleRecords.length) % visibleRecords.length];
    recordMotion.turn(step, () => setSelection({ characterId: character.id }));
  };

  const selectLinkedCard = (entry: LinkedCard, step: number) => {
    const select = () => setSelection({ characterId: entry.character.id, cardId: entry.card.id });
    if (entry.character.id === selectedCharacter?.id) select();
    else recordMotion.turn(step, select);
  };

  // Keep modal keyboard focus and restore the exact initiating control on close.
  useEffect(() => {
    if (!recordIsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalClose.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (modalClose.current?.closest('[role="dialog"]')?.querySelector('dialog[open]')) return;
      if (event.key === 'Escape' && !event.defaultPrevented) closeRecord();
      if (event.key !== 'Tab') return;
      const modal = modalClose.current?.closest('[role="dialog"]');
      const focusable = Array.from(modal?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([type="file"]),[tabindex="0"]') ?? [])
        .filter(node => node.getClientRects().length > 0);
      if (!focusable.length) return;
      const active = document.activeElement;
      const endpoint = event.shiftKey ? focusable[0] : focusable[focusable.length - 1];
      if (active === endpoint || !modal?.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? focusable[focusable.length - 1] : focusable[0]).focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
      window.scrollTo({ ...openerScroll.current, behavior: 'instant' });
    };
    // Focus is held for the complete inspection, including turns between records.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordIsOpen]);

  // Get faction name for a character
  const getFactionName = (factionId: string) => {
    return factions.find(f => f.id === canonicalCharacterFaction(factionId))?.name[locale] || factionId;
  };

  // Get faction color class
  const getFactionClass = (factionId: string) => {
    return `faction-${canonicalCharacterFaction(factionId)}`;
  };

  // Render a character card
  const renderCharacterCard = (character: Character) => {
    const { name, subtitle } = parseCharacterName(character.name[locale]);
    const factionClass = getFactionClass(character.faction);
    return (
      <div key={character.id} className={`char-card ${factionClass}`}>
        <button
          type="button"
          className="people-character-hit"
          aria-haspopup="dialog"
          aria-label={character.name[locale]}
          onClick={event => openCharacter(character, event.currentTarget)}
        />
        <div className="char-img-container">
          <CinematicArtwork
            approved={cinematic ? approvedPortraitFor(character.imageUrl)?.thumb : undefined}
            original={character.imageUrl}
            alt={character.name[locale]}
            width={300}
            height={400}
            className="char-img"
          />
        </div>
        <div className="char-info">
          <span className={`char-role ${factionClass}`}>{getFactionName(character.faction)}</span>
          <h3 className="char-name"><ArchiveName>{name}</ArchiveName></h3>
          {subtitle && <span className="char-subtitle">{subtitle}</span>}
        </div>
      </div>
    );
  };

  const linkedCards = recordIsOpen ? linkedCardsFor(visibleRecords,cards,cinematic) : [];

  return (
    <main className="people-characters-surface">
      {cinematic ? <>
        <WorldStage world="characters" locale={locale}
          badge={<E ns="charactersPage" k="heroBadge">{t('heroBadge')}</E>}
          title={<E ns="showcase" k="charsTitle">{showcase('charsTitle')}</E>}
          description={<E ns="charactersPage" k="subtitle">{t('subtitle')}</E>}
          secondary={<a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer"><E ns="hero" k="joinBtn">{hero('joinBtn')}</E></a>} />
        <CastArchive records={visibleRecords} factions={factions} locale={locale} faction={activeFaction} query={archiveQuery}
          onFaction={setActiveFaction} onQuery={setArchiveQuery} factionName={getFactionName} openRecord={openCharacter} />
        <aside className={night.castFooter}><div><h3><E ns="charactersPage" k="ctaTitle">{t('ctaTitle')}</E></h3>
          <p><E ns="charactersPage" k="ctaDesc">{t('ctaDesc')}</E></p></div>
          <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer"><E ns="hero" k="joinBtn">{hero('joinBtn')}</E> ↗</a>
        </aside>
      </> : <>
      {/* Characters Hero */}
      <CharactersAisle cinematic={cinematic}>
        <div className="characters-hero-bg">
          <EditableCinematicArtwork
            editId="characters-hero-bg"
            approved={cinematic ? '/luna-cinematic/people/hero/archive-intro.webp' : undefined}
            original="/images/our-characters.png"
            alt="Luna Characters"
            fill
            priority
            className="characters-hero-bg-image"
          />
        </div>
        <div className="characters-hero-content">
          <span className="hero-badge"><E ns="charactersPage" k="heroBadge">{t('heroBadge')}</E></span>
          <h1 className="characters-hero-title"><E ns="showcase" k="charsTitle">{showcase('charsTitle')}</E></h1>
          <p className="characters-hero-desc"><E ns="charactersPage" k="subtitle">{t('subtitle')}</E></p>
          <div className="characters-hero-cta">
            <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer" className="cta-discord">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/>
              </svg>
              <span><E ns="hero" k="joinBtn">{hero('joinBtn')}</E></span>
            </a>
            {cinematic && <a className="c7-enter" href="#c7-portrait-archive">{locale === 'ar' ? 'استكشف سجلّ الشخصيات' : 'Explore the portrait archive'} <span aria-hidden="true">↓</span></a>}
          </div>
        </div>
      </CharactersAisle>

      <div id="c6-gallery" className="wrap cinematic-archive-content">

      {/* Faction Filter */}
      {!editMode && <ArchiveCardSearch locale={locale} query={archiveQuery} count={filteredCharacters.length} onQuery={setArchiveQuery} />}
      <div className="faction-filter">
        {factions.map(faction => (
          <button
            key={faction.id}
            type="button"
            aria-pressed={activeFaction === faction.id}
            className={`faction-btn ${activeFaction === faction.id ? 'active' : ''}`}
            onClick={() => setActiveFaction(faction.id)}
          >
            {faction.name[locale]}
          </button>
        ))}
      </div>

      {/* Characters Display */}
      {activeFaction === 'all' ? (
        // Grouped by faction with separators
        <div className="characters-by-faction">
          {charactersByFaction.map(({ faction, characters: factionChars }) => (
            <div key={faction.id} className="faction-section">
              <div className="faction-header">
                <h2 className="faction-title">{faction.name[locale]}</h2>
                <span className="faction-count">{factionChars.length}</span>
              </div>
              <div className="characters-grid">
                {factionChars.map(renderCharacterCard)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Single faction grid
        <div className="characters-grid">
          {filteredCharacters.map(renderCharacterCard)}
        </div>
      )}

      {/* CTA Section */}
      <div className="cta-section">
        <div className="cta-box">
          <h3><E ns="charactersPage" k="ctaTitle">{t('ctaTitle')}</E></h3>
          <p><E ns="charactersPage" k="ctaDesc">{t('ctaDesc')}</E></p>
          <a
            href="https://discord.gg/lunarian"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            <E ns="hero" k="joinBtn">{hero('joinBtn')}</E>
          </a>
        </div>
      </div>

      </div>
      </>}
      {/* Character Detail Modal */}
      {selectedCharacter && (
        <div className={'char-lightbox'+(cinematic?' '+night.recordOverlay+' '+cast.overlay:'')} onClick={closeRecord}>
          <div ref={recordMotion.panel} className="char-lightbox-content" data-record-id={selectedCharacter.id} role="dialog" aria-modal="true" aria-label={selectedCharacter.name[locale]} onClick={e => e.stopPropagation()}
            onKeyDown={event => {
              if (event.defaultPrevented || event.currentTarget.querySelector('dialog[open]') || !cinematic || event.altKey || event.ctrlKey || event.metaKey) return;
              const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
              if (direction) { event.preventDefault(); turnRecord(locale === 'ar' ? -direction : direction); }
            }}>
            <button
              className="char-lightbox-close"
              type="button"
              ref={modalClose}
              aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
              onClick={closeRecord}
            >
              &times;
            </button>
            <PortraitLens key={selectedCharacter.id} locale={locale} overviewSrc={cinematic ? approvedPortraitFor(selectedCharacter.imageUrl)?.thumb : undefined}>
              <EditableCinematicArtwork
                editId={`char-img-${selectedCharacter.id}`}
                nativeDetail={cinematic ? inspectorArtworkViewerSrc(approvedPortraitFor(selectedCharacter.imageUrl)?.id) : undefined}
                approved={cinematic ? approvedPortraitFor(selectedCharacter.imageUrl)?.medium : undefined}
                original={selectedCharacter.imageUrl}
                alt={selectedCharacter.name[locale]}
                width={900}
                height={1350}
                style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                dbCollection="characters"
                dbId={selectedCharacter.id}
                dbField="imageUrl"
              />
            </PortraitLens>
            <div className={'char-lightbox-info'+(cinematic?' '+night.recordBody:'')}>
              <span className={`char-role ${getFactionClass(selectedCharacter.faction)}`}>{getFactionName(selectedCharacter.faction)}</span>
              {(() => {
                const { name, subtitle } = parseCharacterName(selectedCharacter.name[locale]);
                return (
                  <>
                    <h2 className="char-name">
                      <EDb collection="characters" id={selectedCharacter.id} field={`name.${locale}`}><ArchiveName>{name}</ArchiveName></EDb>
                    </h2>
                    {subtitle && <span className="char-subtitle char-subtitle-modal">{subtitle}</span>}
                  </>
                );
              })()}
              {selectedCharacter.lore && (
                <p className="char-desc">
                  <EDb collection="characters" id={selectedCharacter.id} field={`lore.${locale}`}>{selectedCharacter.lore[locale]}</EDb>
                </p>
              )}
              <div className={cast.documentTurn+' char-record-turn'} role="group" aria-label={locale==='ar'?'تصفّح الشخصيات':'Browse characters'}>
                <button type="button" data-step="-1" disabled={!canTurnRecord} onClick={()=>turnRecord(-1)}>{locale==='ar'?'الشخصية السابقة':'Previous character'}</button>
                <span aria-live="polite">{(selectedIndex+1).toLocaleString(locale)} / {visibleRecords.length.toLocaleString(locale)}</span>
                <button type="button" data-step="1" disabled={!canTurnRecord} onClick={()=>turnRecord(1)}>{locale==='ar'?'الشخصية التالية':'Next character'}</button>
              </div>
              <CharacterLinkedCards person={selectedCharacter} cardId={selection?.cardId} entries={linkedCards}
                locale={locale} onSelect={selectLinkedCard} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
