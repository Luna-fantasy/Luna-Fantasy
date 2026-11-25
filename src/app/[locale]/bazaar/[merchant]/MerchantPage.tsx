'use client';

import { useLocale, useTranslations } from 'next-intl';
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
import { dispatchBalanceUpdate, onBalanceUpdate } from '@/lib/balance-events';
import LunariIcon from '@/components/LunariIcon';
import { E } from '@/components/edit-mode/EditableText';
import { EImg } from '@/components/edit-mode/EditableImage';
import { BazaarTrack, BazaarOverlay, MerchantSequence } from '@/components/cinematic/economy/EconomyScenes';
import { backToShelf } from '@/components/cinematic/economy/shelf-navigation';
import { ShopFront, ShopPassage } from '@/components/cinematic/night-economy/NightMarket';
import { StockGuide } from '@/components/cinematic/night-economy/StockGuide';
import night from '@/components/cinematic/night-economy/NightMarket.module.css';
import { cinematicMerchantHero } from '@/lib/cinematic/economy-assets';
import { useEditMode } from '@/lib/edit-mode/context';
import '@/styles/luna-cinematic-economy.css';
import '@/styles/luna-cinematic-bazaar-entry.css';

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

export default function MerchantPage({ merchant, cinematicPresentation }: { merchant: MerchantSlug; cinematicPresentation: boolean }) {
  const locale = useLocale();
  const t = useTranslations('bazaarPage');
  const { data: session, status: sessionStatus } = useSession();
  const { editMode } = useEditMode();
  const cinematic = cinematicPresentation && !editMode;

  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [balance, setBalance] = useState(0);
  const [tickets, setTickets] = useState(0);
  const [hasDebt, setHasDebt] = useState(false);
  const [hasPassport, setHasPassport] = useState(false);
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const buyAgainRef = useRef<(() => void) | null>(null);

  const config = MERCHANT_CONFIG[merchant];

  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    setCatalogFailed(false);
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
    } catch {
      setCatalogFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => onBalanceUpdate(setBalance), []);

  const updateBalance = (newBalance: number) => {
    setBalance(newBalance);
    dispatchBalanceUpdate(newBalance);
  };

  const updateTickets = (newTickets: number) => {
    setTickets(newTickets);
  };

  return (
    <main lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={cinematic ? night.shopPage : undefined} data-economy-route={cinematic ? "bazaar/" + merchant : undefined}>
      {/* Hero */}
      {cinematic ? <ShopFront merchant={merchant} /> : <BazaarTrack scene={merchant} enabled={cinematic}>
      <section className={cinematic ? "bazaar-hero cinematic-economy-hero cinematic-economy-hero--merchant" : "bazaar-hero"} data-cinematic-merchant={cinematic ? merchant : undefined}>
        <div className="bazaar-hero-bg">
          <EImg editId={`merchant-hero-bg-${merchant}`} src={cinematic ? cinematicMerchantHero(merchant) : "https://assets.lunarian.app/backgrounds/BazaarHero.png"} alt={t(config.nameKey)} fill sizes="100vw" priority className="bazaar-hero-bg-image" />
        </div>
        <div className="bazaar-hero-content">
          <h1 className="bazaar-hero-title"><E ns="bazaarPage" k={config.nameKey}>{t(config.nameKey)}</E></h1>
          <p className="bazaar-hero-desc"><E ns="bazaarPage" k={config.titleKey}>{t(config.titleKey)}</E></p>
        </div>
        <BazaarOverlay scene={merchant} enabled={cinematic} />
      </section>
      </BazaarTrack>}

      <div className="bazaar-wrap">
        {/* Back link */}
        {!cinematic && <><Link href="/bazaar" className="merchant-back-link" onClick={cinematic ? backToShelf : undefined}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <E ns="bazaarPage" k="backToBazaar">{t('backToBazaar')}</E>
        </Link>

        {/* Merchant Hero */}
        <div className="merchant-hero">
          <EImg
            editId={`merchant-portrait-${merchant}`}
            source="r2"
            src={cinematic ? cinematicMerchantHero(merchant) : (catalog?.merchants?.[merchant] ?? config.image)}
            alt={t(config.nameKey)}
            width={320}
            height={320}
            className="merchant-hero-img"
          />
          <div className="merchant-hero-info">
            <h2 className="merchant-hero-name"><E ns="bazaarPage" k={config.nameKey}>{t(config.nameKey)}</E></h2>
            <span className="merchant-hero-title"><E ns="bazaarPage" k={config.titleKey}>{t(config.titleKey)}</E></span>
            <p className="merchant-hero-desc"><E ns="bazaarPage" k={config.descKey}>{t(config.descKey)}</E></p>
          </div>
        </div>

        </>}

        {/* Balance Bar */}
        {session?.user && (
          <div className="bazaar-balance-bar" style={{ marginBottom: 24 }}>
            <div className="bazaar-balance-info">
              <LunariIcon size={20} />
              <span className="bazaar-balance-label"><E ns="bazaarPage" k="balance">{t('balance')}</E>:</span>
              <span className="bazaar-balance-value">{isLoading ? '...' : catalogFailed ? '—' : formatNumber(balance)}</span>
              <span className="bazaar-balance-currency"><E ns="bazaarPage" k="lunariLabel">{t('lunariLabel')}</E></span>
            </div>
            {hasDebt && (
              <span className="bazaar-debt-badge"><E ns="bazaarPage" k="inDebt">{t('inDebt')}</E></span>
            )}
          </div>
        )}

        {/* Vendor Content */}
        {cinematic && merchant !== 'brimor' && <div id="night-shop-workshop" className={night.workshop}><MerchantSequence merchant={merchant} /></div>}
        <div id="merchant-offers" className="bazaar-vendor-content">
          {sessionStatus === 'unauthenticated' && (
            <a className={night.shopLink} data-shop-signin
              href={`/${locale}/auth/signin/?${new URLSearchParams({ callbackUrl: `/${locale}/bazaar/${merchant}/#merchant-offers` })}`}
              onClick={event => {
                const { pathname, search, hash } = window.location;
                const callback = new URLSearchParams({ callbackUrl: pathname + search + (hash || '#merchant-offers') });
                event.currentTarget.href = `/${locale}/auth/signin/?${callback}`;
              }}>
              {locale === 'ar' ? 'تسجيل الدخول للشراء' : 'Sign in to buy'}
            </a>
          )}
          {catalogFailed && <div className="vendor-error" role="alert">
            <span>{locale === 'ar' ? 'تعذّر تحميل البضاعة والأسعار.' : 'Stock and prices could not be loaded.'}</span>
            <button type="button" data-catalog-retry onClick={fetchCatalog}>{locale === 'ar' ? 'إعادة المحاولة' : 'Try again'}</button>
          </div>}
          {cinematic && catalog && <StockGuide merchant={merchant} catalog={catalog} hasPassport={hasPassport} />}
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
          {merchant === 'seluna' && (sessionStatus === 'unauthenticated' || catalog) && (
            <VendorSeluna
              night={cinematic}
              balance={balance}
              hasDebt={hasDebt}
              hasPassport={hasPassport}
              isLoggedIn={!!session?.user}
            />
          )}
          {merchant === 'brimor' && (sessionStatus === 'unauthenticated' || catalog) && (
            <VendorBrimor
              night={cinematic}
              balance={balance}
              hasDebt={hasDebt}
              hasPassport={hasPassport}
              isLoggedIn={!!session?.user}
            />
          )}
          {merchant === 'mells' && (sessionStatus === 'unauthenticated' || catalog) && (
            <VendorMells
              night={cinematic}
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
        {cinematic && merchant === 'brimor' && <div id="night-shop-workshop" className={night.workshop}><MerchantSequence merchant={merchant} /></div>}
        {cinematic && <ShopPassage merchant={merchant} />}
      </div>

      {/* Reveal Modal */}
      {reveal && (
        <RevealModal
          data={reveal}
          balance={balance}
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
