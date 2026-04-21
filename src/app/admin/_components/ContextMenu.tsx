'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  tone?: 'default' | 'danger' | 'primary';
  disabled?: boolean;
  run: () => void | Promise<void>;
}

export type ContextMenuItems = Array<ContextMenuItem | 'separator'>;

interface ContextMenuProps {
  /** Builder receives the native event; return [] to cancel. */
  items: ContextMenuItems | (() => ContextMenuItems);
  children: ReactNode;
  className?: string;
}

/**
 * ContextMenu — wraps any element; right-click opens a floating menu.
 * Uses a portal so it can escape clipped ancestors (tables, scroll containers).
 */
export default function ContextMenu({ items, children, className }: ContextMenuProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [resolved, setResolved] = useState<ContextMenuItems>([]);
  const [active, setActive] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const open = useCallback((e: React.MouseEvent) => {
    const list = typeof items === 'function' ? items() : items;
    if (!list || list.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setResolved(list);
    setActive(0);
    setPos({ x: e.clientX, y: e.clientY });
  }, [items]);

  const close = useCallback(() => setPos(null), []);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      const list = resolved.filter((x): x is ContextMenuItem => x !== 'separator');
      if (list.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % list.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + list.length) % list.length); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const item = list[active];
        if (item && !item.disabled) { void item.run(); close(); }
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pos, resolved, active, close]);

  // Position adjustment to stay on-screen
  const [adjusted, setAdjusted] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!pos || !menuRef.current) { setAdjusted(null); return; }
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const x = rect.right > vw - 8 ? Math.max(8, pos.x - rect.width) : pos.x;
    const y = rect.bottom > vh - 8 ? Math.max(8, pos.y - rect.height) : pos.y;
    setAdjusted({ x, y });
  }, [pos, resolved]);

  const realItems = resolved.filter((x): x is ContextMenuItem => x !== 'separator');

  return (
    <>
      <div className={className} onContextMenu={open}>{children}</div>
      {pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="av-ctxmenu"
          style={{ left: adjusted?.x ?? pos.x, top: adjusted?.y ?? pos.y }}
          role="menu"
        >
          {resolved.map((item, i) => {
            if (item === 'separator') return <div key={`sep-${i}`} className="av-ctxmenu-sep" />;
            const itemIdx = realItems.indexOf(item);
            const isActive = itemIdx === active;
            return (
              <button
                key={i}
                type="button"
                disabled={item.disabled}
                className={`av-ctxmenu-item av-ctxmenu-item--${item.tone ?? 'default'}${isActive ? ' av-ctxmenu-item--active' : ''}`}
                onMouseEnter={() => setActive(itemIdx)}
                onClick={() => { void item.run(); close(); }}
                role="menuitem"
              >
                {item.icon && <span className="av-ctxmenu-icon">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
