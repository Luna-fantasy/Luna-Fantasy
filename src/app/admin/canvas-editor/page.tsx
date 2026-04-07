'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CANVAS_DEFINITIONS, type CanvasTypeDef } from '@/lib/admin/canvas-definitions';
import CanvasPreview from './CanvasPreview';
import CanvasSelector from './CanvasSelector';
import CanvasToolbar from './CanvasToolbar';
import ElementListPanel from './ElementListPanel';
import ElementPropertiesPanel from './ElementPropertiesPanel';
import FakePreview from './FakePreview';
import TestDeployModal from './TestDeployModal';
import SaveDeployBar from '../components/SaveDeployBar';
import AdminLightbox from '../components/AdminLightbox';
import { getCsrfToken } from '../utils/csrf';

const LEADERBOARD_BACKGROUNDS = [
  { label: 'Lunari Leaderboard', url: 'https://assets.lunarian.app/butler/leaderboard/Leaderboard-for-Money.png' },
  { label: 'Levels Leaderboard', url: 'https://assets.lunarian.app/butler/leaderboard/Leaderboard-for-Level.png' },
  { label: 'Fantasy Leaderboard', url: 'https://assets.lunarian.app/canvas-backgrounds/jester/fantasy_leaderboard.png' },
];

type BotLayouts = Record<string, Record<string, any>>;

const MAX_UNDO = 50;

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Walk layout to get/set a nested value by dot-separated path
function getNestedValue(obj: Record<string, any>, path: string): Record<string, number> {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return {};
    cur = cur[p];
  }
  if (!cur || typeof cur !== 'object') return {};
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(cur)) {
    if (typeof v === 'number') result[k] = v;
  }
  return result;
}

function setNestedValue(obj: Record<string, any>, path: string, values: Record<string, number>): Record<string, any> {
  const clone = deepClone(obj);
  const parts = path.split('.');
  let cur = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  const lastKey = parts[parts.length - 1];
  cur[lastKey] = { ...(cur[lastKey] || {}), ...values };
  return clone;
}

// Compute diff for save review
function computeLayoutDiff(
  original: Record<string, any>,
  current: Record<string, any>,
  prefix = ''
): { label: string; before: string; after: string }[] {
  const diffs: { label: string; before: string; after: string }[] = [];

  const allKeys = Array.from(new Set([...Object.keys(original), ...Object.keys(current)]));
  for (const key of allKeys) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const a = original[key];
    const b = current[key];

    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      diffs.push(...computeLayoutDiff(a, b, fullKey));
    } else if (a !== b) {
      diffs.push({ label: fullKey, before: String(a ?? '—'), after: String(b ?? '—') });
    }
  }
  return diffs;
}

export default function CanvasEditorPage() {
  const [activeBot, setActiveBot] = useState<'butler' | 'jester'>('butler');
  const [activeCanvasId, setActiveCanvasId] = useState(CANVAS_DEFINITIONS[0].id);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Server-side layout data per bot
  const [serverLayouts, setServerLayouts] = useState<Record<string, BotLayouts>>({});
  // Edited layout data per canvas type
  const [editedLayouts, setEditedLayouts] = useState<Record<string, Record<string, any>>>({});
  // Edited colors per canvas type
  const [editedColors, setEditedColors] = useState<Record<string, Record<string, string>>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const canvasWrapRef = useRef<HTMLDivElement>(null);

  // Compute a zoom level that fits the entire canvas (including height) within the viewport
  function computeFitZoom(def?: CanvasTypeDef): number {
    if (typeof window === 'undefined') return 1;
    const d = def ?? activeDef;
    const containerWidth = canvasWrapRef.current?.clientWidth ?? window.innerWidth * 0.5;
    const availableHeight = window.innerHeight - 340;
    const baseScale = containerWidth / d.width;
    const displayHeight = d.height * baseScale;
    if (displayHeight <= availableHeight) return 1;
    return Math.max(0.25, availableHeight / displayHeight);
  }
  const loadedBots = useRef<Set<string>>(new Set());
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Undo/redo history per canvas type
  const [undoStacks, setUndoStacks] = useState<Record<string, Record<string, any>[]>>({});
  const [redoStacks, setRedoStacks] = useState<Record<string, Record<string, any>[]>>({});
  // Custom background URLs from layout.backgroundUrl
  const [customBackgrounds, setCustomBackgrounds] = useState<Record<string, string>>({});
  // Canvas switch confirmation modal
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  // Hidden elements (local UI only, not saved)
  const [hiddenElements, setHiddenElements] = useState<Set<string>>(new Set());
  // Preview mode (hides all overlays)
  const [previewMode, setPreviewMode] = useState(false);
  // Fake preview lightbox
  const [showFakePreview, setShowFakePreview] = useState(false);
  // Test deploy modal
  const [showTestDeploy, setShowTestDeploy] = useState(false);
  // First-visit onboarding (deferred to avoid hydration mismatch)
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Copied element position for paste between elements
  const copiedValuesRef = useRef<Record<string, number> | null>(null);
  const [copiedValues, setCopiedValues] = useState<Record<string, number> | null>(null);

  const activeDef = CANVAS_DEFINITIONS.find(d => d.id === activeCanvasId)!;
  // Undo debounce ref
  const lastUndoPushRef = useRef(0);
  // Ref for keyboard handler state (avoids re-registering on every render)
  const keyboardStateRef = useRef<any>({});

  // Load layouts for a bot
  const loadBot = useCallback(async (bot: string) => {
    if (loadedBots.current.has(bot)) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/canvas/${bot}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setServerLayouts(prev => ({ ...prev, [bot]: data.layouts ?? {} }));
      loadedBots.current.add(bot);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBot(activeBot); }, [activeBot, loadBot]);

  // Read localStorage after hydration to avoid server/client mismatch
  useEffect(() => {
    if (!localStorage.getItem('ce-onboarding-seen')) setShowOnboarding(true);
    // Auto-fit zoom on first load
    setZoom(computeFitZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get the effective layout for a canvas type (edited > server > defaults)
  function getEffectiveLayout(canvasId: string): Record<string, any> {
    if (editedLayouts[canvasId]) return editedLayouts[canvasId];
    const def = CANVAS_DEFINITIONS.find(d => d.id === canvasId);
    if (!def) return {};
    const server = serverLayouts[def.bot]?.[canvasId];
    if (server) {
      // Deep merge: server overrides defaults for present keys
      return deepMerge(deepClone(def.defaultLayout), server);
    }
    return deepClone(def.defaultLayout);
  }

  function getEffectiveColors(canvasId: string): Record<string, string> {
    if (editedColors[canvasId]) return editedColors[canvasId];
    const def = CANVAS_DEFINITIONS.find(d => d.id === canvasId);
    if (!def) return {};
    const server = serverLayouts[def.bot]?.[canvasId];
    if (server?.colors) return { ...server.colors };
    // Return defaults from colorKeys
    const defaults: Record<string, string> = {};
    for (const ck of def?.colorKeys ?? []) defaults[ck.key] = ck.default;
    return defaults;
  }

  const currentLayout = getEffectiveLayout(activeCanvasId);
  const currentColors = getEffectiveColors(activeCanvasId);

  // Has user made changes?
  const hasChanges = !!editedLayouts[activeCanvasId] || !!editedColors[activeCanvasId];
  const hasAnyChanges = Object.keys(editedLayouts).length > 0 || Object.keys(editedColors).length > 0;

  // Push current state to undo stack before a change (debounced to prevent flood on key hold)
  function pushUndo() {
    const now = Date.now();
    if (now - lastUndoPushRef.current < 300) return;
    lastUndoPushRef.current = now;
    const snapshot = deepClone({ layout: currentLayout, colors: currentColors });
    setUndoStacks(prev => {
      const stack = [...(prev[activeCanvasId] || []), snapshot].slice(-MAX_UNDO);
      return { ...prev, [activeCanvasId]: stack };
    });
    setRedoStacks(prev => ({ ...prev, [activeCanvasId]: [] }));
  }

  // Undo
  function handleUndo() {
    const stack = undoStacks[activeCanvasId];
    if (!stack || stack.length === 0) return;
    const prev = stack[stack.length - 1];
    // Push current to redo
    const snapshot = deepClone({ layout: currentLayout, colors: currentColors });
    setRedoStacks(p => ({ ...p, [activeCanvasId]: [...(p[activeCanvasId] || []), snapshot] }));
    // Restore
    setEditedLayouts(p => ({ ...p, [activeCanvasId]: prev.layout }));
    setEditedColors(p => ({ ...p, [activeCanvasId]: prev.colors }));
    setUndoStacks(p => ({ ...p, [activeCanvasId]: stack.slice(0, -1) }));
  }

  // Redo
  function handleRedo() {
    const stack = redoStacks[activeCanvasId];
    if (!stack || stack.length === 0) return;
    const next = stack[stack.length - 1];
    // Push current to undo
    const snapshot = deepClone({ layout: currentLayout, colors: currentColors });
    setUndoStacks(p => ({ ...p, [activeCanvasId]: [...(p[activeCanvasId] || []), snapshot] }));
    // Restore
    setEditedLayouts(p => ({ ...p, [activeCanvasId]: next.layout }));
    setEditedColors(p => ({ ...p, [activeCanvasId]: next.colors }));
    setRedoStacks(p => ({ ...p, [activeCanvasId]: stack.slice(0, -1) }));
  }

  // Handle element position/size change
  function handleElementChange(elementId: string, newValues: Record<string, number>) {
    pushUndo();
    const updated = setNestedValue(currentLayout, elementId, newValues);
    setEditedLayouts(prev => ({ ...prev, [activeCanvasId]: updated }));
  }

  // Handle color change
  function handleColorChange(key: string, value: string) {
    pushUndo();
    const updated = { ...currentColors, [key]: value };
    setEditedColors(prev => ({ ...prev, [activeCanvasId]: updated }));
  }

  // Background upload via R2
  async function handleBackgroundUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large (max 10MB)');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const r2Key = `canvas-backgrounds/${activeDef.bot}/${activeDef.id}.png`;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('key', r2Key);

      const res = await fetch('/api/admin/assets/upload', {
        method: 'POST',
        headers: { 'x-csrf-token': getCsrfToken() },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      const newUrl = data.url + '?v=' + Date.now();

      // Store in layout so it persists when saved
      setCustomBackgrounds(prev => ({ ...prev, [activeCanvasId]: newUrl }));

      // Also mark layout as edited so backgroundUrl is included in save
      // Append ?v= timestamp so the bot's in-memory cache busts on re-deploy
      const updated = { ...currentLayout, backgroundUrl: data.url + '?v=' + Date.now() };
      setEditedLayouts(prev => ({ ...prev, [activeCanvasId]: updated }));

      setToast('Background uploaded. Save to apply.');
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  // Save to MongoDB
  async function handleSave(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const layoutToSave = {
        ...(editedLayouts[activeCanvasId] || currentLayout),
        colors: editedColors[activeCanvasId] || currentColors,
      };

      const res = await fetch(`/api/admin/canvas/${activeDef.bot}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({
          canvasType: activeCanvasId,
          layout: layoutToSave,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(data.error || 'Save failed');
      }

      // Update server state, clear edits
      setServerLayouts(prev => ({
        ...prev,
        [activeDef.bot]: {
          ...prev[activeDef.bot],
          [activeCanvasId]: layoutToSave,
        },
      }));
      setEditedLayouts(prev => {
        const next = { ...prev };
        delete next[activeCanvasId];
        return next;
      });
      setEditedColors(prev => {
        const next = { ...prev };
        delete next[activeCanvasId];
        return next;
      });
      setToast('Saved! Bots will pick up changes within 30 seconds.');
      setTimeout(() => setToast(null), 4000);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Discard changes
  function handleDiscard() {
    setEditedLayouts(prev => {
      const next = { ...prev };
      delete next[activeCanvasId];
      return next;
    });
    setEditedColors(prev => {
      const next = { ...prev };
      delete next[activeCanvasId];
      return next;
    });
    setSelectedElementId(null);
  }

  // Reset to defaults
  function handleResetToDefaults() {
    setEditedLayouts(prev => ({
      ...prev,
      [activeCanvasId]: deepClone(activeDef.defaultLayout),
    }));
    const defaults: Record<string, string> = {};
    for (const ck of activeDef.colorKeys) defaults[ck.key] = ck.default;
    setEditedColors(prev => ({ ...prev, [activeCanvasId]: defaults }));
  }

  // Switch canvas type (with unsaved changes guard)
  function switchCanvas(id: string) {
    const def = CANVAS_DEFINITIONS.find(d => d.id === id);
    if (!def) return;
    if (hasChanges) {
      setPendingSwitchId(id);
      setShowSwitchConfirm(true);
      return;
    }
    doSwitch(id);
  }

  function doSwitch(id: string) {
    const def = CANVAS_DEFINITIONS.find(d => d.id === id);
    if (!def) return;
    if (def.bot !== activeBot) setActiveBot(def.bot);
    setActiveCanvasId(id);
    setSelectedElementId(null);
    setHiddenElements(new Set());
    setZoom(computeFitZoom(def));
  }

  function handleToggleVisibility(elementId: string) {
    setHiddenElements(prev => {
      const next = new Set(prev);
      if (next.has(elementId)) next.delete(elementId);
      else next.add(elementId);
      return next;
    });
  }

  // Reset a single element to its default values
  function handleResetElement() {
    if (!selectedElementId) return;
    const defaults = getNestedValue(activeDef.defaultLayout, selectedElementId);
    if (Object.keys(defaults).length > 0) {
      handleElementChange(selectedElementId, defaults);
    }
  }

  // Copy/paste position values between elements
  function handleCopyPosition() {
    if (!selectedElementId) return;
    const vals = getNestedValue(currentLayout, selectedElementId);
    copiedValuesRef.current = { ...vals };
    setCopiedValues({ ...vals });
  }

  function handlePastePosition() {
    if (!selectedElementId || !copiedValuesRef.current) return;
    handleElementChange(selectedElementId, { ...selectedValues, ...copiedValuesRef.current });
  }

  function handlePasteX() {
    if (!selectedElementId || !copiedValuesRef.current?.x) return;
    handleElementChange(selectedElementId, { ...selectedValues, x: copiedValuesRef.current.x });
  }

  function handlePasteY() {
    if (!selectedElementId || !copiedValuesRef.current?.y) return;
    handleElementChange(selectedElementId, { ...selectedValues, y: copiedValuesRef.current.y });
  }

  async function handleSwitchSave() {
    const ok = await handleSave();
    if (!ok) return;
    setShowSwitchConfirm(false);
    if (pendingSwitchId) doSwitch(pendingSwitchId);
    setPendingSwitchId(null);
  }

  function handleSwitchDiscard() {
    handleDiscard();
    setShowSwitchConfirm(false);
    if (pendingSwitchId) doSwitch(pendingSwitchId);
    setPendingSwitchId(null);
  }

  function handleSwitchCancel() {
    setShowSwitchConfirm(false);
    setPendingSwitchId(null);
  }

  // Get selected element values
  const selectedElement = activeDef.elements.find(e => e.id === selectedElementId) ?? null;
  const selectedValues = selectedElementId ? getNestedValue(currentLayout, selectedElementId) : {};

  // Count how many fields changed for a given canvas (used for tab badges)
  function getChangedCount(canvasId: string): number {
    if (!editedLayouts[canvasId] && !editedColors[canvasId]) return 0;
    const base = { ...getBaseLayout(canvasId), colors: getBaseColors(canvasId) };
    const current = {
      ...(editedLayouts[canvasId] || getBaseLayout(canvasId)),
      colors: editedColors[canvasId] || getBaseColors(canvasId),
    };
    return computeLayoutDiff(base, current).length;
  }

  // Compute diff for review
  const diff = hasChanges
    ? computeLayoutDiff(
        { ...getBaseLayout(activeCanvasId), colors: getBaseColors(activeCanvasId) },
        { ...currentLayout, colors: currentColors }
      )
    : [];

  function getBaseLayout(canvasId: string): Record<string, any> {
    const def = CANVAS_DEFINITIONS.find(d => d.id === canvasId)!;
    const server = serverLayouts[def.bot]?.[canvasId];
    return server ? deepMerge(deepClone(def.defaultLayout), server) : deepClone(def.defaultLayout);
  }

  function getBaseColors(canvasId: string): Record<string, string> {
    const def = CANVAS_DEFINITIONS.find(d => d.id === canvasId)!;
    const server = serverLayouts[def.bot]?.[canvasId];
    if (server?.colors) return { ...server.colors };
    const defaults: Record<string, string> = {};
    for (const ck of def.colorKeys) defaults[ck.key] = ck.default;
    return defaults;
  }

  // Keep keyboard state ref in sync for the handler
  keyboardStateRef.current = {
    selectedElementId, selectedElement, currentLayout,
    handleElementChange, handleUndo, handleRedo, previewMode, setPreviewMode,
  };

  // Keyboard: arrow keys nudge, Ctrl+Z undo, Ctrl+Y redo, Escape exits preview (registered once via ref)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const s = keyboardStateRef.current;

      // Escape exits preview mode
      if (e.key === 'Escape' && s.previewMode) {
        e.preventDefault();
        s.setPreviewMode(false);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        s.handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        s.handleRedo();
        return;
      }

      if (!s.selectedElementId || !s.selectedElement) return;
      const step = e.shiftKey ? 10 : 1;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;

      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      e.preventDefault();
      const vals = getNestedValue(s.currentLayout, s.selectedElementId);
      s.handleElementChange(s.selectedElementId, {
        ...vals,
        x: (vals.x ?? 0) + dx,
        y: (vals.y ?? 0) + dy,
      });
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn on browser navigation with unsaved changes
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    if (hasAnyChanges) {
      window.addEventListener('beforeunload', onBeforeUnload);
      return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }
  }, [hasAnyChanges]);

  return (
    <div className="ce-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">🎨</span> Canvas Editor</h1>
        <p className="admin-page-subtitle">
          Drag elements to reposition, or use precise inputs. Changes are live within 30s.
        </p>
      </div>

      {error && (
        <div className="admin-alert admin-alert-danger" style={{ marginBottom: 16 }}>
          {error}
          <button className="admin-alert-close" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {toast && (
        <div className="admin-alert admin-alert-success" style={{ marginBottom: 16 }}>
          {toast}
        </div>
      )}

      {/* Canvas selector + Toolbar */}
      <div className="ce-header-row">
        <CanvasSelector
          activeCanvasId={activeCanvasId}
          onSwitch={switchCanvas}
          getChangedCount={getChangedCount}
        />
      </div>

      <input
        ref={bgInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleBackgroundUpload(f);
          e.target.value = '';
        }}
      />
      <CanvasToolbar
        undoCount={undoStacks[activeCanvasId]?.length ?? 0}
        redoCount={redoStacks[activeCanvasId]?.length ?? 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={zoom}
        onZoomChange={setZoom}
        onFitZoom={() => setZoom(computeFitZoom())}
        bgUrl={customBackgrounds[activeCanvasId] || currentLayout.backgroundUrl || activeDef.backgroundUrl}
        bgInputRef={bgInputRef}
        uploading={uploading}
        onResetToDefaults={handleResetToDefaults}
        onFakePreview={() => setShowFakePreview(true)}
        canvasLabel={activeDef.label}
        backgroundOptions={
          activeDef.id.includes('leaderboard') || activeDef.id === 'fantasy_leaderboard'
            ? LEADERBOARD_BACKGROUNDS
            : undefined
        }
        onSelectBackground={(url) => {
          setCustomBackgrounds(prev => ({ ...prev, [activeCanvasId]: url + '?v=' + Date.now() }));
        }}
        onResetBackground={() => {
          setCustomBackgrounds(prev => {
            const next = { ...prev };
            delete next[activeCanvasId];
            return next;
          });
        }}
        onTestDeploy={() => setShowTestDeploy(true)}
      />

      {/* Onboarding banner */}
      {showOnboarding && (
        <div className="ce-onboarding">
          <span className="ce-onboarding-icon">{'\u2139'}</span>
          <span>
            Drag elements on the canvas to reposition them, or use the properties panel on the right for precise values.
            Arrow keys nudge by 1px (Shift+Arrow for 10px). Press <kbd className="ce-kbd">?</kbd> for all shortcuts.
          </span>
          <button
            className="ce-onboarding-close"
            onClick={() => { setShowOnboarding(false); localStorage.setItem('ce-onboarding-seen', '1'); }}
          >
            &times;
          </button>
        </div>
      )}

      {loading ? (
        <div className="ce-loading">Loading canvas data...</div>
      ) : (
        <div className={`ce-editor-grid ${previewMode ? 'ce-preview-mode-active' : ''}`}>
          <ElementListPanel
            elements={activeDef.elements}
            selectedId={selectedElementId}
            onSelect={setSelectedElementId}
            hiddenElements={hiddenElements}
            onToggleVisibility={handleToggleVisibility}
          />

          <div ref={canvasWrapRef} style={{ position: 'relative' }}>
            {previewMode && (
              <button
                className="ce-preview-exit"
                onClick={() => setPreviewMode(false)}
              >
                Exit Preview (Esc)
              </button>
            )}
            <button
              className={`ce-preview-mode-btn ${previewMode ? 'ce-preview-mode-btn-active' : ''}`}
              onClick={() => setPreviewMode(!previewMode)}
              title={previewMode ? 'Exit preview mode' : 'Preview without overlays'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <CanvasPreview
              definition={activeDef}
              layout={currentLayout}
              selectedId={selectedElementId}
              onSelect={setSelectedElementId}
              onElementChange={handleElementChange}
              zoom={zoom}
              customBackgroundUrl={customBackgrounds[activeCanvasId]}
              hiddenElements={hiddenElements}
              previewMode={previewMode}
            />
          </div>

          <ElementPropertiesPanel
            element={selectedElement}
            values={selectedValues}
            colors={currentColors}
            colorKeys={activeDef.colorKeys}
            onChange={(newValues) => {
              if (selectedElementId) handleElementChange(selectedElementId, newValues);
            }}
            onColorChange={handleColorChange}
            canvasWidth={activeDef.width}
            canvasHeight={activeDef.height}
            onResetElement={selectedElementId ? handleResetElement : undefined}
            copiedValues={copiedValues}
            onCopyPosition={selectedElementId ? handleCopyPosition : undefined}
            onPastePosition={selectedElementId ? handlePastePosition : undefined}
            onPasteX={selectedElementId ? handlePasteX : undefined}
            onPasteY={selectedElementId ? handlePasteY : undefined}
          />
        </div>
      )}

      <SaveDeployBar
        hasChanges={hasChanges}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        projectName={activeDef.label}
        diff={diff}
      />

      <AdminLightbox
        isOpen={showSwitchConfirm}
        onClose={handleSwitchCancel}
        title="Unsaved Changes"
        size="sm"
      >
        <div style={{ padding: '0 20px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
            You have unsaved changes to <strong>{activeDef.label}</strong>. Save them first?
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={handleSwitchCancel}>
              Cancel
            </button>
            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={handleSwitchDiscard} style={{ color: '#f85149' }}>
              Discard
            </button>
            <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={handleSwitchSave}>
              Save
            </button>
          </div>
        </div>
      </AdminLightbox>

      {/* Fake preview lightbox */}
      <AdminLightbox
        isOpen={showFakePreview}
        onClose={() => setShowFakePreview(false)}
        title={`Preview — ${activeDef.label}`}
        size="lg"
      >
        <div style={{ padding: '0 20px 20px' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
            Generated preview with sample data. Positions and colors reflect your current edits.
          </p>
          <FakePreview
            definition={activeDef}
            layout={currentLayout}
            colors={currentColors}
            customBackgroundUrl={customBackgrounds[activeCanvasId]}
          />
        </div>
      </AdminLightbox>

      {/* Test deploy modal */}
      <TestDeployModal
        isOpen={showTestDeploy}
        onClose={() => setShowTestDeploy(false)}
        definition={activeDef}
        bot={activeBot}
        onSaveFirst={handleSave}
        hasUnsavedChanges={hasChanges}
      />
    </div>
  );
}

// Deep merge utility: b overrides a for matching keys
function deepMerge(a: Record<string, any>, b: Record<string, any>): Record<string, any> {
  const result = { ...a };
  for (const key of Object.keys(b)) {
    if (
      typeof a[key] === 'object' && a[key] !== null &&
      typeof b[key] === 'object' && b[key] !== null &&
      !Array.isArray(a[key])
    ) {
      result[key] = deepMerge(a[key], b[key]);
    } else {
      result[key] = b[key];
    }
  }
  return result;
}
