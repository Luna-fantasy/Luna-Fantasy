'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminGet, adminPut } from '@/lib/admin/http';
import { uploadFileViaPresign, fileExtension } from '@/lib/admin/upload';
import ToggleCard from '../games/fields/ToggleCard';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';

type CategoryKey = 'staff' | 'wizard';

interface PanelFields {
  title: string;
  description: string;
  image: string;
  enabled: boolean;
}

interface PanelMeta {
  key: CategoryKey;
  section: 'app_panel_staff' | 'app_panel_wizard';
  name: string;
  glyph: string;
  tone: string;
  blurb: string;
  /** R2 file name under butler/applications/ — matches the original assets */
  fileBase: string;
}

const PANELS: PanelMeta[] = [
  {
    key: 'staff',
    section: 'app_panel_staff',
    name: 'Luna Knight',
    glyph: '🛡️',
    tone: '#00D4FF',
    blurb: 'Staff recruitment — "become a Luna Knight". Posted in Discord with /support → Knight.',
    fileBase: 'Application',
  },
  {
    key: 'wizard',
    section: 'app_panel_wizard',
    name: 'Luna Wizard',
    glyph: '🧙',
    tone: '#B066FF',
    blurb: 'Community-team recruitment — "become a Luna Wizard". Posted in Discord with /support → Wizard.',
    fileBase: 'Application-Wizard',
  },
];

const EMPTY: PanelFields = { title: '', description: '', image: '', enabled: true };

function readCategory(raw: any): PanelFields {
  return {
    title: typeof raw?.title === 'string' ? raw.title : '',
    description: typeof raw?.description === 'string' ? raw.description : '',
    image: typeof raw?.image === 'string' ? raw.image : '',
    enabled: raw?.enabled !== false,
  };
}

export default function ApplicationPanelsClient() {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();

  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<Record<CategoryKey, PanelFields>>({ staff: EMPTY, wizard: EMPTY });
  const [draft, setDraft] = useState<Record<CategoryKey, PanelFields>>({ staff: EMPTY, wizard: EMPTY });
  const [uploadingKey, setUploadingKey] = useState<CategoryKey | null>(null);
  // Bumped after an upload so the preview <img> skips the browser cache
  const [previewVersion, setPreviewVersion] = useState<Record<CategoryKey, number>>({ staff: 0, wizard: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await adminGet<any>('/api/admin/config/butler');
      const categories = body?.sections?.applications_system?.categories ?? {};
      const next: Record<CategoryKey, PanelFields> = {
        staff: readCategory(categories.staff),
        wizard: readCategory(categories.wizard),
      };
      setSaved(next);
      setDraft(next);
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const updateDraft = (key: CategoryKey, patch: Partial<PanelFields>) => {
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  };

  const save = (meta: PanelMeta) => {
    const prev = saved[meta.key];
    const next = draft[meta.key];

    // Only send what actually changed — the API writes each key as its own
    // surgical dot-path update.
    const payload: Record<string, string | boolean> = {};
    if (next.title !== prev.title) payload.title = next.title;
    if (next.description !== prev.description) payload.description = next.description;
    if (next.enabled !== prev.enabled) payload.enabled = next.enabled;
    if (Object.keys(payload).length === 0) return;

    if (typeof payload.title === 'string' && !payload.title.trim()) {
      toast.show({ tone: 'error', title: 'Title required', message: 'The panel title cannot be empty.' });
      return;
    }
    if (typeof payload.description === 'string' && !payload.description.trim()) {
      toast.show({ tone: 'error', title: 'Description required', message: 'The panel description cannot be empty.' });
      return;
    }

    const statusChanged = payload.enabled !== undefined;
    pending.queue({
      label: `Save ${meta.name} panel`,
      detail: statusChanged
        ? (next.enabled ? 'Submissions will OPEN · panel updates in ~20s' : 'Submissions will CLOSE · panel updates in ~20s')
        : 'Discord panel updates in ~20s',
      delayMs: 4500,
      run: async () => {
        try {
          await adminPut('/api/admin/config/butler', { section: meta.section, value: payload });
          setSaved((s) => ({ ...s, [meta.key]: next }));
          toast.show({ tone: 'success', title: 'Saved', message: `${meta.name} panel updated — Discord refreshes within ~20s` });
          undo.push({
            label: `Restore previous ${meta.name} panel`,
            detail: 'One-click revert',
            revert: async () => {
              const revertPayload: Record<string, string | boolean> = {};
              if (payload.title !== undefined) revertPayload.title = prev.title;
              if (payload.description !== undefined) revertPayload.description = prev.description;
              if (payload.enabled !== undefined) revertPayload.enabled = prev.enabled;
              await adminPut('/api/admin/config/butler', { section: meta.section, value: revertPayload });
              setSaved((s) => ({ ...s, [meta.key]: { ...s[meta.key], ...prev } }));
              setDraft((d) => ({ ...d, [meta.key]: { ...d[meta.key], ...prev } }));
              toast.show({ tone: 'success', title: 'Reverted', message: `${meta.name} panel restored` });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const discard = (key: CategoryKey) => {
    setDraft((d) => ({ ...d, [key]: saved[key] }));
  };

  const handleFile = async (meta: PanelMeta, file: File) => {
    setUploadingKey(meta.key);
    try {
      const key = `butler/applications/${meta.fileBase}.${fileExtension(file)}`;
      const { publicUrl } = await uploadFileViaPresign(file, key);
      await adminPut('/api/admin/config/butler', { section: meta.section, value: { image: publicUrl } });
      setSaved((s) => ({ ...s, [meta.key]: { ...s[meta.key], image: publicUrl } }));
      setDraft((d) => ({ ...d, [meta.key]: { ...d[meta.key], image: publicUrl } }));
      setPreviewVersion((v) => ({ ...v, [meta.key]: Date.now() }));
      toast.show({ tone: 'success', title: 'Artwork updated', message: `${meta.name} panel image saved — Discord refreshes within ~20s` });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setUploadingKey(null);
    }
  };

  if (loading) return <div className="av-commands-empty">Loading application panels…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p className="av-text-muted" style={{ margin: 0, fontSize: 13 }}>
        Heads-up: a panel posted <strong>before</strong> this feature isn&apos;t linked for live updates yet.
        Run <code>/support</code> once in Discord to re-post it — from then on, every change saved here
        edits the posted panel in place.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        {PANELS.map((meta) => {
          const d = draft[meta.key];
          const s = saved[meta.key];
          const dirty = d.title !== s.title || d.description !== s.description || d.enabled !== s.enabled;
          const notSeeded = !s.title.trim() && !s.description.trim();
          return (
            <PanelCard
              key={meta.key}
              meta={meta}
              draft={d}
              savedEnabled={s.enabled}
              dirty={dirty}
              notSeeded={notSeeded}
              uploading={uploadingKey === meta.key}
              previewVersion={previewVersion[meta.key]}
              onChange={(patch) => updateDraft(meta.key, patch)}
              onSave={() => save(meta)}
              onDiscard={() => discard(meta.key)}
              onFile={(f) => void handleFile(meta, f)}
            />
          );
        })}
      </div>
    </div>
  );
}

function PanelCard({
  meta,
  draft,
  savedEnabled,
  dirty,
  notSeeded,
  uploading,
  previewVersion,
  onChange,
  onSave,
  onDiscard,
  onFile,
}: {
  meta: PanelMeta;
  draft: PanelFields;
  savedEnabled: boolean;
  dirty: boolean;
  notSeeded: boolean;
  uploading: boolean;
  previewVersion: number;
  onChange: (patch: Partial<PanelFields>) => void;
  onSave: () => void;
  onDiscard: () => void;
  onFile: (f: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const previewUrl = draft.image
    ? (previewVersion && !draft.image.includes('?') ? `${draft.image}?v=${previewVersion}` : draft.image)
    : '';

  return (
    <article className="av-surface" style={{ borderColor: `${meta.tone}33`, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span
            aria-hidden="true"
            style={{
              fontSize: 22, width: 42, height: 42, display: 'grid', placeItems: 'center',
              borderRadius: 10, background: `${meta.tone}1c`, border: `1px solid ${meta.tone}44`,
            }}
          >
            {meta.glyph}
          </span>
          <div>
            <h3 style={{ margin: 0 }}>{meta.name}</h3>
            <p className="av-text-muted" style={{ margin: '2px 0 0', fontSize: 12.5 }}>{meta.blurb}</p>
          </div>
        </div>
        <span
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', padding: '4px 10px', borderRadius: 999,
            whiteSpace: 'nowrap',
            color: savedEnabled ? '#22e58c' : '#ff5c7a',
            background: savedEnabled ? 'rgba(34,229,140,0.12)' : 'rgba(255,92,122,0.12)',
            border: `1px solid ${savedEnabled ? 'rgba(34,229,140,0.35)' : 'rgba(255,92,122,0.35)'}`,
          }}
        >
          {savedEnabled ? 'OPEN' : 'CLOSED'}
        </span>
      </header>

      {notSeeded && (
        <p className="av-text-muted" style={{ margin: 0, fontSize: 12.5 }}>
          No saved text yet — the bot is still using its built-in defaults. Fill the fields below and save to take over from the dashboard.
        </p>
      )}

      <div>
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Panel artwork</label>
        <div
          style={{
            borderRadius: 12, overflow: 'hidden', border: `1px solid ${meta.tone}33`,
            background: 'rgba(0,0,0,0.25)', display: 'grid', placeItems: 'center', minHeight: 120,
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`${meta.name} panel artwork`}
              style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <span className="av-text-muted" style={{ fontSize: 12.5, padding: 20 }}>No image set</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="av-btn av-btn-ghost av-btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : draft.image ? '⬆ Replace artwork' : '⬆ Upload artwork'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
        </div>
        <p className="av-text-muted" style={{ margin: '6px 0 0', fontSize: 11.5 }}>
          Uploads save immediately and replace the image on the posted panel.
        </p>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
          Panel title <span className="av-text-muted" style={{ fontWeight: 400 }}>(Arabic, shown as the panel header)</span>
        </label>
        <input
          type="text"
          className="av-shopf-input"
          dir="rtl"
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          maxLength={200}
          style={{ width: '100%' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
          Panel description <span className="av-text-muted" style={{ fontWeight: 400 }}>(Arabic, the &quot;about applying&quot; section)</span>
        </label>
        <textarea
          className="av-shopf-input"
          dir="rtl"
          rows={5}
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          maxLength={2000}
          style={{ width: '100%', resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Submissions</label>
        <ToggleCard
          value={draft.enabled}
          onChange={(next) => onChange({ enabled: next })}
          onLabel="Open — members can apply"
          offLabel="Closed — panel shows a lock and the button is disabled"
        />
      </div>

      <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'auto' }}>
        {dirty && (
          <button type="button" className="av-btn av-btn-ghost" onClick={onDiscard}>Discard</button>
        )}
        <button type="button" className="av-btn av-btn-primary" onClick={onSave} disabled={!dirty}>
          {dirty ? 'Save changes' : 'Saved'}
        </button>
      </footer>
    </article>
  );
}
