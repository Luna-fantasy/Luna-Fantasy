'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type { CanvasTypeDef } from '@/lib/admin/canvas-definitions';
import DraggableElement from './DraggableElement';

interface CanvasPreviewProps {
  definition: CanvasTypeDef;
  layout: Record<string, any>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onElementChange: (elementId: string, newValues: Record<string, number>) => void;
  zoom?: number;
  customBackgroundUrl?: string;
  hiddenElements?: Set<string>;
  previewMode?: boolean;
}

// Element tag colors — cycle through for visual distinction
const TAG_COLORS = [
  '#58a6ff', '#3fb950', '#bc8cff', '#f0883e', '#f85149',
  '#a371f7', '#79c0ff', '#56d364', '#e3b341', '#ff7b72',
];

const RULER_SIZE = 20;
const GRID_INTERVAL = 50; // canvas pixels between grid lines

function getElementValues(layout: Record<string, any>, elementId: string): Record<string, number> {
  const parts = elementId.split('.');
  let obj = layout;
  for (const part of parts) {
    if (!obj || typeof obj !== 'object') return {};
    obj = obj[part];
  }
  if (!obj || typeof obj !== 'object') return {};
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number') result[k] = v;
  }
  return result;
}

// SVG grid overlay component
function GridOverlay({ width, height, scale, gridInterval }: {
  width: number; height: number; scale: number; gridInterval: number;
}) {
  const scaledInterval = gridInterval * scale;
  if (scaledInterval < 5) return null; // too dense, skip

  return (
    <svg
      className="ce-preview-grid"
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 5 }}
    >
      <defs>
        <pattern id="ce-grid" width={scaledInterval} height={scaledInterval} patternUnits="userSpaceOnUse">
          <path
            d={`M ${scaledInterval} 0 L 0 0 0 ${scaledInterval}`}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#ce-grid)" />
    </svg>
  );
}

// Ruler bar component
function RulerBar({ direction, canvasSize, scale, displaySize, selectedPos }: {
  direction: 'h' | 'v';
  canvasSize: number;
  scale: number;
  displaySize: number;
  selectedPos?: number;
}) {
  // Compute tick interval: try to keep ticks ~60-120px apart on screen
  const rawInterval = 100;
  let interval = rawInterval;
  const screenInterval = interval * scale;
  if (screenInterval < 30) interval = 500;
  else if (screenInterval < 60) interval = 200;

  const ticks = useMemo(() => {
    const result: { pos: number; label: string }[] = [];
    for (let v = 0; v <= canvasSize; v += interval) {
      result.push({ pos: v * scale, label: String(v) });
    }
    return result;
  }, [canvasSize, scale, interval]);

  const isH = direction === 'h';

  return (
    <div
      className={isH ? 'ce-ruler-h' : 'ce-ruler-v'}
      style={isH
        ? { width: displaySize, height: RULER_SIZE }
        : { width: RULER_SIZE, height: displaySize }
      }
    >
      {ticks.map((t, i) => (
        <span
          key={i}
          className="ce-ruler-tick"
          style={isH
            ? { left: t.pos, top: 0 }
            : { top: t.pos, left: 0 }
          }
        >
          <span className="ce-ruler-tick-line" style={isH
            ? { width: 1, height: 6, position: 'absolute' as const, bottom: 0, left: 0 }
            : { height: 1, width: 6, position: 'absolute' as const, right: 0, top: 0 }
          } />
          <span className="ce-ruler-tick-label" style={isH
            ? { position: 'absolute' as const, left: 3, top: 1 }
            : { position: 'absolute' as const, top: 3, left: 2, writingMode: 'vertical-lr' as const }
          }>
            {t.label}
          </span>
        </span>
      ))}

      {/* Selected element position indicator */}
      {selectedPos !== undefined && (
        <span
          className="ce-ruler-indicator"
          style={isH
            ? { left: selectedPos * scale, top: 0, width: 1, height: RULER_SIZE }
            : { top: selectedPos * scale, left: 0, height: 1, width: RULER_SIZE }
          }
        />
      )}
    </div>
  );
}

export default function CanvasPreview({
  definition, layout, selectedId, onSelect, onElementChange,
  zoom = 1, customBackgroundUrl, hiddenElements, previewMode = false,
}: CanvasPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(true);
  const prevDefId = useRef(definition.id);

  // Reset img error state when switching canvas type or background
  useEffect(() => {
    if (prevDefId.current !== definition.id) {
      setImgError(false);
      prevDefId.current = definition.id;
    }
  }, [definition.id]);

  useEffect(() => {
    if (customBackgroundUrl) setImgError(false);
  }, [customBackgroundUrl]);

  // Measure available width on window resize only.
  // Container width is set by the CSS Grid layout and only changes when the
  // browser window resizes. Using ResizeObserver here caused a feedback loop:
  // high zoom → overflow → layout shift → ResizeObserver fires → re-render → loop.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Scale factor: fit canvas width into container, then apply zoom
  // Guard against 0 width before first measurement
  const safeContainerWidth = containerWidth || 800;
  // Subtract ruler offset so canvas + rulers fit within the container at zoom=1
  const rulerOffset = showRulers && !previewMode ? RULER_SIZE : 0;
  const baseScale = (safeContainerWidth - rulerOffset) / definition.width;
  const scale = baseScale * zoom;
  const displayWidth = definition.width * scale;
  const displayHeight = definition.height * scale;

  const bgUrl = customBackgroundUrl || layout.backgroundUrl || definition.backgroundUrl;

  const handleBackgroundClick = useCallback(() => {
    onSelect(null);
  }, [onSelect]);

  // Get selected element position for ruler indicators
  const selectedValues = selectedId ? getElementValues(layout, selectedId) : null;

  return (
    <div className="ce-preview" ref={containerRef}>
      <div
        className="ce-preview-scroll"
        style={{ overflow: 'auto', maxHeight: 'calc(100vh - 320px)' }}
      >
        <div
          className="ce-preview-canvas-wrap"
          style={{
            position: 'relative',
            paddingLeft: showRulers && !previewMode ? RULER_SIZE : 0,
            paddingTop: showRulers && !previewMode ? RULER_SIZE : 0,
          }}
        >
          {/* Rulers */}
          {showRulers && !previewMode && (
            <>
              {/* Corner square */}
              <div className="ce-ruler-corner" style={{ position: 'absolute', top: 0, left: 0, width: RULER_SIZE, height: RULER_SIZE, zIndex: 15 }} />
              {/* Horizontal ruler */}
              <div style={{ position: 'absolute', top: 0, left: RULER_SIZE, zIndex: 15 }}>
                <RulerBar
                  direction="h"
                  canvasSize={definition.width}
                  scale={scale}
                  displaySize={displayWidth}
                  selectedPos={selectedValues?.x}
                />
              </div>
              {/* Vertical ruler */}
              <div style={{ position: 'absolute', top: RULER_SIZE, left: 0, zIndex: 15 }}>
                <RulerBar
                  direction="v"
                  canvasSize={definition.height}
                  scale={scale}
                  displaySize={displayHeight}
                  selectedPos={selectedValues?.y}
                />
              </div>
            </>
          )}

          {/* Canvas area */}
          <div
            className="ce-preview-canvas"
            style={{
              width: displayWidth,
              height: displayHeight,
              position: 'relative',
            }}
            onClick={handleBackgroundClick}
          >
            {/* Background image */}
            {!imgError ? (
              <img
                src={bgUrl}
                alt={definition.label}
                className="ce-preview-bg"
                style={{ width: displayWidth, height: displayHeight, objectFit: 'fill' }}
                onError={() => setImgError(true)}
                draggable={false}
              />
            ) : (
              <div
                className="ce-preview-bg-fallback"
                style={{ width: displayWidth, height: displayHeight }}
              >
                <span>Background not available</span>
                <span className="ce-preview-bg-dims">{definition.width} x {definition.height}</span>
              </div>
            )}

            {/* Grid overlay */}
            {showGrid && !previewMode && (
              <GridOverlay
                width={displayWidth}
                height={displayHeight}
                scale={scale}
                gridInterval={GRID_INTERVAL}
              />
            )}

            {/* Element overlays */}
            {!previewMode && definition.elements.map((el, i) => {
              if (hiddenElements?.has(el.id)) return null;
              const values = getElementValues(layout, el.id);
              if (!values.x && values.x !== 0) return null;

              return (
                <DraggableElement
                  key={el.id}
                  element={el}
                  values={values}
                  scale={scale}
                  selected={selectedId === el.id}
                  color={TAG_COLORS[i % TAG_COLORS.length]}
                  onSelect={() => onSelect(el.id)}
                  onDragEnd={(newValues) => onElementChange(el.id, newValues)}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="ce-preview-info">
        <span>{definition.width} x {definition.height}px</span>
        <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
        <span>{definition.elements.length} elements</span>
        <div className="ce-preview-controls">
          <button
            className={`ce-preview-control-btn ${showGrid ? 'ce-preview-control-active' : ''}`}
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle grid"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
          <button
            className={`ce-preview-control-btn ${showRulers ? 'ce-preview-control-active' : ''}`}
            onClick={() => setShowRulers(!showRulers)}
            title="Toggle rulers"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M3 9h3M3 15h3M9 21v-3M15 21v-3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
