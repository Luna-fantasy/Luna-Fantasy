'use client';

import { type RefObject } from 'react';
import AdminLightbox from '../components/AdminLightbox';
import { useState } from 'react';

interface BackgroundOption {
  label: string;
  url: string;
}

interface CanvasToolbarProps {
  undoCount: number;
  redoCount: number;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomChange: (z: number) => void;
  onFitZoom?: () => void;
  bgUrl?: string;
  bgInputRef: RefObject<HTMLInputElement | null>;
  uploading: boolean;
  onResetToDefaults: () => void;
  onFakePreview: () => void;
  canvasLabel: string;
  backgroundOptions?: BackgroundOption[];
  onSelectBackground?: (url: string) => void;
  onResetBackground?: () => void;
  onTestDeploy?: () => void;
}

const SHORTCUTS = [
  { keys: ['Arrow Keys'], desc: 'Nudge selected element by 1px' },
  { keys: ['Shift', 'Arrow Keys'], desc: 'Nudge by 10px' },
  { keys: ['Ctrl', 'Z'], desc: 'Undo' },
  { keys: ['Ctrl', 'Y'], desc: 'Redo' },
  { keys: ['Click'], desc: 'Select element on canvas' },
  { keys: ['Drag'], desc: 'Reposition element' },
  { keys: ['Click background'], desc: 'Deselect element' },
];

export default function CanvasToolbar({
  undoCount, redoCount, onUndo, onRedo,
  zoom, onZoomChange, onFitZoom,
  bgUrl, bgInputRef, uploading,
  onResetToDefaults, onFakePreview, canvasLabel,
  backgroundOptions, onSelectBackground, onResetBackground,
  onTestDeploy,
}: CanvasToolbarProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showBgDropdown, setShowBgDropdown] = useState(false);

  return (
    <>
      <div className="ce-toolbar">
        {/* Undo / Redo */}
        <div className="ce-toolbar-group">
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={onUndo}
            disabled={undoCount === 0}
            title="Undo (Ctrl+Z)"
          >
            <span className="ce-toolbar-icon">{'\u21A9'}</span>
            {undoCount > 0 && <span className="ce-toolbar-badge">{undoCount}</span>}
          </button>
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={onRedo}
            disabled={redoCount === 0}
            title="Redo (Ctrl+Y)"
          >
            <span className="ce-toolbar-icon">{'\u21AA'}</span>
            {redoCount > 0 && <span className="ce-toolbar-badge">{redoCount}</span>}
          </button>
        </div>

        <span className="ce-toolbar-divider" />

        {/* Zoom */}
        <div className="ce-toolbar-group">
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))}
            title="Zoom out"
          >
            {'\u2212'}
          </button>
          <input
            type="range"
            className="ce-toolbar-zoom-slider"
            min={25}
            max={300}
            step={25}
            value={zoom * 100}
            onChange={(e) => onZoomChange(Number(e.target.value) / 100)}
          />
          <span className="ce-toolbar-zoom">{(zoom * 100).toFixed(0)}%</span>
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => onZoomChange(Math.min(3, zoom + 0.25))}
            title="Zoom in"
          >
            +
          </button>
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => onFitZoom ? onFitZoom() : onZoomChange(1)}
            title="Fit entire canvas in view"
          >
            Fit
          </button>
        </div>

        <span className="ce-toolbar-divider" />

        {/* Background */}
        <div className="ce-toolbar-group" style={{ position: 'relative' }}>
          {bgUrl && (
            <img
              src={bgUrl}
              alt="Background"
              className="ce-toolbar-bg-thumb"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => bgInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Background'}
          </button>
          {backgroundOptions && backgroundOptions.length > 0 && (
            <>
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => setShowBgDropdown(!showBgDropdown)}
                title="Compare backgrounds"
                style={{ padding: '4px 6px', fontSize: '10px' }}
              >
                {'\u25BC'}
              </button>
              {showBgDropdown && (
                <div
                  className="ce-bg-dropdown"
                  onMouseLeave={() => setShowBgDropdown(false)}
                >
                  {backgroundOptions.map((opt) => (
                    <button
                      key={opt.url}
                      className="ce-bg-dropdown-item"
                      onClick={() => {
                        onSelectBackground?.(opt.url);
                        setShowBgDropdown(false);
                      }}
                    >
                      <img src={opt.url} alt="" className="ce-bg-dropdown-thumb" />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                  {onResetBackground && (
                    <>
                      <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
                      <button
                        className="ce-bg-dropdown-item"
                        onClick={() => {
                          onResetBackground();
                          setShowBgDropdown(false);
                        }}
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Reset to Original
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <span className="ce-toolbar-divider" />

        {/* Actions */}
        <div className="ce-toolbar-group">
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={onFakePreview}
            title="Generate a fake preview with sample data"
          >
            Generate Preview
          </button>
          {onTestDeploy && (
            <button
              className="admin-btn admin-btn-ghost admin-btn-sm"
              onClick={onTestDeploy}
              title="Send a bot-rendered preview to Discord"
              style={{ color: '#58a6ff' }}
            >
              Test Deploy
            </button>
          )}
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm ce-toolbar-reset"
            onClick={() => setShowResetConfirm(true)}
            title="Reset all positions and colors to defaults"
          >
            Reset Defaults
          </button>
        </div>

        {/* Spacer + shortcuts help */}
        <div className="ce-toolbar-group" style={{ marginLeft: 'auto' }}>
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => setShowShortcuts(true)}
            title="Keyboard shortcuts"
          >
            ?
          </button>
        </div>
      </div>

      {/* Keyboard shortcuts lightbox */}
      <AdminLightbox
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        title="Keyboard Shortcuts"
        size="sm"
      >
        <div style={{ padding: '0 20px 20px' }}>
          <table className="ce-shortcut-table">
            <tbody>
              {SHORTCUTS.map((s, i) => (
                <tr key={i}>
                  <td className="ce-shortcut-keys">
                    {s.keys.map((k, j) => (
                      <span key={j}>
                        {j > 0 && ' + '}
                        <kbd className="ce-kbd">{k}</kbd>
                      </span>
                    ))}
                  </td>
                  <td className="ce-shortcut-desc">{s.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminLightbox>

      {/* Reset confirmation */}
      <AdminLightbox
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset to Defaults"
        size="sm"
      >
        <div style={{ padding: '0 20px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
            Reset all positions and colors for <strong>{canvasLabel}</strong> to their hardcoded defaults? This can be undone.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </button>
            <button
              className="admin-btn admin-btn-primary admin-btn-sm"
              onClick={() => { setShowResetConfirm(false); onResetToDefaults(); }}
              style={{ background: 'rgba(248, 81, 73, 0.15)', borderColor: 'rgba(248, 81, 73, 0.3)', color: '#f85149' }}
            >
              Reset
            </button>
          </div>
        </div>
      </AdminLightbox>
    </>
  );
}
