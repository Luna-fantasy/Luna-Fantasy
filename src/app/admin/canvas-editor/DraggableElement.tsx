'use client';

import { useRef, useCallback, useEffect } from 'react';
import type { CanvasElementDef } from '@/lib/admin/canvas-definitions';

interface DraggableElementProps {
  element: CanvasElementDef;
  values: Record<string, number>;
  scale: number;
  selected: boolean;
  color?: string;
  onSelect: () => void;
  onDragEnd: (newValues: Record<string, number>) => void;
}

const HANDLE_SIZE = 10;
const HALF_HANDLE = HANDLE_SIZE / 2;

export default function DraggableElement({
  element, values, scale, selected, color, onSelect, onDragEnd,
}: DraggableElementProps) {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origCanvasX: number;
    origCanvasY: number;
  } | null>(null);
  const elRef = useRef<HTMLDivElement>(null);

  // Resize state
  const resizeRef = useRef<{
    handle: 'left' | 'right' | 'top' | 'bottom';
    startPos: number;
    origX: number;
    origY: number;
    origRadiusX: number;
    origRadiusY: number;
  } | null>(null);
  // Store cleanup fn so unmount can call it
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  const x = (values.x ?? 0) * scale;
  const y = (values.y ?? 0) * scale;
  const size = (values.size ?? values.fontSize ?? 20) * scale;
  const width = (values.width ?? 0) * scale;
  const height = (values.height ?? 0) * scale;

  // Ellipse radii (fallback to size for backward compat)
  const radiusX = (values.radiusX ?? values.size ?? 20) * scale;
  const radiusY = (values.radiusY ?? values.size ?? 20) * scale;

  // Reset all inline styles set during resize
  function resetInlineStyles() {
    const el = elRef.current;
    if (!el) return;
    el.style.width = '';
    el.style.height = '';
    el.style.left = '';
    el.style.top = '';
    const inner = el.querySelector('.ce-element') as HTMLElement;
    if (inner) { inner.style.width = ''; inner.style.height = ''; }
  }

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).classList.contains('ce-resize-handle')) return;
    if (resizeRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const el = elRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origCanvasX: values.x ?? 0,
      origCanvasY: values.y ?? 0,
    };
  }, [onSelect, values.x, values.y]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !elRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    elRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !elRef.current) return;
    elRef.current.releasePointerCapture(e.pointerId);
    elRef.current.style.transform = '';
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newX = dragRef.current.origCanvasX + Math.round(dx / scale);
    const newY = dragRef.current.origCanvasY + Math.round(dy / scale);
    dragRef.current = null;
    onDragEnd({ ...values, x: newX, y: newY });
  }, [scale, values, onDragEnd]);

  // Resize handle interaction
  //
  // Semantics: each handle resizes the circle RECTANGLE-STYLE — the opposite
  // edge stays pinned, the dragged edge moves. Because circles are stored as
  // (center, radius), we need to update BOTH the center (x/y) AND the radius
  // so that the opposite edge remains fixed.
  //
  // For a right handle drag by `delta` pixels:
  //   newRadiusX = origRadiusX + delta/2
  //   newX       = origX       + delta/2   (center shifts right by half the delta)
  // This keeps the left edge at (origX - origRadiusX) unchanged while the
  // right edge moves by the full delta. Same math with sign flips for the
  // other three handles.
  const handleResizeStart = useCallback((handle: 'left' | 'right' | 'top' | 'bottom', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isHorizontal = handle === 'left' || handle === 'right';
    resizeRef.current = {
      handle,
      startPos: isHorizontal ? e.clientX : e.clientY,
      origX: values.x ?? 0,
      origY: values.y ?? 0,
      origRadiusX: values.radiusX ?? values.size ?? 20,
      origRadiusY: values.radiusY ?? values.size ?? 20,
    };

    // Given the current pointer event, returns the new (center, radius) pair
    // for the axis being dragged. Only the changed fields are returned so the
    // non-dragged axis is preserved via setNestedValue's shallow merge.
    function compute(ev: PointerEvent | null): { radiusX?: number; radiusY?: number; x?: number; y?: number } | null {
      const r = resizeRef.current;
      if (!r || !ev) return null;
      const isH = r.handle === 'left' || r.handle === 'right';
      const delta = isH ? ev.clientX - r.startPos : ev.clientY - r.startPos;
      const sign = (r.handle === 'right' || r.handle === 'bottom') ? 1 : -1;
      const halfDelta = Math.round((delta / scale) / 2);

      if (isH) {
        const newR = Math.max(1, r.origRadiusX + sign * halfDelta);
        const actualDelta = newR - r.origRadiusX; // may be clamped if we hit the min-radius floor
        return { radiusX: newR, x: r.origX + sign * actualDelta };
      } else {
        const newR = Math.max(1, r.origRadiusY + sign * halfDelta);
        const actualDelta = newR - r.origRadiusY;
        return { radiusY: newR, y: r.origY + sign * actualDelta };
      }
    }

    function computeNewValues(ev: PointerEvent | null): Record<string, number> {
      const result = compute(ev);
      if (!result) return {};
      // Return only the changed fields — setNestedValue merges them onto the
      // existing layout, so fields we don't touch (the other axis) are preserved.
      return result as Record<string, number>;
    }

    function onMove(ev: PointerEvent) {
      const result = compute(ev);
      const el = elRef.current;
      if (!result || !el || !resizeRef.current) return;
      const r = resizeRef.current;
      const isH = r.handle === 'left' || r.handle === 'right';

      if (isH) {
        const newRx = result.radiusX!;
        const newCx = result.x!;
        const newW = newRx * 2 * scale;
        el.style.width = newW + 'px';
        el.style.left = (newCx * scale - newRx * scale) + 'px';
        const inner = el.querySelector('.ce-element') as HTMLElement;
        if (inner) inner.style.width = newW + 'px';
      } else {
        const newRy = result.radiusY!;
        const newCy = result.y!;
        const newH = newRy * 2 * scale;
        el.style.height = newH + 'px';
        el.style.top = (newCy * scale - newRy * scale) + 'px';
        const inner = el.querySelector('.ce-element') as HTMLElement;
        if (inner) inner.style.height = newH + 'px';
      }
    }

    function cleanup(ev: PointerEvent | null, commit: boolean) {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUpHandler);
      window.removeEventListener('pointercancel', onCancelHandler);
      resizeCleanupRef.current = null;

      const finalValues = commit ? computeNewValues(ev) : null;
      resizeRef.current = null;

      if (finalValues && Object.keys(finalValues).length > 0) {
        // Commit path — trigger the state update BEFORE clearing inline styles.
        // If we reset first, el.style.top becomes "" (auto) for one frame and
        // the element flashes to the top-left of its container before React
        // applies the new prop. Leaving the inline styles alone means the last
        // drag preview matches what the new render will paint, so the next
        // render quietly reuses the same pixel values without a visible jump.
        onDragEnd(finalValues);
      } else {
        // Cancel path — values haven't changed, so there will be no re-render
        // to restore the prop-driven position. Clear inline styles so the
        // element snaps back to whatever React already had rendered.
        resetInlineStyles();
      }
    }

    function onUpHandler(ev: PointerEvent) {
      cleanup(ev, true);
    }

    function onCancelHandler() {
      cleanup(null, false);
    }

    // Store cleanup so unmount / blur can call it
    resizeCleanupRef.current = () => cleanup(null, false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUpHandler);
    window.addEventListener('pointercancel', onCancelHandler);
  }, [values, scale, onDragEnd]);

  // Clean up on unmount or tab blur
  useEffect(() => {
    function onBlur() {
      if (resizeCleanupRef.current) resizeCleanupRef.current();
    }
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('blur', onBlur);
      if (resizeCleanupRef.current) resizeCleanupRef.current();
      resizeRef.current = null;
    };
  }, []);

  // Visual rendering based on element type
  let style: React.CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    cursor: 'grab',
    zIndex: selected ? 20 : 10,
    touchAction: 'none',
  };

  let inner: React.ReactNode;
  let resizeHandles: React.ReactNode = null;

  if (element.type === 'circle') {
    const rx = radiusX;
    const ry = radiusY;
    style = {
      ...style,
      left: x - rx,
      top: y - ry,
      width: rx * 2,
      height: ry * 2,
    };
    inner = (
      <div
        className={`ce-element ce-circle ${selected ? 'ce-selected' : ''}`}
        style={{ width: '100%', height: '100%', borderColor: color }}
      />
    );

    // Resize handles — only when selected
    if (selected) {
      resizeHandles = (
        <>
          <div
            className="ce-resize-handle ce-resize-handle-top"
            style={{ left: rx - HALF_HANDLE, top: -HALF_HANDLE }}
            onPointerDown={(e) => handleResizeStart('top', e)}
          />
          <div
            className="ce-resize-handle ce-resize-handle-bottom"
            style={{ left: rx - HALF_HANDLE, top: ry * 2 - HALF_HANDLE }}
            onPointerDown={(e) => handleResizeStart('bottom', e)}
          />
          <div
            className="ce-resize-handle ce-resize-handle-left"
            style={{ left: -HALF_HANDLE, top: ry - HALF_HANDLE }}
            onPointerDown={(e) => handleResizeStart('left', e)}
          />
          <div
            className="ce-resize-handle ce-resize-handle-right"
            style={{ left: rx * 2 - HALF_HANDLE, top: ry - HALF_HANDLE }}
            onPointerDown={(e) => handleResizeStart('right', e)}
          />
        </>
      );
    }
  } else if (element.type === 'rect') {
    const w = width || size * 4;
    const h = height || size;
    style = {
      ...style,
      width: w,
      height: h,
    };
    inner = (
      <div
        className={`ce-element ce-rect ${selected ? 'ce-selected' : ''}`}
        style={{ width: '100%', height: '100%', borderColor: color }}
      />
    );
  } else {
    // text
    const fakeWidth = Math.max(size * 4, 60);
    const fakeHeight = size * 1.4;
    style = {
      ...style,
      left: x - fakeWidth / 2,
      top: y - fakeHeight,
      width: fakeWidth,
      height: fakeHeight,
    };
    inner = (
      <div
        className={`ce-element ce-text ${selected ? 'ce-selected' : ''}`}
        style={{ width: '100%', height: '100%', fontSize: Math.max(size * 0.6, 8), borderColor: color }}
      >
        {element.label}
      </div>
    );
  }

  return (
    <div
      ref={elRef}
      className={`ce-element-wrap ${selected ? 'ce-element-wrap-selected' : ''}`}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {inner}
      {resizeHandles}
      <span className="ce-element-tag" style={{ backgroundColor: color }}>
        {element.label}
      </span>
    </div>
  );
}
