'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfigSection from '../components/ConfigSection';
import NumberInput from '../components/NumberInput';
import SaveDeployBar from '../components/SaveDeployBar';
import BotBadge from '../components/BotBadge';
import ToggleSwitch from '../components/ToggleSwitch';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';

interface PrivilegedRole {
  roleId: string;
  title: string;
  name: string;
}

interface SageSettings {
  provider: 'google' | 'openrouter';
  googleModel: string;
  openrouterModel: string;
  webSearch: boolean;
  imageGeneration: boolean;
  threadSlowmode: number;
  threadWelcomeMessage: string;
  panelTitle: string;
  panelDescription: string;
  panelImageUrl: string;
}

interface SagePrivileges {
  lunarianAccess: boolean;
  lunarianRoleId: string;
  privilegedRoles: PrivilegedRole[];
}

const DEFAULT_SETTINGS: SageSettings = {
  provider: 'google',
  googleModel: 'gemini-2.5-flash',
  openrouterModel: 'anthropic/claude-3.5-sonnet:online',
  webSearch: false,
  imageGeneration: false,
  threadSlowmode: 0,
  threadWelcomeMessage: '',
  panelTitle: '',
  panelDescription: '',
  panelImageUrl: '',
};

const DEFAULT_PRIVILEGES: SagePrivileges = {
  lunarianAccess: false,
  lunarianRoleId: '',
  privilegedRoles: [],
};

type Tab = 'settings' | 'system_prompt' | 'privileges';

export default function SagePage() {
  const [tab, setTab] = useState<Tab>('settings');

  // Settings state
  const [settings, setSettings] = useState<SageSettings>({ ...DEFAULT_SETTINGS });
  const [settingsOriginal, setSettingsOriginal] = useState<SageSettings>({ ...DEFAULT_SETTINGS });

  // System prompt state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [systemPromptOriginal, setSystemPromptOriginal] = useState('');

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
        threadSlowmode: s.thread_slowmode ?? DEFAULT_SETTINGS.threadSlowmode,
        threadWelcomeMessage: s.thread_welcome ?? DEFAULT_SETTINGS.threadWelcomeMessage,
        panelTitle: s.panel_title ?? DEFAULT_SETTINGS.panelTitle,
        panelDescription: s.panel_description ?? DEFAULT_SETTINGS.panelDescription,
        panelImageUrl: s.panel_image ?? DEFAULT_SETTINGS.panelImageUrl,
      };
      setSettings(settingsData);
      setSettingsOriginal(settingsData);

      if (s.system_prompt !== undefined) {
        const prompt = typeof s.system_prompt === 'string' ? s.system_prompt : '';
        setSystemPrompt(prompt);
        setSystemPromptOriginal(prompt);
      }

      const privData: SagePrivileges = {
        lunarianAccess: s.lunarian_access ?? DEFAULT_PRIVILEGES.lunarianAccess,
        lunarianRoleId: s.lunarian_role_id ?? DEFAULT_PRIVILEGES.lunarianRoleId,
        privilegedRoles: s.privileged_roles ?? DEFAULT_PRIVILEGES.privilegedRoles,
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
  const privilegesChanged = JSON.stringify(privileges) !== JSON.stringify(privilegesOriginal);
  const hasChanges = settingsChanged || systemPromptChanged || privilegesChanged;

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
      }
      if (systemPromptChanged) {
        toSave.push({ section: 'system_prompt', value: systemPrompt });
      }
      if (privilegesChanged) {
        if (privileges.lunarianAccess !== privilegesOriginal.lunarianAccess)
          toSave.push({ section: 'lunarian_access', value: privileges.lunarianAccess });
        if (privileges.lunarianRoleId !== privilegesOriginal.lunarianRoleId)
          toSave.push({ section: 'lunarian_role_id', value: privileges.lunarianRoleId });
        if (JSON.stringify(privileges.privilegedRoles) !== JSON.stringify(privilegesOriginal.privilegedRoles))
          toSave.push({ section: 'privileged_roles', value: privileges.privilegedRoles });
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

  // Privileged roles helpers
  function addPrivilegedRole() {
    setPrivileges({
      ...privileges,
      privilegedRoles: [...privileges.privilegedRoles, { roleId: '', title: '', name: '' }],
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

  if (configLoading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title">Luna Sage</h1>
          <p className="admin-page-subtitle">AI assistant bot configuration</p>
        </div>
        <div className="admin-loading"><div className="admin-spinner" />Loading Sage config...</div>
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Luna Sage</h1>
        <p className="admin-page-subtitle">AI assistant bot configuration</p>
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
              <label className="admin-number-input-label">Provider</label>
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
                <label className="admin-number-input-label">Google Model</label>
                <input
                  type="text"
                  className="admin-number-input"
                  value={settings.googleModel}
                  onChange={(e) => setSettings({ ...settings, googleModel: e.target.value })}
                  placeholder="gemini-2.5-flash"
                  style={{ width: '100%' }}
                />
                <span className="admin-number-input-desc">Model ID for Google Gemini API</span>
              </div>
              <div className="admin-number-input-wrap">
                <label className="admin-number-input-label">OpenRouter Model</label>
                <input
                  type="text"
                  className="admin-number-input"
                  value={settings.openrouterModel}
                  onChange={(e) => setSettings({ ...settings, openrouterModel: e.target.value })}
                  placeholder="anthropic/claude-3.5-sonnet:online"
                  style={{ width: '100%' }}
                />
                <span className="admin-number-input-desc">Model ID for OpenRouter API</span>
              </div>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ToggleSwitch
                label="Web Search"
                checked={settings.webSearch}
                onChange={(v) => setSettings({ ...settings, webSearch: v })}
              />
              <ToggleSwitch
                label="Image Generation"
                checked={settings.imageGeneration}
                onChange={(v) => setSettings({ ...settings, imageGeneration: v })}
              />
              {settings.imageGeneration && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Image generation and web search cannot be used simultaneously per request.
                  Search is used by default; image generation activates when users ask to create images.
                </span>
              )}
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <ConfigSection title="Thread Settings" description="Thread behavior when Sage creates conversation threads">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              <NumberInput
                label="Slowmode (seconds)"
                value={settings.threadSlowmode}
                onChange={(v) => setSettings({ ...settings, threadSlowmode: v })}
                min={0}
                max={21600}
                description="Slowmode delay in seconds for new threads (0 = disabled)"
              />
            </div>
            <div className="admin-number-input-wrap" style={{ marginTop: '12px' }}>
              <label className="admin-number-input-label">Welcome Message</label>
              <input
                type="text"
                className="admin-number-input"
                value={settings.threadWelcomeMessage}
                onChange={(e) => setSettings({ ...settings, threadWelcomeMessage: e.target.value })}
                placeholder="Welcome to the thread..."
                style={{ width: '100%' }}
              />
              <span className="admin-number-input-desc">Message sent when a new thread is created</span>
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <ConfigSection title="Panel" description="The embed panel shown in the Sage channel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="admin-number-input-wrap">
                <label className="admin-number-input-label">Title</label>
                <input
                  type="text"
                  className="admin-number-input"
                  value={settings.panelTitle}
                  onChange={(e) => setSettings({ ...settings, panelTitle: e.target.value })}
                  placeholder="Panel title"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="admin-number-input-wrap">
                <label className="admin-number-input-label">Description</label>
                <input
                  type="text"
                  className="admin-number-input"
                  value={settings.panelDescription}
                  onChange={(e) => setSettings({ ...settings, panelDescription: e.target.value })}
                  placeholder="Panel description"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="admin-number-input-wrap">
                <label className="admin-number-input-label">Image URL</label>
                <input
                  type="text"
                  className="admin-number-input"
                  value={settings.panelImageUrl}
                  onChange={(e) => setSettings({ ...settings, panelImageUrl: e.target.value })}
                  placeholder="https://..."
                  style={{ width: '100%' }}
                />
                <span className="admin-number-input-desc">Image displayed in the panel embed</span>
              </div>
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <SaveDeployBar
            hasChanges={settingsChanged}
            saving={saving}
            onSave={saveConfig}
            projectName="Sage"
          />
        </>
      )}

      {/* System Prompt Tab */}
      {tab === 'system_prompt' && (
        <>
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
              }}>
                <span>{systemPrompt.length.toLocaleString()} characters</span>
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
            <div className="admin-number-input-wrap" style={{ marginTop: '12px' }}>
              <label className="admin-number-input-label">Lunarian Role ID</label>
              <input
                type="text"
                className="admin-number-input"
                value={privileges.lunarianRoleId}
                onChange={(e) => setPrivileges({ ...privileges, lunarianRoleId: e.target.value })}
                placeholder="Discord Role ID"
                style={{ width: '100%', maxWidth: '300px', fontFamily: 'monospace' }}
              />
              <span className="admin-number-input-desc">The Discord role ID for Lunarian members</span>
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <ConfigSection title="Privileged Roles" description="Roles with elevated access to Sage features">
            {privileges.privilegedRoles.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }}>
                No privileged roles configured. Click "Add Role" to add one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {privileges.privilegedRoles.map((role, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr auto',
                      gap: '8px',
                      alignItems: 'end',
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div className="admin-number-input-wrap">
                      <label className="admin-number-input-label">Role ID</label>
                      <input
                        type="text"
                        className="admin-number-input"
                        value={role.roleId}
                        onChange={(e) => updatePrivilegedRole(index, 'roleId', e.target.value)}
                        placeholder="Discord Role ID"
                        style={{ width: '100%', fontFamily: 'monospace' }}
                      />
                    </div>
                    <div className="admin-number-input-wrap">
                      <label className="admin-number-input-label">Title (Arabic)</label>
                      <input
                        type="text"
                        className="admin-number-input"
                        value={role.title}
                        onChange={(e) => updatePrivilegedRole(index, 'title', e.target.value)}
                        placeholder="العنوان"
                        style={{ width: '100%' }}
                        dir="rtl"
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
                      style={{ padding: '6px 12px', fontSize: '12px', color: '#f43f5e' }}
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

          <SaveDeployBar
            hasChanges={privilegesChanged}
            saving={saving}
            onSave={saveConfig}
            projectName="Sage"
          />
        </>
      )}
    </>
  );
}
