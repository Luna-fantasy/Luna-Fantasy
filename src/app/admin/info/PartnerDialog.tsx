'use client';

import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../_components/Toast';
import { useFocusTrap } from '../_components/a11y';
import ImageUrlInput from '../games/fields/ImageUrlInput';
import type { Partner } from './types';

interface Props {
  mode: 'create' | 'edit';
  initial?: Partner;
  onSave: (p: Partner) => Promise<void>;
  onClose: () => void;
}

const SOCIAL_KEYS: Array<{ key: keyof Partner['socials']; label: string; placeholder: string }> = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
  { key: 'x',         label: 'X',         placeholder: 'https://x.com/...' },
  { key: 'tiktok',    label: 'TikTok',    placeholder: 'https://tiktok.com/@...' },
  { key: 'youtube',   label: 'YouTube',   placeholder: 'https://youtube.com/@...' },
  { key: 'whatsapp',  label: 'WhatsApp',  placeholder: 'https://wa.me/...' },
];

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

export default function PartnerDialog({ mode, initial, onSave, onClose }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleEscape = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useFocusTrap(dialogRef, true, handleEscape);

  const [id, setId] = useState(initial?.id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [typeEn, setTypeEn] = useState(initial?.type?.en ?? '');
  const [typeAr, setTypeAr] = useState(initial?.type?.ar ?? '');
  const [descEn, setDescEn] = useState(initial?.description?.en ?? '');
  const [descAr, setDescAr] = useState(initial?.description?.ar ?? '');
  const [logo, setLogo] = useState(initial?.logo ?? '');
  const [website, setWebsite] = useState(initial?.website ?? '');
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [socials, setSocials] = useState<Partner['socials']>(initial?.socials ?? {});

  const submit = async () => {
    const trimmedId = id.trim();
    if (!trimmedId || !/^[a-z0-9_-]{1,50}$/.test(trimmedId)) {
      toast.show({ tone: 'warn', title: 'Slug required', message: 'Lowercase letters, digits, hyphens, underscores — max 50 chars.' });
      return;
    }
    if (!name.trim()) { toast.show({ tone: 'warn', title: 'Name required', message: 'Give the partner a display name.' }); return; }

    setBusy(true);
    try {
      const cleanedSocials: Partner['socials'] = {};
      for (const { key } of SOCIAL_KEYS) {
        const v = (socials[key] ?? '').trim();
        if (v) cleanedSocials[key] = v;
      }
      await onSave({
        id: trimmedId,
        name: name.trim(),
        type: { en: typeEn.trim(), ar: typeAr.trim() },
        description: { en: descEn.trim(), ar: descAr.trim() },
        logo: logo.trim(),
        website: website.trim() || undefined,
        socials: cleanedSocials,
        order: Math.max(0, Math.floor(Number(order) || 0)),
      });
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <>
      <div className="av-peek-scrim" onClick={busy ? undefined : onClose} />
      <div ref={dialogRef} className="av-itemdialog av-info-partner-dialog" role="dialog" aria-modal="true" aria-label={mode === 'create' ? 'New partner' : `Edit ${initial?.name}`}>
        <header className="av-itemdialog-head">
          <div>
            <h3>{mode === 'create' ? 'New partner' : `Edit · ${initial?.name}`}</h3>
            <p>Shown on the public <code>/partners</code> page.</p>
          </div>
          <button type="button" className="av-peek-close" onClick={onClose} disabled={busy}>×</button>
        </header>

        <div className="av-itemdialog-body">
          <div className="av-info-preview">
            <div className="av-info-preview-logo">
              {logo
                ? <img src={logo} alt="" />
                : <span>{(name || '?').slice(0, 1).toUpperCase()}</span>}
            </div>
            <div>
              <strong>{name || 'Untitled partner'}</strong>
              <span className="av-info-preview-type">{typeEn || typeAr || '—'}</span>
            </div>
          </div>

          <div className="av-itemdialog-fields av-info-partner-fields">
            <label className="av-shopf-field">
              <span>Slug <small>(id)</small></span>
              <input
                className="av-shopf-input av-shopf-input--mono"
                value={id}
                placeholder="e.g. gamer-snack"
                disabled={mode === 'edit'}
                onChange={(e) => setId(slugify(e.target.value))}
              />
            </label>
            <label className="av-shopf-field">
              <span>Name</span>
              <input className="av-shopf-input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <label className="av-shopf-field">
              <span>Type · English</span>
              <input className="av-shopf-input" value={typeEn} onChange={(e) => setTypeEn(e.target.value)} placeholder="Creative Design Studio" />
            </label>
            <label className="av-shopf-field">
              <span>Type · Arabic</span>
              <input className="av-shopf-input" value={typeAr} onChange={(e) => setTypeAr(e.target.value)} dir="rtl" placeholder="استوديو تصميم إبداعي" />
            </label>

            <label className="av-shopf-field av-shopf-field--full">
              <span>Description · English</span>
              <textarea className="av-shopf-input" rows={3} value={descEn} onChange={(e) => setDescEn(e.target.value)} />
            </label>
            <label className="av-shopf-field av-shopf-field--full">
              <span>Description · Arabic</span>
              <textarea className="av-shopf-input" rows={3} value={descAr} onChange={(e) => setDescAr(e.target.value)} dir="rtl" />
            </label>

            <div className="av-shopf-field av-shopf-field--full">
              <span>Logo</span>
              <ImageUrlInput
                value={logo}
                onChange={setLogo}
                folder="butler"
                filenameHint={`partner_${id || 'new'}`}
              />
            </div>

            <label className="av-shopf-field">
              <span>Website</span>
              <input className="av-shopf-input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
            </label>
            <label className="av-shopf-field">
              <span>Display order</span>
              <input className="av-shopf-input av-shopf-input--num" type="number" min={0} max={999}
                value={order} onChange={(e) => setOrder(Number(e.target.value) || 0)} />
            </label>

            <div className="av-shopf-field av-shopf-field--full">
              <span>Social links</span>
              <div className="av-info-socials-grid">
                {SOCIAL_KEYS.map(({ key, label, placeholder }) => (
                  <label key={key} className="av-info-social-row">
                    <span className="av-info-social-label">{label}</span>
                    <input
                      className="av-shopf-input"
                      value={socials[key] ?? ''}
                      placeholder={placeholder}
                      onChange={(e) => setSocials({ ...socials, [key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <footer className="av-itemdialog-foot">
          <button type="button" className="av-btn av-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="av-btn av-btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : mode === 'create' ? 'Add partner' : 'Save changes'}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
