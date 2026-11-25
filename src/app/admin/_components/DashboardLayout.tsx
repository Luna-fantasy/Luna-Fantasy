'use client';

import { Children, isValidElement, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * DashboardLayout — wraps Overview children and lets the admin drag-reorder
 * each section. Children must be `<Section id="..." label="...">` elements so
 * we have a stable key.
 *
 * Order persists in localStorage. Sections not in the saved order append at
 * the end in their natural order.
 */

const STORAGE_KEY = 'av-dashboard-order';

interface SectionProps {
  id: string;
  label?: string;
  /** Set true to exclude this section from drag reorder (e.g., a pinned header). */
  locked?: boolean;
  children: ReactNode;
}

export function Section({ children }: SectionProps) {
  // Just a marker — the real rendering happens in DashboardLayout.
  return <>{children}</>;
}
Section.displayName = 'DashboardSection';

function loadOrder(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveOrder(order: string[]) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch { /* ignore */ }
}

interface SectionEntry {
  id: string;
  label?: string;
  locked?: boolean;
  node: ReactNode;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  // Extract all <Section> elements with their ids
  const entries = useMemo<SectionEntry[]>(() => {
    const arr: SectionEntry[] = [];
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      const props = child.props as SectionProps | undefined;
      if (!props || !props.id) return;
      arr.push({
        id: props.id,
        label: props.label,
        locked: !!props.locked,
        node: props.children,
      });
    });
    return arr;
  }, [children]);

  const [order, setOrder] = useState<string[]>(() => entries.map((e) => e.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    const movable = entries.filter((entry) => !entry.locked).map((entry) => entry.id);
    const saved = loadOrder().filter((id) => movable.includes(id));
    const sorted = Array.from(new Set([...saved, ...movable]));
    let index = 0;
    setOrder(entries.map((entry) => entry.locked ? entry.id : sorted[index++]));
  }, [entries]);

  const ordered = useMemo(() => {
    const byId = new Map(entries.map((e) => [e.id, e] as const));
    return order
      .map((id) => byId.get(id))
      .filter((e): e is SectionEntry => !!e);
  }, [order, entries]);

  const movableIds = useMemo(() => ordered.filter((entry) => !entry.locked).map((entry) => entry.id), [ordered]);

  const move = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setOrder((prev) => {
      const movable = prev.filter((id) => movableIds.includes(id));
      const from = movable.indexOf(fromId);
      const to = movable.indexOf(toId);
      if (from === -1 || to === -1) return prev;
      movable.splice(from, 1);
      movable.splice(to, 0, fromId);
      let index = 0;
      const next = prev.map((id) => movableIds.includes(id) ? movable[index++] : id);
      saveOrder(next);
      return next;
    });
  }, [movableIds]);

  const reset = useCallback(() => {
    const fresh = entries.map((e) => e.id);
    setOrder(fresh);
    saveOrder(fresh);
  }, [entries]);

  return (
    <div className={`av-dashlayout${editMode ? ' av-dashlayout--editing' : ''}`}>
      <div className="av-dashlayout-bar">
        <button
          type="button"
          className={`av-btn av-btn-ghost av-dashlayout-edit${editMode ? ' av-dashlayout-edit--on' : ''}`}
          onClick={() => setEditMode((m) => !m)}
          title="Rearrange dashboard sections"
          aria-pressed={editMode}
        >
          ⁝⁝ {editMode ? 'Done' : 'Rearrange'}
        </button>
        {editMode && (
          <button type="button" className="av-btn av-btn-ghost" onClick={reset}>
            Reset order
          </button>
        )}
      </div>
      {ordered.map((entry) => {
        const position = movableIds.indexOf(entry.id);
        const label = entry.label ?? entry.id;
        const isDragging = draggingId === entry.id;
        const isOver = overId === entry.id && draggingId && draggingId !== entry.id;
        return (
          <div
            key={entry.id}
            className={`av-dashsection${isDragging ? ' av-dashsection--dragging' : ''}${isOver ? ' av-dashsection--over' : ''}${entry.locked ? ' av-dashsection--locked' : ''}`}
            data-section-id={entry.id}
            onDragOver={(e) => {
              if (!editMode || !draggingId || entry.locked) return;
              e.preventDefault();
              setOverId(entry.id);
            }}
            onDragLeave={() => setOverId((cur) => (cur === entry.id ? null : cur))}
            onDrop={(e) => {
              if (!editMode || !draggingId || entry.locked) return;
              e.preventDefault();
              move(draggingId, entry.id);
              setDraggingId(null);
              setOverId(null);
            }}
          >
            {editMode && !entry.locked && (
              <div className="av-dashsection-controls">
                <div
                  className="av-dashsection-handle"
                  draggable
                  onDragStart={(e) => {
                    setDraggingId(entry.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', entry.id);
                  }}
                  onDragEnd={() => { setDraggingId(null); setOverId(null); }}
                  title="Drag to reorder"
                >
                  <span aria-hidden="true">⋮⋮</span>
                  <span>{label}</span>
                </div>
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  aria-label={`Move ${label} up`}
                  disabled={position <= 0}
                  onClick={() => move(entry.id, movableIds[position - 1])}
                >↑</button>
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  aria-label={`Move ${label} down`}
                  disabled={position >= movableIds.length - 1}
                  onClick={() => move(entry.id, movableIds[position + 1])}
                >↓</button>
              </div>
            )}
            {entry.node}
          </div>
        );
      })}
    </div>
  );
}
