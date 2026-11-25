'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { E } from '@/components/edit-mode/EditableText';
import { NightProjection } from '@/components/cinematic/NightProjection';
import s from './NightBank.module.css';

type Locale = 'en' | 'ar';

export function BankAtrium({ locale, signedIn }: { locale: Locale; signedIn: boolean }) {
  const t = useTranslations('bankPage');
  const ar = locale === 'ar';
  const services = [
    ['salary', t('salary.title')], ['loans', t('loans.title')],
    signedIn ? ['investment', ar ? 'الاستثمار' : 'Investment'] : ['vip', t('insurance.title')],
  ];
  return (
    <header className={s.atrium} data-night-bank="atrium">
      <div className={s.window}>
        <NightProjection scene="bank" priority position="48% center" />
        <span className={s.frame} aria-hidden="true" />
      </div>
      <div className={s.reception}>
        <h1><E ns="bankPage" k="title">{t('title')}</E></h1>
        <p><E ns="bankPage" k="subtitle">{t('subtitle')}</E></p>
        <nav className={s.drawerIndex} aria-label={ar ? 'شبابيك البنك' : 'Bank counters'}>
          {services.map(([id, label]) => (
            <a key={id} href={'#' + (id === 'vip' ? 'vip-section' : 'night-bank-' + id)} data-bank-counter={id}>
              <span className={s.drawerMark} aria-hidden="true" /><span>{label}</span><span className={s.arrow} aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>
        {!signedIn && <a className={s.discord} href="https://discord.com/channels/1243327880478462032/1450597284600615062" target="_blank" rel="noopener noreferrer"><E ns="bankPage" k="cta">{t('cta')}</E><span aria-hidden="true"> ↗</span></a>}
      </div>
    </header>
  );
}

type LoanTerms = { tiers: number[]; interestRate: number; vipInterestRate: number; vipExactRate?: number; deadline: number; tierTerms?: { amount: number; interest: number; duration: number }[] };

export function BankLoanEstimator({ terms, locale }: { terms: LoanTerms; locale: Locale }) {
  const [chosen, setChosen] = useState<number | undefined>();
  const [vip, setVip] = useState(false);
  if (!terms.tiers.length) return null;
  const ar = locale === 'ar';
  const tier = chosen !== undefined && terms.tiers.includes(chosen) ? chosen : terms.tiers[0];
  const tierTerms = terms.tierTerms?.find(item => item.amount === tier);
  const standardRate = tierTerms?.interest ?? terms.interestRate / 100;
  const vipRate = terms.vipExactRate ?? terms.vipInterestRate / 100;
  const rate = vip ? vipRate : standardRate;
  const interest = Math.floor(tier * rate);
  const n = new Intl.NumberFormat(locale);
  return (
    <section className={s.estimator} data-night-bank="estimator" aria-labelledby="night-bank-estimate-title">
      <div className={s.settings}>
        <h2 id="night-bank-estimate-title">{ar ? 'حاسبة القرض' : 'Loan calculator'}</h2>
        <fieldset className={s.tiers}>
          <legend>{ar ? 'مبلغ القرض' : 'Loan amount'}</legend>
          {terms.tiers.map(amount => <button key={amount} type="button" aria-pressed={tier === amount} data-bank-tier={amount} onClick={() => setChosen(amount)}>{n.format(amount)}</button>)}
        </fieldset>
        <fieldset className={s.rates}>
          <legend>{ar ? 'نسبة الفائدة' : 'Interest rate'}</legend>
          <button type="button" aria-pressed={!vip} onClick={() => setVip(false)}>{ar ? 'العادية' : 'Standard'} · {n.format(standardRate * 100)}%</button>
          <button type="button" aria-pressed={vip} data-bank-rate="vip" onClick={() => setVip(true)}>VIP · {n.format(vipRate * 100)}%</button>
        </fieldset>
      </div>
      <div className={s.receipt} aria-live="polite" aria-atomic="true">
        <span>{ar ? 'إجمالي السداد التقديري' : 'Estimated repayment'}</span>
        <output key={tier + '-' + rate} data-bank-total={tier + interest}>{n.format(tier + interest)}</output>
        <span>{ar ? 'لوناري' : 'Lunari'}</span>
        <small>{ar ? 'الفائدة' : 'Interest'} · {n.format(interest)}</small>
      </div>
    </section>
  );
}

export function BankCrossing({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  return <nav className={s.crossing} aria-label={ar ? 'خدمات مرتبطة' : 'Related services'}>
    <a href={'/' + locale + '/trading/'}><span>{ar ? 'التداول' : 'Trading'}</span><b aria-hidden="true">↗</b></a>
    <a href={'/' + locale + '/bazaar/'}><span>{ar ? 'البازار' : 'Bazaar'}</span><b aria-hidden="true">↗</b></a>
  </nav>;
}

