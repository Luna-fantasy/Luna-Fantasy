'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import RoleChips from '../_components/RoleChips';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { useUndo } from '../_components/UndoProvider';

interface StaffRoles {
  mastermind: string[];
  sentinel: string[];
  guardian: string[];
}

interface CosmeticsConfig {
  passport_vip_roles: string[];
  passport_staff_roles: StaffRoles;
  merchantPhotoUrl: string;
}

interface ApplicationsDoc {
  passport_vip_roles?: string[];
  passport_staff_roles?: Partial<StaffRoles>;
  categories?: {
    passport?: {
      title?: string;
      description?: string;
      questions?: unknown[];
      image?: string;
    };
  };
  [key: string]: unknown;
}

const DEFAULT_MERCHANT = 'https://assets.lunarian.app/butler/vendors/VaelorStorm.png';
const DEFAULT_BACKGROUND = 'https://assets.lunarian.app/butler/backgrounds/Passport.jpeg';
const VIP_BACKGROUND = 'https://assets.lunarian.app/butler/backgrounds/PassportVIPFinal.png';
const STAFF_TEMPLATES = [
  { id: 'guardian',   label: 'Guardian',   url: 'https://assets.lunarian.app/butler/backgrounds/PassportGuardian.png',   tone: '#3b82f6' },
  { id: 'sentinel',   label: 'Sentinel',   url: 'https://assets.lunarian.app/butler/backgrounds/PassportSentinel.png',   tone: '#FFD54F' },
  { id: 'mastermind', label: 'Mastermind', url: 'https://assets.lunarian.app/butler/backgrounds/PassportMastermind.png', tone: '#a855f7' },
] as const;

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

function normalize(apps: ApplicationsDoc | null): CosmeticsConfig {
  return {
    passport_vip_roles: apps?.passport_vip_roles ?? [],
    passport_staff_roles: {
      mastermind: apps?.passport_staff_roles?.mastermind ?? [],
      sentinel: apps?.passport_staff_roles?.sentinel ?? [],
      guardian: apps?.passport_staff_roles?.guardian ?? [],
    },
    merchantPhotoUrl: apps?.categories?.passport?.image ?? '',
  };
}

async function loadConfig(): Promise<{ applications: ApplicationsDoc; cosmetics: CosmeticsConfig }> {
  const res = await fetch('/api/admin/config/butler', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const applications: ApplicationsDoc = data.sections?.applications_system ?? {};
  return { applications, cosmetics: normalize(applications) };
}

async function saveApplications(value: ApplicationsDoc): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/config/butler', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ section: 'applications_system', value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

export default function CosmeticsPanel() {
  const toast = useToast();
  const pending = usePendingAction();
  const undo = useUndo();

  const [loading, setLoading] = useState(true);
  const [applicationsDoc, setApplicationsDoc] = useState<ApplicationsDoc>({});
  const [saved, setSaved] = useState<CosmeticsConfig>(normalize(null));
  const [draft, setDraft] = useState<CosmeticsConfig>(normalize(null));

  const refresh = useCallback(async () => {
    try {
      const { applications, cosmetics } = await loadConfig();
      setApplicationsDoc(applications);
      setSaved(cosmetics);
      setDraft(cosmetics);
    } catch {
      toast.show({ tone: 'error', title: 'Failed to load', message: 'Could not fetch passport cosmetics' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void refresh(); }, [refresh]);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  const handleSave = async () => {
    if (!dirty) return;
    const prev = saved;
    const next = draft;

    const applicationsNext: ApplicationsDoc = {
      ...applicationsDoc,
      passport_vip_roles: next.passport_vip_roles,
      passport_staff_roles: next.passport_staff_roles,
      categories: {
        ...(applicationsDoc.categories ?? {}),
        passport: {
          ...(applicationsDoc.categories?.passport ?? {
            title: 'جواز سفر لونا',
            description: 'تقدم بطلب للحصول على جواز سفر لونا الرسمي من السيد فيلور ستورم.',
            questions: [],
          }),
          image: next.merchantPhotoUrl.trim() || DEFAULT_MERCHANT,
        },
      },
    };

    await pending.queue({
      label: 'Save passport cosmetics',
      detail: 'VIP roles, staff tiers, merchant portrait',
      delayMs: 4000,
      run: async () => {
        try {
          await saveApplications(applicationsNext);
          setApplicationsDoc(applicationsNext);
          setSaved(next);
          toast.show({ tone: 'success', title: 'Saved', message: 'Passport cosmetics · bot picks up within 60s' });

          const prevApplicationsDoc = applicationsDoc;
          undo.push({
            label: 'Restore passport cosmetics',
            detail: 'Revert VIP roles / staff tiers / merchant portrait',
            revert: async () => {
              try {
                await saveApplications(prevApplicationsDoc);
                setApplicationsDoc(prevApplicationsDoc);
                setSaved(prev);
                setDraft(prev);
                toast.show({ tone: 'success', title: 'Reverted', message: 'Passport cosmetics' });
              } catch (e) {
                toast.show({ tone: 'error', title: 'Revert failed', message: (e as Error).message });
                throw e;
              }
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const handleDiscard = () => setDraft(saved);

  if (loading) {
    return <section className="av-surface av-passport-cos av-passport-cos--loading">Loading passport cosmetics…</section>;
  }

  const merchantPreview = draft.merchantPhotoUrl.trim() || DEFAULT_MERCHANT;

  return (
    <section className="av-surface av-passport-cos">
      <header className="av-passport-cos-head">
        <div>
          <h3 className="av-passport-cos-title">Passport Cosmetics</h3>
          <p className="av-passport-cos-subtitle">
            Merchant portrait, VIP cosmetic variant, and staff passport auto-assignment.
            Canvas layouts are tuned in the <Link href="/admin/media" className="av-passport-cos-link">Canvas Editor</Link>.
          </p>
        </div>
        <div className="av-passport-cos-head-actions">
          <button type="button" className="av-btn av-btn-ghost" onClick={handleDiscard} disabled={!dirty}>Discard</button>
          <button type="button" className="av-btn av-btn-primary" onClick={() => void handleSave()} disabled={!dirty}>Save</button>
        </div>
      </header>

      <div className="av-passport-cos-body">
        <div className="av-passport-cos-row">
          <div className="av-passport-cos-label">
            <h4>Merchant portrait</h4>
            <p>Portrait of the issuing authority on the <code>/profile</code> passport panel. Defaults to Vaelor Storm.</p>
          </div>
          <div className="av-passport-cos-field">
            <input
              type="url"
              className="av-audit-input"
              placeholder={DEFAULT_MERCHANT}
              value={draft.merchantPhotoUrl}
              onChange={(e) => setDraft((d) => ({ ...d, merchantPhotoUrl: e.target.value }))}
              dir="ltr"
            />
            <div className="av-passport-cos-preview">
              <img src={merchantPreview} alt="Merchant portrait preview" />
              <span>{draft.merchantPhotoUrl ? 'Custom portrait' : 'Default (Vaelor Storm)'}</span>
            </div>
          </div>
        </div>

        <div className="av-passport-cos-row">
          <div className="av-passport-cos-label">
            <h4>👑 VIP roles</h4>
            <p>Holders of these roles see the VIP cosmetic variant instead of the normal passport. <strong>No extra benefits</strong> — purely visual.</p>
          </div>
          <div className="av-passport-cos-field">
            <RoleChips
              value={draft.passport_vip_roles}
              onChange={(ids) => setDraft((d) => ({ ...d, passport_vip_roles: ids }))}
            />
          </div>
        </div>

        <div className="av-passport-cos-row">
          <div className="av-passport-cos-label">
            <h4>Staff tiers</h4>
            <p>Auto-assigned when the user's roles change. Priority: <strong>Mastermind</strong> &gt; <strong>Sentinel</strong> &gt; <strong>Guardian</strong>. Passport ID changes accordingly.</p>
          </div>
          <div className="av-passport-cos-field av-passport-cos-field--stack">
            <div className="av-passport-cos-tier">
              <label className="av-passport-cos-tier-label">
                <span className="av-passport-cos-tier-dot" style={{ background: '#a855f7' }} />
                Mastermind — <code>MASTERMIND</code>
              </label>
              <RoleChips
                value={draft.passport_staff_roles.mastermind}
                onChange={(ids) => setDraft((d) => ({
                  ...d,
                  passport_staff_roles: { ...d.passport_staff_roles, mastermind: ids },
                }))}
              />
            </div>
            <div className="av-passport-cos-tier">
              <label className="av-passport-cos-tier-label">
                <span className="av-passport-cos-tier-dot" style={{ background: '#FFD54F' }} />
                Sentinel — <code>SENTINEL-##</code>
              </label>
              <RoleChips
                value={draft.passport_staff_roles.sentinel}
                onChange={(ids) => setDraft((d) => ({
                  ...d,
                  passport_staff_roles: { ...d.passport_staff_roles, sentinel: ids },
                }))}
              />
            </div>
            <div className="av-passport-cos-tier">
              <label className="av-passport-cos-tier-label">
                <span className="av-passport-cos-tier-dot" style={{ background: '#3b82f6' }} />
                Guardian — <code>GUARDIAN-##</code>
              </label>
              <RoleChips
                value={draft.passport_staff_roles.guardian}
                onChange={(ids) => setDraft((d) => ({
                  ...d,
                  passport_staff_roles: { ...d.passport_staff_roles, guardian: ids },
                }))}
              />
            </div>
          </div>
        </div>

        <div className="av-passport-cos-row">
          <div className="av-passport-cos-label">
            <h4>Canvas templates</h4>
            <p>Backgrounds live in R2. Field positions (name, faction, date of birth, photo, passport number) are dragged inside the Canvas Editor.</p>
          </div>
          <div className="av-passport-cos-field av-passport-cos-field--stack">
            <div className="av-passport-cos-templates">
              <TemplateCard
                label="Normal"
                url={DEFAULT_BACKGROUND}
                href="/admin/media"
                tone="var(--accent-primary)"
              />
              <TemplateCard
                label="VIP"
                url={VIP_BACKGROUND}
                href="/admin/media"
                tone="#FFD54F"
              />
              {STAFF_TEMPLATES.map((t) => (
                <TemplateCard
                  key={t.id}
                  label={t.label}
                  url={t.url}
                  href="/admin/media"
                  tone={t.tone}
                />
              ))}
            </div>
            <p className="av-passport-cos-note">
              <span aria-hidden="true">◇</span>
              <span>Each template has its own field layout. Pick the matching canvas in the editor before moving positions.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TemplateCard({ label, url, href, tone }: { label: string; url: string; href: string; tone: string; }) {
  return (
    <Link href={href} className="av-passport-cos-template" style={{ ['--tone' as any]: tone }}>
      <img src={url} alt={label} />
      <span>{label}</span>
    </Link>
  );
}
