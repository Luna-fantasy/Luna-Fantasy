'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { PortraitLens } from '@/app/[locale]/characters/PortraitLens';
import { nativeArtworkViewerSrc } from '@/lib/cinematic/native-art-url';
import type { SectionWindowScene } from '@/lib/cinematic/section-window';
import { useNightMotion } from './NightProjection';
import { notifySceneDialogChange } from './HarbourFilm';
import styles from './SectionArtDialog.module.css';

const artworks: Record<string, readonly [english: string, arabic: string, release?: string]> = {
  home: ['The illuminated quay', 'رصيف لونا عند الغسق', 'LUNA-0001'],
  story: ['After the battle', 'بعد المعركة', 'LUNA-0803'],
  cast: ['The portrait archive', 'أرشيف الشخصيات'],
  dealer: ['The card table', 'طاولة الكروت'],
  grand: ['The conjurer’s hand', 'يد الساحر'],
  council: ['The faction council', 'مجلس الفصائل'],
  members: ['The still waters', 'المياه الساكنة', 'LUNA-0740'],
  partners: ['The alliance bridge', 'جسر التحالفات', 'LUNA-0800'],
  bank: ['The paymaster’s counter', 'منضدة أمين الخزينة'],
  bazaar: ['The merchant quarter', 'حيّ التجّار', 'LUNA-0795'],
  kael: ['Forgefall Spires', 'أبراج الحدادة', 'LUNA-0749'],
  meluna: ['Meluna’s specimens', 'عينات ميلونا'],
  zoldar: ['Gearwright Hall', 'قاعة صنّاع التروس', 'LUNA-0752'],
  seluna: ['The rose garden', 'حديقة الورد', 'LUNA-0767'],
  brimor: ['Brimor’s loom', 'نول بريمور'],
  mells: ['The observatory', 'المرصد', 'LUNA-0762'],
  trading: ['The exchange hall', 'قاعة التبادل'],
  marketplace: ['The market alley', 'زقاق السوق', 'LUNA-0761'],
  about: ['The sundial', 'الساعة الشمسية', 'LUNA-0776'],
  faq: ['The library', 'المكتبة', 'LUNA-0755'],
  contact: ['Silverbeach Gate', 'بوابة الشاطئ الفضي', 'LUNA-0772'],
  privacy: ['The bank vault', 'خزنة البنك', 'LUNA-0737'],
  terms: ['The royal hall', 'القاعة الملكية', 'LUNA-0769'],
  refund: ['The canal', 'القناة المائية', 'LUNA-0766'],
  profile: ['The green atrium', 'البهو الأخضر', 'LUNA-0781'],
  signin: ['The city gate', 'بوّابة المدينة', 'LUNA-0742'],
  unlisted: ['The atlas at dusk', 'الأطلس عند الغسق'],
};

export function SectionArtDialog({ scene, ar, onDismiss }: {
  scene: SectionWindowScene;
  ar: boolean;
  onDismiss: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const motion = useNightMotion();
  const heading = useId();
  const [nativeFailed, setNativeFailed] = useState(false);
  const [english, arabic, release] = artworks[scene.id] ?? artworks.unlisted;
  const title = ar ? arabic : english;
  const fallback = scene.id === 'home' ? '/luna-cinematic/home-story/home/quay-2560.webp' : scene.art;
  const source = (!nativeFailed && nativeArtworkViewerSrc(release)) || fallback;
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!element.open) element.showModal();
    notifySceneDialogChange();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      notifySceneDialogChange();
    };
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={heading} dir={ar ? 'rtl' : 'ltr'}
    data-section-art-dialog={scene.id} data-motion={motion} onClose={onDismiss}
    onKeyDown={event => {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
      const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.target !== (event.shiftKey ? first : last)) return;
      event.preventDefault();
      (event.shiftKey ? last : first).focus({ preventScroll: true });
    }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.current?.close();
    }}>
    <header className={styles.head}>
      <h2 id={heading}>{title}</h2>
      <button type="button" data-close-scene onClick={() => dialog.current?.close()} autoFocus>{ar ? 'إغلاق' : 'Close'} <span aria-hidden="true">×</span></button>
    </header>
    <PortraitLens key={source} locale={ar ? 'ar' : 'en'} subject="scene" overviewSrc={source}>
      <img src={source} alt={title} draggable={false} onError={() => { if (source !== fallback) setNativeFailed(true); }} />
    </PortraitLens>
  </dialog>;
}
