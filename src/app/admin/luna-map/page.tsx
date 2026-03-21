'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import AdminLightbox from '../components/AdminLightbox';
import ImagePicker from '../components/ImagePicker';
import RichTextArea from '../components/RichTextArea';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';

// ── Types ──

interface LunaMapMenuItem {
  label: string;
  label_en?: string;
  content: string;
  content_en?: string;
  image: string;
}

interface LunaMapButton {
  name: string;
  name_en?: string;
  btnStyle: number;
  emojiId: string;
  content?: string;
  content_en?: string;
  image?: string;
  menu?: LunaMapMenuItem[];
}

interface LunaMapConfig {
  title: string;
  title_en?: string;
  description: string;
  description_en?: string;
  image: string;
  buttons: LunaMapButton[];
}

const BTN_STYLE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Blue', color: '#5865F2' },
  2: { label: 'Gray', color: '#4F545C' },
  3: { label: 'Green', color: '#57F287' },
  4: { label: 'Red', color: '#ED4245' },
};

// ── Main Page ──

export default function LunaMapPage() {
  const [loading, setLoading] = useState(true);
  const [lunaMapConfig, setLunaMapConfig] = useState<LunaMapConfig | null>(null);
  const [lunaMapOriginal, setLunaMapOriginal] = useState<LunaMapConfig | null>(null);
  const [lunaMapSaving, setLunaMapSaving] = useState(false);
  const [editingButton, setEditingButton] = useState<{ index: number; button: LunaMapButton } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shops/config');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (data.lunaMap) {
        setLunaMapConfig(data.lunaMap);
        setLunaMapOriginal(data.lunaMap);
      }
    } catch {
      toast('Failed to load Luna Map config', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save handler ──

  async function saveLunaMap(config: LunaMapConfig) {
    setLunaMapSaving(true);
    try {
      const res = await fetch('/api/admin/shops/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ shop: 'lunamap', config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setLunaMapConfig(data.config);
      setLunaMapOriginal(data.config);
      toast('Luna Map config saved', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLunaMapSaving(false);
    }
  }

  function handleSaveButton() {
    if (!editingButton || !lunaMapConfig) return;
    const { index, button } = editingButton;
    if (!button.name.trim()) {
      toast('Button name is required', 'error');
      return;
    }
    const updated = { ...lunaMapConfig };
    const buttons = [...updated.buttons];
    if (index === -1) {
      buttons.push(button);
    } else {
      buttons[index] = button;
    }
    updated.buttons = buttons;
    setLunaMapConfig(updated);
    setEditingButton(null);
  }

  function handleDeleteButton(index: number) {
    if (!lunaMapConfig) return;
    const updated = { ...lunaMapConfig, buttons: lunaMapConfig.buttons.filter((_, i) => i !== index) };
    setLunaMapConfig(updated);
    setConfirmDelete(null);
  }

  // ── Render ──

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">🗺️</span> Luna Map</h1>
          <p className="admin-page-subtitle">Configure the interactive Luna Map buttons and content</p>
        </div>
        <div className="admin-loading"><div className="admin-spinner" />Loading...</div>
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">🗺️</span> Luna Map</h1>
        <p className="admin-page-subtitle">Configure the interactive Luna Map buttons and content</p>
      </div>

      <div className="admin-card" style={{ padding: '24px' }}>
        <div style={{ pointerEvents: lunaMapSaving ? 'none' : 'auto', opacity: lunaMapSaving ? 0.6 : 1, transition: 'opacity 0.2s' }}>
          {!lunaMapConfig ? (
            <div className="admin-empty" style={{ padding: '32px' }}>
              <p>No Luna Map config found. Run the seed script first: <code>npx tsx tools/seed_luna_map.ts</code></p>
            </div>
          ) : (
            <>
              {/* Header fields */}
              <div style={{ marginBottom: '20px' }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">{'\u{1F1F8}\u{1F1E6}'} Title (Arabic)</label>
                  <input className="admin-form-input" value={lunaMapConfig.title} dir="rtl"
                    onChange={e => setLunaMapConfig({ ...lunaMapConfig, title: e.target.value })} />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">{'\u{1F1EC}\u{1F1E7}'} Title (English)</label>
                  <input className="admin-form-input" value={lunaMapConfig.title_en ?? ''} dir="ltr"
                    onChange={e => setLunaMapConfig({ ...lunaMapConfig, title_en: e.target.value })} />
                </div>
                <ImagePicker
                  label="🖼️ Main Image"
                  value={lunaMapConfig.image}
                  onChange={url => setLunaMapConfig({ ...lunaMapConfig, image: url })}
                  uploadPrefix="luna-map/"
                />
                <RichTextArea
                  label={`${'\u{1F1F8}\u{1F1E6}'} Description (Arabic)`}
                  value={lunaMapConfig.description}
                  onChange={v => setLunaMapConfig({ ...lunaMapConfig, description: v })}
                  rows={4}
                  minHeight="100px"
                />
                <RichTextArea
                  label={`${'\u{1F1EC}\u{1F1E7}'} Description (English)`}
                  value={lunaMapConfig.description_en ?? ''}
                  onChange={v => setLunaMapConfig({ ...lunaMapConfig, description_en: v })}
                  rows={4}
                  minHeight="100px"
                />
              </div>

              {/* Buttons grid */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label className="admin-form-label" style={{ margin: 0 }}>Buttons ({lunaMapConfig.buttons.length})</label>
                <button className="admin-btn admin-btn-ghost admin-btn-sm"
                  onClick={() => setEditingButton({ index: -1, button: { name: '', btnStyle: 2, emojiId: '' } })}>
                  + Add Button
                </button>
              </div>

              {lunaMapConfig.buttons.length === 0 ? (
                <div className="admin-empty" style={{ padding: '32px' }}>
                  <p>No buttons configured. Click &quot;+ Add Button&quot; to get started.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                  {lunaMapConfig.buttons.map((btn, i) => (
                    <div key={i} className="admin-card luna-map-card"
                      role="button" tabIndex={0}
                      onClick={() => setEditingButton({ index: i, button: JSON.parse(JSON.stringify(btn)) })}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingButton({ index: i, button: JSON.parse(JSON.stringify(btn)) }); } }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: '50%',
                          backgroundColor: BTN_STYLE_LABELS[btn.btnStyle]?.color ?? '#4F545C',
                          flexShrink: 0,
                        }} />
                        <span style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {btn.name || '(unnamed)'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                        {btn.emojiId && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            Emoji: {btn.emojiId.slice(0, 10)}...
                          </span>
                        )}
                        <span style={{
                          fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                          backgroundColor: btn.menu ? 'rgba(88,101,242,0.15)' : 'rgba(87,242,135,0.15)',
                          color: btn.menu ? '#5865F2' : '#57F287',
                        }}>
                          {btn.menu ? `${btn.menu.length} entries` : 'Direct'}
                        </span>
                        {(btn.image || btn.menu?.some(m => m.image)) && (
                          <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)' }}>
                            Has image
                          </span>
                        )}
                      </div>
                      {/* Content preview */}
                      {(btn.content || btn.menu?.[0]?.content) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl' }}>
                          {(btn.content || btn.menu?.[0]?.content || '').slice(0, 80)}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(i); }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Save / Discard bar */}
              {JSON.stringify(lunaMapConfig) !== JSON.stringify(lunaMapOriginal) && (
                <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="admin-btn admin-btn-ghost" onClick={() => setLunaMapConfig(lunaMapOriginal ? JSON.parse(JSON.stringify(lunaMapOriginal)) : null)}>
                    Discard
                  </button>
                  <button className="admin-btn admin-btn-primary" disabled={lunaMapSaving} onClick={() => lunaMapConfig && saveLunaMap(lunaMapConfig)}>
                    {lunaMapSaving ? 'Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Button Edit Modal ── */}
      <AdminLightbox
        isOpen={editingButton !== null}
        onClose={() => setEditingButton(null)}
        title={editingButton?.index === -1 ? 'Add Button' : 'Edit Button'}
        size="xl"
      >
        {editingButton && (() => {
          const eb = editingButton;
          const btn = eb.button;
          const isSubMenu = !!btn.menu;

          function updateBtn(patch: Partial<LunaMapButton>) {
            setEditingButton({ index: eb.index, button: { ...btn, ...patch } });
          }

          function toggleMode() {
            if (isSubMenu) {
              const hasContent = btn.menu?.some(m => m.label.trim() || m.content.trim() || m.image.trim());
              if (hasContent && !window.confirm('Switching modes will discard current sub-menu content. Continue?')) return;
              const { menu, ...rest } = btn;
              updateBtn({ ...rest, content: '', content_en: '', image: '', menu: undefined });
            } else {
              const hasContent = (btn.content && btn.content.trim()) || (btn.image && btn.image.trim());
              if (hasContent && !window.confirm('Switching modes will discard current content. Continue?')) return;
              const { content, content_en, image, ...rest } = btn;
              updateBtn({ ...rest, content: undefined, content_en: undefined, image: undefined, menu: [{ label: '', label_en: '', content: '', content_en: '', image: '' }] });
            }
          }

          function updateMenuItem(idx: number, patch: Partial<LunaMapMenuItem>) {
            const menu = [...(btn.menu || [])];
            menu[idx] = { ...menu[idx], ...patch };
            updateBtn({ menu });
          }

          function addMenuItem() {
            updateBtn({ menu: [...(btn.menu || []), { label: '', label_en: '', content: '', content_en: '', image: '' }] });
          }

          function removeMenuItem(idx: number) {
            const menu = (btn.menu || []).filter((_, i) => i !== idx);
            updateBtn({ menu: menu.length > 0 ? menu : [{ label: '', label_en: '', content: '', content_en: '', image: '' }] });
          }

          function moveMenuItem(idx: number, dir: -1 | 1) {
            const menu = [...(btn.menu || [])];
            const newIdx = idx + dir;
            if (newIdx < 0 || newIdx >= menu.length) return;
            [menu[idx], menu[newIdx]] = [menu[newIdx], menu[idx]];
            updateBtn({ menu });
          }

          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">{'\u{1F1F8}\u{1F1E6}'} Button Name (Arabic)</label>
                  <input className="admin-form-input" value={btn.name} dir="rtl"
                    onChange={e => updateBtn({ name: e.target.value })}
                    placeholder="e.g. قصة لونا" />
                  <span className="admin-form-description">The text shown on the Discord button</span>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">{'\u{1F1EC}\u{1F1E7}'} Button Name (English)</label>
                  <input className="admin-form-input" value={btn.name_en ?? ''} dir="ltr"
                    onChange={e => updateBtn({ name_en: e.target.value })}
                    placeholder="e.g. Luna Story" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">😀 Discord Emoji ID</label>
                  <input className="admin-form-input" value={btn.emojiId}
                    onChange={e => updateBtn({ emojiId: e.target.value.replace(/\D/g, '') })}
                    placeholder="e.g. 1458703244871340196" />
                  <span className="admin-form-description">Right-click an emoji in Discord and copy its ID</span>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">🎨 Button Color</label>
                  <select className="admin-form-input" value={btn.btnStyle}
                    onChange={e => updateBtn({ btnStyle: parseInt(e.target.value) })}>
                    {Object.entries(BTN_STYLE_LABELS).map(([val, { label }]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ margin: '16px 0 12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label className="admin-form-label" style={{ margin: 0 }}>Mode:</label>
                <button
                  className={`admin-btn admin-btn-sm ${!isSubMenu ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                  onClick={() => { if (isSubMenu) toggleMode(); }}>
                  Direct Content
                </button>
                <button
                  className={`admin-btn admin-btn-sm ${isSubMenu ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                  onClick={() => { if (!isSubMenu) toggleMode(); }}>
                  Sub-menu
                </button>
              </div>

              {!isSubMenu ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <RichTextArea
                    label={`${'\u{1F1F8}\u{1F1E6}'} Content (Arabic)`}
                    value={btn.content ?? ''}
                    onChange={v => updateBtn({ content: v })}
                    rows={8}
                    minHeight="180px"
                    markdown
                  />
                  <RichTextArea
                    label={`${'\u{1F1EC}\u{1F1E7}'} Content (English)`}
                    value={btn.content_en ?? ''}
                    onChange={v => updateBtn({ content_en: v })}
                    rows={8}
                    minHeight="180px"
                    markdown
                  />
                  <ImagePicker
                    label="Button Image"
                    value={btn.image ?? ''}
                    onChange={url => updateBtn({ image: url })}
                    uploadPrefix="luna-map/"
                  />
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{btn.menu?.length ?? 0} entries</span>
                    {(btn.menu?.length ?? 0) < 25 && (
                      <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={addMenuItem}>+ Add Entry</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
                    {(btn.menu || []).map((item, idx) => (
                      <div key={idx} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>#{idx + 1}</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="admin-btn admin-btn-ghost admin-btn-sm" style={{ padding: '2px 6px' }}
                              disabled={idx === 0} onClick={() => moveMenuItem(idx, -1)}>Up</button>
                            <button className="admin-btn admin-btn-ghost admin-btn-sm" style={{ padding: '2px 6px' }}
                              disabled={idx === (btn.menu?.length ?? 1) - 1} onClick={() => moveMenuItem(idx, 1)}>Dn</button>
                            <button className="admin-btn admin-btn-danger admin-btn-sm" style={{ padding: '2px 6px' }}
                              onClick={() => removeMenuItem(idx)}>X</button>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          <div className="admin-form-group" style={{ margin: 0 }}>
                            <label className="admin-form-label" style={{ fontSize: '12px' }}>{'\u{1F1F8}\u{1F1E6}'} Label (Arabic)</label>
                            <input className="admin-form-input" value={item.label} placeholder="Label (Arabic)" dir="rtl"
                              onChange={e => updateMenuItem(idx, { label: e.target.value })}
                              style={{ fontSize: '13px' }} />
                          </div>
                          <div className="admin-form-group" style={{ margin: 0 }}>
                            <label className="admin-form-label" style={{ fontSize: '12px' }}>{'\u{1F1EC}\u{1F1E7}'} Label (English)</label>
                            <input className="admin-form-input" value={item.label_en ?? ''} placeholder="Label (English)" dir="ltr"
                              onChange={e => updateMenuItem(idx, { label_en: e.target.value })}
                              style={{ fontSize: '13px' }} />
                          </div>
                          <RichTextArea
                            label={`${'\u{1F1F8}\u{1F1E6}'} Content (Arabic)`}
                            value={item.content}
                            onChange={v => updateMenuItem(idx, { content: v })}
                            rows={6}
                            minHeight="140px"
                            markdown
                          />
                          <RichTextArea
                            label={`${'\u{1F1EC}\u{1F1E7}'} Content (English)`}
                            value={item.content_en ?? ''}
                            onChange={v => updateMenuItem(idx, { content_en: v })}
                            rows={6}
                            minHeight="140px"
                            markdown
                          />
                          <ImagePicker
                            label="Image"
                            value={item.image}
                            onChange={url => updateMenuItem(idx, { image: url })}
                            uploadPrefix="luna-map/"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="admin-modal-actions" style={{ marginTop: '20px' }}>
                <button className="admin-btn admin-btn-ghost" onClick={() => setEditingButton(null)}>Cancel</button>
                <button className="admin-btn admin-btn-primary" onClick={handleSaveButton} disabled={!btn.name.trim()}>
                  {editingButton.index === -1 ? 'Add' : '💾 Update'}
                </button>
              </div>
            </>
          );
        })()}
      </AdminLightbox>

      {/* ── Confirm Delete ── */}
      {confirmDelete !== null && (
        <ConfirmModal
          title="Delete Button"
          message="Are you sure you want to delete this button? This cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => handleDeleteButton(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
