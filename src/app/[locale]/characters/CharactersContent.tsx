'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { Character, Faction, Card, Locale } from '@/types';

interface CharactersContentProps {
  characters: Character[];
  factions: Faction[];
  cards: Card[];
  locale: Locale;
}

// Parse character name to extract subtitle (text in quotes)
// e.g., "Buddha Ban 'The Mastermind'" → { name: "Buddha Ban", subtitle: "The Mastermind" }
function parseCharacterName(fullName: string): { name: string; subtitle: string | null } {
  // Match patterns like: Name 'Subtitle' or Name "Subtitle" or Name «Subtitle»
  const patterns = [
    /'([^']+)'/, // Single quotes
    /"([^"]+)"/, // Double quotes
    /«([^»]+)»/, // French guillemets
    /「([^」]+)」/, // Japanese quotes
  ];

  for (const pattern of patterns) {
    const match = fullName.match(pattern);
    if (match) {
      const subtitle = match[1].trim();
      const name = fullName.replace(match[0], '').trim();
      return { name, subtitle };
    }
  }

  return { name: fullName, subtitle: null };
}

export function CharactersContent({ characters, factions, cards, locale }: CharactersContentProps) {
  const t = useTranslations('charactersPage');
  const showcase = useTranslations('showcase');
  const hero = useTranslations('hero');
  const cardsT = useTranslations('cardsPage');

  const [activeFaction, setActiveFaction] = useState<string>('all');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  // Get factions that have characters (exclude "all" for grouping)
  const factionsWithCharacters = factions.filter(f =>
    f.id !== 'all' && characters.some(c => c.faction === f.id)
  );

  // Filter characters based on active faction
  const filteredCharacters = activeFaction === 'all'
    ? characters
    : characters.filter(c => c.faction === activeFaction);

  // Group characters by faction (for "all" view)
  const charactersByFaction = factionsWithCharacters.map(faction => ({
    faction,
    characters: characters.filter(c => c.faction === faction.id)
  })).filter(group => group.characters.length > 0);

  // Close modal on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedCharacter(null);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (selectedCharacter) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [selectedCharacter]);

  // Get faction name for a character
  const getFactionName = (factionId: string) => {
    return factions.find(f => f.id === factionId)?.name[locale] || factionId;
  };

  // Get faction color class
  const getFactionClass = (factionId: string) => {
    return `faction-${factionId}`;
  };

  // Find card for a character
  const getCharacterCard = (characterId: string): Card | undefined => {
    return cards.find(card => card.characterId === characterId);
  };

  // Render a character card
  const renderCharacterCard = (character: Character) => {
    const { name, subtitle } = parseCharacterName(character.name[locale]);
    const factionClass = getFactionClass(character.faction);
    return (
      <div
        key={character.id}
        className={`char-card ${factionClass}`}
        onClick={() => setSelectedCharacter(character)}
      >
        <div className="char-img-container">
          <Image
            src={character.imageUrl}
            alt={character.name[locale]}
            width={300}
            height={400}
            className="char-img"
          />
        </div>
        <div className="char-info">
          <span className={`char-role ${factionClass}`}>{getFactionName(character.faction)}</span>
          <h3 className="char-name">{name}</h3>
          {subtitle && <span className="char-subtitle">{subtitle}</span>}
        </div>
      </div>
    );
  };

  const characterCard = selectedCharacter ? getCharacterCard(selectedCharacter.id) : undefined;

  return (
    <>
      {/* Characters Hero */}
      <section className="characters-hero">
        <div className="characters-hero-bg">
          <Image
            src="/images/our-characters.png"
            alt="Luna Characters"
            fill
            priority
            className="characters-hero-bg-image"
          />
        </div>
        <div className="characters-hero-content">
          <span className="hero-badge">{t('heroBadge')}</span>
          <h1 className="characters-hero-title">{showcase('charsTitle')}</h1>
          <p className="characters-hero-desc">{t('subtitle')}</p>
          <div className="characters-hero-cta">
            <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer" className="cta-discord">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/>
              </svg>
              <span>{hero('joinBtn')}</span>
            </a>
          </div>
        </div>
      </section>

      <div className="wrap">

      {/* Faction Filter */}
      <div className="faction-filter">
        {factions.map(faction => (
          <button
            key={faction.id}
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
          <h3>{t('ctaTitle')}</h3>
          <p>{t('ctaDesc')}</p>
          <a
            href="https://discord.gg/lunarian"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            {hero('joinBtn')}
          </a>
        </div>
      </div>

      {/* Character Detail Modal */}
      {selectedCharacter && (
        <div className="char-lightbox" onClick={() => setSelectedCharacter(null)}>
          <div className="char-lightbox-content" onClick={e => e.stopPropagation()}>
            <button
              className="char-lightbox-close"
              onClick={() => setSelectedCharacter(null)}
            >
              &times;
            </button>
            <div className="char-lightbox-img">
              <Image
                src={selectedCharacter.imageUrl}
                alt={selectedCharacter.name[locale]}
                width={450}
                height={600}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
            <div className="char-lightbox-info">
              <span className={`char-role ${getFactionClass(selectedCharacter.faction)}`}>{getFactionName(selectedCharacter.faction)}</span>
              {(() => {
                const { name, subtitle } = parseCharacterName(selectedCharacter.name[locale]);
                return (
                  <>
                    <h2 className="char-name">{name}</h2>
                    {subtitle && <span className="char-subtitle char-subtitle-modal">{subtitle}</span>}
                  </>
                );
              })()}
              {selectedCharacter.lore && (
                <p className="char-desc">{selectedCharacter.lore[locale]}</p>
              )}

              {/* Character's Card */}
              {characterCard && (
                <div className="char-card-section">
                  <h4 className="char-card-title">
                    {locale === 'ar' ? 'الكرت' : 'Card'}
                  </h4>
                  <div className="char-card-preview">
                    <Image
                      src={characterCard.imageUrl}
                      alt={characterCard.name[locale]}
                      width={150}
                      height={210}
                      className="char-card-img"
                    />
                    <div className="char-card-info">
                      <span className={`card-rarity-badge rarity-${characterCard.rarity}`}>
                        {cardsT(`filters.${characterCard.rarity}`)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
