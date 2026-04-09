'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfigSection from '../components/ConfigSection';
import BotBadge from '../components/BotBadge';
import SaveDeployBar from '../components/SaveDeployBar';
import { useUnsavedWarning } from '../hooks/useUnsavedWarning';
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

interface TicketEntry {
  ticketNumber?: number;
  threadId: string;
  userId: string;
  username: string;
  categoryId: string;
  status: 'open' | 'closed';
  createdAt: number;
  closedAt?: number;
  closedBy?: string;
  closedByName?: string;
}

function formatDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(start: number, end?: number): string {
  if (!start) return '—';
  const ms = (end || Date.now()) - start;
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export default function TicketsPage() {
  const [config, setConfig] = useState<TicketSystemConfig>({ global_staff_roles: [], logs_channel_id: '', categories: {} });
  const [original, setOriginal] = useState<TicketSystemConfig>({ global_staff_roles: [], logs_channel_id: '', categories: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCategoryKey, setNewCategoryKey] = useState('');
  const { toast } = useToast();

  // Ticket history
  const [tickets, setTickets] = useState<TicketEntry[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [totalCounter, setTotalCounter] = useState(0);

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

  const fetchTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (ticketFilter !== 'all') params.set('status', ticketFilter);
      const res = await fetch(`/api/admin/tickets?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTickets(data.tickets || []);
      setTotalCounter(data.counter || 0);
    } catch {
      toast('Failed to load ticket history', 'error');
    } finally {
      setTicketsLoading(false);
    }
  }, [ticketFilter, toast]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const hasChanges = JSON.stringify(config) !== JSON.stringify(original);
  useUnsavedWarning(hasChanges);

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

  const openCount = tickets.filter(t => t.status === 'open').length;
  const closedCount = tickets.filter(t => t.status === 'closed').length;

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

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="admin-stat-mini">
          <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-primary)' }}>{totalCounter}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Tickets</span>
        </div>
        <div className="admin-stat-mini">
          <span style={{ fontSize: 24, fontWeight: 700, color: '#3fb950' }}>{openCount}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Open</span>
        </div>
        <div className="admin-stat-mini">
          <span style={{ fontSize: 24, fontWeight: 700, color: '#f85149' }}>{closedCount}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Closed</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ConfigSection title="Global Settings" description="Staff roles and log channel for all ticket categories">
          <RolePicker label="🛡️ Global Staff Roles" description="Roles that can manage tickets across all categories" value={config.global_staff_roles} onChange={v => setConfig(p => ({ ...p, global_staff_roles: v as string[] }))} multi />
          <ChannelPicker label="📺 Logs Channel" description="Channel where ticket open/close events are logged" value={config.logs_channel_id} onChange={v => setConfig(p => ({ ...p, logs_channel_id: v as string }))} />
          <BotBadge bot="butler" />
        </ConfigSection>

        {categoryKeys.map((key) => {
          const cat = config.categories[key];
          const staffCount = cat.staff_roles?.length ?? 0;
          return (
            <div key={key} className="admin-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                {cat.image && (
                  <img src={cat.image} alt={cat.title || key}
                    style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(0,212,255,0.15)' }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 className="admin-section-title" style={{ margin: 0 }}>{cat.title || key}</h3>
                    <span className="admin-badge cyan">{key}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    {staffCount > 0 ? `${staffCount} staff role${staffCount === 1 ? '' : 's'} assigned` : 'Using global staff roles'}
                  </div>
                </div>
                <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => {
                  const updated = { ...config.categories };
                  delete updated[key];
                  setConfig(p => ({ ...p, categories: updated }));
                }}>Delete</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">✏️ Title</label>
                  <input className="admin-input" value={cat.title ?? ''} onChange={(e) => updateCategory(key, { title: e.target.value })} dir="auto" />
                </div>
                <RichTextArea label="📝 Description" value={cat.description ?? ''} onChange={(v) => updateCategory(key, { description: v })} rows={3} minHeight="100px" />
                <ImagePicker label="🖼️ Image (optional)" value={cat.image ?? ''} onChange={(url) => updateCategory(key, { image: url })} uploadPrefix="butler/tickets/" />
                <RolePicker label="🛡️ Staff Roles (override)" description="Roles specific to this category. Overrides global if set." value={cat.staff_roles ?? []} onChange={v => updateCategory(key, { staff_roles: v as string[] })} multi />
              </div>
            </div>
          );
        })}

        <div style={{ border: '2px dashed rgba(0,212,255,0.15)', borderRadius: 'var(--radius-md)', padding: '20px 24px', display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(0,0,0,0.08)' }}>
          <input className="admin-input" style={{ maxWidth: 220 }} value={newCategoryKey} onChange={(e) => setNewCategoryKey(e.target.value)} placeholder="Category key (e.g. bugs)" />
          <button className="admin-btn admin-btn-ghost" disabled={!newCategoryKey.trim()} onClick={() => {
            const key = newCategoryKey.trim();
            if (!key) return;
            setConfig(p => ({ ...p, categories: { ...p.categories, [key]: { title: key, description: '', staff_roles: [] } } }));
            setNewCategoryKey('');
          }}>+ Add Category</button>
        </div>
      </div>

      {/* Ticket History */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 className="admin-section-title" style={{ margin: 0 }}>📋 Ticket History</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'open', 'closed'] as const).map(f => (
              <button key={f} className={`admin-btn admin-btn-sm ${ticketFilter === f ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                onClick={() => setTicketFilter(f)} style={{ textTransform: 'capitalize' }}>
                {f === 'all' ? 'All' : f === 'open' ? '🟢 Open' : '🔴 Closed'}
              </button>
            ))}
          </div>
        </div>

        {ticketsLoading ? (
          <SkeletonTable rows={5} />
        ) : tickets.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">🎫</div>
            <p>No tickets found</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Opened</th>
                  <th>Duration</th>
                  <th>Closed By</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t, i) => (
                  <tr key={t.threadId || i}>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {t.ticketNumber ? `#${t.ticketNumber}` : '—'}
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{t.username}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{t.userId}</span>
                    </td>
                    <td>
                      <span className={`admin-badge ${t.status === 'open' ? 'green' : 'red'}`} style={{ fontSize: 11 }}>
                        {t.status === 'open' ? '🟢 Open' : '🔴 Closed'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDate(t.createdAt)}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatDuration(t.createdAt, t.closedAt)}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.closedByName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SaveDeployBar hasChanges={hasChanges} saving={saving} onSave={handleSave} onDiscard={handleDiscard} />
    </>
  );
}
