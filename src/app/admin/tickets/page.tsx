'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfigSection from '../components/ConfigSection';
import BotBadge from '../components/BotBadge';
import SaveDeployBar from '../components/SaveDeployBar';
import ImagePicker from '../components/ImagePicker';
import RichTextArea from '../components/RichTextArea';
import RolePicker from '../components/RolePicker';
import ChannelPicker from '../components/ChannelPicker';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';

interface TicketCategory {
  title: string;
  description: string;
  image?: string;
  staff_roles?: string[];
}

interface TicketSystemConfig {
  global_staff_roles: string[];
  logs_channel_id: string;
  categories: Record<string, TicketCategory>;
}

export default function TicketsPage() {
  const [config, setConfig] = useState<TicketSystemConfig>({ global_staff_roles: [], logs_channel_id: '', categories: {} });
  const [original, setOriginal] = useState<TicketSystemConfig>({ global_staff_roles: [], logs_channel_id: '', categories: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCategoryKey, setNewCategoryKey] = useState('');
  const { toast } = useToast();

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config/butler');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const ts = data.sections?.ticket_system;
      if (ts) { setConfig(ts); setOriginal(ts); }
    } catch {
      toast('Failed to load ticket config', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const hasChanges = JSON.stringify(config) !== JSON.stringify(original);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/config/butler', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ section: 'ticket_system', value: config }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setOriginal(config);
      toast('Ticket system config saved', 'success');
    } catch (err: any) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => setConfig(original);

  const updateCategory = (key: string, updates: Partial<TicketCategory>) => {
    setConfig(p => ({ ...p, categories: { ...p.categories, [key]: { ...p.categories[key], ...updates } } }));
  };

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">🎫</span> Ticket System</h1>
          <p className="admin-page-subtitle">Support ticket configuration for Butler</p>
        </div>
        <SkeletonCard count={2} />
        <SkeletonTable rows={3} />
      </>
    );
  }

  const categoryKeys = Object.keys(config.categories);

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">🎫</span> Ticket System</h1>
        <p className="admin-page-subtitle">Support ticket configuration for Butler</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ConfigSection title="Global Settings" description="Staff roles and log channel for all ticket categories">
          <RolePicker label="🛡️ Global Staff Roles" description="Roles that can manage tickets across all categories" value={config.global_staff_roles} onChange={v => setConfig(p => ({ ...p, global_staff_roles: v as string[] }))} multi />
          <ChannelPicker label="📺 Logs Channel" description="Channel where ticket open/close events are logged" value={config.logs_channel_id} onChange={v => setConfig(p => ({ ...p, logs_channel_id: v as string }))} />
          <BotBadge bot="butler" />
        </ConfigSection>

        {categoryKeys.length === 0 && (
          <div className="admin-empty">
            <div className="admin-empty-icon">🎫</div>
            <p>No ticket categories configured</p>
            <p className="admin-empty-hint">Add a category below to get started</p>
          </div>
        )}

        {categoryKeys.map((key) => {
          const cat = config.categories[key];
          const staffCount = cat.staff_roles?.length ?? 0;
          return (
            <div key={key} className="admin-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                {cat.image && (
                  <img
                    src={cat.image}
                    alt={cat.title || key}
                    style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(0,212,255,0.15)' }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 className="admin-section-title" style={{ margin: 0 }}>{cat.title || key}</h3>
                    <span className="admin-badge cyan">{key}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    {staffCount > 0
                      ? `${staffCount} staff role${staffCount === 1 ? '' : 's'} assigned`
                      : 'Using global staff roles'}
                  </div>
                </div>
                <button
                  className="admin-btn admin-btn-danger admin-btn-sm"
                  onClick={() => {
                    const updated = { ...config.categories };
                    delete updated[key];
                    setConfig(p => ({ ...p, categories: updated }));
                  }}
                >
                  Delete
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">✏️ Title</label>
                  <input className="admin-input" value={cat.title ?? ''} onChange={(e) => updateCategory(key, { title: e.target.value })} dir="auto" />
                </div>
                <RichTextArea
                  label="📝 Description"
                  value={cat.description ?? ''}
                  onChange={(v) => updateCategory(key, { description: v })}
                  rows={3}
                  minHeight="100px"
                />
                <ImagePicker
                  label="🖼️ Image (optional)"
                  value={cat.image ?? ''}
                  onChange={(url) => updateCategory(key, { image: url })}
                  uploadPrefix="butler/tickets/"
                />
                <RolePicker label="🛡️ Staff Roles (override)" description="Roles specific to this category. Overrides global if set." value={cat.staff_roles ?? []} onChange={v => updateCategory(key, { staff_roles: v as string[] })} multi />
              </div>
            </div>
          );
        })}

        <div
          style={{
            border: '2px dashed rgba(0,212,255,0.15)',
            borderRadius: 'var(--radius-md)',
            padding: '20px 24px',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            background: 'rgba(0,0,0,0.08)',
          }}
        >
          <input className="admin-input" style={{ maxWidth: 220 }} value={newCategoryKey} onChange={(e) => setNewCategoryKey(e.target.value)} placeholder="Category key (e.g. bugs)" />
          <button className="admin-btn admin-btn-ghost" disabled={!newCategoryKey.trim()} onClick={() => {
            const key = newCategoryKey.trim();
            if (!key) return;
            setConfig(p => ({
              ...p,
              categories: { ...p.categories, [key]: { title: key, description: '', staff_roles: [] } },
            }));
            setNewCategoryKey('');
          }}>+ Add Category</button>
        </div>
      </div>

      <SaveDeployBar hasChanges={hasChanges} saving={saving} onSave={handleSave} onDiscard={handleDiscard} />
    </>
  );
}
