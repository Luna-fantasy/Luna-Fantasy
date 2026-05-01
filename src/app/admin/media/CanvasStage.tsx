'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasElementDef, CanvasTypeDef } from './types';
import { getAtPath } from './layoutPath';

type ElementPatch = Partial<{
  x: number; y: number;
  width: number; height: number;
  radiusX: number; radiusY: number;
  fontSize: number;
}>;

interface Props {
  canvas: CanvasTypeDef;
  layout: Record<string, any>;
  activeElementId: string | null;
  onSelectElement: (id: string | null) => void;
  /** Receives any combination of { x, y, width, height, radiusX, radiusY, fontSize }. */
  onMove: (id: string, patch: ElementPatch) => void;
  backgroundOverrideUrl?: string | null;
}

const BOUNDS = { minX: -500, maxX: 4500, minY: -500, maxY: 4500 };
const MIN_SIZE = 10;
const MIN_RADIUS = 8;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

type DragMode = 'move' | 'resize';

interface DragState {
  elementId: string;
  mode: DragMode;
  elementType: CanvasElementDef['type'];
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startRadiusX: number;
  startRadiusY: number;
}

export default function CanvasStage({ canvas, layout, activeElementId, onSelectElement, onMove, backgroundOverrideUrl }: Props) {
  const bgUrl = backgroundOverrideUrl ?? canvas.backgroundUrl;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [dragging, setDragging] = useState<{ id: string; mode: DragMode } | null>(null);
  const dragState = useRef<DragState | null>(null);

  const recomputeScale = useCallback(() => {
    if (!wrapRef.current) return;
    const w = wrapRef.current.clientWidth;
    const target = Math.max(200, w - 8);
    setStageScale(Math.min(1, target / canvas.width));
  }, [canvas.width]);

  useEffect(() => {
    recomputeScale();
    const obs = new ResizeObserver(recomputeScale);
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [recomputeScale]);

  const beginDrag = (e: React.MouseEvent, el: CanvasElementDef, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    const entry = getAtPath(layout, el.id) ?? {};
    dragState.current = {
      elementId: el.id,
      mode,
      elementType: el.type,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: Number(entry.x ?? entry.startX ?? 0),
      startY: Number(entry.y ?? entry.startY ?? 0),
      startWidth: Number(entry.width ?? 50),
      startHeight: Number(entry.height ?? 20),
      startRadiusX: Number(entry.radiusX ?? 24),
      startRadiusY: Number(entry.radiusY ?? entry.radiusX ?? 24),
    };
    setDragging({ id: el.id, mode });
    onSelectElement(el.id);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const st = dragState.current;
      if (!st) return;
      const dx = (e.clientX - st.startMouseX) / stageScale;
      const dy = (e.clientY - st.startMouseY) / stageScale;

      if (st.mode === 'move') {
        const nextX = Math.round(clamp(st.startX + dx, BOUNDS.minX, BOUNDS.maxX));
        const nextY = Math.round(clamp(st.startY + dy, BOUNDS.minY, BOUNDS.maxY));
        onMove(st.elementId, { x: nextX, y: nextY });
        return;
      }

      // RESIZE — corner-dot dragging.
      // For rects: top-left dot anchors the bottom-right corner; dragging the
      // dot inward shrinks (minimizes), outward expands. Both x/y AND
      // width/height update together.
      if (st.elementType === 'rect') {
        const newX = st.startX + dx;
        const newY = st.startY + dy;
        const newW = st.startWidth - dx;
        const newH = st.startHeight - dy;
        // Clamp width/height to MIN_SIZE; pin x/y so the bottom-right stays fixed.
        const finalW = Math.max(MIN_SIZE, newW);
        const finalH = Math.max(MIN_SIZE, newH);
        const finalX = newW < MIN_SIZE ? (st.startX + st.startWidth - MIN_SIZE) : newX;
        const finalY = newH < MIN_SIZE ? (st.startY + st.startHeight - MIN_SIZE) : newY;
        onMove(st.elementId, {
          x: Math.round(clamp(finalX, BOUNDS.minX, BOUNDS.maxX)),
          y: Math.round(clamp(finalY, BOUNDS.minY, BOUNDS.maxY)),
          width: Math.round(finalW),
          height: Math.round(finalH),
        });
        return;
      }

      if (st.elementType === 'circle') {
        // Dot is at the center; dx/dy expand radii. Moving away from center
        // grows the ellipse, toward center shrinks it.
        const nextRx = Math.max(MIN_RADIUS, Math.round(st.startRadiusX + Math.abs(dx) * Math.sign(dx || 1)));
        const nextRy = Math.max(MIN_RADIUS, Math.round(st.startRadiusY + Math.abs(dy) * Math.sign(dy || 1)));
        onMove(st.elementId, {
          radiusX: Math.max(MIN_RADIUS, nextRx),
          radiusY: Math.max(MIN_RADIUS, nextRy),
        });
        return;
      }

      // Text — dot drag changes fontSize (vertical drag).
      const nextFont = Math.max(8, Math.round(st.startWidth /* repurposed: fontSize */ - dy));
      onMove(st.elementId, { fontSize: nextFont });
    };
    const onMouseUp = () => {
      dragState.current = null;
      setDragging(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragState.current) {
        dragState.current = null;
        setDragging(null);
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [stageScale, onMove]);

  const renderHandle = (el: CanvasElementDef) => {
    const entry = getAtPath(layout, el.id) ?? {};
    const x = Number(entry.x ?? entry.startX ?? 0);
    const y = Number(entry.y ?? entry.startY ?? 0);
    const isActive = el.id === activeElementId;
    const isMoving = dragging?.id === el.id && dragging.mode === 'move';
    const isResizing = dragging?.id === el.id && dragging.mode === 'resize';
    const stateClass = `${isActive ? ' av-canvas-handle--active' : ''}${isMoving || isResizing ? ' av-canvas-handle--drag' : ''}`;

    if (el.type === 'circle') {
      const rx = Math.max(MIN_RADIUS, Number(entry.radiusX ?? 24));
      const ry = Math.max(MIN_RADIUS, Number(entry.radiusY ?? rx));
      return (
        <g key={el.id} className={`av-canvas-handle${stateClass}`}>
          <ellipse
            cx={x} cy={y} rx={rx} ry={ry}
            className="av-canvas-handle-shape"
            onMouseDown={(e) => beginDrag(e, el, 'move')}
            style={{ cursor: 'move' }}
          />
          <circle
            cx={x} cy={y} r={6}
            className="av-canvas-handle-dot"
            onMouseDown={(e) => beginDrag(e, el, 'resize')}
            style={{ cursor: 'nwse-resize' }}
          />
        </g>
      );
    }
    if (el.type === 'rect') {
      const w = Math.max(MIN_SIZE, Number(entry.width ?? 50));
      const h = Math.max(MIN_SIZE, Number(entry.height ?? 20));
      return (
        <g key={el.id} className={`av-canvas-handle${stateClass}`}>
          <rect
            x={x} y={y} width={w} height={h}
            className="av-canvas-handle-shape"
            onMouseDown={(e) => beginDrag(e, el, 'move')}
            style={{ cursor: 'move' }}
          />
          <circle
            cx={x} cy={y} r={6}
            className="av-canvas-handle-dot"
            onMouseDown={(e) => beginDrag(e, el, 'resize')}
            style={{ cursor: 'nwse-resize' }}
          />
        </g>
      );
    }
    // text
    const fontSize = Math.max(8, Number(entry.fontSize ?? 20));
    return (
      <g key={el.id} className={`av-canvas-handle${stateClass}`}>
        <rect
          x={x - 4} y={y - fontSize - 4} width={fontSize * 6} height={fontSize + 8}
          className="av-canvas-handle-shape av-canvas-handle-shape--text"
          onMouseDown={(e) => beginDrag(e, el, 'move')}
          style={{ cursor: 'move' }}
        />
        <text x={x} y={y} fontSize={fontSize} className="av-canvas-handle-text" pointerEvents="none">{el.label}</text>
        <circle
          cx={x} cy={y} r={6}
          className="av-canvas-handle-dot"
          onMouseDown={(e) => {
            // For text, repurpose startWidth = current fontSize so the resize
            // math in onMouseMove can read it back. Keeps the DragState shape
            // shared without adding text-specific fields.
            const synthetic = { ...e, clientX: e.clientX, clientY: e.clientY } as unknown as React.MouseEvent;
            beginDrag(synthetic, el, 'resize');
            if (dragState.current) dragState.current.startWidth = fontSize;
          }}
          style={{ cursor: 'ns-resize' }}
        />
      </g>
    );
  };

  return (
    <div ref={wrapRef} className="av-canvas-stage-wrap" onClick={() => onSelectElement(null)}>
      <div
        className="av-canvas-stage"
        style={{
          width: canvas.width * stageScale,
          height: canvas.height * stageScale,
        }}
      >
        <svg
          viewBox={`0 0 ${canvas.width} ${canvas.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="av-canvas-svg"
        >
          {bgUrl && (
            <image
              href={bgUrl}
              x={0}
              y={0}
              width={canvas.width}
              height={canvas.height}
              preserveAspectRatio="xMidYMid meet"
            />
          )}
          {canvas.elements.map(renderHandle)}
        </svg>
      </div>
      <div className="av-canvas-stage-foot">
        <span>{canvas.width} × {canvas.height} · preview scale {(stageScale * 100).toFixed(0)}% · drag shape to move · drag corner dot to resize</span>
      </div>
    </div>
  );
}
