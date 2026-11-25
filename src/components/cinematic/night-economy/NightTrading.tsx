'use client';

import { useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { E } from '@/components/edit-mode/EditableText';
import { NightProjection } from '@/components/cinematic/NightProjection';
import { projectTrade, type TradeTerms } from '@/lib/cinematic/night-economy-pricing';
import s from './NightTrading.module.css';

export function TradingQuay({ terms }: { terms: TradeTerms }) {
  const t = useTranslations('tradingPage');
  const locale = useLocale();
  const ar = locale === 'ar';
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
  return <header className={s.quay} data-night-trading="quay">
    <div className={s.quayImage}><NightProjection scene="trading" priority position="53% 53%" /></div>
    <div className={s.quayCopy}>
      <h1><E ns="tradingPage" k="title">{t('title')}</E></h1>
      <p><E ns="tradingPage" k="subtitle">{t('subtitle')}</E></p>
      <a className={s.entry} href="#night-trade-model">{ar ? 'زِن الصفقة' : 'Weigh a trade'}<span aria-hidden="true">↓</span></a>
    </div>
    <dl className={s.ticker}>
      <div><dt>{t('maxTrade')}</dt><dd>{terms.maximum.toLocaleString(locale)}</dd></div>
      <div><dt>{t('winChance')}</dt><dd>{percent.format(terms.winChance)}</dd></div>
      <div><dt>{t('cooldown')}</dt><dd>{(terms.cooldownMs / 3_600_000).toLocaleString(locale)} {t('hours')}</dd></div>
    </dl>
  </header>;
}

export function TradeModel({ terms, onApply }: { terms: TradeTerms; onApply?: (amount: number) => void }) {
  const t = useTranslations('tradingPage');
  const locale = useLocale();
  const ar = locale === 'ar';
  const [amount, setAmount] = useState(Math.min(5000, terms.maximum));
  const [side, setSide] = useState<'win' | 'loss'>('win');
  const n = new Intl.NumberFormat(locale);
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
  const { win, loss } = projectTrade(amount, terms);
  const presets = Array.from(new Set([5000, 10000, 25000, 50000, terms.maximum].filter(v => v > 0 && v <= terms.maximum))).sort((a,b) => a-b);
  const beamAngle = (side === 'win' ? -1 : 1) * (3 + 9 * amount / Math.max(1, terms.maximum));
  return <section className={s.model} id="night-trade-model" data-night-trading="model" aria-labelledby="night-trade-heading">
    <div className={s.controls}>
      <h2 id="night-trade-heading">{ar ? 'ميزان الصفقة' : 'Trade balance'}</h2>
      <label htmlFor="night-trade-amount">{ar ? 'مبلغ تجريبي باللوناري' : 'Preview amount in Lunari'}</label>
      <output htmlFor="night-trade-amount" className={s.amount}>{n.format(amount)}</output>
      <input id="night-trade-amount" type="range" min={1} max={terms.maximum} value={amount} onChange={e => setAmount(Number(e.target.value))} />
      <div className={s.presets}>
        {presets.map(preset => <button type="button" key={preset} aria-pressed={amount === preset} data-trade-amount={preset} onClick={() => setAmount(preset)}>{n.format(preset)}</button>)}
      </div>
    </div>
    <div className={s.instrument} data-trade-outcome={side} style={{'--beam-angle': beamAngle + 'deg'} as CSSProperties}>
      <div className={s.scale} aria-hidden="true"><span className={s.stand} /><div className={s.beam}><span className={s.pan} /><span className={s.pan} /></div></div>
      <div className={s.outcomes}>
        <button type="button" data-trade-side="win" aria-pressed={side === 'win'} onClick={() => setSide('win')}>{t('winReward')}<strong dir="ltr">+{pct.format(terms.winRate)}</strong></button>
        <button type="button" data-trade-side="loss" aria-pressed={side === 'loss'} onClick={() => setSide('loss')}>{t('lossPenalty')}<strong dir="ltr">−{pct.format(terms.lossRate)}</strong></button>
      </div>
      <div className={s.result} aria-live="polite"><span>{side === 'win' ? t('winReward') : t('lossPenalty')}</span><output key={side + '-' + amount} data-trade-delta={side === 'win' ? win : -loss} dir="ltr">{side === 'win' ? '+' : '−'}{n.format(side === 'win' ? win : loss)}</output></div>
    </div>
    <div className={s.modelFoot}>
      <p>{t('warning')}</p>
      {onApply ? <button type="button" onClick={() => { onApply(amount); document.getElementById('night-trade-desk')?.scrollIntoView({ block: 'start' }); }}>{ar ? 'استخدم هذا المبلغ' : 'Use this amount'}<span aria-hidden="true">↓</span></button>
        : <a href="#night-trade-desk">{ar ? 'انتقل إلى شباك التداول' : 'Go to the trading desk'}<span aria-hidden="true">↓</span></a>}
    </div>
  </section>;
}

