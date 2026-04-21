'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CANVAS_DEFINITIONS } from '@/lib/admin/canvas-definitions';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import CanvasStage from './CanvasStage';
import CanvasPropertiesPanel from './CanvasPropertiesPanel';
import CanvasTestDialog from './CanvasTestDialog';
import CanvasPicker from './CanvasPicker';
import { useCanvasHistory } from './useCanvasHistory';
import type { CanvasLayouts, CanvasTypeDef } from './types';
import { getAtPath, setAtPath } from './layoutPath';

interface Props {
  butlerLayouts: CanvasLayouts;
  jesterLayouts: CanvasLayouts;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function saveLayout(bot: 'butler' | 'jester', canvasType: string, layout: any): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch(`/api/admin/canvas/${bot}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ canvasType, layout }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
}

export default function CanvasEditorPanel({ butlerLayouts, jesterLayouts }: Props) {
  const toast = useToast();
  const undo = useUndo();

  const [bot, setBot] = useState<'butler' | 'jester'>('butler');
  const defs = useMemo(() => CANVAS_DEFINITIONS.filter((c) => c.bot === bot) as CanvasTypeDef[], [bot]);
  const [canvasId, setCanvasId] = useState<string>(defs[0]?.id ?? '');

  const [drafts, setDrafts] = useState<{ butler: CanvasLayouts; jester: CanvasLayouts }>({
    butler: butlerLayouts,
    jester: jesterLayouts,
  });
  const committedRef = useRef<{ butler: CanvasLayouts; jester: CanvasLayouts }>({
    butler: butlerLayouts,
    jester: jesterLayouts,
  });

  useEffect(() => {
    // Snap canvasId when bot changes
    if (!defs.some((c) => c.id === canvasId)) {
      setCanvasId(defs[0]?.id ?? '');
    }
  }, [defs, canvasId]);

  const canvas = defs.find((c) => c.id === canvasId) ?? defs[0];

  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [trial, setTrial] = useState<{ url: string; key: string; filename: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clear the trial image when bot or canvas changes (and delete it from R2)
  const trialRef = useRef(trial);
  useEffect(() => { trialRef.current = trial; }, [trial]);

  useEffect(() => {
    const previousTrial = trialRef.current;
    if (previousTrial) {
      void fetchCsrf().then((token) =>
        fetch('/api/admin/canvas/upload-trial', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
          credentials: 'include',
          body: JSON.stringify({ key: previousTrial.key }),
        }).catch(() => { /* best-effort cleanup */ })
      );
      setTrial(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot, canvasId]);

  // Cleanup on unmount — delete any active trial
  useEffect(() => {
    return () => {
      const t = trialRef.current;
      if (!t) return;
      void fetchCsrf().then((token) =>
        fetch('/api/admin/canvas/upload-trial', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
          credentials: 'include',
          body: JSON.stringify({ key: t.key }),
          keepalive: true,
        }).catch(() => { /* best-effort */ })
      );
    };
  }, []);

  if (!canvas) {
    return <div className="av-commands-empty">No canvas definitions for this bot — nothing to render yet.</div>;
  }

  const currentLayout = drafts[bot][canvas.id] ?? canvas.defaultLayout;
  const committedLayout = committedRef.current[bot][canvas.id] ?? canvas.defaultLayout;
  const savedOverride = typeof currentLayout?._backgroundOverride === 'string' ? currentLayout._backgroundOverride : null;
  const effectiveBackgroundUrl = trial?.url ?? savedOverride ?? canvas.backgroundUrl;
  const isDirty = JSON.stringify(currentLayout) !== JSON.stringify(committedLayout) || !!trial;

  const uploadTrial = async (file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.show({ tone: 'error', title: 'Too large', message: 'Max 8MB.' });
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result ?? '');
          const comma = result.indexOf(',');
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const token = await fetchCsrf();
      const res = await fetch('/api/admin/canvas/upload-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        credentials: 'include',
        body: JSON.stringify({
          bot,
          canvasType: canvas.id,
          imageData: base64,
          contentType: file.type || 'image/png',
          filename: file.name,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      // If there was a previous trial, delete it first (best-effort)
      if (trial) {
        void fetch('/api/admin/canvas/upload-trial', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
          credentials: 'include',
          body: JSON.stringify({ key: trial.key }),
        }).catch(() => { /* best-effort */ });
      }

      setTrial({ url: body.url, key: body.key, filename: file.name });
      toast.show({ tone: 'success', title: 'Trial uploaded', message: 'Click Save to make it official, or Test render to preview in Discord.' });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearTrial = async () => {
    if (!trial) return;
    const prev = trial;
    setTrial(null);
    try {
      const token = await fetchCsrf();
      await fetch('/api/admin/canvas/upload-trial', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        credentials: 'include',
        body: JSON.stringify({ key: prev.key }),
      });
    } catch { /* best-effort */ }
  };

  const commitSave = async () => {
    if (!isDirty) return;
    const snapBot = bot;
    const snapId = canvas.id;
    const current = drafts[snapBot][snapId] ?? canvas.defaultLayout;
    // Promote trial → saved _backgroundOverride before persisting
    const next = trial ? { ...current, _backgroundOverride: trial.url } : current;
    const before = committedRef.current[snapBot][snapId];
    try {
      await saveLayout(snapBot, snapId, next);
      // Reflect the promotion in both draft + committed state
      setDrafts((d) => ({ ...d, [snapBot]: { ...d[snapBot], [snapId]: next } }));
      committedRef.current = {
        ...committedRef.current,
        [snapBot]: { ...committedRef.current[snapBot], [snapId]: next },
      };
      // Trial is now the official background — clear the trial marker without deleting the R2 object
      if (trial) setTrial(null);
      toast.show({ tone: 'success', title: 'Saved', message: canvas.label });
      undo.push({
        label: `Restore ${canvas.label}`,
        detail: 'Rolls back to prior snapshot',
        revert: async () => {
          await saveLayout(snapBot, snapId, before);
          committedRef.current = {
            ...committedRef.current,
            [snapBot]: { ...committedRef.current[snapBot], [snapId]: before },
          };
          setDrafts((d) => ({ ...d, [snapBot]: { ...d[snapBot], [snapId]: before } }));
          toast.show({ tone: 'success', title: 'Reverted', message: canvas.label });
        },
      });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
    }
  };

  const discardChanges = () => {
    setDrafts((d) => ({
      ...d,
      [bot]: { ...d[bot], [canvas.id]: committedLayout },
    }));
    if (trial) void clearTrial();
    toast.show({ tone: 'info', title: 'Changes discarded', message: canvas.label });
  };

  // Undo/redo history scoped to the current canvas. Reset when bot or canvas
  // changes — cross-canvas undo would be confusing. Committed state from a
  // save also resets the history (implicitly, via effect below).
  const history = useCanvasHistory<any>(currentLayout);
  useEffect(() => {
    history.reset(committedRef.current[bot][canvas.id] ?? canvas.defaultLayout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot, canvas.id]);

  const patchElement = useCallback((elementId: string, patch: Record<string, number>) => {
    if (Object.keys(patch).length === 0) {
      setActiveElementId(elementId);
      return;
    }
    setActiveElementId(elementId);
    setDrafts((d) => {
      const layout = d[bot][canvas.id] ?? canvas.defaultLayout;
      const currentEntry = getAtPath(layout, elementId) ?? {};
      const nextEntry = { ...currentEntry, ...patch };
      const nextLayout = setAtPath(layout, elementId, nextEntry);
      history.push(nextLayout);
      return { ...d, [bot]: { ...d[bot], [canvas.id]: nextLayout } };
    });
  }, [bot, canvas.id, canvas.defaultLayout, history]);

  const handleMove = (elementId: string, patch: { x: number; y: number }) => {
    patchElement(elementId, patch);
  };

  const patchColor = (key: string, value: string) => {
    const nextColors = { ...(currentLayout.colors ?? {}), [key]: value };
    const nextLayout = { ...currentLayout, colors: nextColors };
    history.push(nextLayout);
    setDrafts((d) => ({ ...d, [bot]: { ...d[bot], [canvas.id]: nextLayout } }));
  };

  const resetDefaults = () => {
    const nextLayout = { ...canvas.defaultLayout };
    history.push(nextLayout);
    setDrafts((d) => ({ ...d, [bot]: { ...d[bot], [canvas.id]: nextLayout } }));
    toast.show({ tone: 'info', title: 'Reset to defaults', message: `${canvas.label} — click Save to apply` });
  };

  // Mirror history.value → drafts so undo/redo visibly rewinds the canvas.
  // The guard below short-circuits when drafts was the source of a history
  // push (both point at the same reference) — prevents an infinite loop.
  useEffect(() => {
    const committedForCurrent = drafts[bot][canvas.id];
    if (committedForCurrent === history.value) return;
    try {
      if (JSON.stringify(committedForCurrent) === JSON.stringify(history.value)) return;
    } catch { /* fall through */ }
    setDrafts((d) => ({ ...d, [bot]: { ...d[bot], [canvas.id]: history.value } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.value]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // Keyboard nudge + undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      // Undo / Redo — only when not typing in a field
      if (!inInput && (e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) {
          if (history.canUndo) { e.preventDefault(); history.undo(); }
          return;
        }
        if ((k === 'z' && e.shiftKey) || k === 'y') {
          if (history.canRedo) { e.preventDefault(); history.redo(); }
          return;
        }
      }

      // Arrow-key nudge — needs an active element
      if (!activeElementId) return;
      if (inInput) return;
      const step = e.shiftKey ? 10 : 1;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft')  dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp')    dy = -step;
      else if (e.key === 'ArrowDown')  dy = step;
      else return;
      e.preventDefault();
      const entry = getAtPath(currentLayout, activeElementId) ?? {};
      patchElement(activeElementId, {
        x: Math.round(Number(entry.x ?? 0) + dx),
        y: Math.round(Number(entry.y ?? 0) + dy),
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeElementId, currentLayout, patchElement, history]);

  const butlerCount = useMemo(() => CANVAS_DEFINITIONS.filter((c) => c.bot === 'butler').length, []);
  const jesterCount = useMemo(() => CANVAS_DEFINITIONS.filter((c) => c.bot === 'jester').length, []);

  // Compute which canvas IDs (for the current bot) have unsaved edits so the
  // picker can show a marker next to them.
  const dirtyIds = useMemo(() => {
    const set = new Set<string>();
    const current = drafts[bot];
    const committed = committedRef.current[bot];
    for (const def of defs) {
      const a = current[def.id] ?? def.defaultLayout;
      const b = committed[def.id] ?? def.defaultLayout;
      if (JSON.stringify(a) !== JSON.stringify(b)) set.add(def.id);
    }
    if (trial) set.add(canvas.id);
    return set;
  }, [defs, drafts, bot, trial, canvas.id]);

  return (
    <section className="av-media av-media-canvas">
      <div className="av-media-canvas-layout">
        <CanvasPicker
          defs={defs}
          bot={bot}
          canvasId={canvas.id}
          butlerCount={butlerCount}
          jesterCount={jesterCount}
          onBot={(b) => { setBot(b); setActiveElementId(null); }}
          onPick={(id) => { setCanvasId(id); setActiveElementId(null); }}
          dirtyIds={dirtyIds}
        />

        <div className="av-media-canvas-main">
          <div className="av-media-canvas-toolbar">
            <div className="av-media-canvas-heading">
              <h3 className="av-media-canvas-title">{canvas.label}</h3>
              <span className="av-media-canvas-id">{canvas.id}</span>
            </div>
            <div className="av-media-canvas-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadTrial(file);
                }}
              />
              <button
                type="button"
                className="av-btn av-btn-ghost av-btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Upload a trial background to preview. Nothing saves until you click Save."
              >
                {uploading ? '⏳ Uploading…' : trial ? '🖼 Replace trial' : '🖼 Upload trial'}
              </button>
              {trial && (
                <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => void clearTrial()}>
                  ✕ Clear trial
                </button>
              )}
              <button
                type="button"
                className="av-btn av-btn-ghost av-btn-sm"
                onClick={() => history.undo()}
                disabled={!history.canUndo}
                title="Undo last edit (Ctrl+Z)"
                aria-label="Undo"
              >↶ Undo</button>
              <button
                type="button"
                className="av-btn av-btn-ghost av-btn-sm"
                onClick={() => history.redo()}
                disabled={!history.canRedo}
                title="Redo (Ctrl+Shift+Z or Ctrl+Y)"
                aria-label="Redo"
              >↷ Redo</button>
              <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={resetDefaults}>↺ Reset defaults</button>
              {isDirty && (
                <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={discardChanges}>✕ Discard</button>
              )}
              <button
                type="button"
                className={`av-btn av-btn-primary av-btn-sm${isDirty ? ' av-canvas-save-dirty' : ''}`}
                onClick={commitSave}
                disabled={!isDirty}
                title={isDirty ? 'Save all changes' : 'No changes to save'}
              >
                {isDirty ? '● Save changes' : '✓ Saved'}
              </button>
              <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => setTestOpen(true)}>Test render ↗</button>
            </div>
          </div>

          {trial && (
            <div className="av-canvas-trial-banner" role="status">
              <strong>Trial image active</strong>
              <span>
                Previewing <code>{trial.filename}</code> on the canvas. This is local-only — test render uses it,
                but nothing on R2 or the DB changes until you click <strong>Save changes</strong>. Leaving this page discards the trial.
              </span>
            </div>
          )}
          {isDirty && (
            <div className="av-canvas-dirty-banner" role="status">
              <strong>Unsaved changes</strong>
              <span>You have made edits to <code>{canvas.label}</code>. Click <strong>Save changes</strong> to apply them, or <strong>Discard</strong> to revert.</span>
            </div>
          )}

          <div className="av-media-canvas-body">
            <CanvasStage
              canvas={canvas}
              layout={currentLayout}
              activeElementId={activeElementId}
              onSelectElement={setActiveElementId}
              onMove={handleMove}
              backgroundOverrideUrl={effectiveBackgroundUrl !== canvas.backgroundUrl ? effectiveBackgroundUrl : null}
            />
            <CanvasPropertiesPanel
              canvas={canvas}
              layout={currentLayout}
              activeElementId={activeElementId}
              onPatchElement={patchElement}
              onPatchColor={patchColor}
            />
          </div>
        </div>
      </div>

      {testOpen && (
        <CanvasTestDialog
          bot={bot}
          canvasType={canvas.id}
          canvasLabel={canvas.label}
          trialBackgroundUrl={trial?.url ?? null}
          onClose={() => setTestOpen(false)}
        />
      )}
    </section>
  );
}
