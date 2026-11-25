'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useEditMode } from '@/lib/edit-mode/context';
import { storyCoverPresentationSrc } from '@/lib/cinematic/v19-visual-fix-src';
import { mountStoryScene } from '@/lib/cinematic/story-scene.js';

const labels = {
  en: {
    label: 'Scenes from the Chronicles',
    title: ['Lunvor Before Chaos', 'Movarth’s Reign', 'Bod Aban Prevails'],
    details: ['A city at peace', 'Lunvor under the King of Chaos', 'Luna’s champion ends Movarth’s reign'],
    read: 'Read the chapters',
    hint: 'Scroll to unfold the story',
  },
  ar: {
    label: 'مشاهد من سجلات لونا',
    title: ['لونفور قبل الفوضى', 'عهد موفارث', 'انتصار بود أبان'],
    details: ['مدينةٌ تعيش في سلام', 'سقطت لونفور تحت حكم ملك الفوضى', 'انتهى حكم موفارث على يد بطل لونا'],
    read: 'اقرأ الفصول',
    hint: 'مرّر لمتابعة القصة',
  },
};

const plates = [
  'lunvor-original-remastered.webp',
  'movarth-original-remastered.webp',
  'champion-remastered.webp',
];

export function ChroniclesHero({ children, locale }: { children: ReactNode; locale: string }) {
  const root = useRef<HTMLElement>(null);
  const { editMode } = useEditMode();
  const [failed, setFailed] = useState<string>();
  const approved = editMode ? undefined : storyCoverPresentationSrc();
  const champion = approved && approved !== failed ? approved : undefined;
  const copy = locale === 'ar' ? labels.ar : labels.en;
  useEffect(() => {
    if (root.current) return mountStoryScene(root.current);
  }, []);

  return (
    <section ref={root} className="chron-runway" data-story-chronicles aria-label={copy.label}>
      <div className="chron-pinned story-hero">
        <div className="chron-visual">
          <div className="chron-film" aria-hidden="true">
            {plates.map((src, i) => (
              <div className={`chron-plane chron-plane--${i}`} data-scene={i} key={src}
                style={i === 2 && champion ? { '--chron-src': 'url("' + champion + '")' } as CSSProperties : undefined}>
                <img
                  className="chron-plate" src={i === 2 && champion ? champion : `/luna-cinematic/home-story/story/${src}`}
                  decoding="async" loading={i === 0 ? 'eager' : 'lazy'} alt="" width={1536} height={1024}
                  onLoad={i === 0 ? (e) => e.currentTarget.closest('.chron-film')?.removeAttribute('data-opening-missing') : undefined}
                  onError={i === 0 ? (e) => e.currentTarget.closest('.chron-film')?.setAttribute('data-opening-missing', 'true') : (i === 2 && champion ? () => setFailed(champion) : undefined)}
                />
                <div className="chron-foreground" />
              </div>
            ))}
            <div className="chron-grade" />
            <div className="chron-door chron-door--left" />
            <div className="chron-door chron-door--right" />
            <div className="chron-embers">{Array.from({ length: 7 }, (_, i) => <i key={i} />)}</div>
            <div className="chron-bronze-cut" />
          </div>
          <div className="story-hero-content">{children}</div>
          <div className="chron-moments" aria-hidden="true">
            {copy.title.map((title, i) => <div className={`chron-beat-copy chron-beat-copy--${i}`} key={title}>
              <span>{title}</span><p>{copy.details[i]}</p>
            </div>)}
          </div>
        </div>
        <nav className="chron-strip" aria-label={copy.label}>
          <div className="chron-progress" aria-hidden="true" />
          <ol>
            {copy.title.map((title, i) => (
              <li key={title}><a href={`#chapter-${i+1}`} data-chron-anchor={i} aria-current={i === 0 ? 'step' : undefined}>
                <span className="chron-count">{String(i+1).padStart(2, '0')}</span>{' '}{title}
              </a></li>
            ))}
          </ol>
          <a className="chron-read" href="#chapter-1">{copy.read}</a>
          <p className="chron-hint" aria-hidden="true">{copy.hint}</p>
        </nav>
      </div>
    </section>
  );
}
