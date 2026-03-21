'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfigSection from '../components/ConfigSection';
import NumberInput from '../components/NumberInput';
import BotBadge from '../components/BotBadge';
import SaveDeployBar from '../components/SaveDeployBar';
import ImagePicker from '../components/ImagePicker';
import RichTextArea from '../components/RichTextArea';
import RolePicker from '../components/RolePicker';
import ChannelPicker from '../components/ChannelPicker';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';

interface AppCategory {
  title: string;
  description: string;
  image?: string;
  questions: string[];
}

interface ApplicationsConfig {
  reviews_channel_id: string;
  logs_channel_id: string;
  votes_required: number;
  high_staff_roles: string[];
  mid_staff_roles: string[];
  categories: Record<string, AppCategory>;
}

export default function ApplicationsPage() {
  const [config, setConfig] = useState<ApplicationsConfig>({
    reviews_channel_id: '', logs_channel_id: '', votes_required: 3,
    high_staff_roles: [], mid_staff_roles: [], categories: {},
  });
  const [original, setOriginal] = useState<ApplicationsConfig>({
    reviews_channel_id: '', logs_channel_id: '', votes_required: 3,
    high_staff_roles: [], mid_staff_roles: [], categories: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCategoryKey, setNewCategoryKey] = useState('');
  const { toast } = useToast();

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config/butler');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const apps = data.sections?.applications_system;
      if (apps) { setConfig(apps); setOriginal(apps); }
    } catch {
      toast('Failed to load applications config', 'error');
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
        body: JSON.stringify({ section: 'applications_system', value: config }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setOriginal(config);
      toast('Applications config saved', 'success');
    } catch (err: any) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => setConfig(original);

  const updateCategory = (key: string, updates: Partial<AppCategory>) => {
    setConfig(p => ({ ...p, categories: { ...p.categories, [key]: { ...p.categories[key], ...updates } } }));
  };

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">📋</span> Applications</h1>
          <p className="admin-page-subtitle">Staff application system configuration for Butler</p>
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
        <h1 className="admin-page-title"><span className="emoji-float">📋</span> Applications</h1>
        <p className="admin-page-subtitle">Staff application system configuration for Butler</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ConfigSection title="General" description="Channels, voting, and staff roles">
          <ChannelPicker label="📺 Reviews Channel" description="Channel where application review embeds are posted" value={config.reviews_channel_id} onChange={v => setConfig(p => ({ ...p, reviews_channel_id: v as string }))} />
          <ChannelPicker label="📺 Logs Channel" description="Channel where application submission logs are sent" value={config.logs_channel_id} onChange={v => setConfig(p => ({ ...p, logs_channel_id: v as string }))} />
          <NumberInput label="🔢 Votes Required" value={config.votes_required} onChange={(v) => setConfig(p => ({ ...p, votes_required: v }))} min={1} description="Staff votes needed to approve/reject" />
          <RolePicker label="🛡️ High Staff Roles" description="Senior staff roles that can approve/reject applications" value={config.high_staff_roles} onChange={v => setConfig(p => ({ ...p, high_staff_roles: v as string[] }))} multi />
          <RolePicker label="🛡️ Mid Staff Roles" description="Mid-tier staff roles that can vote on applications" value={config.mid_staff_roles} onChange={v => setConfig(p => ({ ...p, mid_staff_roles: v as string[] }))} multi />
          <BotBadge bot="butler" />
        </ConfigSection>

        {categoryKeys.length === 0 && (
          <div className="admin-empty">
            <div className="admin-empty-icon">📂</div>
            <p>No application categories configured</p>
            <p className="admin-empty-hint">Add a category below to get started</p>
          </div>
        )}

        {categoryKeys.map((key) => {
          const cat = config.categories[key];
          const questionCount = cat.questions?.length ?? 0;
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
                    {questionCount} {questionCount === 1 ? 'question' : 'questions'}
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
                  uploadPrefix="butler/applications/"
                />

                <div className="admin-form-group">
                  <label className="admin-form-label">❓ Questions ({questionCount})</label>
                  <div style={{ borderRadius: 8, overflow: 'hidden', border: questionCount > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    {(cat.questions ?? []).map((q, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: i % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                          <button
                            className="admin-btn admin-btn-ghost"
                            style={{ padding: '1px 6px', fontSize: 10, lineHeight: 1 }}
                            disabled={i === 0}
                            onClick={() => {
                              const copy = [...(cat.questions ?? [])];
                              [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
                              updateCategory(key, { questions: copy });
                            }}
                          >
                            &#9650;
                          </button>
                          <button
                            className="admin-btn admin-btn-ghost"
                            style={{ padding: '1px 6px', fontSize: 10, lineHeight: 1 }}
                            disabled={i === (cat.questions?.length ?? 0) - 1}
                            onClick={() => {
                              const copy = [...(cat.questions ?? [])];
                              [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]];
                              updateCategory(key, { questions: copy });
                            }}
                          >
                            &#9660;
                          </button>
                        </div>
                        <span className="admin-badge-muted" style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>Q{i + 1}</span>
                        <input className="admin-input" style={{ flex: 1 }} value={q} dir="auto" onChange={(e) => {
                          const copy = [...(cat.questions ?? [])];
                          copy[i] = e.target.value;
                          updateCategory(key, { questions: copy });
                        }} />
                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => {
                          updateCategory(key, { questions: (cat.questions ?? []).filter((_, j) => j !== i) });
                        }}>&times;</button>
                      </div>
                    ))}
                  </div>
                  {questionCount === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0 4px', opacity: 0.7 }}>
                      No questions yet. Add one below.
                    </div>
                  )}
                  <button className="admin-btn admin-btn-ghost admin-btn-sm" style={{ marginTop: 8 }} onClick={() => {
                    updateCategory(key, { questions: [...(cat.questions ?? []), ''] });
                  }}>+ Add Question</button>
                </div>
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
          <input className="admin-input" style={{ maxWidth: 220 }} value={newCategoryKey} onChange={(e) => setNewCategoryKey(e.target.value)} placeholder="Category key (e.g. moderator)" />
          <button className="admin-btn admin-btn-ghost" disabled={!newCategoryKey.trim()} onClick={() => {
            const key = newCategoryKey.trim();
            if (!key) return;
            setConfig(p => ({
              ...p,
              categories: { ...p.categories, [key]: { title: key, description: '', questions: [] } },
            }));
            setNewCategoryKey('');
          }}>+ Add Category</button>
        </div>
      </div>

      <SaveDeployBar hasChanges={hasChanges} saving={saving} onSave={handleSave} onDiscard={handleDiscard} />
    </>
  );
}
