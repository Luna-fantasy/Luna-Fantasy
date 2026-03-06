'use client';

import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
// import { useSearchParams } from 'next/navigation'; // hidden — Stripe not yet active
import { Link } from '@/i18n/routing';
// import LunariStore from './LunariStore'; // hidden — Stripe not yet active
import type { CatalogResponse } from '@/types/bazaar';
import { dispatchBalanceUpdate } from '@/lib/balance-events';
import LunariIcon from '@/components/LunariIcon';

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
    <main>
      {/* Hero */}
      <section className="bazaar-hero">
        <div className="bazaar-hero-bg" />
        <div className="bazaar-hero-content">
          <h1 className="bazaar-hero-title">{t('title')}</h1>
          <p className="bazaar-hero-desc">{t('subtitle')}</p>
        </div>
      </section>

      <div className="bazaar-wrap">
        {/* Purchase status banner (hidden — Stripe not yet active) */}

        {/* Balance Bar */}
        {session?.user && (
          <div className="bazaar-balance-bar" style={{ marginBottom: 24 }}>
            <div className="bazaar-balance-info">
              <LunariIcon size={20} />
              <span className="bazaar-balance-label">{t('balance')}:</span>
              <span className="bazaar-balance-value">{isLoading ? '...' : formatNumber(balance)}</span>
              <span className="bazaar-balance-currency">{t('lunariLabel')}</span>
            </div>
            {hasDebt && (
              <span className="bazaar-debt-badge">{t('inDebt')}</span>
            )}
          </div>
        )}

        {/* Merchant Showcase */}
        <section className="merchants-section">
          <h2 className="merchants-heading">{t('merchantsHeading')}</h2>

          <div className="merchant-showcase">
            {MERCHANTS.map((merchant) => (
              <Link
                key={merchant.slug}
                href={`/bazaar/${merchant.slug}`}
                className="merchant-card"
              >
                <img
                  src={merchant.image}
                  alt={t(merchant.nameKey)}
                  className="merchant-card-img"
                  loading="lazy"
                />
                <div className="merchant-card-info">
                  <span className="merchant-card-name">{t(merchant.nameKey)}</span>
                  <span className="merchant-card-title">{t(merchant.titleKey)}</span>
                </div>
                <p className="merchant-card-desc">{t(merchant.descKey)}</p>
                <span className="merchant-card-cta">
                  {t('visitShop')}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Lunari Store Section (hidden — Stripe not yet active) */}
      </div>
    </main>
  );
}
