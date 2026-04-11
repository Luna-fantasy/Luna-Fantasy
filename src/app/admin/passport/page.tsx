'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ConfigSection from '../components/ConfigSection';
import BotBadge from '../components/BotBadge';
import SaveDeployBar from '../components/SaveDeployBar';
import { useUnsavedWarning } from '../hooks/useUnsavedWarning';
import ImagePicker from '../components/ImagePicker';
import ChannelPicker from '../components/ChannelPicker';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';

interface AppCategory {
  title: string;
  description: string;
  image?: string;
  questions: any[];
  submitFee?: number;
}

interface ApplicationsConfig {
  reviews_channel_id: string;
  logs_channel_id: string;
  votes_required: number;
  high_staff_roles: string[];
  mid_staff_roles: string[];
  categories: Record<string, AppCategory>;
  passport_reviews_channel_id?: string;
}

const EMPTY_CONFIG: ApplicationsConfig = {
  reviews_channel_id: '',
  logs_channel_id: '',
  votes_required: 3,
  high_staff_roles: [],
  mid_staff_roles: [],
  categories: {},
  passport_reviews_channel_id: '',
};

const PASSPORT_DEFAULT_MERCHANT = 'https://assets.lunarian.app/butler/vendors/VaelorStorm.png';
const PASSPORT_DEFAULT_BACKGROUND = 'https://assets.lunarian.app/butler/backgrounds/Passport.jpeg';

export default function PassportPage() {
  const [config, setConfig] = useState<ApplicationsConfig>(EMPTY_CONFIG);
  const [original, setOriginal] = useState<ApplicationsConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Passport history (filtered from applications collection)
  const [apps, setApps] = useState<any[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appFilter, setAppFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [appCounts, setAppCounts] = useState({ pending: 0, accepted: 0, rejected: 0 });

  const fetchApps = useCallback(async () => {
    setAppsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (appFilter !== 'all') params.set('status', appFilter);
      const res = await fetch(`/api/admin/applications?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Only passport applications
      const passportOnly = (data.applications || []).filter((a: any) => a.categoryId === 'passport');
      setApps(passportOnly);
      // Recount from filtered set
      const counts = passportOnly.reduce(
        (acc: any, a: any) => {
          if (a.status === 'pending') acc.pending++;
          else if (a.status === 'accepted') acc.accepted++;
          else if (a.status === 'rejected') acc.rejected++;
          return acc;
        },
        { pending: 0, accepted: 0, rejected: 0 }
      );
      setAppCounts(counts);
    } catch { toast('Failed to load passport history', 'error'); }
    finally { setAppsLoading(false); }
  }, [appFilter, toast]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config/butler');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const apps = data.sections?.applications_system;
      if (apps) { setConfig(apps); setOriginal(apps); }
    } catch {
      toast('Failed to load passport config', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const hasChanges = JSON.stringify(config) !== JSON.stringify(original);
  useUnsavedWarning(hasChanges);

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
      toast('Passport config saved', 'success');
    } catch (err: any) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => setConfig(original);

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">🛂</span> Passport System</h1>
          <p className="admin-page-subtitle">Luna Passport issuance — review channel, merchant photo, canvas template, and history</p>
        </div>
        <SkeletonCard count={2} />
        <SkeletonTable rows={3} />
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">🛂</span> Passport System</h1>
        <p className="admin-page-subtitle">Luna Passport issuance — review channel, merchant photo, canvas template, and history</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ConfigSection title="🛂 Passport Settings" description="The 3rd red button on /profile — disabled until an admin approves a user's passport request">
          <div style={{
            background: 'rgba(0, 212, 255, 0.06)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 14,
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
          }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>How the passport flow works</div>
            <div>1. Users click the <b>تقديم الآن</b> button on the passport panel → pick a faction from a select menu → fill in name + date of birth in a modal.</div>
            <div>2. A <b>10,000 Lunari</b> fee is charged on submit. The review embed is posted to the channel below (or falls back to the general applications reviews channel).</div>
            <div>3. When an admin clicks <b>قبول فوري</b>, the fee is refunded, a passport number is generated, and the user's profile gets a 3rd red Passport button. On <b>رفض فوري</b> the fee is burned.</div>
          </div>

          <ChannelPicker
            label="📺 Passport Reviews Channel"
            description="Dedicated channel where passport applications are posted for admin accept/reject. Leave empty to use the general applications reviews channel."
            value={config.passport_reviews_channel_id ?? ''}
            onChange={v => setConfig(p => ({ ...p, passport_reviews_channel_id: v as string }))}
          />

          <ImagePicker
            label="🧑‍💼 Merchant Photo (Vaelor Storm)"
            description="Portrait of the issuing authority shown on the passport panel thumbnail. Default: Vaelor Storm from Lunvor."
            value={config.categories?.passport?.image ?? ''}
            defaultUrl={PASSPORT_DEFAULT_MERCHANT}
            onChange={(url) => {
              const cur = config.categories?.passport ?? {
                title: 'جواز سفر لونا',
                description: 'تقدم بطلب للحصول على جواز سفر لونا الرسمي من السيد فيلور ستورم.',
                questions: [],
              };
              setConfig(p => ({
                ...p,
                categories: { ...p.categories, passport: { ...cur, image: url } },
              }));
            }}
            uploadPrefix="butler/vendors/"
          />

          <div className="admin-form-group">
            <label className="admin-form-label">🎨 Canvas Template</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
              <img
                src={PASSPORT_DEFAULT_BACKGROUND}
                alt="Passport template"
                style={{ height: 90, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}
              />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                The passport card background is managed via the{' '}
                <a href="/admin/canvas-editor" style={{ color: 'var(--accent-primary)' }}>Canvas Editor</a>.
                Drag the 5 field positions there to match the template's pre-printed labels.
              </div>
            </div>
          </div>

          <div style={{
            padding: '10px 12px',
            background: 'rgba(184, 134, 11, 0.08)',
            borderLeft: '3px solid #b8860b',
            borderRadius: 4,
            marginTop: 8,
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}>
            <div style={{ fontWeight: 600, color: '#d4a017', marginBottom: 2 }}>Passport Benefits (hardcoded in bot)</div>
            <div>• +2,500 Lunari bonus on the monthly bank salary</div>
            <div>• 10% discount on Mells Selvair shop purchases</div>
            <div>• Access to the 150,000 Lunari passport-only loan tier (bypasses level requirement)</div>
          </div>

          <BotBadge bot="butler" />
        </ConfigSection>
      </div>

      {/* Passport Application History */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 className="admin-section-title" style={{ margin: 0 }}>📋 Passport Application History</h2>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>⏳ {appCounts.pending} pending</span>
              <span style={{ fontSize: 13, color: '#3fb950' }}>✅ {appCounts.accepted} accepted</span>
              <span style={{ fontSize: 13, color: '#f85149' }}>❌ {appCounts.rejected} rejected</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'pending', 'accepted', 'rejected'] as const).map(f => (
              <button key={f} className={`admin-btn admin-btn-sm ${appFilter === f ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                onClick={() => setAppFilter(f)} style={{ textTransform: 'capitalize' }}>
                {f === 'all' ? 'All' : f === 'pending' ? '⏳ Pending' : f === 'accepted' ? '✅ Accepted' : '❌ Rejected'}
              </button>
            ))}
          </div>
        </div>

        {appsLoading ? (
          <SkeletonTable rows={5} />
        ) : apps.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">🛂</div>
            <p>No passport applications yet</p>
            <p className="admin-empty-hint">Users must click the passport apply button in Discord to submit one</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Votes</th>
                  <th>Applied</th>
                  <th>Decision By</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => {
                  const isSelected = selectedApp?.id === a.id;
                  const statusBadge = a.status === 'pending'
                    ? { cls: 'yellow', label: '⏳ Pending' }
                    : a.status === 'accepted'
                    ? { cls: 'green', label: '✅ Accepted' }
                    : { cls: 'red', label: '❌ Rejected' };
                  return (
                    <React.Fragment key={a.id}>
                      <tr onClick={() => setSelectedApp(isSelected ? null : a)} style={{ cursor: 'pointer', background: isSelected ? 'rgba(0,212,255,0.06)' : undefined }}>
                        <td><span style={{ fontWeight: 500 }}>{a.username}</span></td>
                        <td><span className={`admin-badge ${statusBadge.cls}`} style={{ fontSize: 11 }}>{statusBadge.label}</span></td>
                        <td style={{ fontSize: 13 }}>
                          <span style={{ color: '#3fb950' }}>👍 {a.votes.likes}</span>
                          {' / '}
                          <span style={{ color: '#f85149' }}>👎 {a.votes.dislikes}</span>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          {a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          {a.acceptedBy || a.rejectedBy || '—'}
                        </td>
                      </tr>
                      {isSelected && (
                        <tr>
                          <td colSpan={5} style={{ padding: 0 }}>
                            <div style={{
                              background: 'rgba(0,0,0,0.3)',
                              borderTop: '1px solid rgba(0,212,255,0.15)',
                              borderBottom: '1px solid rgba(0,212,255,0.15)',
                              padding: '16px 20px',
                            }}>
                              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                                User ID: <code>{a.userId}</code> &bull; Applied: {a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}
                                {a.rejectionReason && (
                                  <div style={{ marginTop: 8, color: '#f85149' }}>
                                    <strong>Rejection Reason:</strong> {a.rejectionReason}
                                  </div>
                                )}
                              </div>
                              {Object.entries(a.answers || {}).map(([q, ans], i) => (
                                <div key={i} style={{ marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 10 }}>
                                  <div style={{ fontWeight: 600, fontSize: 13, color: '#fff', marginBottom: 4 }}>{q}</div>
                                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{String(ans)}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SaveDeployBar hasChanges={hasChanges} saving={saving} onSave={handleSave} onDiscard={handleDiscard} />
    </>
  );
}
