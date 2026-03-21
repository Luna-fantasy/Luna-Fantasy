'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { E } from '@/components/edit-mode/EditableText';

const REASONS = ['bugReport', 'featureRequest', 'paymentIssue', 'accountIssue', 'complaint', 'partnership'] as const;
const AREAS = ['lunaFantasy', 'bank', 'bazaar', 'marketplace', 'auth', 'website', 'other'] as const;
const MAX_FILES = 3;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export default function ContactForm() {
  const t = useTranslations('contactPage');
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const loggedInDiscord = session?.user?.username || session?.user?.discordId || '';
  const [form, setForm] = useState({ discord: '', reason: '', area: '', message: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loggedInDiscord) {
      setForm((prev) => ({ ...prev, discord: loggedInDiscord }));
    }
  }, [loggedInDiscord]);

  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  function validate() {
    const e: Record<string, boolean> = {};
    if (!form.discord.trim()) e.discord = true;
    if (!form.reason) e.reason = true;
    if (!form.area) e.area = true;
    if (!form.message.trim()) e.message = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const accepted: File[] = [];
    for (let i = 0; i < incoming.length; i++) {
      const f = incoming[i];
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_SIZE) continue;
      if (files.length + accepted.length >= MAX_FILES) break;
      accepted.push(f);
    }
    if (accepted.length === 0) return;
    const next = [...files, ...accepted];
    setFiles(next);
    setPreviews((prev) => [
      ...prev,
      ...accepted.map((f) => URL.createObjectURL(f)),
    ]);
  }

  function removeFile(idx: number) {
    URL.revokeObjectURL(previews[idx]);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragging');
    addFiles(e.dataTransfer.files);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setStatus('sending');
    try {
      const fd = new FormData();
      fd.append('discord', form.discord);
      fd.append('reason', form.reason);
      fd.append('area', form.area);
      fd.append('message', form.message);
      files.forEach((f) => fd.append('attachments', f));

      const res = await fetch('/api/contact', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) throw new Error();
      setStatus('success');
      setForm({ discord: loggedInDiscord, reason: '', area: '', message: '' });
      previews.forEach((p) => URL.revokeObjectURL(p));
      setFiles([]);
      setPreviews([]);
    } catch {
      setStatus('error');
    }
  }

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: false }));
  }

  return (
    <>
      {status === 'success' ? (
        <div className="contact-success">
          <div className="contact-success-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2><E ns="contactPage" k="successTitle">{t('successTitle')}</E></h2>
          <p><E ns="contactPage" k="successDesc">{t('successDesc')}</E></p>
          <button className="contact-btn" type="button" onClick={() => setStatus('idle')}>
            <E ns="contactPage" k="sendAnother">{t('sendAnother')}</E>
          </button>
        </div>
      ) : (
        <form className="contact-form" onSubmit={handleSubmit} noValidate>
          {/* Discord ID / Username */}
          <div className={`contact-field${errors.discord ? ' has-error' : ''}`}>
            <label htmlFor="contact-discord"><E ns="contactPage" k="discord">{t('discord')}</E></label>
            <input
              id="contact-discord"
              type="text"
              value={form.discord}
              onChange={(e) => update('discord', e.target.value)}
              placeholder={t('discordPlaceholder')}
              disabled={isLoggedIn}
              className={isLoggedIn ? 'contact-input-locked' : ''}
            />
            {errors.discord && <span className="contact-error"><E ns="contactPage" k="required">{t('required')}</E></span>}
          </div>

          {/* Reason + Area row */}
          <div className="contact-row">
            <div className={`contact-field${errors.reason ? ' has-error' : ''}`}>
              <label htmlFor="contact-reason"><E ns="contactPage" k="reason">{t('reason')}</E></label>
              <select
                id="contact-reason"
                value={form.reason}
                onChange={(e) => update('reason', e.target.value)}
              >
                <option value="" disabled><E ns="contactPage" k="selectReason">{t('selectReason')}</E></option>
                {REASONS.map((r) => (
                  <option key={r} value={r}><E ns="contactPage" k={`reasons.${r}`}>{t(`reasons.${r}`)}</E></option>
                ))}
              </select>
              {errors.reason && <span className="contact-error"><E ns="contactPage" k="required">{t('required')}</E></span>}
            </div>

            <div className={`contact-field${errors.area ? ' has-error' : ''}`}>
              <label htmlFor="contact-area"><E ns="contactPage" k="area">{t('area')}</E></label>
              <select
                id="contact-area"
                value={form.area}
                onChange={(e) => update('area', e.target.value)}
              >
                <option value="" disabled><E ns="contactPage" k="selectArea">{t('selectArea')}</E></option>
                {AREAS.map((a) => (
                  <option key={a} value={a}><E ns="contactPage" k={`areas.${a}`}>{t(`areas.${a}`)}</E></option>
                ))}
              </select>
              {errors.area && <span className="contact-error"><E ns="contactPage" k="required">{t('required')}</E></span>}
            </div>
          </div>

          {/* Message */}
          <div className={`contact-field${errors.message ? ' has-error' : ''}`}>
            <label htmlFor="contact-message"><E ns="contactPage" k="message">{t('message')}</E></label>
            <textarea
              id="contact-message"
              rows={6}
              value={form.message}
              onChange={(e) => update('message', e.target.value)}
              placeholder={t('messagePlaceholder')}
            />
            {errors.message && <span className="contact-error"><E ns="contactPage" k="required">{t('required')}</E></span>}
          </div>

          {/* Image attachments */}
          <div className="contact-field">
            <label><E ns="contactPage" k="attachments">{t('attachments')}</E></label>
            <div
              className="contact-dropzone"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragging'); }}
              onDragLeave={(e) => e.currentTarget.classList.remove('dragging')}
              onDrop={handleDrop}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
              />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              <span className="contact-dropzone-text"><E ns="contactPage" k="attachHint">{t('attachHint')}</E></span>
              <span className="contact-dropzone-limit"><E ns="contactPage" k="attachLimit">{t('attachLimit')}</E></span>
            </div>

            {previews.length > 0 && (
              <div className="contact-previews">
                {previews.map((src, i) => (
                  <div key={src} className="contact-preview">
                    <img src={src} alt="" />
                    <button
                      type="button"
                      className="contact-preview-remove"
                      onClick={() => removeFile(i)}
                      aria-label={t('removeFile')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {status === 'error' && (
            <div className="contact-error-banner"><E ns="contactPage" k="errorMsg">{t('errorMsg')}</E></div>
          )}

          <button className="contact-btn" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? <E ns="contactPage" k="sending">{t('sending')}</E> : <E ns="contactPage" k="send">{t('send')}</E>}
          </button>
        </form>
      )}

      {/* OR Discord CTA */}
      <div className="contact-divider">
        <span><E ns="contactPage" k="orDivider">{t('orDivider')}</E></span>
      </div>
      <div className="contact-discord-cta">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--accent-primary)">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/>
        </svg>
        <div>
          <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer" className="contact-discord-link">
            <E ns="contactPage" k="discordCta">{t('discordCta')}</E>
          </a>
          <p><E ns="contactPage" k="discordCtaDesc">{t('discordCtaDesc')}</E></p>
        </div>
      </div>
    </>
  );
}
