'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasElementDef, CanvasTypeDef } from './types';
import { getAtPath } from './layoutPath';

type ElementPatch = Partial<{
  x: number; y: number;
  startX: number; startY: number;
  width: number; height: number;
  radiusX: number; radiusY: number;
  fontSize: number;
}>;

interface Props {
  canvas: CanvasTypeDef;
  layout: Record<string, any>;
  activeElementId: string | null;
  onSelectElement: (id: string | null) => void;
  /** Receives any combination of { x, y, startX, startY, width, height, radiusX, radiusY, fontSize }. */
  onMove: (id: string, patch: ElementPatch) => void;
  backgroundOverrideUrl?: string | null;
}

const MIN_SIZE = 10;
const MIN_RADIUS = 8;
const MIN_FONT = 8;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

type DragMode = 'move' | 'resize';

interface DragState {
  elementId: string;
  mode: DragMode;
  elementType: CanvasElementDef['type'];
  /** Element stores its position as startX/startY (e.g. card rows) instead of x/y. */
  usesStartKeys: boolean;
  /** Real rendered px-per-canvas-unit, measured at drag start. */
  scale: number;
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startRadiusX: number;
  startRadiusY: number;
  startFontSize: number;
  /** Shape extents relative to the position value — left/right/top/bottom offsets. */
  offL: number;
  offR: number;
  offT: number;
  offB: number;
}

/** Some elements (card rows) position via startX/startY — write back the keys the bot reads. */
function usesStartKeys(el: CanvasElementDef): boolean {
  return !el.props.includes('x') && el.props.includes('startX');
}

function readPos(el: CanvasElementDef, entry: Record<string, any>): { x: number; y: number } {
  if (usesStartKeys(el)) {
    return { x: Number(entry.startX ?? entry.x ?? 0), y: Number(entry.startY ?? entry.y ?? 0) };
  }
  return { x: Number(entry.x ?? entry.startX ?? 0), y: Number(entry.y ?? entry.startY ?? 0) };
}

export default function CanvasStage({ canvas, layout, activeElementId, onSelectElement, onMove, backgroundOverrideUrl }: Props) {
  const bgUrl = backgroundOverrideUrl ?? canvas.backgroundUrl;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [dragging, setDragging] = useState<{ id: string; mode: DragMode } | null>(null);
  const dragState = useRef<DragState | null>(null);
  // A click that concludes a drag (or element press) must not bubble into the
  // wrap's deselect handler — the element would lose selection the moment you
  // drop it.
  const suppressClickRef = useRef(false);

  // Drag bounds follow the canvas: elements may hang up to 10% (min 64px)
  // past any edge. Small canvases get tight clamps, huge ones (the 10000px
  // leaderboard) get proportionally roomy ones. The server enforces a
  // superset of these, so anything draggable here is also saveable.
  const marginX = Math.max(64, Math.round(canvas.width * 0.1));
  const marginY = Math.max(64, Math.round(canvas.height * 0.1));
  const boundsRef = useRef({ w: 0, h: 0, minX: 0, maxX: 0, minY: 0, maxY: 0, maxR: 0, maxW: 0, maxH: 0, maxFont: 0 });
  boundsRef.current = {
    w: canvas.width,
    h: canvas.height,
    minX: -marginX, maxX: canvas.width + marginX,
    minY: -marginY, maxY: canvas.height + marginY,
    maxR: Math.max(1000, Math.round(Math.max(canvas.width, canvas.height) / 2)),
    maxW: canvas.width + marginX,
    maxH: canvas.height + marginY,
    maxFont: Math.max(200, Math.round(canvas.height * 0.1)),
  };

  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const recomputeScale = useCallback(() => {
    if (!wrapRef.current) return;
    const cs = getComputedStyle(wrapRef.current);
    const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const target = Math.max(200, wrapRef.current.clientWidth - pad);
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
    const pos = readPos(el, entry);
    // Measure the real rendered scale — CSS (max-width, padding) can shrink
    // the svg below stageScale's estimate, which makes drags lag the cursor.
    const rect = svgRef.current?.getBoundingClientRect();
    const scale = rect && rect.width > 0 ? rect.width / canvas.width : stageScale;
    suppressClickRef.current = true;
    const width = Number(entry.width ?? 50);
    const height = Number(entry.height ?? 20);
    const radiusX = Number(entry.radiusX ?? 24);
    const radiusY = Number(entry.radiusY ?? entry.radiusX ?? 24);
    const fontSize = Number(entry.fontSize ?? 20);
    // Shape extents relative to the position value, so the move clamp can keep
    // part of the shape on-stage (a fully off-canvas element is ungrabbable).
    let offL = 0, offR = 0, offT = 0, offB = 0;
    if (el.type === 'circle') {
      offL = -radiusX; offR = radiusX; offT = -radiusY; offB = radiusY;
    } else if (el.type === 'rect') {
      offL = 0; offR = width; offT = 0; offB = height;
    } else {
      offL = -4; offR = -4 + fontSize * 6; offT = -fontSize - 4; offB = 4;
    }
    dragState.current = {
      elementId: el.id,
      mode,
      elementType: el.type,
      usesStartKeys: usesStartKeys(el),
      scale,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
      startWidth: width,
      startHeight: height,
      startRadiusX: radiusX,
      startRadiusY: radiusY,
      startFontSize: fontSize,
      offL, offR, offT, offB,
    };
    setDragging({ id: el.id, mode });
    onSelectElement(el.id);
  };

  // Registered once — everything mutable is read through refs so a mid-drag
  // re-render can never tear the listeners down (that used to drop mouseups
  // and leave elements glued to the cursor).
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const st = dragState.current;
      if (!st) return;
      const b = boundsRef.current;
      const dx = (e.clientX - st.startMouseX) / st.scale;
      const dy = (e.clientY - st.startMouseY) / st.scale;

      if (st.mode === 'move') {
        // Keep at least ~24 screen px of the shape on-stage — an element that
        // fully leaves the canvas can't be grabbed back with the mouse.
        const minVis = 24 / st.scale;
        const loX = Math.max(b.minX, minVis - st.offR);
        const hiX = Math.min(b.maxX, b.w - minVis - st.offL);
        const loY = Math.max(b.minY, minVis - st.offB);
        const hiY = Math.min(b.maxY, b.h - minVis - st.offT);
        const nextX = Math.round(clamp(st.startX + dx, loX, hiX));
        const nextY = Math.round(clamp(st.startY + dy, loY, hiY));
        onMoveRef.current(
          st.elementId,
          st.usesStartKeys ? { startX: nextX, startY: nextY } : { x: nextX, y: nextY }
        );
        return;
      }

      // RESIZE — corner-dot dragging.
      // For rects the dot sits at the bottom-right corner: dragging outward
      // (right/down) grows the rect, inward shrinks it. Position stays put.
      if (st.elementType === 'rect') {
        onMoveRef.current(st.elementId, {
          width: clamp(Math.round(st.startWidth + dx), MIN_SIZE, b.maxW),
          height: clamp(Math.round(st.startHeight + dy), MIN_SIZE, b.maxH),
        });
        return;
      }

      if (st.elementType === 'circle') {
        // Dot sits on the ellipse's bottom-right edge: dragging outward
        // (right/down) grows it, inward shrinks it.
        const nextRx = clamp(Math.round(st.startRadiusX + dx), MIN_RADIUS, b.maxR);
        const nextRy = clamp(Math.round(st.startRadiusY + dy), MIN_RADIUS, b.maxR);
        onMoveRef.current(st.elementId, { radiusX: nextRx, radiusY: nextRy });
        return;
      }

      // Text — dot drag changes fontSize (drag up = bigger).
      const nextFont = clamp(Math.round(st.startFontSize - dy), MIN_FONT, b.maxFont);
      onMoveRef.current(st.elementId, { fontSize: nextFont });
    };
    const onMouseUp = () => {
      // The trailing click event still needs to see the suppress flag; clear
      // it right after so a lost click (or an Escape-cancelled drag) can't
      // swallow a later deselect.
      setTimeout(() => { suppressClickRef.current = false; }, 0);
      if (!dragState.current) return;
      dragState.current = null;
      setDragging(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragState.current) {
        const st = dragState.current;
        // Escape cancels the drag: put the element back where it started.
        if (st.mode === 'move') {
          onMoveRef.current(
            st.elementId,
            st.usesStartKeys ? { startX: st.startX, startY: st.startY } : { x: st.startX, y: st.startY }
          );
        } else if (st.elementType === 'circle') {
          onMoveRef.current(st.elementId, { radiusX: st.startRadiusX, radiusY: st.startRadiusY });
        } else if (st.elementType === 'rect') {
          onMoveRef.current(st.elementId, { width: st.startWidth, height: st.startHeight });
        } else {
          onMoveRef.current(st.elementId, { fontSize: st.startFontSize });
        }
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
  }, []);

  // Handle dots keep a constant on-screen size regardless of canvas scale —
  // in canvas units they'd be invisible on a 10000px board and huge on a small one.
  const dotR = 7 / Math.max(0.01, stageScale);

  const handleStateClass = (el: CanvasElementDef) => {
    const isActive = el.id === activeElementId;
    const isMoving = dragging?.id === el.id && dragging.mode === 'move';
    const isResizing = dragging?.id === el.id && dragging.mode === 'resize';
    return `${isActive ? ' av-canvas-handle--active' : ''}${isMoving || isResizing ? ' av-canvas-handle--drag' : ''}`;
  };

  const renderShape = (el: CanvasElementDef) => {
    const entry = getAtPath(layout, el.id) ?? {};
    const { x, y } = readPos(el, entry);
    const stateClass = handleStateClass(el);

    if (el.type === 'circle') {
      const rx = Math.max(MIN_RADIUS, Number(entry.radiusX ?? 24));
      const ry = Math.max(MIN_RADIUS, Number(entry.radiusY ?? rx));
      return (
        <g key={`${el.id}-shape`} className={`av-canvas-handle${stateClass}`}>
          <ellipse
            cx={x} cy={y} rx={rx} ry={ry}
            className="av-canvas-handle-shape"
            onMouseDown={(e) => beginDrag(e, el, 'move')}
            style={{ cursor: 'move' }}
          />
        </g>
      );
    }
    if (el.type === 'rect') {
      const w = Math.max(MIN_SIZE, Number(entry.width ?? 50));
      const h = Math.max(MIN_SIZE, Number(entry.height ?? 20));
      return (
        <g key={`${el.id}-shape`} className={`av-canvas-handle${stateClass}`}>
          <rect
            x={x} y={y} width={w} height={h}
            className="av-canvas-handle-shape"
            onMouseDown={(e) => beginDrag(e, el, 'move')}
            style={{ cursor: 'move' }}
          />
        </g>
      );
    }
    // text — anchored the same way the bot draws it (centered podium text,
    // right-aligned list values), so the preview lands where Discord will.
    const fontSize = Math.max(MIN_FONT, Number(entry.fontSize ?? 20));
    const anchor = el.align ?? 'start';
    const boxWidth = fontSize * 6;
    const boxX = anchor === 'middle' ? x - boxWidth / 2 : anchor === 'end' ? x - boxWidth : x;
    return (
      <g key={`${el.id}-shape`} className={`av-canvas-handle${stateClass}`}>
        <rect
          x={boxX - 4} y={y - fontSize - 4} width={boxWidth + 8} height={fontSize + 8}
          className="av-canvas-handle-shape av-canvas-handle-shape--text"
          onMouseDown={(e) => beginDrag(e, el, 'move')}
          style={{ cursor: 'move' }}
        />
        <text x={x} y={y} fontSize={fontSize} textAnchor={anchor} className="av-canvas-handle-text" pointerEvents="none">{el.label}</text>
      </g>
    );
  };

  // True when the element declares a prop the resize dot can actually write —
  // an element without one (e.g. card rows with only startX/startY/spacing)
  // gets no dot at all instead of a dot that pollutes its layout with dead keys.
  const canResize = (el: CanvasElementDef) => {
    if (el.type === 'circle') return el.props.includes('radiusX') || el.props.includes('radiusY');
    if (el.type === 'rect') return el.props.includes('width') || el.props.includes('height');
    return el.props.includes('fontSize');
  };

  // Dots live in their own top layer so a neighbouring element's (larger)
  // move shape can never sit on top of a resize dot and swallow its clicks.
  // Only the selected (or mid-drag) element shows its dot — 30 permanent
  // gold dots on a leaderboard would be pure noise.
  const renderDot = (el: CanvasElementDef) => {
    if (el.id !== activeElementId && dragging?.id !== el.id) return null;
    if (!canResize(el)) return null;
    const entry = getAtPath(layout, el.id) ?? {};
    const { x, y } = readPos(el, entry);
    const stateClass = handleStateClass(el);

    if (el.type === 'circle') {
      const rx = Math.max(MIN_RADIUS, Number(entry.radiusX ?? 24));
      const ry = Math.max(MIN_RADIUS, Number(entry.radiusY ?? rx));
      return (
        <g key={`${el.id}-dot`} className={`av-canvas-handle${stateClass}`}>
          <circle
            cx={x + rx * 0.7071} cy={y + ry * 0.7071} r={dotR}
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
        <g key={`${el.id}-dot`} className={`av-canvas-handle${stateClass}`}>
          <circle
            cx={x + w} cy={y + h} r={dotR}
            className="av-canvas-handle-dot"
            onMouseDown={(e) => beginDrag(e, el, 'resize')}
            style={{ cursor: 'nwse-resize' }}
          />
        </g>
      );
    }
    const fontSize = Math.max(MIN_FONT, Number(entry.fontSize ?? 20));
    // Same anchored box as renderShape — the dot rides its top-left corner.
    const anchor = el.align ?? 'start';
    const boxWidth = fontSize * 6;
    const boxX = anchor === 'middle' ? x - boxWidth / 2 : anchor === 'end' ? x - boxWidth : x;
    return (
      <g key={`${el.id}-dot`} className={`av-canvas-handle${stateClass}`}>
        <circle
          cx={boxX - 4} cy={y - fontSize - 4} r={dotR}
          className="av-canvas-handle-dot"
          onMouseDown={(e) => beginDrag(e, el, 'resize')}
          style={{ cursor: 'ns-resize' }}
        />
      </g>
    );
  };

  return (
    <div
      ref={wrapRef}
      className="av-canvas-stage-wrap"
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        onSelectElement(null);
      }}
    >
      <div
        className="av-canvas-stage"
        style={{
          width: canvas.width * stageScale,
          height: canvas.height * stageScale,
        }}
      >
        <svg
          ref={svgRef}
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
          {canvas.elements.map(renderShape)}
          {canvas.elements.map(renderDot)}
        </svg>
      </div>
      <div className="av-canvas-stage-foot">
        <span>{canvas.width} × {canvas.height} · preview scale {(stageScale * 100).toFixed(0)}% · drag shape to move · select, then drag the gold dot to resize · Esc cancels a drag</span>
      </div>
    </div>
  );
}
