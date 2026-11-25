'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import { Link } from '@/i18n/routing';
// import { useSearchParams } from 'next/navigation'; // hidden — Stripe not yet active
// import LunariStore from './LunariStore'; // hidden — Stripe not yet active
import type { CatalogResponse } from '@/types/bazaar';
import { dispatchBalanceUpdate } from '@/lib/balance-events';
import LunariIcon from '@/components/LunariIcon';
import { E } from '@/components/edit-mode/EditableText';
import { EImg } from '@/components/edit-mode/EditableImage';
import { BazaarTrack, BazaarOverlay } from '@/components/cinematic/economy/EconomyScenes';
import { MarketGate, MarketRegister } from '@/components/cinematic/night-economy/NightMarket';
import night from '@/components/cinematic/night-economy/NightMarket.module.css';
import { rememberShelf, useShelfRestoration } from '@/components/cinematic/economy/shelf-navigation';
import { useEditMode } from '@/lib/edit-mode/context';
import { cinematicBazaarHero, cinematicMerchantHero } from '@/lib/cinematic/economy-assets';
import '@/styles/luna-cinematic-economy.css';
import '@/styles/luna-cinematic-bazaar-entry.css';

const MERCHANTS = [
  {
    slug: 'kael',
    image: 'https://assets.lunarian.app/shops/kael_vandar.png',
    nameKey: 'kael.name',
    titleKey: 'kael.title',
    descKey: 'kael.desc',
  },
  {
    slug: 'meluna',
    image: 'https://assets.lunarian.app/icons/meluna.png',
    nameKey: 'meluna.name',
    titleKey: 'meluna.title',
    descKey: 'meluna.desc',
  },
  {
    slug: 'zoldar',
    image: 'https://assets.lunarian.app/shops/zoldar_mooncarver.png',
    nameKey: 'zoldar.name',
    titleKey: 'zoldar.title',
    descKey: 'zoldar.desc',
  },
  {
    slug: 'seluna',
    image: 'https://assets.lunarian.app/icons/seluna.png',
    nameKey: 'seluna.name',
    titleKey: 'seluna.title',
    descKey: 'seluna.desc',
  },
  {
    slug: 'brimor',
    image: 'https://assets.lunarian.app/shops/brimor.png',
    nameKey: 'brimor.name',
    titleKey: 'brimor.title',
    descKey: 'brimor.desc',
  },
  {
    slug: 'mells',
    image: 'https://assets.lunarian.app/shops/mells_selvair.png',
    nameKey: 'mells.name',
    titleKey: 'mells.title',
    descKey: 'mells.desc',
  },
] as const;

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default function BazaarContent() {
  const t = useTranslations('bazaarPage');
  const locale = useLocale();
  const { editMode } = useEditMode();
  useShelfRestoration(!editMode);
  // A document navigation starts a scrolled-to merchant's cinematic at its first frame.
  const MerchantCardLink = editMode ? Link : 'a';
  const { data: session } = useSession();
  // const searchParams = useSearchParams(); // hidden — Stripe not yet active

  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [hasDebt, setHasDebt] = useState(false);
  // const [purchaseStatus, setPurchaseStatus] = useState<string | null>(null); // hidden — Stripe not yet active

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/bazaar/catalog');
      if (!res.ok) throw new Error('Catalog fetch failed');
      const data: CatalogResponse = await res.json();
      if (!data.luckboxTiers) throw new Error('Invalid catalog data');
      setCatalog(data);
      if (data.user) {
        setBalance(data.user.balance);
        setHasDebt(data.user.hasDebt);
      }
    } catch (err) {
      console.error('Failed to fetch catalog:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Handle Stripe redirect (hidden — Stripe not yet active)
  // useEffect(() => {
  //   const purchase = searchParams.get('purchase');
  //   if (purchase === 'success') {
  //     setPurchaseStatus('success');
  //     setTimeout(fetchCatalog, 2000);
  //   } else if (purchase === 'cancelled') {
  //     setPurchaseStatus('cancelled');
  //   }
  // }, [searchParams, fetchCatalog]);

  useEffect(() => {
    if (balance > 0) {
      dispatchBalanceUpdate(balance);
    }
  }, [balance]);

  return (
    <main lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={editMode ? undefined : night.marketPage} data-economy-route={editMode ? undefined : "bazaar"}>
      {/* Hero */}
      {editMode ? <BazaarTrack scene="hub">
      <section className="bazaar-hero cinematic-economy-hero cinematic-economy-hero--bazaar">
        <div className="bazaar-hero-bg">
          <EImg editId="bazaar-hero-bg" src={cinematicBazaarHero} alt={t('title')} fill sizes="100vw" priority className="bazaar-hero-bg-image" />
        </div>
        <div className="bazaar-hero-content">
          <h1 className="bazaar-hero-title"><E ns="bazaarPage" k="title">{t('title')}</E></h1>
          <p className="bazaar-hero-desc"><E ns="bazaarPage" k="subtitle">{t('subtitle')}</E></p>
        </div>
        <BazaarOverlay scene="hub" />
      </section>
      </BazaarTrack> : <MarketGate />}

      <div className="bazaar-wrap">
        {/* Purchase status banner (hidden — Stripe not yet active) */}

        {/* Balance Bar */}
        {session?.user && (
          <div className="bazaar-balance-bar" style={{ marginBottom: 24 }}>
            <div className="bazaar-balance-info">
              <LunariIcon size={20} />
              <span className="bazaar-balance-label"><E ns="bazaarPage" k="balance">{t('balance')}</E>:</span>
              <span className="bazaar-balance-value">{isLoading ? '...' : formatNumber(balance)}</span>
              <span className="bazaar-balance-currency"><E ns="bazaarPage" k="lunariLabel">{t('lunariLabel')}</E></span>
            </div>
            {hasDebt && (
              <span className="bazaar-debt-badge"><E ns="bazaarPage" k="inDebt">{t('inDebt')}</E></span>
            )}
          </div>
        )}

        {/* Merchant Showcase */}
        {editMode ? <section className="merchants-section">
          <h2 className="merchants-heading"><E ns="bazaarPage" k="merchantsHeading">{t('merchantsHeading')}</E></h2>

          <div className="merchant-showcase">
            {MERCHANTS.map((merchant) => (
              <MerchantCardLink
                key={merchant.slug}
                href={editMode ? `/bazaar/${merchant.slug}` : `/${locale}/bazaar/${merchant.slug}/`}
                className="merchant-card"
                onClick={editMode ? undefined : rememberShelf}
              >
                <img
                  src={editMode ? (catalog?.merchants?.[merchant.slug] ?? merchant.image) : cinematicMerchantHero(merchant.slug)}
                  alt={t(merchant.nameKey)}
                  className="merchant-card-img"
                  loading="lazy"
                />
                <div className="merchant-card-info">
                  <span className="merchant-card-name"><E ns="bazaarPage" k={merchant.nameKey}>{t(merchant.nameKey)}</E></span>
                  <span className="merchant-card-title"><E ns="bazaarPage" k={merchant.titleKey}>{t(merchant.titleKey)}</E></span>
                </div>
                <p className="merchant-card-desc"><E ns="bazaarPage" k={merchant.descKey}>{t(merchant.descKey)}</E></p>
                <span className="merchant-card-cta">
                  <E ns="bazaarPage" k="visitShop">{t('visitShop')}</E>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </MerchantCardLink>
            ))}
          </div>
        </section> : <MarketRegister />}

        {/* Lunari Store Section (hidden — Stripe not yet active) */}
      </div>
    </main>
  );
}
