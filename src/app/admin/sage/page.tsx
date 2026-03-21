'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfigSection from '../components/ConfigSection';
import DurationInput from '../components/DurationInput';
import NumberInput from '../components/NumberInput';
import SaveDeployBar from '../components/SaveDeployBar';
import BotBadge from '../components/BotBadge';
import ToggleSwitch from '../components/ToggleSwitch';
import ImagePicker from '../components/ImagePicker';
import RichTextArea from '../components/RichTextArea';
import RolePicker from '../components/RolePicker';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';

interface PrivilegedRole {
  id: string;
  title: string;
  name: string;
}

interface KnownRole {
  id: string;
  name: string;
}

interface SageSettings {
  provider: 'google' | 'openrouter';
  googleModel: string;
  openrouterModel: string;
  webSearch: boolean;
  imageGeneration: boolean;
  imageGenerationModel: string;
  imageGenRoles: string[];
  sagePrefixes: string[];
  ownerRoleIds: string[];
  threadSlowmode: number;
  threadWelcomeMessage: string;
  panelTitle: string;
  panelDescription: string;
  panelImageUrl: string;
  channelContextLimit: number;
  threadHistoryLimit: number;
}

interface SagePrivileges {
  lunarianAccess: boolean;
  lunarianRoleId: string;
  privilegedRoles: PrivilegedRole[];
  allKnownRoles: KnownRole[];
}

const DEFAULT_SETTINGS: SageSettings = {
  provider: 'google',
  googleModel: 'gemini-2.5-flash',
  openrouterModel: 'anthropic/claude-3.5-sonnet:online',
  webSearch: false,
  imageGeneration: false,
  imageGenerationModel: 'gemini-2.5-flash-image',
  imageGenRoles: [],
  sagePrefixes: ['سيج', 'sage'],
  ownerRoleIds: [],
  threadSlowmode: 0,
  threadWelcomeMessage: '',
  panelTitle: '',
  panelDescription: '',
  panelImageUrl: '',
  channelContextLimit: 50,
  threadHistoryLimit: 200,
};

const DEFAULT_PRIVILEGES: SagePrivileges = {
  lunarianAccess: false,
  lunarianRoleId: '',
  privilegedRoles: [],
  allKnownRoles: [],
};

type Tab = 'settings' | 'system_prompt' | 'lore' | 'privileges';

export default function SagePage() {
  const [tab, setTab] = useState<Tab>('settings');

  // Settings state
  const [settings, setSettings] = useState<SageSettings>({ ...DEFAULT_SETTINGS });
  const [settingsOriginal, setSettingsOriginal] = useState<SageSettings>({ ...DEFAULT_SETTINGS });

  // System prompt state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [systemPromptOriginal, setSystemPromptOriginal] = useState('');

  // Lore state
  const [loreText, setLoreText] = useState('');
  const [loreTextOriginal, setLoreTextOriginal] = useState('');

  // Privileges state
  const [privileges, setPrivileges] = useState<SagePrivileges>({ ...DEFAULT_PRIVILEGES });
  const [privilegesOriginal, setPrivilegesOriginal] = useState<SagePrivileges>({ ...DEFAULT_PRIVILEGES });

  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  // Fetch config — API returns flat field names, map to local state
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config/sage');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const s = data.sections || {};

      const settingsData: SageSettings = {
        provider: s.provider ?? DEFAULT_SETTINGS.provider,
        googleModel: s.google_model ?? DEFAULT_SETTINGS.googleModel,
        openrouterModel: s.openrouter_model ?? DEFAULT_SETTINGS.openrouterModel,
        webSearch: s.enable_search ?? DEFAULT_SETTINGS.webSearch,
        imageGeneration: s.enable_image_generation ?? DEFAULT_SETTINGS.imageGeneration,
        imageGenerationModel: s.image_generation_model ?? DEFAULT_SETTINGS.imageGenerationModel,
        imageGenRoles: s.image_gen_roles ?? DEFAULT_SETTINGS.imageGenRoles,
        sagePrefixes: s.sage_prefix ?? DEFAULT_SETTINGS.sagePrefixes,
        ownerRoleIds: s.owner_role_ids ?? DEFAULT_SETTINGS.ownerRoleIds,
        threadSlowmode: s.thread_slowmode ?? DEFAULT_SETTINGS.threadSlowmode,
        threadWelcomeMessage: s.thread_welcome ?? DEFAULT_SETTINGS.threadWelcomeMessage,
        panelTitle: s.panel_title ?? DEFAULT_SETTINGS.panelTitle,
        panelDescription: s.panel_description ?? DEFAULT_SETTINGS.panelDescription,
        panelImageUrl: s.panel_image ?? DEFAULT_SETTINGS.panelImageUrl,
        channelContextLimit: s.channel_context_limit ?? DEFAULT_SETTINGS.channelContextLimit,
        threadHistoryLimit: s.thread_history_limit ?? DEFAULT_SETTINGS.threadHistoryLimit,
      };
      setSettings(settingsData);
      setSettingsOriginal(settingsData);

      if (s.system_prompt !== undefined) {
        const prompt = typeof s.system_prompt === 'string' ? s.system_prompt : '';
        setSystemPrompt(prompt);
        setSystemPromptOriginal(prompt);
      }

      if (s.lore_text !== undefined) {
        const lore = typeof s.lore_text === 'string' ? s.lore_text : '';
        setLoreText(lore);
        setLoreTextOriginal(lore);
      }

      const privData: SagePrivileges = {
        lunarianAccess: s.lunarian_access ?? DEFAULT_PRIVILEGES.lunarianAccess,
        lunarianRoleId: s.lunarian_role_id ?? DEFAULT_PRIVILEGES.lunarianRoleId,
        privilegedRoles: s.privileged_roles ?? DEFAULT_PRIVILEGES.privilegedRoles,
        allKnownRoles: s.all_known_roles ?? DEFAULT_PRIVILEGES.allKnownRoles,
      };
      setPrivileges(privData);
      setPrivilegesOriginal(privData);
    } catch {
      toast('Failed to load Sage config. Try refreshing.', 'error');
    } finally {
      setConfigLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Change detection
  const settingsChanged = JSON.stringify(settings) !== JSON.stringify(settingsOriginal);
  const systemPromptChanged = systemPrompt !== systemPromptOriginal;
  const loreChanged = loreText !== loreTextOriginal;
  const privilegesChanged = JSON.stringify(privileges) !== JSON.stringify(privilegesOriginal);
  const hasChanges = settingsChanged || systemPromptChanged || loreChanged || privilegesChanged;

  // Save helper — sends individual field PUTs to match API's per-field design
  async function saveConfig() {
    setSaving(true);
    const toSave: Array<{ section: string; value: any }> = [];
    const saved: string[] = [];
    try {
      if (settingsChanged) {
        if (settings.provider !== settingsOriginal.provider)
          toSave.push({ section: 'provider', value: settings.provider });
        if (settings.googleModel !== settingsOriginal.googleModel)
          toSave.push({ section: 'google_model', value: settings.googleModel });
        if (settings.openrouterModel !== settingsOriginal.openrouterModel)
          toSave.push({ section: 'openrouter_model', value: settings.openrouterModel });
        if (settings.webSearch !== settingsOriginal.webSearch)
          toSave.push({ section: 'enable_search', value: settings.webSearch });
        if (settings.imageGeneration !== settingsOriginal.imageGeneration)
          toSave.push({ section: 'enable_image_generation', value: settings.imageGeneration });
        if (settings.threadSlowmode !== settingsOriginal.threadSlowmode)
          toSave.push({ section: 'thread_slowmode', value: settings.threadSlowmode });
        if (settings.threadWelcomeMessage !== settingsOriginal.threadWelcomeMessage)
          toSave.push({ section: 'thread_welcome', value: settings.threadWelcomeMessage });
        if (settings.panelTitle !== settingsOriginal.panelTitle)
          toSave.push({ section: 'panel_title', value: settings.panelTitle });
        if (settings.panelDescription !== settingsOriginal.panelDescription)
          toSave.push({ section: 'panel_description', value: settings.panelDescription });
        if (settings.panelImageUrl !== settingsOriginal.panelImageUrl)
          toSave.push({ section: 'panel_image', value: settings.panelImageUrl });
        if (settings.imageGenerationModel !== settingsOriginal.imageGenerationModel)
          toSave.push({ section: 'image_generation_model', value: settings.imageGenerationModel });
        if (JSON.stringify(settings.imageGenRoles) !== JSON.stringify(settingsOriginal.imageGenRoles))
          toSave.push({ section: 'image_gen_roles', value: settings.imageGenRoles });
        if (JSON.stringify(settings.sagePrefixes) !== JSON.stringify(settingsOriginal.sagePrefixes))
          toSave.push({ section: 'sage_prefix', value: settings.sagePrefixes });
        if (JSON.stringify(settings.ownerRoleIds) !== JSON.stringify(settingsOriginal.ownerRoleIds))
          toSave.push({ section: 'owner_role_ids', value: settings.ownerRoleIds });
        if (settings.channelContextLimit !== settingsOriginal.channelContextLimit)
          toSave.push({ section: 'channel_context_limit', value: settings.channelContextLimit });
        if (settings.threadHistoryLimit !== settingsOriginal.threadHistoryLimit)
          toSave.push({ section: 'thread_history_limit', value: settings.threadHistoryLimit });
      }
      if (systemPromptChanged) {
        toSave.push({ section: 'system_prompt', value: systemPrompt });
      }
      if (loreChanged) {
        toSave.push({ section: 'lore_text', value: loreText });
      }
      if (privilegesChanged) {
        if (privileges.lunarianAccess !== privilegesOriginal.lunarianAccess)
          toSave.push({ section: 'lunarian_access', value: privileges.lunarianAccess });
        if (privileges.lunarianRoleId !== privilegesOriginal.lunarianRoleId)
          toSave.push({ section: 'lunarian_role_id', value: privileges.lunarianRoleId });
        if (JSON.stringify(privileges.privilegedRoles) !== JSON.stringify(privilegesOriginal.privilegedRoles))
          toSave.push({ section: 'privileged_roles', value: privileges.privilegedRoles });
        if (JSON.stringify(privileges.allKnownRoles) !== JSON.stringify(privilegesOriginal.allKnownRoles))
          toSave.push({ section: 'all_known_roles', value: privileges.allKnownRoles });
      }

      for (const { section, value } of toSave) {
        const res = await fetch('/api/admin/config/sage', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body: JSON.stringify({ section, value }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to save ${section}`);
        }
        saved.push(section);
      }

      if (settingsChanged) setSettingsOriginal({ ...settings });
      if (systemPromptChanged) setSystemPromptOriginal(systemPrompt);
      if (loreChanged) setLoreTextOriginal(loreText);
      if (privilegesChanged) setPrivilegesOriginal(JSON.parse(JSON.stringify(privileges)));

      toast('Saved! Changes take effect within 30 seconds.', 'success');
    } catch (err: any) {
      const msg = saved.length > 0
        ? `Saved ${saved.length} of ${toSave.length} fields, then failed: ${err.message}. Click Save again to retry.`
        : err.message;
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  function discardSettings() {
    setSettings({ ...settingsOriginal });
  }

  function discardSystemPrompt() {
    setSystemPrompt(systemPromptOriginal);
  }

  function discardLore() {
    setLoreText(loreTextOriginal);
  }

  function discardPrivileges() {
    setPrivileges(JSON.parse(JSON.stringify(privilegesOriginal)));
  }

  // Privileged roles helpers
  function addPrivilegedRole() {
    setPrivileges({
      ...privileges,
      privilegedRoles: [...privileges.privilegedRoles, { id: '', title: '', name: '' }],
    });
  }

  function removePrivilegedRole(index: number) {
    setPrivileges({
      ...privileges,
      privilegedRoles: privileges.privilegedRoles.filter((_, i) => i !== index),
    });
  }

  function updatePrivilegedRole(index: number, field: keyof PrivilegedRole, value: string) {
    const updated = [...privileges.privilegedRoles];
    updated[index] = { ...updated[index], [field]: value };
    setPrivileges({ ...privileges, privilegedRoles: updated });
  }

  // System prompt character count thresholds
  const promptLen = systemPrompt.length;
  const promptWarning = promptLen > 8000 ? 'red' : promptLen > 4000 ? 'yellow' : null;

  if (configLoading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">🧙</span> Luna Sage</h1>
          <p className="admin-page-subtitle">AI assistant bot configuration</p>
        </div>
        <SkeletonCard count={4} />
        <SkeletonTable rows={4} />
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">🧙</span> Luna Sage</h1>
        <p className="admin-page-subtitle">AI assistant bot configuration</p>
      </div>

      {/* Status overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div className="admin-stat-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Provider</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {settings.provider === 'google' ? 'Google Gemini' : 'OpenRouter'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
            {settings.provider === 'google' ? settings.googleModel : settings.openrouterModel}
          </div>
        </div>
        <div className="admin-stat-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Web Search</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: settings.webSearch ? '#34d399' : 'var(--text-muted)' }}>
            {settings.webSearch ? 'Enabled' : 'Disabled'}
          </div>
        </div>
        <div className="admin-stat-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Image Generation</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: settings.imageGeneration ? '#34d399' : 'var(--text-muted)' }}>
            {settings.imageGeneration ? 'Enabled' : 'Disabled'}
          </div>
          {settings.imageGeneration && settings.provider !== 'google' && (
            <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '2px' }}>Google only</div>
          )}
        </div>
        <div className="admin-stat-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Privileged Roles</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {privileges.privilegedRoles.length}
          </div>
          <div style={{ fontSize: '11px', color: privileges.lunarianAccess ? '#34d399' : 'var(--text-muted)', marginTop: '2px' }}>
            Lunarian: {privileges.lunarianAccess ? 'On' : 'Off'}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'settings' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
        <button
          className={`admin-tab ${tab === 'system_prompt' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('system_prompt')}
        >
          System Prompt
          {systemPromptChanged && <span style={{ marginLeft: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-legendary)', display: 'inline-block' }} />}
        </button>
        <button
          className={`admin-tab ${tab === 'lore' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('lore')}
        >
          World Lore
          {loreChanged && <span style={{ marginLeft: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-legendary)', display: 'inline-block' }} />}
        </button>
        <button
          className={`admin-tab ${tab === 'privileges' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('privileges')}
        >
          Privileges
        </button>
      </div>

      {/* Settings Tab */}
      {tab === 'settings' && (
        <>
          <ConfigSection title="AI Provider" description="Which AI service to use for responses">
            <div style={{ marginBottom: '12px' }}>
              <label className="admin-number-input-label">🔵 Provider</label>
              <select
                className="admin-number-input"
                value={settings.provider}
                onChange={(e) => setSettings({ ...settings, provider: e.target.value as 'google' | 'openrouter' })}
                style={{ width: '100%', maxWidth: '300px', cursor: 'pointer' }}
              >
                <option value="google">Google (Gemini)</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              <div className="admin-number-input-wrap">
                <label className="admin-number-input-label">
                  🤖 Google Model
                  {settings.provider === 'google' && <span style={{ marginLeft: 6, fontSize: '10px', color: '#34d399' }}>active</span>}
                </label>
                <input
                  type="text"
                  className="admin-number-input"
                  value={settings.googleModel}
                  onChange={(e) => setSettings({ ...settings, googleModel: e.target.value })}
                  placeholder="gemini-2.5-flash"
                  style={{ width: '100%', opacity: settings.provider === 'google' ? 1 : 0.5 }}
                />
                <span className="admin-number-input-desc">Model ID for Google Gemini API</span>
              </div>
              <div className="admin-number-input-wrap">
                <label className="admin-number-input-label">
                  🤖 OpenRouter Model
                  {settings.provider === 'openrouter' && <span style={{ marginLeft: 6, fontSize: '10px', color: '#34d399' }}>active</span>}
                </label>
                <input
                  type="text"
                  className="admin-number-input"
                  value={settings.openrouterModel}
                  onChange={(e) => setSettings({ ...settings, openrouterModel: e.target.value })}
                  placeholder="anthropic/claude-3.5-sonnet:online"
                  style={{ width: '100%', opacity: settings.provider === 'openrouter' ? 1 : 0.5 }}
                />
                <span className="admin-number-input-desc">Model ID for OpenRouter API</span>
              </div>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ToggleSwitch
                label="⚡ Web Search"
                checked={settings.webSearch}
                onChange={(v) => setSettings({ ...settings, webSearch: v })}
              />
              <ToggleSwitch
                label="⚡ Image Generation"
                checked={settings.imageGeneration}
                onChange={(v) => setSettings({ ...settings, imageGeneration: v })}
              />
              {settings.imageGeneration && (
                <div style={{ marginLeft: '16px', paddingLeft: '12px', borderLeft: '2px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Image generation and web search cannot be used simultaneously per request.
                    Search is used by default; image generation activates when users ask to create images.
                  </span>
                  {settings.provider !== 'google' && (
                    <span style={{ fontSize: '12px', color: '#f59e0b' }}>
                      Image generation only works with Google provider. Switch provider to use this feature.
                    </span>
                  )}
                  <div className="admin-number-input-wrap" style={{ marginTop: '4px' }}>
                    <label className="admin-number-input-label">🤖 Image Gen Model</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={settings.imageGenerationModel}
                      onChange={(e) => setSettings({ ...settings, imageGenerationModel: e.target.value })}
                      placeholder="gemini-2.5-flash-image"
                      style={{ width: '100%', maxWidth: '300px' }}
                    />
                    <span className="admin-number-input-desc">Model used for image generation requests</span>
                  </div>
                  <RolePicker
                    label="🛡️ Image Gen Roles"
                    description="Roles allowed to generate images. Empty = all Sage users can generate."
                    value={settings.imageGenRoles}
                    onChange={(v) => setSettings({ ...settings, imageGenRoles: v as string[] })}
                    multi
                  />
                </div>
              )}
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <ConfigSection title="Bot Configuration" description="Sage prefix triggers and owner role permissions">
            <div className="admin-form-group">
              <label className="admin-number-input-label">✏️ Sage Prefixes</label>
              <input
                type="text"
                className="admin-input"
                value={settings.sagePrefixes.join(', ')}
                onChange={(e) => setSettings({ ...settings, sagePrefixes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="سيج, sage"
                style={{ width: '100%', maxWidth: '400px' }}
              />
              <span className="admin-number-input-desc">Text prefixes that trigger Sage responses (e.g. !sage, سيج)</span>
            </div>
            <RolePicker
              label="🛡️ Owner Roles"
              description="Roles with full admin access to Sage commands (!setai, etc.)"
              value={settings.ownerRoleIds}
              onChange={(v) => setSettings({ ...settings, ownerRoleIds: v as string[] })}
              multi
            />
            <BotBadge bot="sage" />
          </ConfigSection>

          <ConfigSection title="Thread Settings" description="Thread behavior when Sage creates conversation threads">
            <DurationInput
              label="⏱️ Slowmode"
              value={settings.threadSlowmode * 1000}
              onChange={(ms) => setSettings({ ...settings, threadSlowmode: Math.round(ms / 1000) })}
              description="Delay between messages in new threads (0 = disabled)"
            />
            <div className="admin-number-input-wrap" style={{ marginTop: '12px' }}>
              <label className="admin-number-input-label">📝 Welcome Message</label>
              <textarea
                className="admin-input"
                rows={3}
                value={settings.threadWelcomeMessage}
                onChange={(e) => setSettings({ ...settings, threadWelcomeMessage: e.target.value })}
                placeholder="أهلاً بك {mention} في محادثتك الخاصة..."
                style={{ width: '100%', resize: 'vertical' }}
                dir="auto"
              />
              <span className="admin-number-input-desc">Message sent when a new thread is created. Use {'{mention}'} for the user mention.</span>
            </div>
            <div className="admin-config-grid" style={{ marginTop: '12px' }}>
              <NumberInput
                label="🔢 Channel Context"
                value={settings.channelContextLimit}
                onChange={(v) => setSettings({ ...settings, channelContextLimit: v })}
                min={0}
                max={100}
                description="Number of recent channel messages included as context when Sage is triggered (0 = none)"
              />
              <NumberInput
                label="🔢 Thread History"
                value={settings.threadHistoryLimit}
                onChange={(v) => setSettings({ ...settings, threadHistoryLimit: v })}
                min={10}
                max={500}
                description="Maximum conversation messages sent to the AI per thread (higher = more context, more tokens)"
              />
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <ConfigSection title="Panel" description="The embed panel shown in the Sage channel via !setai">
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="admin-number-input-wrap">
                  <label className="admin-number-input-label">✏️ Panel Title</label>
                  <input
                    type="text"
                    className="admin-number-input"
                    value={settings.panelTitle}
                    onChange={(e) => setSettings({ ...settings, panelTitle: e.target.value })}
                    placeholder="Luna AI Chat"
                    style={{ width: '100%' }}
                  />
                </div>
                <RichTextArea
                  label="📝 Panel Description"
                  value={settings.panelDescription}
                  onChange={(v) => setSettings({ ...settings, panelDescription: v })}
                  rows={3}
                  minHeight="100px"
                  placeholder="Panel description"
                />
                <ImagePicker
                  label="🖼️ Panel Image"
                  description="Image displayed in the panel embed"
                  value={settings.panelImageUrl}
                  onChange={(url) => setSettings({ ...settings, panelImageUrl: url })}
                  uploadPrefix="sage/"
                />
              </div>
              {/* Panel preview */}
              {(settings.panelTitle || settings.panelDescription) && (
                <div style={{
                  flex: '0 0 280px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '16px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  alignSelf: 'flex-start',
                }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>Preview</div>
                  {settings.panelImageUrl && (
                    <div style={{
                      width: '100%',
                      height: '100px',
                      borderRadius: '6px',
                      marginBottom: '10px',
                      background: `url(${settings.panelImageUrl}) center/cover no-repeat`,
                      border: '1px solid rgba(255,255,255,0.06)',
                    }} />
                  )}
                  {settings.panelTitle && (
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      {settings.panelTitle}
                    </div>
                  )}
                  {settings.panelDescription && (
                    <div style={{ lineHeight: 1.5, direction: 'rtl' }}>{settings.panelDescription}</div>
                  )}
                  <div style={{
                    marginTop: '12px',
                    padding: '6px 14px',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: '4px',
                    display: 'inline-block',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}>
                    فتح شات جديد
                  </div>
                </div>
              )}
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <SaveDeployBar
            hasChanges={settingsChanged}
            saving={saving}
            onSave={saveConfig}
            onDiscard={discardSettings}
            projectName="Sage"
          />
        </>
      )}

      {/* System Prompt Tab */}
      {tab === 'system_prompt' && (
        <>
          {/* Variable reference guide */}
          <div className="admin-stat-card" style={{ marginBottom: 16, padding: '16px 20px', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>How the System Prompt Works</strong>
            Your prompt is sent as the base instruction to the AI model. The bot automatically appends the following context to every request:
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>
                <code style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>[CONTEXT_INFO]</code>
                <span style={{ marginLeft: 8 }}>User identity: REQUESTER_ID, REQUESTER_NAME, REQUESTER_ROLE, REQUESTER_TITLE, IS_LUNARIAN</span>
              </div>
              <div>
                <code style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>[CHANNEL_HISTORY]</code>
                <span style={{ marginLeft: 8 }}>Last 50 messages from the channel (for prefix/mention triggers)</span>
              </div>
              <div>
                <code style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>[USER_MESSAGE]</code>
                <span style={{ marginLeft: 8 }}>The actual user question/request</span>
              </div>
            </div>
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Also appended: Mastermind role indicator + Luna world lore data (~800 lines). Keep your prompt structured and concise for best results.
            </div>
          </div>

          <ConfigSection title="System Prompt" description="The system prompt sent to the AI model with every conversation">
            <div style={{ position: 'relative' }}>
              <textarea
                className="admin-number-input"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Enter the system prompt for Luna Sage..."
                style={{
                  width: '100%',
                  minHeight: '400px',
                  resize: 'vertical',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  padding: '12px',
                }}
              />
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{promptLen.toLocaleString()} characters</span>
                  {promptWarning === 'yellow' && (
                    <span style={{ color: '#f59e0b', fontSize: '11px' }}>
                      Long prompt — AI may deprioritize later instructions
                    </span>
                  )}
                  {promptWarning === 'red' && (
                    <span style={{ color: '#f43f5e', fontSize: '11px' }}>
                      Very long prompt — combined with lore data (~800 lines), this may exceed model limits or reduce compliance
                    </span>
                  )}
                </div>
                {systemPromptChanged && (
                  <span style={{ color: 'var(--accent-legendary)' }}>Unsaved changes</span>
                )}
              </div>
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <SaveDeployBar
            hasChanges={systemPromptChanged}
            saving={saving}
            onSave={saveConfig}
            onDiscard={discardSystemPrompt}
            projectName="Sage"
          />
        </>
      )}

      {/* World Lore Tab */}
      {tab === 'lore' && (
        <>
          <div className="admin-stat-card" style={{ marginBottom: 16, padding: '16px 20px', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>How Lore Works</strong>
            The lore text below is appended to every AI request as pinned context. Sage uses it to answer questions about the Luna world, characters, factions, merchants, games, and economy.
            If this field is empty, Sage falls back to the built-in lore file in the bot code.
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Format: Markdown headings (## Category, ### Sub-item) work best. Arabic text is fully supported.
            </div>
          </div>

          <ConfigSection title="Luna World Lore" description="Complete world-building data injected into every Sage AI prompt">
            <div style={{ position: 'relative' }}>
              <textarea
                className="admin-number-input"
                value={loreText}
                onChange={(e) => setLoreText(e.target.value)}
                placeholder="# Luna World - خريطة عالم لونا&#10;&#10;## قصة لونا&#10;..."
                style={{
                  width: '100%',
                  minHeight: '500px',
                  resize: 'vertical',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  padding: '12px',
                }}
                dir="auto"
              />
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{loreText.length.toLocaleString()} characters</span>
                  {loreText.length > 50000 && (
                    <span style={{ color: '#f59e0b', fontSize: '11px' }}>
                      Large lore — may increase AI token usage significantly
                    </span>
                  )}
                </div>
                {loreChanged && (
                  <span style={{ color: 'var(--accent-legendary)' }}>Unsaved changes</span>
                )}
              </div>
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <SaveDeployBar
            hasChanges={loreChanged}
            saving={saving}
            onSave={saveConfig}
            onDiscard={discardLore}
            projectName="Sage"
          />
        </>
      )}

      {/* Privileges Tab */}
      {tab === 'privileges' && (
        <>
          <ConfigSection title="Lunarian Access" description="Allow regular Lunarian members to use Sage">
            <ToggleSwitch
              label="Enable Lunarian Access"
              checked={privileges.lunarianAccess}
              onChange={(v) => setPrivileges({ ...privileges, lunarianAccess: v })}
            />
            <RolePicker
              label="Lunarian Role"
              description="The Discord role for Lunarian community members"
              value={privileges.lunarianRoleId}
              onChange={(v) => setPrivileges({ ...privileges, lunarianRoleId: v as string })}
            />
            <BotBadge bot="sage" />
          </ConfigSection>

          <div className="admin-stat-card" style={{ marginBottom: 16, padding: '16px 20px', fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 10 }}>How Sage Addresses Users</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>
                <span style={{ color: 'var(--accent-legendary)', fontWeight: 600 }}>Mastermind</span>
                {privileges.privilegedRoles[0]?.title && (
                  <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontStyle: 'italic' }} dir="auto">&quot;{privileges.privilegedRoles[0].title}&quot;</span>
                )}
                <span style={{ marginLeft: 8 }}>— Full expressive/deferential tone, must answer everything</span>
              </div>
              <div>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Privileged</span>
                {privileges.privilegedRoles.length > 1 && (
                  <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    ({privileges.privilegedRoles.slice(1).map(r => r.name).filter(Boolean).join(', ') || 'other roles'})
                  </span>
                )}
                <span style={{ marginLeft: 8 }}>— Strict neutral tone, addressed with their title</span>
              </div>
              <div>
                <span style={{ color: 'var(--common)', fontWeight: 600 }}>Lunarian</span>
                <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontStyle: 'italic' }} dir="auto">&quot;يا اللوناري،&quot;</span>
                <span style={{ marginLeft: 8 }}>— Friendly tone, gets follow-up Luna topic suggestions</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Default</span>
                <span style={{ marginLeft: 8 }}>— Concise, factual, no honorifics</span>
              </div>
            </div>
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
              The system prompt controls this behavior. Each role&apos;s &quot;Title&quot; field below is the Arabic honorific Sage uses when addressing that user.
            </div>
          </div>

          <ConfigSection title="Privileged Roles" description="Roles with elevated access to Sage. First role = highest priority (Mastermind). Order matters.">
            {privileges.privilegedRoles.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0', lineHeight: 1.6 }}>
                No privileged roles configured. Add roles to enable title-based addressing.
                The first role added will be treated as the Mastermind (highest privilege).
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {privileges.privilegedRoles.map((role, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr 1fr 1fr auto',
                      gap: '8px',
                      alignItems: 'end',
                      padding: '12px',
                      background: index === 0 ? 'rgba(255, 213, 79, 0.04)' : 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                      border: index === 0 ? '1px solid rgba(255, 213, 79, 0.15)' : '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: index === 0 ? 'rgba(255, 213, 79, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                      color: index === 0 ? 'var(--accent-legendary)' : 'var(--text-muted)',
                      alignSelf: 'center',
                    }}>
                      {index + 1}
                    </div>
                    <RolePicker
                      label={index === 0 ? 'Role (Mastermind)' : 'Role'}
                      value={role.id}
                      onChange={(v) => updatePrivilegedRole(index, 'id', v as string)}
                      compact
                    />
                    <div className="admin-number-input-wrap">
                      <label className="admin-number-input-label">Title (Arabic honorific)</label>
                      <input
                        type="text"
                        className="admin-number-input"
                        value={role.title}
                        onChange={(e) => updatePrivilegedRole(index, 'title', e.target.value)}
                        placeholder="سيدي العقل المدبر"
                        style={{ width: '100%' }}
                        dir="auto"
                      />
                    </div>
                    <div className="admin-number-input-wrap">
                      <label className="admin-number-input-label">Name</label>
                      <input
                        type="text"
                        className="admin-number-input"
                        value={role.name}
                        onChange={(e) => updatePrivilegedRole(index, 'name', e.target.value)}
                        placeholder="Role name"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <button
                      className="admin-btn admin-btn-ghost"
                      onClick={() => removePrivilegedRole(index)}
                      style={{ padding: '6px 12px', fontSize: '12px', color: '#f43f5e', alignSelf: 'center' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: '12px' }}>
              <button
                className="admin-btn admin-btn-ghost"
                onClick={addPrivilegedRole}
                style={{ fontSize: '13px' }}
              >
                + Add Role
              </button>
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <ConfigSection title="All Known Roles" description="All known roles in priority order (highest first). Used to show role names in channel context sent to AI.">
            {privileges.allKnownRoles.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0', lineHeight: 1.6 }}>
                No known roles configured. These roles help Sage identify users in channel history
                (e.g. &quot;[نبيل لونا المكرم] asked about...&quot;). Add them from highest to lowest priority.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {privileges.allKnownRoles.map((role, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr 1fr auto',
                      gap: '8px',
                      alignItems: 'end',
                      padding: '10px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: 'var(--text-muted)',
                      alignSelf: 'center',
                    }}>
                      {index + 1}
                    </div>
                    <RolePicker
                      label="Role"
                      value={role.id}
                      onChange={(v) => {
                        const copy = [...privileges.allKnownRoles];
                        copy[index] = { ...copy[index], id: v as string };
                        setPrivileges({ ...privileges, allKnownRoles: copy });
                      }}
                      compact
                    />
                    <div className="admin-number-input-wrap">
                      <label className="admin-number-input-label">Name</label>
                      <input
                        type="text"
                        className="admin-input"
                        value={role.name}
                        onChange={(e) => {
                          const copy = [...privileges.allKnownRoles];
                          copy[index] = { ...copy[index], name: e.target.value };
                          setPrivileges({ ...privileges, allKnownRoles: copy });
                        }}
                      />
                    </div>
                    <button
                      className="admin-btn admin-btn-ghost"
                      onClick={() => setPrivileges({ ...privileges, allKnownRoles: privileges.allKnownRoles.filter((_, i) => i !== index) })}
                      style={{ padding: '6px 12px', fontSize: '12px', color: '#f43f5e', alignSelf: 'center' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: '12px' }}>
              <button
                className="admin-btn admin-btn-ghost"
                onClick={() => setPrivileges({ ...privileges, allKnownRoles: [...privileges.allKnownRoles, { id: '', name: '' }] })}
                style={{ fontSize: '13px' }}
              >
                + Add Role
              </button>
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <SaveDeployBar
            hasChanges={privilegesChanged}
            saving={saving}
            onSave={saveConfig}
            onDiscard={discardPrivileges}
            projectName="Sage"
          />
        </>
      )}
    </>
  );
}
