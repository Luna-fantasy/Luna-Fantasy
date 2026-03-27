'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/app/admin/components/Toast';
import type { FooterConfig, FooterColumn, FooterLink, SocialLink, LegalLink } from '@/lib/admin/footer-defaults';

function getCsrf(): string {
  const m = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

type Tab = 'columns' | 'social' | 'bottom';

export default function FooterConfigPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<FooterConfig | null>(null);
  const [orig, setOrig] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('columns');
  const [meta, setMeta] = useState<{ updatedAt?: string; updatedBy?: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config/footer');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setConfig(data.config);
      setOrig(JSON.stringify(data.config));
      setMeta(data.metadata);
    } catch {
      toast('Failed to load footer config', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const hasChanges = config ? JSON.stringify(config) !== orig : false;

  const handleSave = async () => {
    if (!config || !hasChanges) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/config/footer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(data.error);
      }
      setOrig(JSON.stringify(config));
      setMeta({ updatedAt: new Date().toISOString(), updatedBy: 'You' });
      toast('Footer config saved!', 'success');
    } catch (err: any) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (orig) setConfig(JSON.parse(orig));
  };

  // Update helpers
  const updateColumn = (idx: number, patch: Partial<FooterColumn>) => {
    if (!config) return;
    const cols = [...config.columns];
    cols[idx] = { ...cols[idx], ...patch };
    setConfig({ ...config, columns: cols });
  };

  const updateLink = (colIdx: number, linkIdx: number, patch: Partial<FooterLink>) => {
    if (!config) return;
    const cols = [...config.columns];
    const links = [...cols[colIdx].links];
    links[linkIdx] = { ...links[linkIdx], ...patch };
    cols[colIdx] = { ...cols[colIdx], links };
    setConfig({ ...config, columns: cols });
  };

  const addLink = (colIdx: number) => {
    if (!config) return;
    const cols = [...config.columns];
    cols[colIdx] = {
      ...cols[colIdx],
      links: [...cols[colIdx].links, { labelEn: 'New Link', labelAr: 'رابط جديد', href: '/', external: false }],
    };
    setConfig({ ...config, columns: cols });
  };

  const removeLink = (colIdx: number, linkIdx: number) => {
    if (!config) return;
    const cols = [...config.columns];
    cols[colIdx] = { ...cols[colIdx], links: cols[colIdx].links.filter((_, i) => i !== linkIdx) };
    setConfig({ ...config, columns: cols });
  };

  const addColumn = () => {
    if (!config || config.columns.length >= 6) return;
    setConfig({
      ...config,
      columns: [...config.columns, {
        id: `col_${Date.now()}`,
        titleEn: 'New Column',
        titleAr: 'عمود جديد',
        visible: true,
        links: [],
      }],
    });
  };

  const removeColumn = (idx: number) => {
    if (!config) return;
    setConfig({ ...config, columns: config.columns.filter((_, i) => i !== idx) });
  };

  const moveLink = (colIdx: number, linkIdx: number, dir: -1 | 1) => {
    if (!config) return;
    const cols = [...config.columns];
    const links = [...cols[colIdx].links];
    const target = linkIdx + dir;
    if (target < 0 || target >= links.length) return;
    [links[linkIdx], links[target]] = [links[target], links[linkIdx]];
    cols[colIdx] = { ...cols[colIdx], links };
    setConfig({ ...config, columns: cols });
  };

  const updateSocial = (idx: number, patch: Partial<SocialLink>) => {
    if (!config) return;
    const social = [...config.socialLinks];
    social[idx] = { ...social[idx], ...patch };
    setConfig({ ...config, socialLinks: social });
  };

  const addSocial = () => {
    if (!config || config.socialLinks.length >= 8) return;
    setConfig({
      ...config,
      socialLinks: [...config.socialLinks, { platform: 'twitter', url: '', visible: true }],
    });
  };

  const removeSocial = (idx: number) => {
    if (!config) return;
    setConfig({ ...config, socialLinks: config.socialLinks.filter((_, i) => i !== idx) });
  };

  const updateLegal = (idx: number, patch: Partial<LegalLink>) => {
    if (!config) return;
    const legal = [...config.legalLinks];
    legal[idx] = { ...legal[idx], ...patch };
    setConfig({ ...config, legalLinks: legal });
  };

  if (loading) return <div className="admin-page-header"><p>Loading...</p></div>;
  if (!config) return <div className="admin-page-header"><p>Failed to load config</p></div>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Footer Configuration</h1>
        <p className="admin-page-subtitle">Manage footer columns, links, social media, and bottom bar</p>
        {meta?.updatedAt && (
          <p className="admin-last-updated">
            Last updated: {new Date(meta.updatedAt).toLocaleString()} {meta.updatedBy && `by ${meta.updatedBy}`}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="admin-tabs" style={{ marginBottom: '1.5rem' }}>
        {(['columns', 'social', 'bottom'] as Tab[]).map(t => (
          <button key={t} className={`admin-tab ${tab === t ? 'admin-tab-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'columns' ? 'Columns & Links' : t === 'social' ? 'Social Media' : 'Bottom Bar'}
          </button>
        ))}
      </div>

      {/* === COLUMNS TAB === */}
      {tab === 'columns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {config.columns.map((col, colIdx) => (
            <div key={col.id} className="admin-config-section" style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={col.visible} onChange={e => updateColumn(colIdx, { visible: e.target.checked })} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Visible</span>
                </label>
                <input className="admin-input" placeholder="Title (EN)" value={col.titleEn} onChange={e => updateColumn(colIdx, { titleEn: e.target.value })} style={{ flex: 1 }} />
                <input className="admin-input" placeholder="Title (AR)" value={col.titleAr} onChange={e => updateColumn(colIdx, { titleAr: e.target.value })} style={{ flex: 1, direction: 'rtl' }} />
                <button className="admin-btn admin-btn-sm" style={{ color: '#f43f5e' }} onClick={() => removeColumn(colIdx)} title="Remove column">✕</button>
              </div>

              {/* Links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '8px' }}>
                {col.links.map((link, linkIdx) => (
                  <div key={linkIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button className="admin-btn admin-btn-sm" onClick={() => moveLink(colIdx, linkIdx, -1)} disabled={linkIdx === 0} style={{ padding: '0 4px', fontSize: '10px', lineHeight: 1 }}>▲</button>
                      <button className="admin-btn admin-btn-sm" onClick={() => moveLink(colIdx, linkIdx, 1)} disabled={linkIdx === col.links.length - 1} style={{ padding: '0 4px', fontSize: '10px', lineHeight: 1 }}>▼</button>
                    </div>
                    <input className="admin-input" placeholder="Label (EN)" value={link.labelEn} onChange={e => updateLink(colIdx, linkIdx, { labelEn: e.target.value })} style={{ flex: 1, fontSize: '0.85rem' }} />
                    <input className="admin-input" placeholder="Label (AR)" value={link.labelAr} onChange={e => updateLink(colIdx, linkIdx, { labelAr: e.target.value })} style={{ flex: 1, fontSize: '0.85rem', direction: 'rtl' }} />
                    <input className="admin-input" placeholder="https://... or /page" value={link.href} onChange={e => updateLink(colIdx, linkIdx, { href: e.target.value })} style={{ flex: 1.5, fontSize: '0.85rem' }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      <input type="checkbox" checked={link.external} onChange={e => updateLink(colIdx, linkIdx, { external: e.target.checked })} />
                      External
                    </label>
                    <button className="admin-btn admin-btn-sm" style={{ color: '#f43f5e', padding: '2px 6px' }} onClick={() => removeLink(colIdx, linkIdx)}>✕</button>
                  </div>
                ))}
                <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => addLink(colIdx)} style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                  + Add Link
                </button>
              </div>
            </div>
          ))}

          {config.columns.length < 6 && (
            <button className="admin-btn admin-btn-ghost" onClick={addColumn} style={{ alignSelf: 'flex-start' }}>
              + Add Column
            </button>
          )}
        </div>
      )}

      {/* === SOCIAL MEDIA TAB === */}
      {tab === 'social' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {config.socialLinks.map((s, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={s.visible} onChange={e => updateSocial(idx, { visible: e.target.checked })} />
              </label>
              <select className="admin-input" value={s.platform} onChange={e => updateSocial(idx, { platform: e.target.value })} style={{ width: '140px' }}>
                <option value="discord">Discord</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="twitter">Twitter / X</option>
                <option value="youtube">YouTube</option>
              </select>
              <input className="admin-input" placeholder="https://discord.gg/..." value={s.url} onChange={e => updateSocial(idx, { url: e.target.value })} style={{ flex: 1 }} />
              <button className="admin-btn admin-btn-sm" style={{ color: '#f43f5e' }} onClick={() => removeSocial(idx)}>✕</button>
            </div>
          ))}
          {config.socialLinks.length < 8 && (
            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={addSocial} style={{ alignSelf: 'flex-start' }}>
              + Add Platform
            </button>
          )}
        </div>
      )}

      {/* === BOTTOM BAR TAB === */}
      {tab === 'bottom' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Copyright */}
          <div className="admin-config-section" style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 600 }}>Copyright Text</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label className="admin-form-label">English</label>
                <input className="admin-input" value={config.copyrightEn} onChange={e => setConfig({ ...config, copyrightEn: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="admin-form-label">Arabic</label>
                <input className="admin-input" value={config.copyrightAr} onChange={e => setConfig({ ...config, copyrightAr: e.target.value })} style={{ direction: 'rtl' }} />
              </div>
            </div>
          </div>

          {/* Legal Links */}
          <div className="admin-config-section" style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 600 }}>Legal Links</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {config.legalLinks.map((link, idx) => (
                <div key={link.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={link.visible} onChange={e => updateLegal(idx, { visible: e.target.checked })} />
                  </label>
                  <input className="admin-input" placeholder="Label (EN)" value={link.labelEn} onChange={e => updateLegal(idx, { labelEn: e.target.value })} style={{ flex: 1, fontSize: '0.85rem' }} />
                  <input className="admin-input" placeholder="Label (AR)" value={link.labelAr} onChange={e => updateLegal(idx, { labelAr: e.target.value })} style={{ flex: 1, fontSize: '0.85rem', direction: 'rtl' }} />
                  <input className="admin-input" placeholder="/terms or https://..." value={link.href} onChange={e => updateLegal(idx, { href: e.target.value })} style={{ flex: 1.5, fontSize: '0.85rem' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Payment Icons */}
          <div className="admin-config-section" style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 600 }}>Payment Icons</h3>
            <div style={{ display: 'flex', gap: '24px' }}>
              {(['visa', 'mastercard', 'paypal'] as const).map(icon => (
                <label key={icon} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textTransform: 'capitalize' }}>
                  <input type="checkbox" checked={(config.paymentIcons as any)[icon]} onChange={e => setConfig({ ...config, paymentIcons: { ...config.paymentIcons, [icon]: e.target.checked } })} />
                  {icon}
                </label>
              ))}
            </div>
          </div>

          {/* Brand Description Toggle */}
          <div className="admin-config-section" style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 600 }}>Brand Section</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={config.brandDescription} onChange={e => setConfig({ ...config, brandDescription: e.target.checked })} />
              Show description text below logo
            </label>
          </div>
        </div>
      )}

      {/* Save Bar */}
      {hasChanges && (
        <div className="admin-save-bar">
          <span style={{ fontSize: '0.85rem' }}>You have unsaved changes</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="admin-btn admin-btn-ghost" onClick={handleDiscard}>Discard</button>
            <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
