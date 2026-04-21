'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * BulkSelect — provider + hooks for multi-row selection + an action bar.
 * Usage:
 *   <BulkSelectProvider ids={rows.map((r) => r.id)}>
 *     {rows.map((r) => <BulkRow id={r.id} ...>{row content}</BulkRow>)}
 *     <BulkActionBar actions={[{ label: 'Credit', onRun: async (ids) => ... }]} />
 *   </BulkSelectProvider>
 */

interface Ctx {
  allIds: string[];
  selected: Set<string>;
  toggle: (id: string) => void;
  setOne: (id: string, on: boolean) => void;
  clear: () => void;
  selectAll: () => void;
  isSelected: (id: string) => boolean;
}

const BulkCtx = createContext<Ctx | null>(null);

export function BulkSelectProvider({ ids, children }: { ids: string[]; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const setOne = useCallback((id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);
  const selectAll = useCallback(() => setSelected(new Set(ids)), [ids]);
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const value = useMemo<Ctx>(() => ({
    allIds: ids, selected, toggle, setOne, clear, selectAll, isSelected,
  }), [ids, selected, toggle, setOne, clear, selectAll, isSelected]);

  return <BulkCtx.Provider value={value}>{children}</BulkCtx.Provider>;
}

export function useBulkSelect(): Ctx {
  const ctx = useContext(BulkCtx);
  if (!ctx) throw new Error('useBulkSelect must be used inside <BulkSelectProvider>');
  return ctx;
}

export function BulkCheckbox({ id, 'aria-label': ariaLabel }: { id: string; 'aria-label'?: string }) {
  const { isSelected, toggle } = useBulkSelect();
  return (
    <label className="av-bulk-check" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={isSelected(id)}
        onChange={() => toggle(id)}
        aria-label={ariaLabel}
      />
    </label>
  );
}

export function BulkSelectAll() {
  const { allIds, selected, selectAll, clear } = useBulkSelect();
  const all = selected.size > 0 && selected.size === allIds.length;
  const some = selected.size > 0 && !all;
  return (
    <label className="av-bulk-check">
      <input
        type="checkbox"
        checked={all}
        ref={(el) => { if (el) el.indeterminate = some; }}
        onChange={() => (all || some ? clear() : selectAll())}
        aria-label="Select all"
      />
    </label>
  );
}

export interface BulkAction {
  label: string;
  tone?: 'primary' | 'danger' | 'default';
  onRun: (ids: string[]) => Promise<void> | void;
}

export function BulkActionBar({ actions }: { actions: BulkAction[] }) {
  const { selected, clear } = useBulkSelect();
  const ids = Array.from(selected);
  if (ids.length === 0) return null;
  return (
    <div className="av-bulk-bar" role="toolbar" aria-label="Bulk actions">
      <span className="av-bulk-count">{ids.length} selected</span>
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          className={`av-btn av-btn-${a.tone === 'danger' ? 'danger' : a.tone === 'primary' ? 'primary' : 'ghost'}`}
          onClick={() => { void a.onRun(ids); }}
        >
          {a.label}
        </button>
      ))}
      <button type="button" className="av-btn av-btn-ghost" onClick={clear}>Cancel</button>
    </div>
  );
}
