'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { E } from '@/components/edit-mode/EditableText';
import { EImg } from '@/components/edit-mode/EditableImage';
import type { FooterConfig, FooterColumn } from '@/lib/admin/footer-defaults';

// SVG icons keyed by platform name
const SOCIAL_ICONS: Record<string, JSX.Element> = {
  discord: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/>
    </svg>
  ),
  instagram: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
  ),
  tiktok: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  ),
  twitter: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  youtube: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
};

const PAYMENT_SVGS = {
  visa: (
    <svg viewBox="0 0 48 32" fill="none" className="payment-icon" aria-label="Visa">
      <rect width="48" height="32" rx="4" fill="#1A1F71"/>
      <path d="M19.5 21h-3l1.9-11.5h3L19.5 21zm12.6-11.2c-.6-.2-1.5-.5-2.7-.5-3 0-5.1 1.5-5.1 3.7 0 1.6 1.5 2.5 2.6 3.1 1.2.6 1.6.9 1.6 1.4 0 .8-.9 1.1-1.8 1.1-1.2 0-1.8-.2-2.8-.6l-.4-.2-.4 2.5c.7.3 2 .6 3.3.6 3.2 0 5.2-1.5 5.2-3.8 0-1.3-.8-2.2-2.5-3.1-1-.5-1.7-.8-1.7-1.4 0-.5.5-1 1.7-1 1 0 1.7.2 2.2.4l.3.1.5-2.3zM37 9.5h-2.3c-.7 0-1.3.2-1.6 1L29 21h3.2l.6-1.7h3.9l.4 1.7H40L37 9.5zm-3.5 8.3c.3-.7 1.2-3.3 1.2-3.3l.4-1.1.2 1 .7 3.4h-2.5zM15 9.5l-2.8 7.8-.3-1.5c-.5-1.7-2.1-3.6-3.9-4.5l2.7 9.7h3.2L18.2 9.5H15z" fill="#fff"/>
      <path d="M10.1 9.5H5l-.1.3c3.8.9 6.3 3.2 7.3 5.9l-1.1-5.2c-.2-.8-.7-1-1-.1z" fill="#F9A533"/>
    </svg>
  ),
  mastercard: (
    <svg viewBox="0 0 48 32" fill="none" className="payment-icon" aria-label="Mastercard">
      <rect width="48" height="32" rx="4" fill="#252525"/>
      <circle cx="19" cy="16" r="8" fill="#EB001B"/>
      <circle cx="29" cy="16" r="8" fill="#F79E1B"/>
      <path d="M24 10.3a8 8 0 0 1 0 11.4 8 8 0 0 1 0-11.4z" fill="#FF5F00"/>
    </svg>
  ),
  paypal: (
    <svg viewBox="0 0 48 32" fill="none" className="payment-icon" aria-label="PayPal">
      <rect width="48" height="32" rx="4" fill="#253B80"/>
      <path d="M19.5 8h5.7c2.7 0 4.6 1.7 4.2 4.5-.5 3.5-3 5.3-6 5.3h-1.6c-.4 0-.8.3-.9.8l-.7 4.2c-.1.4-.4.7-.8.7h-2.8c-.3 0-.5-.3-.5-.6l.2-.9 1.8-11c.1-.5.5-.9 1-.9l.4-.1z" fill="#fff"/>
      <path d="M31 8.5c-.4 3.3-2.8 5.5-6.2 5.5h-1.5l-1 6.3h-2l.1-.5C21.5 13 24 8.2 31 8.5z" fill="#179BD7"/>
    </svg>
  ),
};

function renderColumn(col: FooterColumn, locale: string) {
  const title = locale === 'ar' ? col.titleAr : col.titleEn;
  return (
    <div key={col.id} className="footer-col">
      <h4>{title}</h4>
      <ul className="footer-links">
        {col.links.map((link, i) => {
          const label = locale === 'ar' ? link.labelAr : link.labelEn;
          if (!label) return null; // Skip empty labels
          const icon = SOCIAL_ICONS[(link.labelEn || '').toLowerCase()];
          return (
            <li key={`${col.id}-${i}`}>
              {link.external ? (
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  {icon && icon} {label}
                </a>
              ) : (
                <Link href={link.href as any}>{label}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface FooterProps {
  config?: FooterConfig | null;
  locale?: string;
}

export function Footer({ config, locale = 'en' }: FooterProps) {
  const t = useTranslations('footer');
  const brand = useTranslations('brand');

  // If no config passed, render with translation keys (backward compatible)
  if (!config) {
    return (
      <footer>
        <div className="wrap">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="footer-brand-row">
                <EImg editId="footer-brand-logo" src="/images/logo.png" alt="Luna Logo" width={40} height={40} className="footer-logo" />
                <h3><E ns="brand" k="name">{brand('name')}</E></h3>
              </div>
              <p><E ns="footer" k="desc">{t('desc')}</E></p>
            </div>
          </div>
          <div className="footer-bottom">
            <span className="footer-copyright"><E ns="footer" k="copyright">{t('copyright')}</E></span>
          </div>
        </div>
      </footer>
    );
  }

  const visibleColumns = config.columns.filter(c => c.visible);
  const visibleLegal = config.legalLinks.filter(l => l.visible);
  const pi = config.paymentIcons;
  const hasPaymentIcons = pi.visa || pi.mastercard || pi.paypal;
  const copyright = locale === 'ar' ? config.copyrightAr : config.copyrightEn;

  return (
    <footer>
      <div className="wrap">
        {/* Brand Section */}
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-brand-row">
              <EImg editId="footer-brand-logo" src="/images/logo.png" alt="Luna Logo" width={40} height={40} className="footer-logo" />
              <h3><E ns="brand" k="name">{brand('name')}</E></h3>
            </div>
            {config.brandDescription && <p><E ns="footer" k="desc">{t('desc')}</E></p>}
          </div>
        </div>

        {/* Dynamic Columns */}
        {visibleColumns.length > 0 && (
          <div className="footer-columns">
            {visibleColumns.map(col => renderColumn(col, locale))}
          </div>
        )}

        {/* Payment Icons */}
        {hasPaymentIcons && (
          <div className="footer-payments">
            {pi.visa && PAYMENT_SVGS.visa}
            {pi.mastercard && PAYMENT_SVGS.mastercard}
            {pi.paypal && PAYMENT_SVGS.paypal}
          </div>
        )}

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <span className="footer-copyright">{copyright}</span>
          {visibleLegal.length > 0 && (
            <div className="footer-legal">
              {visibleLegal.map((link, i) => {
                const label = locale === 'ar' ? link.labelAr : link.labelEn;
                return (
                  <span key={link.key || link.href || `legal-${i}`}>
                    {i > 0 && <span className="footer-legal-dot">·</span>}
                    <Link href={link.href as any}>{label}</Link>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
