'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { E } from '@/components/edit-mode/EditableText';
import { Lightbox } from '@/components/Lightbox';
import { NightProjection } from '@/components/cinematic/NightProjection';
import { useMerchantEntry, rememberShelf, backToShelf } from '@/components/cinematic/economy/shelf-navigation';
import { cinematicMerchantHero } from '@/lib/cinematic/economy-assets';
import s from './NightMarket.module.css';

export const merchantWalk = ['kael', 'meluna', 'zoldar', 'seluna', 'brimor', 'mells'] as const;
type Merchant = typeof merchantWalk[number];

const crafts: Record<Merchant, [string, string]> = {
  kael: ['The luckbox vault', 'خزنة صناديق الحظ'],
  meluna: ['The stone cabinet', 'خزانة الأحجار'],
  zoldar: ['The ticket press', 'مطبعة التذاكر'],
  seluna: ['The travelling stall', 'المتجر المتنقّل'],
  brimor: ['The loom', 'النول'],
  mells: ['The portrait studio', 'مرسم الصور'],
};

export function MarketGate() {
  const t = useTranslations('bazaarPage');
  const ar = useLocale() === 'ar';
  return <header className={s.gate} data-night-market="gate">
    <NightProjection scene="bazaar" priority position="50% 50%" />
    <div className={s.gateScrim} aria-hidden="true" />
    <div className={s.gateCopy}>
      <h1><E ns="bazaarPage" k="title">{t('title')}</E></h1>
      <p><E ns="bazaarPage" k="subtitle">{t('subtitle')}</E></p>
      <a className={s.gateLink} href="#night-market-register">{ar ? 'تصفّح المتاجر' : 'Browse the stalls'}<span aria-hidden="true">↓</span></a>
    </div>
  </header>;
}

export function MarketRegister() {
  const locale = useLocale();
  const t = useTranslations('bazaarPage');
  const ar = locale === 'ar';
  const [selected, setSelected] = useState<(typeof merchantWalk)[number]>('kael');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const restore = () => {
      const saved = history.state?.nightMarketStall;
      if (merchantWalk.includes(saved)) setSelected(saved);
    };
    restore();
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);
  const active = merchantWalk.indexOf(selected);
  const choose = (index: number, moveFocus = false) => {
    const position = (index + merchantWalk.length) % merchantWalk.length;
    setSelected(merchantWalk[position]);
    history.replaceState({ ...history.state, nightMarketStall: merchantWalk[position] }, '');
    if (moveFocus) tabs.current[position]?.focus({ preventScroll: true });
  };
  const keys = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const direction: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, ArrowRight: ar ? -1 : 1, ArrowLeft: ar ? 1 : -1 };
    if (!(e.key in direction) && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    choose(e.key === 'Home' ? 0 : e.key === 'End' ? merchantWalk.length - 1 : index + direction[e.key], true);
  };
  return <section className={s.register} id="night-market-register" data-night-market="register" aria-labelledby="night-market-heading">
    <div className={s.stallIndex}>
      <h2 id="night-market-heading"><E ns="bazaarPage" k="merchantsHeading">{t('merchantsHeading')}</E></h2>
      <div className={s.stalls} role="tablist" aria-labelledby="night-market-heading">
        {merchantWalk.map((merchant, index) => <button role="tab" key={merchant} id={'stall-' + merchant}
          type="button" data-market-stall={merchant} aria-selected={selected === merchant} aria-controls="night-market-pane"
          tabIndex={selected === merchant ? 0 : -1} ref={el => { tabs.current[index] = el; }}
          onKeyDown={e => keys(e, index)} onClick={() => choose(index)}>
          <span>{t(merchant + '.name')}</span><i aria-hidden="true">↗</i>
        </button>)}
      </div>
    </div>
    <div className={s.counter} role="tabpanel" id="night-market-pane" aria-labelledby={'stall-' + selected} data-market-preview={selected}>
      <div className={s.panorama} key={selected}>
        <a href={'/' + locale + '/bazaar/' + selected + '/'} onClick={rememberShelf} tabIndex={-1} aria-hidden="true">
          <img src={cinematicMerchantHero(selected)} alt="" width="1320" height="744" decoding="async" />
        </a>
      </div>
      <div className={s.stallCopy}>
        <div><div className={s.specialty}>{t(selected + '.title')}</div>
          <h3>{t(selected + '.name')}</h3><p>{t(selected + '.desc')}</p>
          <a className={s.shopLink} data-market-enter={selected} href={'/' + locale + '/bazaar/' + selected + '/'} onClick={rememberShelf}>{t('visitShop')}<span aria-hidden="true">↗</span></a>
        </div>
        <div className={s.walkArrows}>
          <button type="button" onClick={() => choose(active - 1)} aria-label={ar ? 'التاجر السابق' : 'Previous merchant'}><span aria-hidden="true">{ar ? '→' : '←'}</span></button>
          <button type="button" data-market-next onClick={() => choose(active + 1)} aria-label={ar ? 'التاجر التالي' : 'Next merchant'}><span aria-hidden="true">{ar ? '←' : '→'}</span></button>
        </div>
      </div>
    </div>
  </section>;
}

export function ShopFront({ merchant }: { merchant: Merchant }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('bazaarPage');
  const locale = useLocale();
  const ar = locale === 'ar';
  const image = cinematicMerchantHero(merchant);
  useMerchantEntry(true);
  return <>
    <header className={s.shopFront} data-night-shop={merchant} data-cinematic-merchant={merchant}>
      <div className={s.shopArtwork}>
        <div className={s.shopPortrait}>
          <img src={image} alt={t(merchant + '.name')} fetchPriority="high" decoding="async" width="1320" height="744" />
        </div>
        <button className={s.viewArt} type="button" data-shop-enlarge onClick={() => setOpen(true)} aria-label={ar ? 'تكبير لوحة التاجر' : 'Enlarge merchant artwork'}><span aria-hidden="true">⛶</span></button>
      </div>
      <div className={s.shopCopy}>
        <a className={s.back} href={'/' + locale + '/bazaar/'} onClick={backToShelf}><span aria-hidden="true">{ar ? '→' : '←'}</span>{t('backToBazaar')}</a>
        <p className={s.specialty}>{t(merchant + '.title')}</p>
        <h1>{t(merchant + '.name')}</h1>
        <p className={s.biography}>{t(merchant + '.desc')}</p>
        <nav className={s.shopActions} aria-label={ar ? 'أقسام المتجر' : 'Shop sections'}>
          <a href="#merchant-offers" data-shop-go="offers">{ar ? 'تصفّح المعروضات' : 'Browse the stock'}<span aria-hidden="true">↓</span></a>
          <a href="#night-shop-workshop" data-shop-go="workshop">{crafts[merchant][ar ? 1 : 0]}<span aria-hidden="true">↓</span></a>
        </nav>
      </div>
    </header>
    <Lightbox isOpen={open} imageSrc={image} alt={t(merchant + '.name')} title={t(merchant + '.title')} onClose={() => setOpen(false)} />
  </>;
}

export function ShopPassage({ merchant }: { merchant: Merchant }) {
  const locale = useLocale();
  const ar = locale === 'ar';
  const t = useTranslations('bazaarPage');
  const next = merchantWalk[(merchantWalk.indexOf(merchant) + 1) % merchantWalk.length];
  return <nav className={s.passage} data-shop-passage={next} aria-label={ar ? 'ممر البازار' : 'Bazaar passage'}>
    <a className={s.dismiss} href={'/' + locale + '/bazaar/'} onClick={backToShelf}>{t('backToBazaar')}</a>
    <a className={s.nextDoor} href={'/' + locale + '/bazaar/' + next + '/'}>
      <img src={cinematicMerchantHero(next)} alt="" width="320" height="180" loading="lazy" />
      <span><small>{ar ? 'المتجر التالي' : 'Next stall'}</small><strong>{t(next + '.name')}</strong></span>
      <b aria-hidden="true">{ar ? '←' : '→'}</b>
    </a>
  </nav>;
}

