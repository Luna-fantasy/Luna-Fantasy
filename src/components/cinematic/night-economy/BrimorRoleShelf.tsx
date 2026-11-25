'use client';

import { useState, type CSSProperties } from 'react';
import { useLocale } from 'next-intl';
import { archiveRoleSwatches, fittingRoleColors, needsInkEdge, type RoleSwatch } from '@/lib/bazaar/brimor-showcase';
import styles from './BrimorRoleShelf.module.css';

type Props = {
  items: readonly RoleSwatch[];
  selectedId?: string;
  onPick: (id: string) => void;
  showReference: boolean;
  unavailable: boolean;
  onRetry: () => void;
};

function dye(role?: RoleSwatch): CSSProperties {
  const colors = fittingRoleColors(role?.gradientColors);
  return {
    '--dye-first': colors[0],
    '--dye-last': colors[colors.length-1],
    '--dye-face': colors.length > 1
      ? 'linear-gradient(108deg,' + colors.join(',') + ')'
      : colors[0],
  } as CSSProperties;
}

export function BrimorRoleShelf({ items, selectedId, onPick, showReference, unavailable, onRetry }: Props) {
  const locale = useLocale();
  const ar = locale === 'ar';
  const [archiveId, setArchiveId] = useState('');
  const [sample, setSample] = useState('');
  const [light, setLight] = useState(false);
  const archive = items.length === 0 && showReference;
  const roles = archive ? archiveRoleSwatches : items;
  const selected = roles.find(role => role.id === (archive ? archiveId : selectedId)) ?? roles[0];
  const choose = archive ? setArchiveId : onPick;
  const name = sample.trim() || selected?.name || (ar ? 'لونا' : 'Luna');
  const number = new Intl.NumberFormat(locale);

  if (unavailable) return <section className={styles.shelf} data-stock-guide="brimor" data-role-catalogue="unavailable">
    <p role="status">{ar?'تعذّر تحميل بضاعة بريمور.':'Brimor’s stock could not be loaded.'}</p>
    <button type="button" className={styles.light} onClick={onRetry}>{ar?'أعد المحاولة':'Try again'}</button>
  </section>;
  return <section className={styles.shelf} data-stock-guide="brimor" data-role-catalogue={archive ? 'reference' : 'shop'}>
    <header className={styles.heading}>
      <div><h2>{ar ? 'رولات بريمور' : 'Brimor’s role collection'}</h2>
        {archive && <p>{ar ? 'معاينة التشكيلة المحفوظة. الأسعار المعروضة مرجعية.' : 'Archive preview. Prices shown are for reference.'}</p>}
        {!roles.length && <p>{ar ? 'لا توجد رولات معروضة للبيع حالياً.' : 'No roles are currently for sale.'}</p>}
      </div>
      {roles.length > 0 && <label className={styles.picker}>{ar ? 'اختيار سريع' : 'Quick selection'}
        <select data-stock-select value={selected?.id} onChange={e => choose(e.target.value)}>
          {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      </label>}
    </header>
    <div className={styles.workbench}>
      {roles.length > 0 && <div className={styles.ribbons} role="group" aria-label={ar ? 'ألوان الرولات' : 'Role colours'}>
        {roles.map(role => <button type="button" key={role.id} style={dye(role)} data-role-chip={role.id}
          aria-pressed={selected?.id === role.id} onClick={() => choose(role.id)}>
          <span className={styles.thread} aria-hidden="true" /><span dir="auto">{role.name}</span>
        </button>)}
      </div>}
      <div className={styles.fitting} style={dye(selected)} data-role-selected={selected?.id ?? ''}>
        <div className={styles.fittingTop}><h3>{ar ? 'معاينة لون الاسم' : 'Name colour preview'}</h3>
          <button type="button" data-role-backing className={styles.light} aria-pressed={light}
            onClick={() => setLight(value => !value)}><i aria-hidden="true" />{ar ? 'خلفية فاتحة' : 'Light background'}</button>
        </div>
        <div className={styles.paper} data-light={light}>
          <div key={selected?.id} className={styles.sample} data-role-paper>
            <output dir="auto" style={{ '--name-length': Math.max(7, Array.from(name).length) } as CSSProperties}>
              <bdi data-role-ink data-keyline={needsInkEdge(selected?.gradientColors, light) || undefined}>{name}</bdi>
            </output>
          </div>
        </div>
        <label className={styles.nameInput}>{ar ? 'جرّب اسمك' : 'Try your display name'}
          <input data-role-sample maxLength={32} dir="auto" value={sample} placeholder={selected?.name || (ar ? 'اسم العرض' : 'Display name')}
            onChange={event => setSample(event.target.value)} />
        </label>
        {selected && <div className={styles.selected}><strong dir="auto">{selected.name}</strong>
          <span>{archive ? (ar ? 'السعر المرجعي' : 'Reference price') : (ar ? 'السعر الأساسي' : 'List price')} <bdi>{number.format(selected.price)}</bdi> {ar ? 'لوناري' : 'Lunari'}</span></div>}
      </div>
    </div>
  </section>;
}
