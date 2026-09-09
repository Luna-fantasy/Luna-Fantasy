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
import { adminFetch, adminPut } from '@/lib/admin/http';
import { uploadFileViaPresign } from '@/lib/admin/upload';

interface Props {
  butlerLayouts: CanvasLayouts;
  jesterLayouts: CanvasLayouts;
}

async function saveLayout(bot: 'butler' | 'jester', canvasType: string, layout: any): Promise<void> {
  await adminPut(`/api/admin/canvas/${bot}`, { canvasType, layout });
}

/** Best-effort natural-size read so the trial banner can warn on shape mismatch. */
async function measureImageFile(file: File): Promise<{ width: number; height: number } | null> {
  try {
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  } catch {
    return null;
  }
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
  const [trial, setTrial] = useState<{ url: string; key: string; filename: string; width?: number; height?: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clear the trial image when bot or canvas changes (and delete it from R2)
  const trialRef = useRef(trial);
  useEffect(() => { trialRef.current = trial; }, [trial]);

  useEffect(() => {
    const previousTrial = trialRef.current;
    if (previousTrial) {
      void adminFetch('/api/admin/canvas/upload-trial', {
        method: 'DELETE',
        body: { key: previousTrial.key },
      }).catch(() => { /* best-effort cleanup */ });
      setTrial(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot, canvasId]);

  // Cleanup on unmount — delete any active trial
  useEffect(() => {
    return () => {
      const t = trialRef.current;
      if (!t) return;
      void adminFetch('/api/admin/canvas/upload-trial', {
        method: 'DELETE',
        body: { key: t.key },
        keepalive: true,
      }).catch(() => { /* best-effort */ });
    };
  }, []);

  // NOTE: `canvas` can be undefined when a bot has zero definitions — every
  // derivation and callback below is null-safe, and the empty state renders
  // just before the JSX return (after all hooks, so hook order never varies).
  const currentLayout = canvas ? (drafts[bot][canvas.id] ?? canvas.defaultLayout) : {};
  const committedLayout = canvas ? (committedRef.current[bot][canvas.id] ?? canvas.defaultLayout) : {};
  const savedOverride = typeof currentLayout?._backgroundOverride === 'string' ? currentLayout._backgroundOverride : null;
  const effectiveBackgroundUrl = trial?.url ?? savedOverride ?? canvas?.backgroundUrl ?? '';
  const isDirty = JSON.stringify(currentLayout) !== JSON.stringify(committedLayout) || !!trial;

  const uploadTrial = async (file: File) => {
    if (!file || !canvas) return;
    setUploading(true);
    try {
      const dims = await measureImageFile(file);

      // Direct-to-R2 presign (was 8MB base64 through the server — full-size
      // canvas backgrounds are far bigger). Key mirrors the old route's shape
      // so the trial DELETE endpoint's canvas-trials/ guard keeps working.
      const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const key = `canvas-trials/${bot}/${canvas.id}/${Date.now()}-${safeName}`;
      const body = await uploadFileViaPresign(file, key);

      // If there was a previous trial, delete it first (best-effort)
      if (trial) {
        void adminFetch('/api/admin/canvas/upload-trial', {
          method: 'DELETE',
          body: { key: trial.key },
        }).catch(() => { /* best-effort */ });
      }

      setTrial({ url: body.publicUrl, key: body.key, filename: file.name, width: dims?.width, height: dims?.height });
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
      await adminFetch('/api/admin/canvas/upload-trial', {
        method: 'DELETE',
        body: { key: prev.key },
      });
    } catch { /* best-effort */ }
  };

  const commitSave = async () => {
    if (!isDirty || !canvas) return;
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
    if (!canvas) return;
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
    if (!canvas) return;
    history.reset(committedRef.current[bot][canvas.id] ?? canvas.defaultLayout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot, canvas?.id]);

  // Latest drafts, updated synchronously inside patchElement so rapid drag
  // frames compound instead of clobbering each other between renders.
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const patchElement = useCallback((elementId: string, patch: Record<string, number>) => {
    setActiveElementId(elementId);
    if (Object.keys(patch).length === 0 || !canvas) return;
    const d = draftsRef.current;
    const layout = d[bot][canvas.id] ?? canvas.defaultLayout;
    const currentEntry = getAtPath(layout, elementId) ?? {};
    const nextLayout = setAtPath(layout, elementId, { ...currentEntry, ...patch });
    const nextDrafts = { ...d, [bot]: { ...d[bot], [canvas.id]: nextLayout } };
    draftsRef.current = nextDrafts;
    // History push happens here, outside the state updater — updaters must be
    // pure (StrictMode double-invokes them, which duplicated undo entries).
    history.push(nextLayout);
    setDrafts(nextDrafts);
  }, [bot, canvas, history]);

  const handleMove = (elementId: string, patch: Partial<{
    x: number; y: number;
    startX: number; startY: number;
    width: number; height: number;
    radiusX: number; radiusY: number;
    fontSize: number;
  }>) => {
    patchElement(elementId, patch);
  };

  const patchColor = (key: string, value: string) => {
    if (!canvas) return;
    const nextColors = { ...(currentLayout.colors ?? {}), [key]: value };
    const nextLayout = { ...currentLayout, colors: nextColors };
    history.push(nextLayout);
    setDrafts((d) => ({ ...d, [bot]: { ...d[bot], [canvas.id]: nextLayout } }));
  };

  const resetDefaults = () => {
    if (!canvas) return;
    const nextLayout = { ...canvas.defaultLayout };
    history.push(nextLayout);
    setDrafts((d) => ({ ...d, [bot]: { ...d[bot], [canvas.id]: nextLayout } }));
    toast.show({ tone: 'info', title: 'Reset to defaults', message: `${canvas.label} — click Save to apply` });
  };

  // Mirror history.value → drafts so undo/redo visibly rewinds the canvas.
  // The guard below short-circuits when drafts was the source of a history
  // push (both point at the same reference) — prevents an infinite loop.
  useEffect(() => {
    if (!canvas) return;
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
    if (trial && canvas) set.add(canvas.id);
    return set;
  }, [defs, drafts, bot, trial, canvas?.id]);

  if (!canvas) {
    return <div className="av-commands-empty">No canvas definitions for this bot — nothing to render yet.</div>;
  }

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
              {trial.width && trial.height && (() => {
                const imgRatio = trial.width / trial.height;
                const canvasRatio = canvas.width / canvas.height;
                const matches = Math.abs(imgRatio - canvasRatio) / canvasRatio <= 0.02;
                return matches ? (
                  <span className="av-canvas-trial-dims">
                    Image is {trial.width}×{trial.height} — same shape as the canvas, it will fill it perfectly.
                  </span>
                ) : (
                  <span className="av-canvas-trial-dims av-canvas-trial-dims--warn">
                    Heads up: this image is {trial.width}×{trial.height} but the canvas is {canvas.width}×{canvas.height} —
                    a different shape. It shows with empty bars, here and in Discord alike, and elements land exactly
                    where you place them on it. For an edge-to-edge fit, use an image sized {canvas.width}×{canvas.height} (or the same shape).
                  </span>
                );
              })()}
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
          layoutOverride={currentLayout}
          onClose={() => setTestOpen(false)}
        />
      )}
    </section>
  );
}
