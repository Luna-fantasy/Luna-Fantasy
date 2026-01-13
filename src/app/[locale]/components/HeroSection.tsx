'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { ParticleBackground } from '@/components';

export function HeroSection() {
  const t = useTranslations('hero');

  useEffect(() => {
    // Create energy streaks
    const container = document.getElementById('energy-container');
    if (!container || container.children.length > 0) return;

    const streakCount = 8;
    for (let i = 0; i < streakCount; i++) {
      const streak = document.createElement('div');
      streak.className = 'energy-streak';
      streak.style.left = (10 + Math.random() * 80) + '%';
      streak.style.animationDelay = Math.random() * 3 + 's';
      streak.style.animationDuration = (2 + Math.random() * 2) + 's';
      streak.style.height = (60 + Math.random() * 80) + 'px';
      container.appendChild(streak);
    }
  }, []);

  return (
    <>
      <ParticleBackground />
      <section className="hero">
        {/* Background layers */}
        <div className="hero-bg">
          <div className="hero-bg-image"></div>
          <div className="hero-bg-overlay"></div>
        </div>

        {/* Floating orbs */}
        {/* <div className="hero-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div> */}

        {/* Energy streaks */}
        <div className="hero-energy" id="energy-container"></div>

        {/* Content */}
        <div className="hero-content">
          <span className="hero-badge">{t('badge')}</span>
          <h1 className="hero-title">{t('title')}</h1>
          <p className="hero-subtitle">{t('desc')}</p>

          {/* Stats */}
          <div className="hero-stats">
            <div className="stat-box">
              <div className="stat-value">{t('statStory')}</div>
              <div className="stat-label">{t('statStoryLabel')}</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{t('statCards')}</div>
              <div className="stat-label">{t('statCardsLabel')}</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{t('statCommunity')}</div>
              <div className="stat-label">{t('statCommunityLabel')}</div>
            </div>
          </div>

          {/* CTA */}
          <div className="hero-cta">
            <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer" className="cta-discord">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/>
              </svg>
              <span>{t('joinBtn')}</span>
            </a>
            <a href="#overview" className="btn btn-secondary">{t('exploreBtn')}</a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="scroll-indicator">
          <span>SCROLL</span>
          <div className="scroll-line"></div>
        </div>
      </section>
    </>
  );
}
