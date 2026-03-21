'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';
import { timeAgo } from '../utils/timeAgo';
import ImageCropper from '../components/ImageCropper';

interface BotProfile {
  _id: string;
  name: string;
  status_text: string;
  status_type: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string;
  discord_avatar_url: string | null;
  discord_banner_url: string | null;
  discord_id: string | null;
  last_applied_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

interface BotCardState {
  profile: BotProfile;
  original: BotProfile;
  saving: boolean;
  deploying: boolean;
  avatarFile: File | null;
  bannerFile: File | null;
  avatarPreview: string | null;
  bannerPreview: string | null;
  uploadingAvatar: boolean;
  uploadingBanner: boolean;
}

interface CropState {
  botId: string;
  type: 'avatar' | 'banner';
  file: File;
}

const BOT_COLORS: Record<string, string> = {
  butler: 'rgba(0, 212, 255, 0.25)',
  jester: 'rgba(139, 92, 246, 0.25)',
  oracle: 'rgba(255, 210, 127, 0.25)',
  sage: 'rgba(74, 222, 128, 0.25)',
};

const BOT_ACCENT: Record<string, string> = {
  butler: '#00d4ff',
  jester: '#8b5cf6',
  oracle: '#ffd27f',
  sage: '#4ade80',
};

const STATUS_DOT_COLORS: Record<string, string> = {
  online: '#3ba55c',
  idle: '#faa61a',
  dnd: '#ed4245',
};

export default function BotManagementPage() {
  const [bots, setBots] = useState<Record<string, BotCardState>>({});
  const [loading, setLoading] = useState(true);
  const [cropState, setCropState] = useState<CropState | null>(null);
  const { toast } = useToast();
  const avatarRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const bannerRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/bots');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      const state: Record<string, BotCardState> = {};
      for (const profile of data.profiles) {
        state[profile._id] = {
          profile: { ...profile },
          original: { ...profile },
          saving: false,
          deploying: false,
          avatarFile: null,
          bannerFile: null,
          avatarPreview: null,
          bannerPreview: null,
          uploadingAvatar: false,
          uploadingBanner: false,
        };
      }
      setBots(state);
    } catch {
      toast('Failed to load bot profiles', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  function updateField(botId: string, field: keyof BotProfile, value: string) {
    setBots((prev) => ({
      ...prev,
      [botId]: {
        ...prev[botId],
        profile: { ...prev[botId].profile, [field]: value },
      },
    }));
  }

  function handleFileSelect(botId: string, type: 'avatar' | 'banner', file: File | null) {
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast('Invalid file type. Use PNG, JPEG, WebP, or GIF.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('File too large. Maximum size is 5MB.', 'error');
      return;
    }

    // Open the crop modal instead of immediately setting the file
    setCropState({ botId, type, file });
  }

  function handleCropComplete(croppedFile: File) {
    if (!cropState) return;
    const { botId, type } = cropState;

    // Revoke old preview URL to prevent memory leak
    const oldPreview = bots[botId]?.[`${type}Preview` as 'avatarPreview' | 'bannerPreview'];
    if (oldPreview) URL.revokeObjectURL(oldPreview);

    const previewUrl = URL.createObjectURL(croppedFile);
    setBots((prev) => ({
      ...prev,
      [botId]: {
        ...prev[botId],
        [`${type}File`]: croppedFile,
        [`${type}Preview`]: previewUrl,
      },
    }));
    setCropState(null);

    // Clear the file input so re-selecting the same file triggers onChange
    const ref = type === 'avatar' ? avatarRefs.current[botId] : bannerRefs.current[botId];
    if (ref) ref.value = '';
  }

  function clearFile(botId: string, type: 'avatar' | 'banner') {
    const state = bots[botId];
    if (!state) return;
    const previewKey = `${type}Preview` as 'avatarPreview' | 'bannerPreview';
    if (state[previewKey]) {
      URL.revokeObjectURL(state[previewKey]!);
    }
    setBots((prev) => ({
      ...prev,
      [botId]: {
        ...prev[botId],
        [`${type}File`]: null,
        [`${type}Preview`]: null,
      },
    }));
    const ref = type === 'avatar' ? avatarRefs.current[botId] : bannerRefs.current[botId];
    if (ref) ref.value = '';
  }

  async function uploadFile(botId: string, type: 'avatar' | 'banner', file: File, previousUrl?: string): Promise<string | null> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('botId', botId);
    formData.append('type', type);
    if (previousUrl) formData.append('previousUrl', previousUrl);

    try {
      const res = await fetch('/api/admin/bots/upload', {
        method: 'POST',
        headers: { 'x-csrf-token': getCsrfToken() },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }
      const data = await res.json();
      return data.url;
    } catch (err: any) {
      toast(`Failed to upload ${type}: ${err.message}`, 'error');
      return null;
    }
  }

  async function saveBot(botId: string, deploy: boolean) {
    const state = bots[botId];
    if (!state) return;

    const stateKey = deploy ? 'deploying' : 'saving';
    setBots((prev) => ({ ...prev, [botId]: { ...prev[botId], [stateKey]: true } }));

    try {
      let avatarUrl = state.profile.avatar_url;
      let bannerUrl = state.profile.banner_url;

      if (state.avatarFile) {
        setBots((prev) => ({ ...prev, [botId]: { ...prev[botId], uploadingAvatar: true } }));
        const url = await uploadFile(botId, 'avatar', state.avatarFile, avatarUrl ?? undefined);
        if (url) avatarUrl = url;
        setBots((prev) => ({ ...prev, [botId]: { ...prev[botId], uploadingAvatar: false } }));
      }

      if (state.bannerFile) {
        setBots((prev) => ({ ...prev, [botId]: { ...prev[botId], uploadingBanner: true } }));
        const url = await uploadFile(botId, 'banner', state.bannerFile, bannerUrl ?? undefined);
        if (url) bannerUrl = url;
        setBots((prev) => ({ ...prev, [botId]: { ...prev[botId], uploadingBanner: false } }));
      }

      const res = await fetch('/api/admin/bots', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({
          botId,
          status_text: state.profile.status_text,
          status_type: state.profile.status_type,
          avatar_url: avatarUrl,
          banner_url: bannerUrl,
          bio: state.profile.bio,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      if (deploy) {
        try {
          const deployRes = await fetch('/api/admin/deploy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': getCsrfToken(),
            },
            body: JSON.stringify({ project: botId }),
          });
          if (deployRes.ok) {
            toast(`${state.profile.name} saved and deploy triggered!`, 'success');
          } else {
            toast(`${state.profile.name} saved, but deploy failed. Check Deploy page.`, 'error');
          }
        } catch {
          toast(`${state.profile.name} saved, but deploy request failed.`, 'error');
        }
      } else {
        toast(`${state.profile.name} profile saved!`, 'success');
      }

      const updatedProfile = {
        ...state.profile,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        updated_at: new Date().toISOString(),
      };

      setBots((prev) => ({
        ...prev,
        [botId]: {
          ...prev[botId],
          profile: updatedProfile,
          original: { ...updatedProfile },
          avatarFile: null,
          bannerFile: null,
          avatarPreview: null,
          bannerPreview: null,
        },
      }));
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBots((prev) => ({
        ...prev,
        [botId]: { ...prev[botId], saving: false, deploying: false, uploadingAvatar: false, uploadingBanner: false },
      }));
    }
  }

  function hasChanges(botId: string): boolean {
    const state = bots[botId];
    if (!state) return false;
    return (
      state.profile.status_text !== state.original.status_text ||
      state.profile.status_type !== state.original.status_type ||
      state.profile.bio !== state.original.bio ||
      state.avatarFile !== null ||
      state.bannerFile !== null
    );
  }

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">🤖</span> Bot Management</h1>
          <p className="admin-page-subtitle">Manage status, avatar, and appearance for all Luna bots</p>
        </div>
        <div className="admin-loading"><div className="admin-spinner" />Loading bot profiles...</div>
      </>
    );
  }

  const botIds = ['butler', 'jester', 'oracle', 'sage'];

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Bot Management</h1>
        <p className="admin-page-subtitle">Manage status, avatar, and appearance for all Luna bots</p>
      </div>

      <div className="bot-grid">
        {botIds.map((botId) => {
          const state = bots[botId];
          if (!state) return null;
          const { profile } = state;
          const accent = BOT_ACCENT[botId];
          const borderColor = BOT_COLORS[botId];
          const avatarSrc = state.avatarPreview || profile.avatar_url;
          const bannerSrc = state.bannerPreview || profile.banner_url;
          const isBusy = state.saving || state.deploying;
          const changed = hasChanges(botId);

          return (
            <div
              key={botId}
              className="admin-stat-card bot-profile-card"
              style={{
                borderColor,
                padding: 0,
              }}
            >
              {/* Accent top bar */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
                zIndex: 2,
              }} />

              {/* Banner */}
              <div className="bot-profile-banner-wrap">
                {bannerSrc ? (
                  <img
                    src={bannerSrc}
                    alt={`${profile.name} banner`}
                    className="bot-profile-banner"
                    style={{ background: `linear-gradient(135deg, ${borderColor}, transparent)` }}
                  />
                ) : (
                  <div
                    className="bot-profile-banner-empty"
                    style={{ background: `linear-gradient(135deg, ${borderColor}, rgba(0,0,0,0.3))` }}
                  />
                )}
              </div>

              {/* Avatar + Name area */}
              <div className="bot-profile-header">
                <div className="bot-profile-avatar" style={{ borderColor: accent, '--glow-color': `${accent}4d` } as React.CSSProperties}>
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={`${profile.name} avatar`} />
                  ) : (
                    <span style={{
                      fontSize: '28px',
                      color: accent,
                      fontFamily: 'Cinzel, serif',
                      fontWeight: 700,
                    }}>
                      {profile.name.split(' ')[1]?.[0] || profile.name[0]}
                    </span>
                  )}
                </div>

                <div className="bot-profile-info">
                  <h2 className="bot-profile-name" style={{ color: accent }}>
                    {profile.name}
                    <span
                      className="bot-profile-name-dot"
                      style={{
                        background: STATUS_DOT_COLORS[profile.status_type] || STATUS_DOT_COLORS.online,
                        boxShadow: `0 0 8px ${STATUS_DOT_COLORS[profile.status_type] || STATUS_DOT_COLORS.online}80`,
                      }}
                    />
                  </h2>
                  <div className="bot-profile-status">
                    {profile.status_text ? (
                      <>
                        <span
                          className="bot-profile-status-dot"
                          style={{ background: STATUS_DOT_COLORS[profile.status_type] || STATUS_DOT_COLORS.online }}
                        />
                        <span>{profile.status_text}</span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No status set</span>
                    )}
                  </div>
                  {profile.bio && (
                    <div className="bot-profile-bio">{profile.bio}</div>
                  )}
                </div>
              </div>

              {/* Meta info */}
              <div className="bot-profile-meta">
                {profile.updated_at
                  ? `Updated ${timeAgo(profile.updated_at)}`
                  : 'Not configured yet'}
                {profile.last_applied_at && (
                  <span style={{ marginLeft: 8 }}>
                    · Applied {timeAgo(profile.last_applied_at)}
                  </span>
                )}
              </div>

              {/* Form section */}
              <div className="bot-profile-form" style={{ gap: '16px' }}>
                {/* Status Text + Status Type in a row */}
                <div className="bot-profile-row" style={{ gap: '16px' }}>
                  <div className="admin-form-group" style={{ margin: 0 }}>
                    <label className="admin-form-label">Status Text</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      value={profile.status_text}
                      onChange={(e) => updateField(botId, 'status_text', e.target.value)}
                      placeholder="e.g. At your service"
                      maxLength={128}
                      disabled={isBusy}
                      dir="auto"
                    />
                    <span className="admin-form-description">The text shown below the bot&apos;s name in Discord</span>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right', marginTop: '2px' }}>{profile.status_text.length}/128</div>
                  </div>
                  <div className="admin-form-group" style={{ margin: 0, maxWidth: 160 }}>
                    <label className="admin-form-label">Status Type</label>
                    <select
                      className="admin-select"
                      value={profile.status_type}
                      onChange={(e) => updateField(botId, 'status_type', e.target.value)}
                      disabled={isBusy}
                    >
                      <option value="online">Online</option>
                      <option value="idle">Idle</option>
                      <option value="dnd">Do Not Disturb</option>
                    </select>
                    <span className="admin-form-description">Controls the colored dot on the bot&apos;s avatar</span>
                  </div>
                </div>

                {/* Bio */}
                <div className="admin-form-group" style={{ margin: 0 }}>
                  <label className="admin-form-label">Bio</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={profile.bio}
                    onChange={(e) => updateField(botId, 'bio', e.target.value)}
                    placeholder="Per-guild bio shown on the bot's profile"
                    maxLength={190}
                    disabled={isBusy}
                    dir="auto"
                  />
                  <span className="admin-form-description">A short description shown when someone clicks the bot&apos;s profile in Discord</span>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right', marginTop: '2px' }}>{profile.bio.length}/190</div>
                </div>

                {/* Avatar upload */}
                <div className="bot-profile-upload-section">
                  <div className="bot-profile-upload-label">Upload Avatar</div>
                  <div className="bot-profile-preview-row">
                    <div
                      className="bot-profile-avatar-preview"
                      style={{
                        borderColor: `${accent}40`,
                        boxShadow: `0 0 16px ${accent}1a`,
                      }}
                    >
                      {avatarSrc ? (
                        <img src={avatarSrc} alt={`${profile.name} avatar preview`} />
                      ) : (
                        <span className="bot-profile-avatar-preview-empty">?</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      <div className="bot-profile-upload-row" style={{ gap: '10px' }}>
                        <button
                          className="admin-btn admin-btn-ghost admin-btn-sm"
                          onClick={() => avatarRefs.current[botId]?.click()}
                          disabled={isBusy}
                          type="button"
                        >
                          {state.uploadingAvatar ? 'Uploading...' : 'Choose & Crop'}
                        </button>
                        {state.avatarFile && (
                          <>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              Cropped
                            </span>
                            <button
                              className="admin-btn admin-btn-sm admin-btn-danger"
                              onClick={() => clearFile(botId, 'avatar')}
                              disabled={isBusy}
                              type="button"
                              style={{ padding: '2px 8px', fontSize: '11px' }}
                            >
                              Clear
                            </button>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          ref={(el) => { avatarRefs.current[botId] = el; }}
                          style={{ display: 'none' }}
                          onChange={(e) => handleFileSelect(botId, 'avatar', e.target.files?.[0] || null)}
                        />
                      </div>
                      <span className="admin-form-description">Square image, at least 128x128. This becomes the bot&apos;s profile picture.</span>
                    </div>
                  </div>
                </div>

                {/* Banner upload */}
                <div className="bot-profile-upload-section">
                  <div className="bot-profile-upload-label">Upload Banner</div>
                  <div
                    className="bot-profile-banner-preview"
                    style={{
                      borderColor: `${accent}26`,
                      boxShadow: `0 0 12px ${accent}14`,
                    }}
                  >
                    {bannerSrc ? (
                      <img src={bannerSrc} alt={`${profile.name} banner preview`} />
                    ) : (
                      <span className="bot-profile-banner-preview-empty">No banner</span>
                    )}
                  </div>
                  <div className="bot-profile-upload-row" style={{ gap: '10px', marginTop: '4px' }}>
                    <button
                      className="admin-btn admin-btn-ghost admin-btn-sm"
                      onClick={() => bannerRefs.current[botId]?.click()}
                      disabled={isBusy}
                      type="button"
                    >
                      {state.uploadingBanner ? 'Uploading...' : 'Choose & Crop'}
                    </button>
                    {state.bannerFile && (
                      <>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Cropped
                        </span>
                        <button
                          className="admin-btn admin-btn-sm admin-btn-danger"
                          onClick={() => clearFile(botId, 'banner')}
                          disabled={isBusy}
                          type="button"
                          style={{ padding: '2px 8px', fontSize: '11px' }}
                        >
                          Clear
                        </button>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      ref={(el) => { bannerRefs.current[botId] = el; }}
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileSelect(botId, 'banner', e.target.files?.[0] || null)}
                    />
                  </div>
                  <span className="admin-form-description">Wide image (3:1 ratio). Shown at the top of the bot&apos;s Discord profile.</span>
                </div>

                {/* Empty state tip */}
                {!avatarSrc && !bannerSrc && (
                  <div className="bot-profile-tip">
                    Tip: Upload an avatar and banner to customize this bot&apos;s Discord profile
                  </div>
                )}

                {/* Action Buttons */}
                <div className="bot-profile-actions">
                  <button
                    className="admin-btn admin-btn-primary"
                    onClick={() => saveBot(botId, false)}
                    disabled={!changed || isBusy}
                    style={{ flex: 1 }}
                  >
                    {state.saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    className="admin-btn admin-btn-success"
                    onClick={() => saveBot(botId, true)}
                    disabled={!changed || isBusy}
                    style={{ flex: 1 }}
                  >
                    {state.deploying ? 'Deploying...' : <><span className="emoji-bounce-hover">🚀</span> Save &amp; Deploy</>}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Image Crop Modal */}
      {cropState && (
        <ImageCropper
          file={cropState.file}
          aspect={cropState.type}
          onCrop={handleCropComplete}
          onCancel={() => {
            setCropState(null);
            // Clear the file input
            const ref = cropState.type === 'avatar'
              ? avatarRefs.current[cropState.botId]
              : bannerRefs.current[cropState.botId];
            if (ref) ref.value = '';
          }}
        />
      )}
    </>
  );
}
