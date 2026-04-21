'use client';

import { useState } from 'react';
import ToggleCard from '../games/fields/ToggleCard';
import type { FooterConfig, FooterColumn, FooterLink, SocialLink, LegalLink } from './types';

interface Props {
  data: FooterConfig;
  onChange: (next: FooterConfig) => void;
}

type Sub = 'columns' | 'social' | 'legal' | 'payments';

const PLATFORMS = ['instagram', 'x', 'twitter', 'tiktok', 'youtube', 'discord', 'twitch', 'reddit', 'facebook', 'linkedin'];

export default function FooterPanel({ data, onChange }: Props) {
  const [sub, setSub] = useState<Sub>('columns');

  const patch = (p: Partial<FooterConfig>) => onChange({ ...data, ...p });

  /* ─── Columns ─── */

  const patchColumn = (i: number, next: Partial<FooterColumn>) => {
    patch({ columns: data.columns.map((c, idx) => idx === i ? { ...c, ...next } : c) });
  };
  const removeColumn = (i: number) => patch({ columns: data.columns.filter((_, idx) => idx !== i) });
  const moveColumn = (i: number, dir: -1 | 1) => {
    const next = [...data.columns];
    const target = i + dir;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    patch({ columns: next });
  };
  const addColumn = () => {
    if (data.columns.length >= 6) return;
    const id = `col_${Date.now().toString(36)}`;
    patch({ columns: [...data.columns, { id, titleEn: 'Untitled', titleAr: 'بلا عنوان', visible: true, links: [] }] });
  };

  const patchLink = (colIdx: number, linkIdx: number, next: Partial<FooterLink>) => {
    patchColumn(colIdx, {
      links: data.columns[colIdx].links.map((l, idx) => idx === linkIdx ? { ...l, ...next } : l),
    });
  };
  const removeLink = (colIdx: number, linkIdx: number) => {
    patchColumn(colIdx, { links: data.columns[colIdx].links.filter((_, i) => i !== linkIdx) });
  };
  const addLink = (colIdx: number) => {
    const col = data.columns[colIdx];
    if (col.links.length >= 12) return;
    patchColumn(colIdx, {
      links: [...col.links, { labelEn: 'New link', labelAr: 'رابط جديد', href: '/', external: false }],
    });
  };

  /* ─── Social ─── */

  const patchSocial = (i: number, next: Partial<SocialLink>) => {
    patch({ socialLinks: data.socialLinks.map((s, idx) => idx === i ? { ...s, ...next } : s) });
  };
  const addSocial = () => {
    if (data.socialLinks.length >= 8) return;
    patch({ socialLinks: [...data.socialLinks, { platform: 'instagram', url: '', visible: true }] });
  };
  const removeSocial = (i: number) => patch({ socialLinks: data.socialLinks.filter((_, idx) => idx !== i) });

  /* ─── Legal ─── */

  const patchLegal = (i: number, next: Partial<LegalLink>) => {
    patch({ legalLinks: data.legalLinks.map((l, idx) => idx === i ? { ...l, ...next } : l) });
  };
  const addLegal = () => {
    patch({ legalLinks: [...(data.legalLinks ?? []), { key: `legal_${Date.now().toString(36)}`, labelEn: 'New', labelAr: 'جديد', href: '/', visible: true }] });
  };
  const removeLegal = (i: number) => patch({ legalLinks: data.legalLinks.filter((_, idx) => idx !== i) });

  /* ─── Payments ─── */

  const patchPayment = (key: string, value: boolean) => {
    patch({ paymentIcons: { ...data.paymentIcons, [key]: value } });
  };
  const paymentKeys = Object.keys(data.paymentIcons ?? {});

  return (
    <section className="av-info">
      <nav className="av-inbox-chipset" role="tablist" aria-label="Footer section">
        {(['columns', 'social', 'legal', 'payments'] as Sub[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={sub === k}
            className={`av-inbox-chip${sub === k ? ' av-inbox-chip--active' : ''}`}
            onClick={() => setSub(k)}
          >{k === 'columns' ? `Columns · ${data.columns.length}`
            : k === 'social' ? `Social · ${data.socialLinks.length}`
            : k === 'legal' ? `Legal · ${(data.legalLinks ?? []).length}`
            : `Payments · ${paymentKeys.length}`}</button>
        ))}
      </nav>

      {sub === 'columns' && (
        <div className="av-info-footer-columns">
          {data.columns.map((col, i) => (
            <article key={col.id} className="av-commands-card">
              <header className="av-commands-card-head">
                <div className="av-info-col-head">
                  <code className="av-info-col-id">{col.id}</code>
                  <div className="av-info-menu-move">
                    <button type="button" onClick={() => moveColumn(i, -1)} disabled={i === 0}>↑</button>
                    <button type="button" onClick={() => moveColumn(i, 1)} disabled={i === data.columns.length - 1}>↓</button>
                  </div>
                </div>
                <div className="av-commands-toggle-row">
                  <ToggleCard value={col.visible} onChange={(v) => patchColumn(i, { visible: v })} onLabel="Visible" offLabel="Hidden" />
                  <button type="button" className="av-commands-delete" onClick={() => removeColumn(i)} title="Delete column">🗑</button>
                </div>
              </header>

              <div className="av-commands-row-grid">
                <label className="av-shopf-field">
                  <span>Title · English</span>
                  <input className="av-shopf-input" value={col.titleEn} onChange={(e) => patchColumn(i, { titleEn: e.target.value })} />
                </label>
                <label className="av-shopf-field">
                  <span>Title · Arabic</span>
                  <input className="av-shopf-input" dir="rtl" value={col.titleAr} onChange={(e) => patchColumn(i, { titleAr: e.target.value })} />
                </label>
              </div>

              <div className="av-info-link-list">
                {col.links.length === 0 && <div className="av-commands-empty">No links in this column.</div>}
                {col.links.map((l, j) => (
                  <div key={j} className="av-info-link-row">
                    <input className="av-shopf-input" placeholder="Label EN" value={l.labelEn} onChange={(e) => patchLink(i, j, { labelEn: e.target.value })} />
                    <input className="av-shopf-input" placeholder="Label AR" dir="rtl" value={l.labelAr} onChange={(e) => patchLink(i, j, { labelAr: e.target.value })} />
                    <input className="av-shopf-input av-shopf-input--mono" placeholder="/path or https://…" value={l.href} onChange={(e) => patchLink(i, j, { href: e.target.value })} />
                    <label className="av-info-link-external">
                      <input type="checkbox" checked={l.external} onChange={(e) => patchLink(i, j, { external: e.target.checked })} />
                      <span>external</span>
                    </label>
                    <button type="button" className="av-commands-delete" onClick={() => removeLink(i, j)} title="Delete link">×</button>
                  </div>
                ))}
                {col.links.length < 12 && (
                  <button type="button" className="av-commands-add" onClick={() => addLink(i)}>+ Add link</button>
                )}
              </div>
            </article>
          ))}
          {data.columns.length < 6 && (
            <button type="button" className="av-commands-add" onClick={addColumn}>+ New column</button>
          )}
        </div>
      )}

      {sub === 'social' && (
        <div className="av-info-social-list">
          {data.socialLinks.map((s, i) => (
            <div key={i} className="av-info-social-rowlist">
              <select className="av-shopf-input" value={s.platform} onChange={(e) => patchSocial(i, { platform: e.target.value })}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input className="av-shopf-input" placeholder="https://…" value={s.url} onChange={(e) => patchSocial(i, { url: e.target.value })} />
              <ToggleCard value={s.visible} onChange={(v) => patchSocial(i, { visible: v })} onLabel="Visible" offLabel="Hidden" />
              <button type="button" className="av-commands-delete" onClick={() => removeSocial(i)} title="Delete">🗑</button>
            </div>
          ))}
          {data.socialLinks.length < 8 && (
            <button type="button" className="av-commands-add" onClick={addSocial}>+ Add social link</button>
          )}
        </div>
      )}

      {sub === 'legal' && (
        <div className="av-info-social-list">
          {(data.legalLinks ?? []).map((l, i) => (
            <div key={l.key ?? i} className="av-info-legal-rowlist">
              <input className="av-shopf-input" placeholder="Label EN" value={l.labelEn} onChange={(e) => patchLegal(i, { labelEn: e.target.value })} />
              <input className="av-shopf-input" placeholder="Label AR" dir="rtl" value={l.labelAr} onChange={(e) => patchLegal(i, { labelAr: e.target.value })} />
              <input className="av-shopf-input av-shopf-input--mono" placeholder="/path" value={l.href} onChange={(e) => patchLegal(i, { href: e.target.value })} />
              <ToggleCard value={l.visible} onChange={(v) => patchLegal(i, { visible: v })} onLabel="Visible" offLabel="Hidden" />
              <button type="button" className="av-commands-delete" onClick={() => removeLegal(i)} title="Delete">🗑</button>
            </div>
          ))}
          <button type="button" className="av-commands-add" onClick={addLegal}>+ Add legal link</button>
        </div>
      )}

      {sub === 'payments' && (
        <div className="av-info-payments-grid">
          {paymentKeys.length === 0 && <div className="av-commands-empty">No payment keys configured.</div>}
          {paymentKeys.map((key) => (
            <div key={key} className="av-info-payment-row">
              <strong>{key}</strong>
              <ToggleCard value={Boolean(data.paymentIcons[key])} onChange={(v) => patchPayment(key, v)} onLabel="Shown" offLabel="Hidden" />
            </div>
          ))}
        </div>
      )}

      <div className="av-info-footer-copy">
        <label className="av-shopf-field">
          <span>Copyright · English</span>
          <input className="av-shopf-input" value={data.copyrightEn ?? ''} onChange={(e) => patch({ copyrightEn: e.target.value })} />
        </label>
        <label className="av-shopf-field">
          <span>Copyright · Arabic</span>
          <input className="av-shopf-input" dir="rtl" value={data.copyrightAr ?? ''} onChange={(e) => patch({ copyrightAr: e.target.value })} />
        </label>
        <label className="av-shopf-field av-shopf-field--inline">
          <span>Brand description</span>
          <ToggleCard value={Boolean(data.brandDescription)} onChange={(v) => patch({ brandDescription: v })} onLabel="Shown" offLabel="Hidden" />
        </label>
      </div>
    </section>
  );
}
