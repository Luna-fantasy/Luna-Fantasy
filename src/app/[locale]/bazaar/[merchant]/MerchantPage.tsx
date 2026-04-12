'use client';

import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from '@/i18n/routing';
import VendorKael from '../VendorKael';
import VendorMeluna from '../VendorMeluna';
import VendorZoldar from '../VendorZoldar';
import VendorSeluna from '../VendorSeluna';
import VendorBrimor from '../VendorBrimor';
import VendorMells from '../VendorMells';
import RevealModal from '../RevealModal';
import type { CatalogResponse, RevealData } from '@/types/bazaar';
import { dispatchBalanceUpdate } from '@/lib/balance-events';
import LunariIcon from '@/components/LunariIcon';
import { E } from '@/components/edit-mode/EditableText';
import { EImg } from '@/components/edit-mode/EditableImage';

type MerchantSlug = 'kael' | 'meluna' | 'zoldar' | 'seluna' | 'brimor' | 'mells';

const MERCHANT_CONFIG: Record<MerchantSlug, {
  image: string;
  nameKey: string;
  titleKey: string;
  descKey: string;
}> = {
  kael: {
    image: 'https://assets.lunarian.app/shops/kael_vandar.png',
    nameKey: 'kael.name',
    titleKey: 'kael.title',
    descKey: 'kael.desc',
  },
  meluna: {
    image: 'https://assets.lunarian.app/icons/meluna.png',
    nameKey: 'meluna.name',
    titleKey: 'meluna.title',
    descKey: 'meluna.desc',
  },
  zoldar: {
    image: 'https://assets.lunarian.app/shops/zoldar_mooncarver.png',
    nameKey: 'zoldar.name',
    titleKey: 'zoldar.title',
    descKey: 'zoldar.desc',
  },
  seluna: {
    image: 'https://assets.lunarian.app/icons/seluna.png',
    nameKey: 'seluna.name',
    titleKey: 'seluna.title',
    descKey: 'seluna.desc',
  },
  brimor: {
    image: 'https://assets.lunarian.app/shops/brimor.png',
    nameKey: 'brimor.name',
    titleKey: 'brimor.title',
    descKey: 'brimor.desc',
  },
  mells: {
    image: 'https://assets.lunarian.app/shops/mells_selvair.png',
    nameKey: 'mells.name',
    titleKey: 'mells.title',
    descKey: 'mells.desc',
  },
};

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default function MerchantPage({ merchant }: { merchant: MerchantSlug }) {
  const t = useTranslations('bazaarPage');
  const { data: session } = useSession();

  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [tickets, setTickets] = useState(0);
  const [hasDebt, setHasDebt] = useState(false);
  const [hasPassport, setHasPassport] = useState(false);
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const buyAgainRef = useRef<(() => void) | null>(null);

  const config = MERCHANT_CONFIG[merchant];

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/bazaar/catalog');
      if (!res.ok) throw new Error('Catalog fetch failed');
      const data: CatalogResponse = await res.json();
      if (!data.luckboxTiers) throw new Error('Invalid catalog data');
      setCatalog(data);
      if (data.user) {
        setBalance(data.user.balance);
        setTickets(data.user.tickets);
        setHasDebt(data.user.hasDebt);
        setHasPassport(data.user.hasPassport ?? false);
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

  const updateBalance = (newBalance: number) => {
    setBalance(newBalance);
    dispatchBalanceUpdate(newBalance);
  };

  const updateTickets = (newTickets: number) => {
    setTickets(newTickets);
  };

  return (
    <main>
      {/* Hero */}
      <section className="bazaar-hero">
        <div className="bazaar-hero-bg">
          <EImg editId={`merchant-hero-bg-${merchant}`} src="https://assets.lunarian.app/backgrounds/BazaarHero.png" alt="Bazaar" fill priority className="bazaar-hero-bg-image" />
        </div>
        <div className="bazaar-hero-content">
          <h1 className="bazaar-hero-title"><E ns="bazaarPage" k={config.nameKey}>{t(config.nameKey)}</E></h1>
          <p className="bazaar-hero-desc"><E ns="bazaarPage" k={config.titleKey}>{t(config.titleKey)}</E></p>
        </div>
      </section>

      <div className="bazaar-wrap">
        {/* Back link */}
        <Link href="/bazaar" className="merchant-back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <E ns="bazaarPage" k="backToBazaar">{t('backToBazaar')}</E>
        </Link>

        {/* Merchant Hero */}
        <div className="merchant-hero">
          <img
            src={config.image}
            alt={t(config.nameKey)}
            className="merchant-hero-img"
          />
          <div className="merchant-hero-info">
            <h2 className="merchant-hero-name"><E ns="bazaarPage" k={config.nameKey}>{t(config.nameKey)}</E></h2>
            <span className="merchant-hero-title"><E ns="bazaarPage" k={config.titleKey}>{t(config.titleKey)}</E></span>
            <p className="merchant-hero-desc"><E ns="bazaarPage" k={config.descKey}>{t(config.descKey)}</E></p>
          </div>
        </div>

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

        {/* Vendor Content */}
        <div className="bazaar-vendor-content">
          {merchant === 'kael' && catalog && (
            <VendorKael
              tiers={catalog.luckboxTiers}
              balance={balance}
              hasDebt={hasDebt}
              hasPassport={hasPassport}
              isLoggedIn={!!session?.user}
              onPurchase={(data) => {
                setReveal(data);
                updateBalance(data.newBalance);
              }}
              onRegisterBuyAgain={(fn) => { buyAgainRef.current = fn; }}
            />
          )}
          {merchant === 'meluna' && catalog && (
            <VendorMeluna
              stoneBox={catalog.stoneBox}
              balance={balance}
              hasDebt={hasDebt}
              hasPassport={hasPassport}
              isLoggedIn={!!session?.user}
              onPurchase={(data) => {
                setReveal(data);
                updateBalance(data.newBalance);
              }}
              onRegisterBuyAgain={(fn) => { buyAgainRef.current = fn; }}
              onBalanceUpdate={updateBalance}
            />
          )}
          {merchant === 'zoldar' && catalog && (
            <VendorZoldar
              packages={catalog.ticketPackages}
              balance={balance}
              tickets={tickets}
              hasDebt={hasDebt}
              hasPassport={hasPassport}
              isLoggedIn={!!session?.user}
              onPurchase={(result) => {
                updateBalance(result.newBalance);
                updateTickets(result.totalTickets);
              }}
            />
          )}
          {merchant === 'seluna' && (
            <VendorSeluna
              balance={balance}
              hasDebt={hasDebt}
              hasPassport={hasPassport}
              isLoggedIn={!!session?.user}
            />
          )}
          {merchant === 'brimor' && (
            <VendorBrimor
              balance={balance}
              hasDebt={hasDebt}
              hasPassport={hasPassport}
              isLoggedIn={!!session?.user}
            />
          )}
          {merchant === 'mells' && (
            <VendorMells
              balance={balance}
              hasDebt={hasDebt}
              hasPassport={hasPassport}
              isLoggedIn={!!session?.user}
              userAvatar={session?.user?.image ?? undefined}
              userName={session?.user?.globalName || session?.user?.name || undefined}
            />
          )}
          {isLoading && (
            <div className="bazaar-loading">
              <div className="bazaar-loading-spinner" />
            </div>
          )}
        </div>
      </div>

      {/* Reveal Modal */}
      {reveal && (
        <RevealModal
          data={reveal}
          onClose={() => setReveal(null)}
          onBuyAnother={() => {
            setReveal(null);
            buyAgainRef.current?.();
          }}
          onBalanceUpdate={updateBalance}
        />
      )}
    </main>
  );
}
