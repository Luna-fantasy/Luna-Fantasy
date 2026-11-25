'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { EImg } from '@/components/edit-mode/EditableImage';
import { NightFilmSwitch, NightProjection } from '@/components/cinematic/NightProjection';
import { useEditMode } from '@/lib/edit-mode/context';
import s from './night-worlds.module.css';

export type World = 'characters' | 'partners' | 'story' | 'members';

const artwork = {
  characters: { fallback: '/luna-cinematic/people/hero/archive-intro.webp', original: '/images/our-characters.png', field: 'characters-hero-bg' },
  partners: { fallback: '/luna-cinematic/people/hero/LUNA-0800/medium.webp', original: 'https://assets.lunarian.app/partners/partners-hero.png', field: 'partners-hero-bg' },
  story: { fallback: '/luna-cinematic/home-story/story/lunvor-original-remastered.webp', original: '/luna-cinematic/home-story/story/lunvor-original-remastered.webp', field: 'storyPage.chapter1.image' },
  members: { fallback: '/luna-cinematic/people/hero/LUNA-0799/medium.webp', original: 'https://assets.lunarian.app/backgrounds/Members_Hero.png', field: 'members-hero-bg' }
};

export function WorldPicture({world, priority = false, editable = false}: {world: World; priority?: boolean; editable?: boolean}) {
  const { editMode } = useEditMode();
  const [failed, setFailed] = useState(false);
  const data = artwork[world];
  if (editable && editMode && world !== 'story') {
    const alt = world === 'members' ? 'Members' : world === 'partners' ? 'Luna Partners' : 'Luna Characters';
    return <EImg editId={data.field} source={world === 'characters' ? undefined : 'r2'} alt={alt} fill src={data.original} priority={priority} />;
  }
  if (editable) return <NightProjection scene={world} priority={priority}/>;
  const base = '/luna-cinematic/night-worlds/' + world;
  return <img alt="" src={failed ? data.fallback : base + '-1920.webp'}
    srcSet={failed ? undefined : base + '-960.webp 960w, ' + base + '-1920.webp 1920w'}
    sizes="100vw" width={1920} height={1080} loading={priority ? 'eager' : 'lazy'}
    fetchPriority={priority ? 'high' : 'auto'} onError={failed ? undefined : () => setFailed(true)} />;
}

type Props = { world: World; locale: string; title: ReactNode; description: ReactNode; badge?: ReactNode; secondary?: ReactNode };

export function WorldStage({ world, locale, title, description, badge, secondary }: Props) {
  const ar = locale === 'ar';
  const { editMode } = useEditMode();
  const [view, setView] = useState(0);
  const [crossing, setCrossing] = useState(50);
  const [lamps, setLamps] = useState(false);
  const entry = {
    characters: ['#c7-portrait-archive', ar ? 'افتح سجلّ الشخصيات' : 'Open the portrait archive'],
    partners: ['#alliance-register', ar ? 'دليل الشركاء' : 'Alliance directory'],
    story: ['#chapter-1', ar ? 'ابدأ القراءة' : 'Begin reading'],
    members: ['#members-directory', ar ? 'ابحث عن عضو' : 'Find a member']
  }[world];
  const viewNames = ar ? ['المشهد الكامل','منضدة الخياطة','رفّ الأزياء'] : ['Full room','Sewing table','Costume rail'];
  const lensLabel = ar ? 'زاوية رؤية المرسم' : 'Atelier view';
  return <header className={s.stage + ' ' + s[world]} data-night-world={world} data-view={view} data-lamps={lamps || undefined} data-world-editing={editMode || undefined}
    style={{'--cross-x': ((50-crossing)*.11)+'%', '--cross-focus': (26+crossing*.48)+'%'} as CSSProperties}>
    <div className={s.plate} aria-hidden={editMode ? undefined : true}><WorldPicture world={world} priority editable /></div>
    <div className={s.stageScrim} aria-hidden="true" />
    <div className={s.stageCopy}>
      {badge && <p className={s.kicker}>{badge}</p>}
      <h1>{title}</h1>
      <p className={s.description}>{description}</p>
      <div className={s.actions}><a className={s.primary} href={entry[0]} onClick={world === 'members' ? () => {
        window.requestAnimationFrame(() => document.getElementById('members-search')?.focus({ preventScroll: true }));
      } : undefined}>{entry[1]} <span aria-hidden="true">↓</span></a>{secondary}</div>
    </div>
    {world === 'characters' && <div className={s.camera} role="group" aria-label={lensLabel}>
      {viewNames.map((label,i)=><button type="button" key={label} aria-label={label} title={label} aria-pressed={view === i} onClick={()=>setView(i)}>
        <span className={s.viewIcon} aria-hidden="true" data-lens={i}/><span>{label}</span>
      </button>)}
    </div>}
    {world === 'partners' && <label className={s.crossing}>
      <span>{ar ? 'اعبر الجسر' : 'Cross the bridge'}</span>
      <input type="range" min="0" max="100" value={crossing} onChange={e=>setCrossing(Number(e.target.value))}
        aria-valuetext={(ar ? 'الموضع ' : 'Crossing ')+crossing+'%'} />
    </label>}
    {world === 'members' && <button className={s.lantern} type="button" aria-pressed={lamps} onClick={()=>setLamps(!lamps)}>
      <span className={s.lampGlyph} aria-hidden="true"/>{lamps ? (ar ? 'خفّض ضوء الفوانيس' : 'Dim the lanterns') : (ar ? 'أضئ الفوانيس' : 'Light the lanterns')}
    </button>}
    {!editMode && <div className={s.filmControl}><NightFilmSwitch ar={ar}/></div>}
  </header>;
}

