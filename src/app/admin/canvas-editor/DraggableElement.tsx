'use client';

import { useRef, useCallback } from 'react';
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

  const x = (values.x ?? 0) * scale;
  const y = (values.y ?? 0) * scale;
  const size = (values.size ?? values.fontSize ?? 20) * scale;
  const width = (values.width ?? 0) * scale;
  const height = (values.height ?? 0) * scale;

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
    // Use CSS transform so React re-renders (from onSelect) don't overwrite position
    elRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !elRef.current) return;
    elRef.current.releasePointerCapture(e.pointerId);
    // Clear the drag transform — final position will come from props after onDragEnd
    elRef.current.style.transform = '';
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newX = dragRef.current.origCanvasX + Math.round(dx / scale);
    const newY = dragRef.current.origCanvasY + Math.round(dy / scale);
    dragRef.current = null;
    onDragEnd({ ...values, x: newX, y: newY });
  }, [scale, values, onDragEnd]);

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

  if (element.type === 'circle') {
    const r = size;
    const d = r * 2;
    style = {
      ...style,
      left: x - r,
      top: y - r,
      width: d,
      height: d,
      borderRadius: '50%',
    };
    inner = (
      <div
        className={`ce-element ce-circle ${selected ? 'ce-selected' : ''}`}
        style={{ width: '100%', height: '100%', borderColor: color }}
      />
    );
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
      <span className="ce-element-tag" style={{ backgroundColor: color }}>
        {element.label}
      </span>
    </div>
  );
}
