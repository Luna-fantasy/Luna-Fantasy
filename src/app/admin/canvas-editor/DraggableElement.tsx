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

  // Resize state — managed via ref + window listeners to avoid interfering with drag
  const resizeRef = useRef<{
    handle: 'left' | 'right' | 'top' | 'bottom';
    startPos: number;
    origRadiusX: number;
    origRadiusY: number;
  } | null>(null);

  const x = (values.x ?? 0) * scale;
  const y = (values.y ?? 0) * scale;
  const size = (values.size ?? values.fontSize ?? 20) * scale;
  const width = (values.width ?? 0) * scale;
  const height = (values.height ?? 0) * scale;

  // Ellipse radii (fallback to size for backward compat)
  const radiusX = (values.radiusX ?? values.size ?? 20) * scale;
  const radiusY = (values.radiusY ?? values.size ?? 20) * scale;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
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

  // Resize handle interaction via window events
  const handleResizeStart = useCallback((handle: 'left' | 'right' | 'top' | 'bottom', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isHorizontal = handle === 'left' || handle === 'right';
    resizeRef.current = {
      handle,
      startPos: isHorizontal ? e.clientX : e.clientY,
      origRadiusX: values.radiusX ?? values.size ?? 20,
      origRadiusY: values.radiusY ?? values.size ?? 20,
    };

    function onMove(ev: PointerEvent) {
      if (!resizeRef.current) return;
      const r = resizeRef.current;
      const isH = r.handle === 'left' || r.handle === 'right';
      const delta = isH ? ev.clientX - r.startPos : ev.clientY - r.startPos;
      const sign = (r.handle === 'right' || r.handle === 'bottom') ? 1 : -1;

      if (isH) {
        const newRx = Math.max(1, r.origRadiusX + Math.round((delta * sign) / scale));
        // Update DOM directly for smooth feedback
        const el = elRef.current;
        if (el) {
          const newW = newRx * scale * 2;
          const cx = (values.x ?? 0) * scale;
          el.style.width = newW + 'px';
          el.style.left = (cx - newRx * scale) + 'px';
          const inner = el.querySelector('.ce-element') as HTMLElement;
          if (inner) inner.style.width = newW + 'px';
        }
      } else {
        const newRy = Math.max(1, r.origRadiusY + Math.round((delta * sign) / scale));
        const el = elRef.current;
        if (el) {
          const newH = newRy * scale * 2;
          const cy = (values.y ?? 0) * scale;
          el.style.height = newH + 'px';
          el.style.top = (cy - newRy * scale) + 'px';
          const inner = el.querySelector('.ce-element') as HTMLElement;
          if (inner) inner.style.height = newH + 'px';
        }
      }
    }

    function onUp(ev: PointerEvent) {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!resizeRef.current) return;
      const r = resizeRef.current;
      const isH = r.handle === 'left' || r.handle === 'right';
      const delta = isH ? ev.clientX - r.startPos : ev.clientY - r.startPos;
      const sign = (r.handle === 'right' || r.handle === 'bottom') ? 1 : -1;
      resizeRef.current = null;

      const newValues = { ...values };
      if (isH) {
        newValues.radiusX = Math.max(1, r.origRadiusX + Math.round((delta * sign) / scale));
      } else {
        newValues.radiusY = Math.max(1, r.origRadiusY + Math.round((delta * sign) / scale));
      }
      // Reset inline styles
      const el = elRef.current;
      if (el) {
        el.style.width = '';
        el.style.height = '';
        el.style.left = '';
        el.style.top = '';
        const inner = el.querySelector('.ce-element') as HTMLElement;
        if (inner) { inner.style.width = ''; inner.style.height = ''; }
      }
      onDragEnd(newValues);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [values, scale, onDragEnd]);

  // Cleanup window listeners on unmount
  useEffect(() => {
    return () => {
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
      borderRadius: '50%',
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
