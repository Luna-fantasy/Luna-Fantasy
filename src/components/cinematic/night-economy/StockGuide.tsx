'use client';

import { useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { CatalogResponse } from '@/types/bazaar';
import { applyPassportDiscount } from '@/components/PassportPrice';
import type { MerchantScene } from '@/components/cinematic/economy/EconomyScenes';
import s from './NightMarket.module.css';

export function StockGuide({ merchant, catalog, hasPassport }: { merchant: MerchantScene; catalog: CatalogResponse; hasPassport: boolean }) {
  const locale = useLocale();
  const ar = locale === 'ar';
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const [choice, setChoice] = useState('');
  let title: string;
  let caption: string;
  let choices: { id: string; name: string; measure: number }[];
  switch (merchant) {
    case 'kael':
      title = ar ? 'دليل صناديق الحظ' : 'Luckbox catalogue';
      caption = ar ? 'البطاقات المتاحة' : 'Cards in this tier';
      choices = catalog.luckboxTiers.map(box => ({ id: box.tier, name: box.label, measure: box.cardCount }));
      break;
    case 'meluna':
      title = ar ? 'سجل الأحجار' : 'Stone register';
      caption = ar ? 'احتمال السحب' : 'Listed drop chance';
      choices = catalog.stoneBox.stones.filter(stone => stone.weight > 0).map(stone => ({ id: stone.name, name: stone.name, measure: stone.dropPercent }));
      break;
    case 'zoldar':
      title = ar ? 'مقارنة حزم التذاكر' : 'Ticket bundle comparison';
      caption = ar ? 'لوناري للتذكرة' : 'Lunari per ticket';
      choices = catalog.ticketPackages.filter(pack => pack.tickets > 0).map(pack => ({ id: pack.id, name: pack.name, measure: applyPassportDiscount(pack.price, hasPassport) / pack.tickets }));
      break;
    default: return null;
  }
  const selected = choices.find(option => option.id === choice) ?? choices[0];
  if (!selected) return null;
  const maximum = merchant === 'meluna' ? 100 : Math.max(1, ...choices.map(item => item.measure));
  const value = merchant === 'meluna' ? new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(selected.measure / 100) : n.format(selected.measure);
  return <section className={s.stockGuide} data-stock-guide={merchant}>
    <div><h2>{title}</h2><select aria-label={title} data-stock-select value={selected.id} onChange={e => setChoice(e.target.value)}>
      {choices.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select></div>
    <div className={s.stockResult}><span>{caption}</span><output aria-live="polite" key={selected.id}>{value}</output>
      <div className={s.measure} aria-hidden="true" style={{ '--stock-ratio': Math.max(0, Math.min(1, selected.measure / maximum)) } as CSSProperties}><i /></div>
    </div>
  </section>;
}

export function StallCalendar({ active, endsAt, nextOpenAt }: { active: boolean; endsAt: number | null; nextOpenAt: number | null }) {
  const locale = useLocale();
  const ar = locale === 'ar';
  const t = useTranslations('bazaarPage');
  const [show, setShow] = useState(false);
  const when = active ? endsAt : nextOpenAt;
  return <section className={s.calendar} data-stock-guide="seluna">
    <h2>{ar ? 'ساعات المتجر المتنقّل' : 'Travelling stall hours'}</h2>
    <button type="button" aria-expanded={show} aria-controls="seluna-opening-window" data-shop-hours onClick={() => setShow(!show)}>
      {ar ? 'تفاصيل الموعد' : 'View trading hours'}<span aria-hidden="true">{show ? '−' : '+'}</span>
    </button>
    {show && <div id="seluna-opening-window" aria-live="polite"><strong>{active ? t('seluna.shopOpen') : t('seluna.shopClosed')}</strong>
      <p>{when && Number.isFinite(new Date(when).getTime())
        ? (active ? (ar ? 'تغلق في ' : 'Closes ') : (ar ? 'تفتح في ' : 'Opens ')) + new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(when))
        : ar ? 'لم يُعلن موعد محدد.' : 'No time has been announced.'}</p>
    </div>}
  </section>;
}

