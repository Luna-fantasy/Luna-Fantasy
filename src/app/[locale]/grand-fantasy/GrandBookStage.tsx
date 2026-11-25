'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useMessages } from 'next-intl';
import './grand-book-stage.css';

const GRAND_ASSET = '/luna-v16/grand';
const POSTER = GRAND_ASSET + '/artwork/hero/LUNA-0797';
const RENDERER = GRAND_ASSET + '/grand-v7/game-motion.mjs?plate=0797-v2&art=final-comparison-3';

interface StageHandle {
  ready: Promise<void>;
  dispose: () => void;
}

interface StageModule {
  mountGrandStage: (config: {
    hero: HTMLElement;
    holder: HTMLDivElement;
    wrap: HTMLDivElement;
    direction: 'ltr' | 'rtl';
  }) => StageHandle;
}

/**
 * Grand's scenic renderer is an enhancement of an eager, server-rendered
 * poster. React retains ownership of the frame, copy and CTA; the local
 * renderer owns only its canvases, observer and pointer lifetime.
 */
export function GrandBookStage({ locale, children }: { locale: 'en' | 'ar'; children: ReactNode }) {
  const resolve = useMessages() as Record<string, unknown>;
  const alts = resolve.alts as Record<string, unknown> | undefined;
  const override = alts?.['grand-fantasy-hero-bg'];
  const alt = typeof override === 'string' && override
    ? override
    : 'Grand Fantasy Card Game';
  const direction = locale === 'ar' ? 'rtl' : 'ltr';
  const hero = useRef<HTMLElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let generation = 0;
    let stopped = false;
    let previous: StageHandle | null = null;
    const reduced = matchMedia('(prefers-reduced-motion:reduce)');

    const start = async () => {
      const attempt = ++generation;
      previous?.dispose();
      previous = null;
      if (reduced.matches) {
        if (holder.current) holder.current.dataset.gameStage = 'static-full-original';
        return;
      }
      try {
        // The reviewed scene uses its private Three version. In particular do
        // not change the app/administrator renderer or global package versions.
        const player = await import(/* webpackIgnore: true */ RENDERER) as StageModule;
        if (stopped || generation !== attempt || !hero.current || !holder.current || !wrap.current) return;
        previous = player.mountGrandStage({
          hero: hero.current,
          holder: holder.current,
          wrap: wrap.current,
          direction,
        });
        await previous.ready;
      } catch {
        if (!stopped && attempt === generation && holder.current)
          holder.current.dataset.gameStage = 'static-full-original';
      }
    };
    void start();
    reduced.addEventListener?.('change', start);
    return () => {
      stopped = true;
      generation++;
      reduced.removeEventListener?.('change', start);
      previous?.dispose();
    };
  }, [direction]);

  return (
    <div className="luna-grand-v16" dir={direction}>
      <section className="cards-hero luna-grand-stage" ref={hero} aria-label={alt}>
        <div className="crown-game-frame" ref={wrap}>
          <div className="cards-hero-bg" ref={holder}>
            {/* eslint-disable-next-line @next/next/no-img-element -- exact tier/scene pixels */}
            <img
              className="cards-hero-bg-image"
              src={POSTER + '/medium.webp'}
              srcSet={POSTER + '/thumb.webp 1280w, ' + POSTER + '/medium.webp 1920w, ' + POSTER + '/detail.webp 3840w'}
              sizes="100vw"
              width={1920}
              height={1080}
              alt={alt}
              fetchPriority="high"
              loading="eager"
              decoding="async"
              draggable={false}
            />
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
