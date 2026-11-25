'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { adminGet, adminPut } from '@/lib/admin/http';
import {
  changedPassportCosmetics, DEFAULT_PASSPORT_MERCHANT as DEFAULT_MERCHANT,
  type PassportCosmetics as CosmeticsConfig, type PassportStaffTier,
} from '@/lib/admin/passport-cosmetics';
import RoleChips from '../_components/RoleChips';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { useUndo } from '../_components/UndoProvider';



interface ApplicationsDoc {
  passport_vip_roles?: string[];
  passport_staff_roles?: Partial<Record<PassportStaffTier, string[]>>;
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


const DEFAULT_BACKGROUND = 'https://assets.lunarian.app/butler/backgrounds/Passport.jpeg';
const VIP_BACKGROUND = 'https://assets.lunarian.app/butler/backgrounds/PassportVIPFinal.png';
const STAFF_TEMPLATES = [
  { id: 'guardian',   label: 'Guardian',   url: 'https://assets.lunarian.app/butler/backgrounds/PassportGuardian.png',   tone: '#3b82f6' },
  { id: 'sentinel',   label: 'Sentinel',   url: 'https://assets.lunarian.app/butler/backgrounds/PassportSentinel.png',   tone: '#FFD54F' },
  { id: 'mastermind', label: 'Mastermind', url: 'https://assets.lunarian.app/butler/backgrounds/PassportMastermind.png', tone: '#a855f7' },
] as const;

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

async function loadConfig(): Promise<CosmeticsConfig> {
  const data = await adminGet<{ sections: { applications_system?: ApplicationsDoc } }>('/api/admin/config/butler');
  if (!data?.sections) throw new Error('Passport settings did not load');
  return normalize(data.sections.applications_system ?? null);
}

async function saveCosmetics(previous: CosmeticsConfig, next: CosmeticsConfig) {
  const value = changedPassportCosmetics(previous, next);
  if (Object.keys(value).length) await adminPut('/api/admin/config/butler', { section: 'passport_cosmetics', value });
}

export default function CosmeticsPanel() {
  const toast = useToast();
  const pending = usePendingAction();
  const undo = useUndo();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<CosmeticsConfig>(normalize(null));
  const [draft, setDraft] = useState<CosmeticsConfig>(normalize(null));

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const cosmetics = await loadConfig();
      setSaved(cosmetics);
      setDraft(cosmetics);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const dirty = useMemo(() => Object.keys(changedPassportCosmetics(saved, draft)).length > 0, [saved, draft]);

  const handleSave = async () => {
    if (!dirty || saving) return;
    const previous = saved;
    const next = draft;
    setSaving(true);
    try {
      await pending.queue({
        label: 'Save passport cosmetics',
        detail: 'Apply edited settings',
        delayMs: 4000,
        run: async () => {
          try {
            await saveCosmetics(previous, next);
            setSaved(next);
            toast.show({ tone: 'success', title: 'Saved', message: 'Passport cosmetics · bot picks up within 60s' });
            undo.push({
              label: 'Restore passport cosmetics',
              detail: 'Revert the edited settings',
              revert: async () => {
                await saveCosmetics(next, previous);
                await refresh();
                toast.show({ tone: 'success', title: 'Reverted', message: 'Passport cosmetics' });
              },
            });
          } catch (error) {
            toast.show({ tone: 'error', title: 'Save failed', message: (error as Error).message });
            throw error;
          }
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => setDraft(saved);

  if (loading) {
    return <section className="av-surface av-passport-cos av-passport-cos--loading">Loading passport cosmetics…</section>;
  }

  if (loadError) {
    return <section className="av-surface av-passport-cos" role="alert">
      <p>Passport settings could not be loaded.</p>
      <button type="button" className="av-btn av-btn-ghost" onClick={() => void refresh()}>Retry</button>
    </section>;
  }

  const merchantPreview = draft.merchantPhotoUrl.trim() || DEFAULT_MERCHANT;

  return (
    <section className="av-surface av-passport-cos">
      <header className="av-passport-cos-head">
        <div>
          <h3 className="av-passport-cos-title">Passport Cosmetics</h3>
          <p className="av-passport-cos-subtitle">
            Merchant portrait, VIP cosmetic variant, and staff passport auto-assignment.
            Canvas layouts are tuned in the <Link href="/admin/media?canvas=passport_web" className="av-passport-cos-link">Canvas Editor</Link>.
          </p>
        </div>
        <div className="av-passport-cos-head-actions">
          <button type="button" className="av-btn av-btn-ghost" onClick={handleDiscard} disabled={!dirty || saving}>Discard</button>
          <button type="button" className="av-btn av-btn-primary" onClick={() => void handleSave()} disabled={!dirty || saving}>Save</button>
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
              aria-label="Merchant portrait URL"
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
              emptyLabel="No roles grant the VIP appearance."
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
                emptyLabel="No roles assign this passport tier."
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
                emptyLabel="No roles assign this passport tier."
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
                emptyLabel="No roles assign this passport tier."
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
                href="/admin/media?canvas=passport_web"
                tone="var(--accent-primary)"
              />
              <TemplateCard
                label="VIP"
                url={VIP_BACKGROUND}
                href="/admin/media?canvas=passport_vip_web"
                tone="#FFD54F"
              />
              {STAFF_TEMPLATES.map((t) => (
                <TemplateCard
                  key={t.id}
                  label={t.label}
                  url={t.url}
                  href={`/admin/media?canvas=passport_${t.id}_web`}
                  tone={t.tone}
                />
              ))}
            </div>
            <p className="av-passport-cos-note">
              <span aria-hidden="true">◇</span>
              <span>Select a template to edit its website profile layout.</span>
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
