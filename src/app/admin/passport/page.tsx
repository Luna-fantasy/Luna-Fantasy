'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ConfigSection from '../components/ConfigSection';
import BotBadge from '../components/BotBadge';
import SaveDeployBar from '../components/SaveDeployBar';
import { useUnsavedWarning } from '../hooks/useUnsavedWarning';
import ImagePicker from '../components/ImagePicker';
import ChannelPicker from '../components/ChannelPicker';
import RolePicker from '../components/RolePicker';
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
  // Optional passport-specific staff role overrides. Leave empty to fall back
  // to the shared high/mid staff roles from the Applications page.
  passport_high_staff_roles?: string[];
  passport_mid_staff_roles?: string[];
  // VIP passport role gate — users with any of these roles see the VIP cosmetic
  // variant. Empty = feature disabled. Changes propagate to both bot + website.
  passport_vip_roles?: string[];
  // Staff passport cosmetic roles — auto-assigns staff ID + template
  passport_staff_roles?: {
    mastermind: string[];
    sentinel: string[];
    guardian: string[];
  };
}

interface Passport {
  number: string;
  faction: string;
  fullName: string;
  dateOfBirth: string;
  issuedAt: number;
  issuedBy: string;
}

interface PassportRow {
  discordId: string;
  username: string | null;
  globalName: string | null;
  avatar: string | null;
  passport: Passport;
}

const FACTION_OPTIONS = [
  'Beasts', 'Colossals', 'Dragons', 'Knights', 'Lunarians', 'Moon Creatures',
  'Mythical Creatures', 'Strange Beings', 'Supernatural', 'Underworld', 'Warriors',
];

function emptyPassport(): Passport {
  return {
    number: '',
    faction: 'Lunarians',
    fullName: '',
    dateOfBirth: '',
    issuedAt: Date.now(),
    issuedBy: '',
  };
}

const EMPTY_CONFIG: ApplicationsConfig = {
  reviews_channel_id: '',
  logs_channel_id: '',
  votes_required: 3,
  high_staff_roles: [],
  mid_staff_roles: [],
  categories: {},
  passport_reviews_channel_id: '',
  passport_high_staff_roles: [],
  passport_mid_staff_roles: [],
  passport_vip_roles: [],
  passport_staff_roles: { mastermind: [], sentinel: [], guardian: [] },
};

const PASSPORT_DEFAULT_MERCHANT = 'https://assets.lunarian.app/butler/vendors/VaelorStorm.png';
const PASSPORT_DEFAULT_BACKGROUND = 'https://assets.lunarian.app/butler/backgrounds/Passport.jpeg';
const PASSPORT_VIP_BACKGROUND = 'https://assets.lunarian.app/butler/backgrounds/PassportVIPFinal.png';

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

  // Issued passports (admin edit surface)
  const [passports, setPassports] = useState<PassportRow[]>([]);
  const [passportsLoading, setPassportsLoading] = useState(true);
  const [editingPassportId, setEditingPassportId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Passport>(emptyPassport());
  const [savingPassport, setSavingPassport] = useState(false);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

  // Manual issue flow
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueSearch, setIssueSearch] = useState('');
  const [issueSearchResults, setIssueSearchResults] = useState<any[]>([]);
  const [issueSelectedUser, setIssueSelectedUser] = useState<any>(null);

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

  const fetchPassports = useCallback(async () => {
    setPassportsLoading(true);
    try {
      const res = await fetch('/api/admin/passports/list');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPassports(data.passports || []);
    } catch { toast('Failed to load issued passports', 'error'); }
    finally { setPassportsLoading(false); }
  }, [toast]);

  useEffect(() => { fetchPassports(); }, [fetchPassports]);

  const startEditPassport = (row: PassportRow) => {
    setEditingPassportId(row.discordId);
    setEditForm({ ...row.passport });
  };

  const cancelEditPassport = () => {
    setEditingPassportId(null);
    setEditForm(emptyPassport());
  };

  const savePassport = async (discordId: string) => {
    // Client-side validation — mirrors the server-side checks
    if (!/^LUNA-110317\d{5}$/.test(editForm.number)) {
      toast('Passport number must match LUNA-110317##### format', 'error');
      return;
    }
    if (!editForm.fullName.trim()) {
      toast('Full name is required', 'error');
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(editForm.dateOfBirth)) {
      toast('Date of birth must be DD/MM', 'error');
      return;
    }
    if (!FACTION_OPTIONS.includes(editForm.faction)) {
      toast('Invalid faction', 'error');
      return;
    }

    setSavingPassport(true);
    try {
      const res = await fetch(`/api/admin/users/${discordId}/passport`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      toast('Passport saved', 'success');
      cancelEditPassport();
      await fetchPassports();
    } catch (err: any) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setSavingPassport(false);
    }
  };

  const revokePassport = async (discordId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${discordId}/passport`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': getCsrfToken() },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      toast('Passport revoked', 'success');
      setRevokeConfirmId(null);
      await fetchPassports();
    } catch (err: any) {
      toast(err.message || 'Revoke failed', 'error');
    }
  };

  // Manual issue flow — search users, then open the edit form with their info pre-filled
  const searchIssueUsers = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setIssueSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setIssueSearchResults(data.results || []);
    } catch { /* silent — user will see empty results */ }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { searchIssueUsers(issueSearch); }, 250);
    return () => clearTimeout(t);
  }, [issueSearch, searchIssueUsers]);

  const openManualIssue = () => {
    setShowIssueModal(true);
    setIssueSearch('');
    setIssueSearchResults([]);
    setIssueSelectedUser(null);
  };

  const selectIssueUser = (user: any) => {
    setIssueSelectedUser(user);
    // Pre-fill edit form: keep number blank so the user notices it needs to be set (a fresh mint ID)
    setEditForm({
      number: '',
      faction: 'Lunarians',
      fullName: user.globalName || user.username || '',
      dateOfBirth: '',
      issuedAt: Date.now(),
      issuedBy: '',
    });
  };

  const submitManualIssue = async () => {
    if (!issueSelectedUser) return;
    const discordId = issueSelectedUser.discordId;
    await savePassport(discordId);
    // savePassport() already refreshes the list on success
    if (!savingPassport) {
      setShowIssueModal(false);
      setIssueSelectedUser(null);
    }
  };

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
            <div>2. A non-refundable <b>10,000 Lunari</b> fee is charged on submit. The review embed is posted to the channel below (or falls back to the general applications reviews channel).</div>
            <div>3. When an admin clicks <b>قبول فوري</b>, a passport number is generated and the user's profile gets a 3rd red Passport button. The 10,000 fee is burned either way — accept or reject.</div>
          </div>

          <ChannelPicker
            label="📺 Passport Reviews Channel"
            description="Dedicated channel where passport applications are posted for admin accept/reject. Leave empty to use the general applications reviews channel."
            value={config.passport_reviews_channel_id ?? ''}
            onChange={v => setConfig(p => ({ ...p, passport_reviews_channel_id: v as string }))}
          />

          <RolePicker
            label="🗳️ Passport Vote Roles"
            description="Roles allowed to vote 👍/👎 on passport applications. Leave empty to reuse the general mid staff roles from the Applications page."
            value={config.passport_mid_staff_roles ?? []}
            onChange={(v) => setConfig(p => ({ ...p, passport_mid_staff_roles: v as string[] }))}
            multi
          />

          <RolePicker
            label="🛡️ Passport Accept/Reject Roles"
            description="Roles allowed to instantly accept/reject a passport application. Leave empty to reuse the general high staff roles from the Applications page."
            value={config.passport_high_staff_roles ?? []}
            onChange={(v) => setConfig(p => ({ ...p, passport_high_staff_roles: v as string[] }))}
            multi
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
            <div>• +2,500 Lunari bonus on the daily bank reward</div>
            <div>• 10% discount on ALL Luna shops (Butler + Jester)</div>
            <div>• Access to the 150,000 Lunari passport-only loan tier (bypasses level requirement)</div>
          </div>

          {/* ─── VIP Passport (cosmetic variant) ──────────────────────── */}
          <div style={{
            marginTop: 24,
            paddingTop: 18,
            borderTop: '1px dashed rgba(255, 215, 0, 0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#FFD54F' }}>👑 VIP Passport</div>
              <span className="admin-badge" style={{ background: 'rgba(255, 213, 79, 0.15)', color: '#FFD54F', fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255, 213, 79, 0.3)' }}>Cosmetic only</span>
            </div>

            <div style={{
              background: 'rgba(255, 213, 79, 0.04)',
              border: '1px solid rgba(255, 213, 79, 0.15)',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 14,
              fontSize: 13,
              lineHeight: 1.55,
              color: 'var(--text-secondary)',
            }}>
              Users holding any of the roles below see the <b>VIP cosmetic variant</b> of the passport instead of the normal one when they view their <code>/profile</code> in Discord or the public profile on the website. The check is live — losing the role reverts to the normal passport on the next render. <b>No extra benefits</b> — same daily bonus, same shop discount, same loan tier.
            </div>

            <RolePicker
              label="👑 VIP Passport Roles"
              description="Leave empty to disable the VIP feature entirely. Pick any roles whose holders should see the VIP cosmetic variant."
              value={config.passport_vip_roles ?? []}
              onChange={(v) => setConfig(p => ({ ...p, passport_vip_roles: v as string[] }))}
              multi
            />

            <div className="admin-form-group" style={{ marginTop: 14 }}>
              <label className="admin-form-label">🎨 VIP Canvas Template</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
                <img
                  src={PASSPORT_VIP_BACKGROUND}
                  alt="VIP Passport template"
                  style={{ height: 90, borderRadius: 6, border: '1px solid rgba(255, 213, 79, 0.25)' }}
                />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  The VIP card background has its own field positions separate from the normal passport. Tune them via the{' '}
                  <a href="/admin/canvas-editor" style={{ color: 'var(--accent-primary)' }}>Canvas Editor</a>
                  {' '}→ pick <b>Luna Passport VIP (Discord bot)</b> or <b>Luna Passport VIP (Website profile)</b>.
                </div>
              </div>
            </div>
          </div>

          <BotBadge bot="butler" />
        </ConfigSection>

        {/* Staff Passport Cosmetics */}
        <ConfigSection title="Staff Passport Cosmetics" defaultOpen={false}>
          <div style={{
            background: 'rgba(88, 166, 255, 0.04)',
            border: '1px solid rgba(88, 166, 255, 0.15)',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 14,
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
          }}>
            Staff passport cosmetics are auto-assigned when a user&apos;s roles change. Users must already have a passport.
            Priority: <b>Mastermind</b> &gt; <b>Sentinel</b> &gt; <b>Guardian</b>. The passport ID changes automatically
            (e.g. GUARDIAN-01, SENTINEL-01, MASTERMIND) and reverts to the original Luna ID when the role is removed.
          </div>

          <RolePicker
            label="🟣 Mastermind Roles"
            description="Users with these roles get the Mastermind passport cosmetic. ID format: MASTERMIND (no number)."
            value={config.passport_staff_roles?.mastermind ?? []}
            onChange={(v) => setConfig(p => ({
              ...p,
              passport_staff_roles: { ...p.passport_staff_roles ?? { mastermind: [], sentinel: [], guardian: [] }, mastermind: v as string[] },
            }))}
            multi
          />

          <RolePicker
            label="🟡 Sentinel Roles"
            description="Users with these roles get the Sentinel passport cosmetic. ID format: SENTINEL-01, SENTINEL-02, etc."
            value={config.passport_staff_roles?.sentinel ?? []}
            onChange={(v) => setConfig(p => ({
              ...p,
              passport_staff_roles: { ...p.passport_staff_roles ?? { mastermind: [], sentinel: [], guardian: [] }, sentinel: v as string[] },
            }))}
            multi
          />

          <RolePicker
            label="🔵 Guardian Roles"
            description="Users with these roles get the Guardian passport cosmetic. ID format: GUARDIAN-01, GUARDIAN-02, etc."
            value={config.passport_staff_roles?.guardian ?? []}
            onChange={(v) => setConfig(p => ({
              ...p,
              passport_staff_roles: { ...p.passport_staff_roles ?? { mastermind: [], sentinel: [], guardian: [] }, guardian: v as string[] },
            }))}
            multi
          />

          <div className="admin-form-group" style={{ marginTop: 14 }}>
            <label className="admin-form-label">🎨 Staff Passport Templates</label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '8px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <img src="https://assets.lunarian.app/butler/backgrounds/PassportGuardian.png" alt="Guardian" style={{ height: 80, borderRadius: 6, border: '1px solid rgba(88, 166, 255, 0.25)' }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Guardian</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <img src="https://assets.lunarian.app/butler/backgrounds/PassportSentinel.png" alt="Sentinel" style={{ height: 80, borderRadius: 6, border: '1px solid rgba(255, 213, 79, 0.25)' }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Sentinel</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <img src="https://assets.lunarian.app/butler/backgrounds/PassportMastermind.png" alt="Mastermind" style={{ height: 80, borderRadius: 6, border: '1px solid rgba(188, 140, 255, 0.25)' }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Mastermind</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Each staff passport template has its own canvas layout. Tune positions via the{' '}
              <a href="/admin/canvas-editor" style={{ color: 'var(--accent-primary)' }}>Canvas Editor</a>.
            </div>
          </div>

          <BotBadge bot="butler" />
        </ConfigSection>
      </div>

      {/* Issued Passports — admin edit surface */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 className="admin-section-title" style={{ margin: 0 }}>🛂 Issued Passports</h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
              Edit any issued passport's fields, revoke a passport, or manually issue one without the application flow.
            </div>
          </div>
          <button
            className="admin-btn admin-btn-primary admin-btn-sm"
            onClick={openManualIssue}
          >
            + Manually Issue Passport
          </button>
        </div>

        {passportsLoading ? (
          <SkeletonTable rows={3} />
        ) : passports.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">🛂</div>
            <p>No passports issued yet</p>
            <p className="admin-empty-hint">Accepted passport applications will appear here. You can also manually issue one with the button above.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Number</th>
                  <th>Name</th>
                  <th>Faction</th>
                  <th>DOB</th>
                  <th>Issued</th>
                  <th style={{ width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {passports.map((row) => {
                  const isEditing = editingPassportId === row.discordId;
                  const displayName = row.globalName || row.username || row.discordId;
                  return (
                    <React.Fragment key={row.discordId}>
                      <tr style={{ background: isEditing ? 'rgba(0,212,255,0.06)' : undefined }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {row.avatar && (
                              <img src={row.avatar} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
                            )}
                            <div>
                              <div style={{ fontWeight: 500 }}>{displayName}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}><code>{row.discordId}</code></div>
                            </div>
                          </div>
                        </td>
                        <td><code style={{ fontSize: 12 }}>{row.passport.number}</code></td>
                        <td>{row.passport.fullName}</td>
                        <td><span className="admin-badge cyan" style={{ fontSize: 11 }}>{row.passport.faction}</span></td>
                        <td style={{ fontSize: 13 }}>{row.passport.dateOfBirth}</td>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          {row.passport.issuedAt ? new Date(row.passport.issuedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td>
                          {isEditing ? (
                            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={cancelEditPassport}>Cancel</button>
                          ) : (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => startEditPassport(row)}>Edit</button>
                              <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setRevokeConfirmId(row.discordId)}>Revoke</button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isEditing && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <div style={{
                              background: 'rgba(0,0,0,0.3)',
                              borderTop: '1px solid rgba(0,212,255,0.15)',
                              borderBottom: '1px solid rgba(0,212,255,0.15)',
                              padding: '16px 20px',
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                              gap: 12,
                              alignItems: 'end',
                            }}>
                              <div className="admin-form-group" style={{ margin: 0 }}>
                                <label className="admin-form-label">Passport Number</label>
                                <input
                                  className="admin-input"
                                  value={editForm.number}
                                  onChange={e => setEditForm(f => ({ ...f, number: e.target.value }))}
                                  placeholder="LUNA-11031700001"
                                />
                              </div>
                              <div className="admin-form-group" style={{ margin: 0 }}>
                                <label className="admin-form-label">Full Name</label>
                                <input
                                  className="admin-input"
                                  value={editForm.fullName}
                                  onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))}
                                  dir="auto"
                                />
                              </div>
                              <div className="admin-form-group" style={{ margin: 0 }}>
                                <label className="admin-form-label">Date of Birth (DD/MM)</label>
                                <input
                                  className="admin-input"
                                  value={editForm.dateOfBirth}
                                  onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                                  placeholder="15/03"
                                  maxLength={5}
                                />
                              </div>
                              <div className="admin-form-group" style={{ margin: 0 }}>
                                <label className="admin-form-label">Faction</label>
                                <select
                                  className="admin-input"
                                  value={editForm.faction}
                                  onChange={e => setEditForm(f => ({ ...f, faction: e.target.value }))}
                                >
                                  {FACTION_OPTIONS.map(f => (
                                    <option key={f} value={f}>{f}</option>
                                  ))}
                                </select>
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'end', gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
                                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={cancelEditPassport} disabled={savingPassport}>Cancel</button>
                                <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => savePassport(row.discordId)} disabled={savingPassport}>
                                  {savingPassport ? 'Saving…' : 'Save changes'}
                                </button>
                              </div>
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

      {/* Revoke confirmation */}
      {revokeConfirmId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setRevokeConfirmId(null)}
        >
          <div
            style={{ background: '#111822', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 12, padding: 24, maxWidth: 440, boxShadow: '0 0 40px rgba(0,212,255,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', color: '#f85149' }}>🛂 Revoke Passport?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              This will delete the passport from <code>{revokeConfirmId}</code>'s profile. The 10,000 Lunari fee is NOT refunded. The user's <b>/profile</b> Passport button will be disabled again.
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
              This cannot be undone — but you can manually re-issue them a new passport afterwards if it was a mistake.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setRevokeConfirmId(null)}>Cancel</button>
              <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => revokePassport(revokeConfirmId)}>Revoke</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual issue modal */}
      {showIssueModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}
          onClick={() => !savingPassport && setShowIssueModal(false)}
        >
          <div
            style={{ background: '#111822', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 12, padding: 24, maxWidth: 640, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 0 40px rgba(0,212,255,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>🛂 Manually Issue Passport</h3>

            {!issueSelectedUser ? (
              <>
                <div className="admin-form-group">
                  <label className="admin-form-label">Search user</label>
                  <input
                    className="admin-input"
                    value={issueSearch}
                    onChange={e => setIssueSearch(e.target.value)}
                    placeholder="Type a username, display name, or Discord ID"
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                  {issueSearchResults.length === 0 && issueSearch.length >= 2 && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>No users matched.</div>
                  )}
                  {issueSearchResults.map((u: any) => (
                    <button
                      key={u.discordId}
                      className="admin-btn admin-btn-ghost"
                      style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '10px 12px' }}
                      onClick={() => selectIssueUser(u)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {u.image && <img src={u.image} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />}
                        <div>
                          <div style={{ fontWeight: 500 }}>{u.globalName || u.username || u.discordId}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}><code>{u.discordId}</code></div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: '10px 12px', background: 'rgba(0,212,255,0.06)', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {issueSelectedUser.image && <img src={issueSelectedUser.image} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />}
                  <div>
                    <div style={{ fontWeight: 500 }}>{issueSelectedUser.globalName || issueSelectedUser.username}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}><code>{issueSelectedUser.discordId}</code></div>
                  </div>
                  <button className="admin-btn admin-btn-ghost admin-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setIssueSelectedUser(null)}>Change</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <div className="admin-form-group" style={{ margin: 0 }}>
                    <label className="admin-form-label">Passport Number</label>
                    <input
                      className="admin-input"
                      value={editForm.number}
                      onChange={e => setEditForm(f => ({ ...f, number: e.target.value }))}
                      placeholder="LUNA-11031700003"
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Manually enter the next available number. The bot's counter continues from the highest issued.</div>
                  </div>
                  <div className="admin-form-group" style={{ margin: 0 }}>
                    <label className="admin-form-label">Full Name</label>
                    <input
                      className="admin-input"
                      value={editForm.fullName}
                      onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))}
                      dir="auto"
                    />
                  </div>
                  <div className="admin-form-group" style={{ margin: 0 }}>
                    <label className="admin-form-label">Date of Birth (DD/MM)</label>
                    <input
                      className="admin-input"
                      value={editForm.dateOfBirth}
                      onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                      placeholder="15/03"
                      maxLength={5}
                    />
                  </div>
                  <div className="admin-form-group" style={{ margin: 0 }}>
                    <label className="admin-form-label">Faction</label>
                    <select
                      className="admin-input"
                      value={editForm.faction}
                      onChange={e => setEditForm(f => ({ ...f, faction: e.target.value }))}
                    >
                      {FACTION_OPTIONS.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setShowIssueModal(false)} disabled={savingPassport}>Cancel</button>
                  <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={submitManualIssue} disabled={savingPassport}>
                    {savingPassport ? 'Issuing…' : 'Issue passport'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
