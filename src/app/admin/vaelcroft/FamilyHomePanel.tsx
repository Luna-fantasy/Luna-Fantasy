'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import ImageUrlInput from '../games/fields/ImageUrlInput';
import type { VaelcroftLore, VaelcroftFamilyMember } from '@/lib/admin/vaelcroft-lore-types';
import { EMPTY_LORE } from '@/lib/admin/vaelcroft-lore-types';

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

function slug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export default function FamilyHomePanel() {
  const toast = useToast();
  const pending = usePendingAction();
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<VaelcroftLore>(EMPTY_LORE);
  const [lore, setLore] = useState<VaelcroftLore>(EMPTY_LORE);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/vaelcroft/lore', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const next = data.lore ?? EMPTY_LORE;
      setSaved(next);
      setLore(JSON.parse(JSON.stringify(next)));
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const dirty = JSON.stringify(lore) !== JSON.stringify(saved);

  const save = () => {
    if (!dirty) return;
    pending.queue({
      label: 'Save Vaelcroft family & home',
      detail: `${lore.family.length} member${lore.family.length === 1 ? '' : 's'} · ${lore.home.gallery.length} gallery image${lore.home.gallery.length === 1 ? '' : 's'}`,
      delayMs: 3500,
      run: async () => {
        try {
          const token = await fetchCsrf();
          const res = await fetch('/api/admin/vaelcroft/lore', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
            credentials: 'include',
            body: JSON.stringify({ lore }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || 'Save failed');
          }
          const data = await res.json();
          const clean = data.lore ?? lore;
          setSaved(clean);
          setLore(JSON.parse(JSON.stringify(clean)));
          toast.show({ tone: 'success', title: 'Saved', message: 'Vaelcroft lore updated.' });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const reset = () => setLore(JSON.parse(JSON.stringify(saved)));

  const updateHome = <K extends keyof VaelcroftLore['home']>(patch: Partial<VaelcroftLore['home']>) => {
    setLore((l) => ({ ...l, home: { ...l.home, ...patch } }));
  };

  const addFamilyMember = () => {
    const baseId = 'member';
    let i = 1;
    const existing = new Set(lore.family.map((m) => m.id));
    while (existing.has(`${baseId}-${i}`)) i++;
    const member: VaelcroftFamilyMember = {
      id: `${baseId}-${i}`,
      name: { en: '', ar: '' },
      role: { en: '', ar: '' },
      bio: { en: '', ar: '' },
      imageUrl: '',
    };
    setLore((l) => ({ ...l, family: [...l.family, member] }));
  };

  const updateMember = (idx: number, patch: (m: VaelcroftFamilyMember) => VaelcroftFamilyMember) => {
    setLore((l) => ({
      ...l,
      family: l.family.map((m, i) => (i === idx ? patch(m) : m)),
    }));
  };

  const removeMember = (idx: number) => {
    setLore((l) => ({ ...l, family: l.family.filter((_, i) => i !== idx) }));
  };

  const addGallery = () => updateHome({ gallery: [...lore.home.gallery, ''] });
  const setGalleryAt = (idx: number, url: string) => {
    updateHome({ gallery: lore.home.gallery.map((g, i) => (i === idx ? url : g)) });
  };
  const removeGallery = (idx: number) => {
    updateHome({ gallery: lore.home.gallery.filter((_, i) => i !== idx) });
  };

  if (loading) return <div className="av-flows-empty">Loading Vaelcroft lore…</div>;

  return (
    <div className="av-vaellore">
      <header className="av-vaellore-head">
        <div>
          <h3>Family &amp; Home</h3>
          <p>Narrative content shown on the public Vaelcroft page. Stored in <code>bot_config.vaelcroft_lore</code>. Images upload to R2 under <code>vaelcroft/</code>.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {dirty && <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={reset}>Discard</button>}
          <button
            type="button"
            className="av-btn av-btn-primary av-btn-sm"
            onClick={save}
            disabled={!dirty}
            title={!dirty ? 'No changes' : undefined}
          >Save lore</button>
        </div>
      </header>

      <section className="av-vaellore-section">
        <h4>Vaelcroft Estate</h4>
        <div className="av-banking-investment-grid">
          <label className="av-banking-field">
            <span>Estate name (EN)</span>
            <input
              className="av-audit-input"
              value={lore.home.name.en}
              onChange={(e) => updateHome({ name: { ...lore.home.name, en: e.target.value } })}
              maxLength={120}
              placeholder="Vaelcroft Manor"
            />
          </label>
          <label className="av-banking-field">
            <span>Estate name (AR)</span>
            <input
              className="av-audit-input"
              value={lore.home.name.ar}
              onChange={(e) => updateHome({ name: { ...lore.home.name, ar: e.target.value } })}
              maxLength={120}
              dir="rtl"
            />
          </label>
          <label className="av-banking-field" style={{ gridColumn: '1 / -1' }}>
            <span>Description (EN)</span>
            <textarea
              className="av-audit-input"
              rows={4}
              maxLength={4000}
              value={lore.home.description.en}
              onChange={(e) => updateHome({ description: { ...lore.home.description, en: e.target.value } })}
              placeholder="The silent hold of the Vaelcroft bloodline…"
            />
          </label>
          <label className="av-banking-field" style={{ gridColumn: '1 / -1' }}>
            <span>Description (AR)</span>
            <textarea
              className="av-audit-input"
              rows={4}
              maxLength={4000}
              value={lore.home.description.ar}
              onChange={(e) => updateHome({ description: { ...lore.home.description, ar: e.target.value } })}
              dir="rtl"
            />
          </label>
          <label className="av-banking-field" style={{ gridColumn: '1 / -1' }}>
            <span>Main estate image</span>
            <ImageUrlInput
              value={lore.home.imageUrl}
              onChange={(url) => updateHome({ imageUrl: url })}
              folder="vaelcroft"
              filenameHint="estate-main"
            />
          </label>
        </div>

        <div className="av-vaellore-gallery">
          <div className="av-vaellore-gallery-head">
            <strong>Gallery images</strong>
            <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={addGallery}>+ Add image</button>
          </div>
          {lore.home.gallery.length === 0 ? (
            <p className="av-text-muted" style={{ fontSize: 13 }}>No gallery images yet. Add up to 20.</p>
          ) : (
            <div className="av-chars-grid">
              {lore.home.gallery.map((url, i) => (
                <div key={i} className="av-vaellore-gallery-item">
                  <ImageUrlInput
                    value={url}
                    onChange={(next) => setGalleryAt(i, next)}
                    folder="vaelcroft"
                    filenameHint={`gallery-${i + 1}`}
                  />
                  <button
                    type="button"
                    className="av-btn av-btn-ghost av-btn-sm"
                    onClick={() => removeGallery(i)}
                  >Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="av-vaellore-section">
        <div className="av-vaellore-section-head">
          <h4>Family members · {lore.family.length}</h4>
          <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={addFamilyMember}>+ Add member</button>
        </div>

        {lore.family.length === 0 ? (
          <div className="av-flows-empty">No family members yet. Click <strong>Add member</strong> to create one.</div>
        ) : (
          <div className="av-chars-grid">
            {lore.family.map((m, i) => (
              <article key={i} className="av-chars-card">
                <div className="av-chars-card-head">
                  <div className="av-chars-image-wrap">
                    {m.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={m.imageUrl} alt="" className="av-chars-image" />
                    ) : (
                      <div className="av-chars-image-placeholder">?</div>
                    )}
                  </div>
                  <div className="av-chars-meta">
                    <div className="av-chars-id"><code>{m.id || '—'}</code></div>
                    <div className="av-chars-faction">Vaelcroft</div>
                  </div>
                </div>

                <ImageUrlInput
                  value={m.imageUrl}
                  onChange={(url) => updateMember(i, (mm) => ({ ...mm, imageUrl: url }))}
                  folder="vaelcroft"
                  filenameHint={`member-${m.id || 'new'}`}
                />

                <div className="av-chars-fields">
                  <label className="av-banking-field">
                    <span>ID (slug)</span>
                    <input
                      className="av-audit-input"
                      value={m.id}
                      onChange={(e) => updateMember(i, (mm) => ({ ...mm, id: slug(e.target.value) }))}
                      maxLength={60}
                      placeholder="corin-avelle"
                    />
                  </label>
                  <label className="av-banking-field">
                    <span>Role / title (EN)</span>
                    <input
                      className="av-audit-input"
                      value={m.role.en}
                      onChange={(e) => updateMember(i, (mm) => ({ ...mm, role: { ...mm.role, en: e.target.value } }))}
                      maxLength={120}
                      placeholder="Butler of Vaelcroft"
                    />
                  </label>
                  <label className="av-banking-field">
                    <span>Name (EN)</span>
                    <input
                      className="av-audit-input"
                      value={m.name.en}
                      onChange={(e) => updateMember(i, (mm) => ({ ...mm, name: { ...mm.name, en: e.target.value } }))}
                      maxLength={120}
                    />
                  </label>
                  <label className="av-banking-field">
                    <span>Name (AR)</span>
                    <input
                      className="av-audit-input"
                      value={m.name.ar}
                      onChange={(e) => updateMember(i, (mm) => ({ ...mm, name: { ...mm.name, ar: e.target.value } }))}
                      maxLength={120}
                      dir="rtl"
                    />
                  </label>
                  <label className="av-banking-field" style={{ gridColumn: '1 / -1' }}>
                    <span>Role / title (AR)</span>
                    <input
                      className="av-audit-input"
                      value={m.role.ar}
                      onChange={(e) => updateMember(i, (mm) => ({ ...mm, role: { ...mm.role, ar: e.target.value } }))}
                      maxLength={120}
                      dir="rtl"
                    />
                  </label>
                  <label className="av-banking-field" style={{ gridColumn: '1 / -1' }}>
                    <span>Bio (EN)</span>
                    <textarea
                      className="av-audit-input"
                      rows={3}
                      maxLength={4000}
                      value={m.bio.en}
                      onChange={(e) => updateMember(i, (mm) => ({ ...mm, bio: { ...mm.bio, en: e.target.value } }))}
                    />
                  </label>
                  <label className="av-banking-field" style={{ gridColumn: '1 / -1' }}>
                    <span>Bio (AR)</span>
                    <textarea
                      className="av-audit-input"
                      rows={3}
                      maxLength={4000}
                      value={m.bio.ar}
                      onChange={(e) => updateMember(i, (mm) => ({ ...mm, bio: { ...mm.bio, ar: e.target.value } }))}
                      dir="rtl"
                    />
                  </label>
                </div>

                <div className="av-chars-actions">
                  <button
                    type="button"
                    className="av-btn av-btn-ghost av-btn-sm"
                    onClick={() => removeMember(i)}
                  >Remove member</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
