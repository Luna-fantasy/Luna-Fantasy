'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';

interface EmbedTemplate {
  title: string;
  description: string;
  footer: string;
}

interface RejectTemplate extends EmbedTemplate {
  reason_label: string;
  reason_default: string;
}

interface ConfirmTemplate {
  content: string;
}

interface NotificationsData {
  application_accepted: EmbedTemplate;
  application_accepted_passport: EmbedTemplate;
  application_rejected: RejectTemplate;
  application_submitted: ConfirmTemplate;
}

const DEFAULTS: NotificationsData = {
  application_accepted: {
    title: '🎉 مبروك! تم قبول تقديمك',
    description: '**مبروك!** تم قبول تقديمك على **{category}**\n\nسيتم التواصل معك قريباً من قبل الإدارة.',
    footer: 'نتمنى لك التوفيق!',
  },
  application_accepted_passport: {
    title: '🎉 تم إصدار جواز سفرك',
    description: '**مبروك!** تم إصدار **جواز سفر لونا** باسمك.\n\nشاهد جوازك من خلال `/profile` — زر جواز السفر أصبح مفعّلاً.',
    footer: 'نتمنى لك التوفيق!',
  },
  application_rejected: {
    title: '❌ تم رفض تقديمك',
    description: 'للأسف، تم رفض تقديمك على **{category}**',
    reason_label: '⚠️ السبب',
    reason_default: 'تم رفض التقديم بناءً على تصويت الفريق',
    footer: 'يمكنك المحاولة مرة أخرى لاحقاً',
  },
  application_submitted: {
    content: '✅ تم إرسال طلب جواز السفر بنجاح! تم خصم `{fee}` لوناري كرسوم تقديم (غير مستردة).',
  },
};

interface TemplateInfo {
  key: keyof NotificationsData;
  title: string;
  description: string;
  type: 'embed' | 'reject-embed' | 'content';
  placeholders: string[];
  color: string;
}

const TEMPLATES: TemplateInfo[] = [
  {
    key: 'application_accepted',
    title: 'Application accepted (general)',
    description: 'DM sent when any non-passport application is approved (e.g. Sentinel, Guardian, custom role apps).',
    type: 'embed',
    placeholders: ['{category}'],
    color: '#57F287',
  },
  {
    key: 'application_accepted_passport',
    title: 'Passport issued',
    description: 'DM sent when a passport application is approved — user becomes a Lunarian.',
    type: 'embed',
    placeholders: [],
    color: '#57F287',
  },
  {
    key: 'application_rejected',
    title: 'Application rejected',
    description: 'DM sent when any application is declined. Shows reason as a separate field.',
    type: 'reject-embed',
    placeholders: ['{category}'],
    color: '#ED4245',
  },
  {
    key: 'application_submitted',
    title: 'Passport submission confirmation',
    description: 'Ephemeral message shown to user after they submit a passport application. Not a DM.',
    type: 'content',
    placeholders: ['{fee}'],
    color: '#48D8FF',
  },
];

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function saveNotifications(value: NotificationsData): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/config/butler', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ section: 'notifications', value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

export default function NotificationsClient() {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();

  const [draft, setDraft] = useState<NotificationsData>(DEFAULTS);
  const [saved, setSaved] = useState<NotificationsData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<keyof NotificationsData>('application_accepted');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config/butler', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const loaded: NotificationsData = {
        application_accepted: { ...DEFAULTS.application_accepted, ...(body.sections?.notifications?.application_accepted ?? {}) },
        application_accepted_passport: { ...DEFAULTS.application_accepted_passport, ...(body.sections?.notifications?.application_accepted_passport ?? {}) },
        application_rejected: { ...DEFAULTS.application_rejected, ...(body.sections?.notifications?.application_rejected ?? {}) },
        application_submitted: { ...DEFAULTS.application_submitted, ...(body.sections?.notifications?.application_submitted ?? {}) },
      };
      setSaved(loaded);
      setDraft(loaded);
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = () => {
    if (!dirty) return;
    const before = saved;
    pending.queue({
      label: 'Save notification templates',
      detail: 'Butler applies within ~30s — no restart needed',
      delayMs: 4500,
      run: async () => {
        try {
          await saveNotifications(draft);
          setSaved(draft);
          toast.show({ tone: 'success', title: 'Saved', message: 'All templates updated' });
          undo.push({
            label: 'Restore previous notification templates',
            detail: 'Prior copy',
            revert: async () => {
              await saveNotifications(before);
              setSaved(before);
              setDraft(before);
              toast.show({ tone: 'success', title: 'Reverted', message: 'Previous templates restored' });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const resetDefaults = () => setDraft(DEFAULTS);
  const discard = () => setDraft(saved);

  const updateTemplate = <K extends keyof NotificationsData>(key: K, patch: Partial<NotificationsData[K]>) => {
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } } as NotificationsData));
  };

  const activeInfo = TEMPLATES.find((t) => t.key === activeKey)!;
  const activeTemplate = draft[activeKey];

  if (loading) return <div className="av-commands-empty">Loading notification templates…</div>;

  return (
    <div className="av-notifications-page">
      <nav className="av-inbox-chipset" role="tablist" aria-label="Notification templates">
        {TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={activeKey === t.key}
            className={`av-inbox-chip${activeKey === t.key ? ' av-inbox-chip--active' : ''}`}
            onClick={() => setActiveKey(t.key)}
          >{t.title}</button>
        ))}
      </nav>

      <div className="av-notifications-main">
        <article className="av-surface av-notifications-editor">
          <header className="av-flows-head">
            <div>
              <h3>{activeInfo.title}</h3>
              <p>{activeInfo.description}</p>
            </div>
            <div className="av-flows-actions" style={{ display: 'flex', gap: 8 }}>
              {dirty && <button type="button" className="av-btn av-btn-ghost" onClick={discard}>Discard</button>}
              <button type="button" className="av-btn av-btn-ghost" onClick={resetDefaults}>Restore defaults</button>
              <button type="button" className="av-btn av-btn-primary" onClick={save} disabled={!dirty}>
                {dirty ? 'Save changes' : 'Saved'}
              </button>
            </div>
          </header>

          {activeInfo.placeholders.length > 0 && (
            <div className="av-commands-banner" data-tone="info">
              <strong>Placeholders</strong>
              <span>
                Use <code>{activeInfo.placeholders.join('</code> or <code>')}</code> in the text — Butler replaces them before sending.
              </span>
            </div>
          )}

          {activeInfo.type === 'embed' && (
            <div className="av-notifications-fields">
              <div>
                <label className="av-games-field-label">Title</label>
                <input
                  type="text"
                  className="av-shopf-input"
                  value={(activeTemplate as EmbedTemplate).title}
                  onChange={(e) => updateTemplate(activeKey, { title: e.target.value } as any)}
                />
              </div>
              <div>
                <label className="av-games-field-label">Description</label>
                <textarea
                  className="av-shopf-input"
                  rows={5}
                  value={(activeTemplate as EmbedTemplate).description}
                  onChange={(e) => updateTemplate(activeKey, { description: e.target.value } as any)}
                />
              </div>
              <div>
                <label className="av-games-field-label">Footer</label>
                <input
                  type="text"
                  className="av-shopf-input"
                  value={(activeTemplate as EmbedTemplate).footer}
                  onChange={(e) => updateTemplate(activeKey, { footer: e.target.value } as any)}
                />
              </div>
            </div>
          )}

          {activeInfo.type === 'reject-embed' && (
            <div className="av-notifications-fields">
              <div>
                <label className="av-games-field-label">Title</label>
                <input
                  type="text"
                  className="av-shopf-input"
                  value={(activeTemplate as RejectTemplate).title}
                  onChange={(e) => updateTemplate(activeKey, { title: e.target.value } as any)}
                />
              </div>
              <div>
                <label className="av-games-field-label">Description</label>
                <textarea
                  className="av-shopf-input"
                  rows={3}
                  value={(activeTemplate as RejectTemplate).description}
                  onChange={(e) => updateTemplate(activeKey, { description: e.target.value } as any)}
                />
              </div>
              <div className="av-leveling-grid">
                <div>
                  <label className="av-games-field-label">Reason field label</label>
                  <input
                    type="text"
                    className="av-shopf-input"
                    value={(activeTemplate as RejectTemplate).reason_label}
                    onChange={(e) => updateTemplate(activeKey, { reason_label: e.target.value } as any)}
                  />
                </div>
                <div>
                  <label className="av-games-field-label">Default reason text</label>
                  <input
                    type="text"
                    className="av-shopf-input"
                    value={(activeTemplate as RejectTemplate).reason_default}
                    onChange={(e) => updateTemplate(activeKey, { reason_default: e.target.value } as any)}
                  />
                </div>
              </div>
              <div>
                <label className="av-games-field-label">Footer</label>
                <input
                  type="text"
                  className="av-shopf-input"
                  value={(activeTemplate as RejectTemplate).footer}
                  onChange={(e) => updateTemplate(activeKey, { footer: e.target.value } as any)}
                />
              </div>
            </div>
          )}

          {activeInfo.type === 'content' && (
            <div className="av-notifications-fields">
              <div>
                <label className="av-games-field-label">Message content</label>
                <textarea
                  className="av-shopf-input"
                  rows={3}
                  value={(activeTemplate as ConfirmTemplate).content}
                  onChange={(e) => updateTemplate(activeKey, { content: e.target.value } as any)}
                />
              </div>
            </div>
          )}
        </article>

        <article className="av-surface av-notifications-preview">
          <header className="av-flows-head">
            <div>
              <h3>Discord preview</h3>
              <p>Approximation of how the message will render in Discord.</p>
            </div>
          </header>
          <NotificationPreview info={activeInfo} template={activeTemplate as any} />
        </article>
      </div>
    </div>
  );
}

function NotificationPreview({ info, template }: { info: TemplateInfo; template: any }) {
  const sample = { category: 'Sentinel Role', fee: '10,000' };
  const fill = (s: string) => s.replace(/\{category\}/g, sample.category).replace(/\{fee\}/g, sample.fee);

  if (info.type === 'content') {
    return (
      <div className="av-notifications-preview-box">
        <div className="av-notifications-discord-content">{fill(template.content)}</div>
      </div>
    );
  }

  const isReject = info.type === 'reject-embed';
  return (
    <div className="av-notifications-preview-box">
      <div className="av-notifications-embed" style={{ borderLeftColor: info.color }}>
        <div className="av-notifications-embed-title">{fill(template.title)}</div>
        <div className="av-notifications-embed-description">{fill(template.description)}</div>
        {isReject && (
          <div className="av-notifications-embed-field">
            <div className="av-notifications-embed-field-name">{template.reason_label}</div>
            <div className="av-notifications-embed-field-value">{template.reason_default}</div>
          </div>
        )}
        <div className="av-notifications-embed-footer">{template.footer}</div>
      </div>
    </div>
  );
}
