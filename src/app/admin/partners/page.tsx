'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLightbox from '../components/AdminLightbox';
import ConfirmModal from '../components/ConfirmModal';
import ImagePicker from '../components/ImagePicker';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';

// ── Types ──

interface Partner {
  id: string;
  name: string;
  type: { en: string; ar: string };
  description: { en: string; ar: string };
  logo: string;
  website?: string;
  socials: {
    instagram?: string;
    x?: string;
    tiktok?: string;
    youtube?: string;
    whatsapp?: string;
  };
  order: number;
}

interface PartnerForm {
  id: string;
  name: string;
  typeEn: string;
  typeAr: string;
  descEn: string;
  descAr: string;
  logo: string;
  website: string;
  instagram: string;
  x: string;
  tiktok: string;
  youtube: string;
  whatsapp: string;
  order: number;
}

const EMPTY_FORM: PartnerForm = {
  id: '', name: '', typeEn: '', typeAr: '', descEn: '', descAr: '',
  logo: '', website: '', instagram: '', x: '', tiktok: '', youtube: '',
  whatsapp: '', order: 0,
};

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,50}$/;

// ── Social Icon SVGs ──

function IconInstagram() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.5" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconTikTok() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.11V9a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.72a8.17 8.17 0 004.77 1.53V6.69h-1z" />
    </svg>
  );
}

function IconYouTube() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// Map social keys to their icon and label
const SOCIAL_ICONS: { key: keyof Partner['socials']; icon: () => JSX.Element; label: string }[] = [
  { key: 'instagram', icon: IconInstagram, label: 'Instagram' },
  { key: 'x', icon: IconX, label: 'X (Twitter)' },
  { key: 'tiktok', icon: IconTikTok, label: 'TikTok' },
  { key: 'youtube', icon: IconYouTube, label: 'YouTube' },
  { key: 'whatsapp', icon: IconWhatsApp, label: 'WhatsApp' },
];

// ── Helpers ──

function partnerToForm(p: Partner): PartnerForm {
  return {
    id: p.id,
    name: p.name,
    typeEn: p.type?.en ?? '',
    typeAr: p.type?.ar ?? '',
    descEn: p.description?.en ?? '',
    descAr: p.description?.ar ?? '',
    logo: p.logo ?? '',
    website: p.website ?? '',
    instagram: p.socials?.instagram ?? '',
    x: p.socials?.x ?? '',
    tiktok: p.socials?.tiktok ?? '',
    youtube: p.socials?.youtube ?? '',
    whatsapp: p.socials?.whatsapp ?? '',
    order: p.order ?? 0,
  };
}

function formToPartner(f: PartnerForm): Partner {
  return {
    id: f.id.trim(),
    name: f.name.trim(),
    type: { en: f.typeEn.trim(), ar: f.typeAr.trim() },
    description: { en: f.descEn.trim(), ar: f.descAr.trim() },
    logo: f.logo.trim(),
    website: f.website.trim() || undefined,
    socials: {
      ...(f.instagram.trim() ? { instagram: f.instagram.trim() } : {}),
      ...(f.x.trim() ? { x: f.x.trim() } : {}),
      ...(f.tiktok.trim() ? { tiktok: f.tiktok.trim() } : {}),
      ...(f.youtube.trim() ? { youtube: f.youtube.trim() } : {}),
      ...(f.whatsapp.trim() ? { whatsapp: f.whatsapp.trim() } : {}),
    },
    order: f.order,
  };
}

// ── Main Page ──

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [form, setForm] = useState<PartnerForm>({ ...EMPTY_FORM });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);

  const { toast } = useToast();

  // ── Data Fetching ──

  const fetchPartners = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/partners');
      if (!res.ok) throw new Error('Failed to load partners');
      const data = await res.json();
      setPartners(data.partners ?? []);
    } catch (err: any) {
      toast(err.message || 'Failed to load partners', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchPartners(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Open Add/Edit ──

  function openAdd() {
    setEditingPartner(null);
    setForm({ ...EMPTY_FORM, order: partners.length });
    setLightboxOpen(true);
  }

  function openEdit(partner: Partner) {
    setEditingPartner(partner);
    setForm(partnerToForm(partner));
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
    setEditingPartner(null);
  }

  // ── Create ──

  async function handleCreate() {
    if (!form.id.trim() || !form.name.trim()) {
      toast('ID and Name are required', 'error');
      return;
    }
    if (!ID_PATTERN.test(form.id.trim())) {
      toast('ID must be alphanumeric with hyphens/underscores only (max 50 chars)', 'error');
      return;
    }

    setSaving(true);
    try {
      const partner = formToPartner(form);
      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify(partner),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create partner');
      }
      toast('Partner created', 'success');
      closeLightbox();
      fetchPartners();
    } catch (err: any) {
      toast(err.message || 'Failed to create partner', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Update ──

  async function handleUpdate() {
    if (!editingPartner) return;
    if (!form.name.trim()) {
      toast('Name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const partner = formToPartner(form);
      // Remove the id field from the update payload (cannot change id)
      const { id: _id, ...updateData } = partner;
      const res = await fetch(`/api/admin/partners/${editingPartner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update partner');
      }
      toast('Partner updated', 'success');
      closeLightbox();
      fetchPartners();
    } catch (err: any) {
      toast(err.message || 'Failed to update partner', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/partners/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': getCsrfToken() },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete partner');
      }
      toast('Partner deleted', 'success');
      setDeleteTarget(null);
      fetchPartners();
    } catch (err: any) {
      toast(err.message || 'Failed to delete partner', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Save dispatcher ──

  function handleSave() {
    if (editingPartner) {
      handleUpdate();
    } else {
      handleCreate();
    }
  }

  // ── Render: Loading ──

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title">
            <span className="emoji-float">{'\uD83E\uDD1D'}</span> Partners
          </h1>
          <p className="admin-page-subtitle">Manage partner organizations and their contact info</p>
        </div>
        <SkeletonCard count={4} />
      </>
    );
  }

  // ── Render: Main ──

  return (
    <>
      <div className="admin-page-header">
        <div style={{ flex: 1 }}>
          <h1 className="admin-page-title">
            <span className="emoji-float">{'\uD83E\uDD1D'}</span> Partners
          </h1>
          <p className="admin-page-subtitle">Manage partner organizations and their contact info</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={openAdd}>
          + Add Partner
        </button>
      </div>

      {/* ── Partner Cards Grid ── */}
      {partners.length === 0 ? (
        <div className="admin-empty" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No partners yet. Click &quot;Add Partner&quot; to create the first one.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
        }}>
          {partners.map((partner) => (
            <div key={partner.id} className="admin-stat-card" style={{ position: 'relative' }}>
              {/* Order badge */}
              <span
                className="admin-badge admin-badge-muted"
                style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '11px' }}
              >
                #{partner.order}
              </span>

              {/* Top row: Logo + Name + Type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', paddingRight: '40px' }}>
                {partner.logo ? (
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0,
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                ) : (
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'var(--bg-void)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                  }}>
                    ?
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '16px', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {partner.name}
                  </div>
                  {partner.type?.en && (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {partner.type.en}
                    </div>
                  )}
                </div>
              </div>

              {/* Social icons row */}
              {SOCIAL_ICONS.some(({ key }) => partner.socials?.[key]) && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {SOCIAL_ICONS.map(({ key, icon: Icon, label }) => {
                    const url = partner.socials?.[key];
                    if (!url) return null;
                    return (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          color: 'var(--text-muted)',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                      >
                        <Icon />
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Website link */}
              {partner.website && (
                <div style={{ marginTop: '8px' }}>
                  <a
                    href={partner.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                  >
                    {partner.website}
                  </a>
                </div>
              )}

              {/* Bottom: Edit + Delete */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(0, 212, 255, 0.06)' }}>
                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => openEdit(partner)}>
                  Edit
                </button>
                <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDeleteTarget(partner)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add/Edit Lightbox ── */}
      <AdminLightbox
        isOpen={lightboxOpen}
        onClose={closeLightbox}
        title={editingPartner ? `Edit Partner: ${editingPartner.name}` : 'Add Partner'}
        size="lg"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Row 1: ID + Name */}
          <div className="admin-form-group">
            <label className="admin-form-label">ID Slug</label>
            <input
              className="admin-form-input"
              placeholder="e.g. acme-corp"
              value={form.id}
              onChange={(e) => setForm(p => ({ ...p, id: e.target.value }))}
              disabled={!!editingPartner}
              style={editingPartner ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
            />
            {!editingPartner && (
              <span className="admin-form-description">Alphanumeric, hyphens, underscores. Cannot be changed later.</span>
            )}
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Name</label>
            <input
              className="admin-form-input"
              placeholder="Partner name"
              value={form.name}
              onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>

          {/* Row 2: Type EN + Type AR */}
          <div className="admin-form-group">
            <label className="admin-form-label">Type (EN)</label>
            <input
              className="admin-form-input"
              placeholder="e.g. Gaming Studio"
              value={form.typeEn}
              onChange={(e) => setForm(p => ({ ...p, typeEn: e.target.value }))}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Type (AR)</label>
            <input
              className="admin-form-input"
              placeholder="e.g. \u0627\u0633\u062A\u0648\u062F\u064A\u0648 \u0627\u0644\u0639\u0627\u0628"
              dir="rtl"
              value={form.typeAr}
              onChange={(e) => setForm(p => ({ ...p, typeAr: e.target.value }))}
            />
          </div>

          {/* Row 3: Description EN (full width) */}
          <div className="admin-form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="admin-form-label">Description (EN)</label>
            <textarea
              className="admin-form-input"
              rows={3}
              placeholder="Brief description in English"
              value={form.descEn}
              onChange={(e) => setForm(p => ({ ...p, descEn: e.target.value }))}
              style={{ resize: 'vertical', minHeight: '60px' }}
            />
          </div>

          {/* Row 4: Description AR (full width, RTL) */}
          <div className="admin-form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="admin-form-label">Description (AR)</label>
            <textarea
              className="admin-form-input"
              rows={3}
              placeholder="\u0648\u0635\u0641 \u0645\u062E\u062A\u0635\u0631 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629"
              dir="rtl"
              value={form.descAr}
              onChange={(e) => setForm(p => ({ ...p, descAr: e.target.value }))}
              style={{ resize: 'vertical', minHeight: '60px' }}
            />
          </div>

          {/* Row 5: Logo (full width) */}
          <div style={{ gridColumn: '1 / -1' }}>
            <ImagePicker
              label="Partner Logo"
              value={form.logo}
              onChange={(url) => setForm(p => ({ ...p, logo: url }))}
              uploadPrefix="partners/"
            />
          </div>

          {/* Row 6: Website URL (full width) */}
          <div className="admin-form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="admin-form-label">Website URL</label>
            <input
              className="admin-form-input"
              placeholder="https://example.com"
              value={form.website}
              onChange={(e) => setForm(p => ({ ...p, website: e.target.value }))}
            />
          </div>

          {/* Section header: Social Links */}
          <div style={{ gridColumn: '1 / -1' }}>
            <h4 className="admin-section-title" style={{ marginBottom: '4px', marginTop: '4px' }}>Social Links</h4>
          </div>

          {/* Row 7: Instagram + X */}
          <div className="admin-form-group">
            <label className="admin-form-label">Instagram</label>
            <input
              className="admin-form-input"
              placeholder="https://instagram.com/..."
              value={form.instagram}
              onChange={(e) => setForm(p => ({ ...p, instagram: e.target.value }))}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">X (Twitter)</label>
            <input
              className="admin-form-input"
              placeholder="https://x.com/..."
              value={form.x}
              onChange={(e) => setForm(p => ({ ...p, x: e.target.value }))}
            />
          </div>

          {/* Row 8: TikTok + YouTube */}
          <div className="admin-form-group">
            <label className="admin-form-label">TikTok</label>
            <input
              className="admin-form-input"
              placeholder="https://tiktok.com/@..."
              value={form.tiktok}
              onChange={(e) => setForm(p => ({ ...p, tiktok: e.target.value }))}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">YouTube</label>
            <input
              className="admin-form-input"
              placeholder="https://youtube.com/@..."
              value={form.youtube}
              onChange={(e) => setForm(p => ({ ...p, youtube: e.target.value }))}
            />
          </div>

          {/* Row 9: WhatsApp (half width) */}
          <div className="admin-form-group">
            <label className="admin-form-label">WhatsApp</label>
            <input
              className="admin-form-input"
              placeholder="https://wa.me/..."
              value={form.whatsapp}
              onChange={(e) => setForm(p => ({ ...p, whatsapp: e.target.value }))}
            />
          </div>

          {/* Row 10: Order (half width) */}
          <div className="admin-form-group">
            <label className="admin-form-label">Display Order</label>
            <input
              className="admin-form-input"
              type="number"
              min={0}
              value={form.order}
              onChange={(e) => setForm(p => ({ ...p, order: parseInt(e.target.value) || 0 }))}
            />
            <span className="admin-form-description">Lower numbers appear first</span>
          </div>
        </div>

        {/* Actions */}
        <div className="admin-modal-actions" style={{ marginTop: '20px' }}>
          <button className="admin-btn admin-btn-ghost" onClick={closeLightbox}>
            Cancel
          </button>
          <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
            {saving
              ? (editingPartner ? 'Saving...' : 'Creating...')
              : (editingPartner ? 'Save Changes' : 'Create Partner')
            }
          </button>
        </div>
      </AdminLightbox>

      {/* ── Delete Confirmation ── */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Partner"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
