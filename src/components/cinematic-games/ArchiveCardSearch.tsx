'use client';

import React from 'react';

const messages = {
  en: { label:'Search the collection', placeholder:'Search by name…', noResults:'No matching results.', results:'Results: ' },
  ar: { label:'بحث في المجموعة', placeholder:'ابحث بالاسم…', noResults:'لا توجد نتائج مطابقة.', results:'النتائج: ' },
};
const counts = { en:new Intl.NumberFormat('en'), ar:new Intl.NumberFormat('ar') };

export function ArchiveCardSearch({ locale, query, count, onQuery }: {
  locale: 'ar' | 'en';
  query: string;
  count: number;
  onQuery: (value: string) => void;
}) {
  const copy = messages[locale];
  return (
    <div className="luna-archive-search catalog-search">
      <label className="catalog-search-label" htmlFor="catalog-search-input">{copy.label}</label>
      <input className="catalog-search-input" id="catalog-search-input" type="search" autoComplete="off"
        placeholder={copy.placeholder} value={query} onChange={event => onQuery(event.target.value)} />
      <p className="catalog-search-status" role="status" aria-live="polite">
        {count === 0 ? copy.noResults : copy.results + counts[locale].format(count)}
      </p>
    </div>
  );
}
