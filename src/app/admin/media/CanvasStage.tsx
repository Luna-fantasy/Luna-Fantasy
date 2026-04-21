'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasElementDef, CanvasTypeDef } from './types';
import { getAtPath } from './layoutPath';

interface Props {
  canvas: CanvasTypeDef;
  layout: Record<string, any>;
  activeElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onMove: (id: string, patch: { x: number; y: number }) => void;
  backgroundOverrideUrl?: string | null;
}

const BOUNDS = { minX: -500, maxX: 4500, minY: -500, maxY: 4500 };

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export default function CanvasStage({ canvas, layout, activeElementId, onSelectElement, onMove, backgroundOverrideUrl }: Props) {
  const bgUrl = backgroundOverrideUrl ?? canvas.backgroundUrl;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragState = useRef<{ elementId: string; startX: number; startY: number; startPx: number; startPy: number } | null>(null);

  const recomputeScale = useCallback(() => {
    if (!wrapRef.current) return;
    const w = wrapRef.current.clientWidth;
    // Give a small margin to prevent overflow
    const target = Math.max(200, w - 8);
    setStageScale(Math.min(1, target / canvas.width));
  }, [canvas.width]);

  useEffect(() => {
    recomputeScale();
    const obs = new ResizeObserver(recomputeScale);
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [recomputeScale]);

  const onMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const entry = getAtPath(layout, elementId) ?? {};
    dragState.current = {
      elementId,
      startX: e.clientX,
      startY: e.clientY,
      startPx: Number(entry.x ?? entry.startX ?? 0),
      startPy: Number(entry.y ?? entry.startY ?? 0),
    };
    setDragging(elementId);
    onSelectElement(elementId);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const st = dragState.current;
      if (!st) return;
      const dx = (e.clientX - st.startX) / stageScale;
      const dy = (e.clientY - st.startY) / stageScale;
      const nextX = Math.round(clamp(st.startPx + dx, BOUNDS.minX, BOUNDS.maxX));
      const nextY = Math.round(clamp(st.startPy + dy, BOUNDS.minY, BOUNDS.maxY));
      onMove(st.elementId, { x: nextX, y: nextY });
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
    const isBeingDragged = dragging === el.id;

    if (el.type === 'circle') {
      const rx = Math.max(8, Number(entry.radiusX ?? 24));
      const ry = Math.max(8, Number(entry.radiusY ?? rx));
      return (
        <g key={el.id} className={`av-canvas-handle${isActive ? ' av-canvas-handle--active' : ''}${isBeingDragged ? ' av-canvas-handle--drag' : ''}`}
           onMouseDown={(e) => onMouseDown(e, el.id)}>
          <ellipse cx={x} cy={y} rx={rx} ry={ry} className="av-canvas-handle-shape" />
          <circle cx={x} cy={y} r={6} className="av-canvas-handle-dot" />
        </g>
      );
    }
    if (el.type === 'rect') {
      const w = Math.max(10, Number(entry.width ?? 50));
      const h = Math.max(10, Number(entry.height ?? 20));
      return (
        <g key={el.id} className={`av-canvas-handle${isActive ? ' av-canvas-handle--active' : ''}${isBeingDragged ? ' av-canvas-handle--drag' : ''}`}
           onMouseDown={(e) => onMouseDown(e, el.id)}>
          <rect x={x} y={y} width={w} height={h} className="av-canvas-handle-shape" />
          <circle cx={x} cy={y} r={6} className="av-canvas-handle-dot" />
        </g>
      );
    }
    // text
    const fontSize = Math.max(8, Number(entry.fontSize ?? 20));
    return (
      <g key={el.id} className={`av-canvas-handle${isActive ? ' av-canvas-handle--active' : ''}${isBeingDragged ? ' av-canvas-handle--drag' : ''}`}
         onMouseDown={(e) => onMouseDown(e, el.id)}>
        <rect x={x - 4} y={y - fontSize - 4} width={fontSize * 6} height={fontSize + 8} className="av-canvas-handle-shape av-canvas-handle-shape--text" />
        <text x={x} y={y} fontSize={fontSize} className="av-canvas-handle-text">{el.label}</text>
        <circle cx={x} cy={y} r={6} className="av-canvas-handle-dot" />
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
        <span>{canvas.width} × {canvas.height} · preview scale {(stageScale * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}
