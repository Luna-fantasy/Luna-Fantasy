'use client';

import { useState } from 'react';
import Icon from '../_components/Icon';

type Locale = 'en' | 'ar';

const COVERED_PAGES = [
  { label: 'Home',        path: '/', note: 'Hero, sections, CTAs' },
  { label: 'Bank',        path: '/bank', note: 'Balance, cards, copy strings' },
  { label: 'Bazaar',      path: '/bazaar', note: 'Vendors: Kael, Meluna, Zoldar, Mells, Brimor, Seluna' },
  { label: 'Faction War', path: '/faction-war', note: 'Event page content' },
  { label: 'Privacy',     path: '/privacy', note: 'Legal copy' },
];

export default function WebsiteClient() {
  const [locale, setLocale] = useState<Locale>('en');

  return (
    <div className="av-website-launch">
      <section className="av-website-card">
        <div className="av-website-sigil" aria-hidden="true">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>

        <h2 className="av-website-heading">Inline Website Editor</h2>
        <p className="av-website-intro">
          Click <strong>Edit website</strong> below and you'll land on the live site with every wrapped text node and image made editable in place. Changes collect in a top toolbar — hit <strong>Save &amp; Publish</strong> there and they persist to MongoDB (for translations / DB fields) or R2 (for images).
        </p>

        <div className="av-website-locale" role="tablist" aria-label="Locale">
          {(['en', 'ar'] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={locale === l}
              className={`av-website-locale-btn${locale === l ? ' av-website-locale-btn--active' : ''}`}
              onClick={() => setLocale(l)}
            >
              {l === 'en' ? 'English' : 'العربية'}
            </button>
          ))}
        </div>

        <a
          href={`/${locale}?editMode=1`}
          className="av-website-launch-btn"
          target="_blank"
          rel="noopener"
        >
          <Icon name="pencil" size={16} />
          <span>Edit website ({locale.toUpperCase()})</span>
          <Icon name="external" size={14} />
        </a>

        <p className="av-website-fine">
          Only Masterminds can enter edit mode. Leaving the page with unsaved changes warns you. Opens in a new tab so you can keep this admin view open for reference.
        </p>
      </section>

      <section className="av-website-coverage">
        <h3 className="av-website-coverage-title">What's editable right now</h3>
        <p className="av-website-coverage-sub">
          Pages already wrapped with <code>&lt;E&gt;</code> / <code>&lt;EImg&gt;</code> components. Other pages render as plain text until they're audited — that's a separate phase.
        </p>
        <ul className="av-website-coverage-list">
          {COVERED_PAGES.map((p) => (
            <li key={p.path}>
              <a href={`/${locale}${p.path === '/' ? '' : p.path}?editMode=1`} target="_blank" rel="noopener" className="av-website-coverage-link">
                <span className="av-website-coverage-label">
                  <Icon name="external" size={11} />
                  <strong>{p.label}</strong>
                  <code>{p.path}</code>
                </span>
                <span className="av-website-coverage-note">{p.note}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
