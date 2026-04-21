'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ring-buffer history for a single canvas layout draft. Stores up to
 * MAX_HISTORY recent snapshots so the admin can Ctrl+Z after a mistaken drag
 * or property tweak. Non-persistent — saved state intentionally resets the
 * history, because once a snapshot is committed to MongoDB there's no safe
 * "undo" path that doesn't clash with the admin pending-action queue.
 *
 * Behaviour notes:
 * - Two-element arrays whose JSON stringification matches are NOT pushed
 *   twice in a row — coalesces chatty drag events into one entry.
 * - `replaceTop(value)` lets an in-progress drag update the top entry
 *   without growing the stack on every mousemove.
 * - `reset(value)` wipes the stack and seeds a new baseline.
 */

const MAX_HISTORY = 50;

export interface CanvasHistory<T> {
  value: T;
  canUndo: boolean;
  canRedo: boolean;
  push: (next: T) => void;
  replaceTop: (next: T) => void;
  undo: () => void;
  redo: () => void;
  reset: (next: T) => void;
}

function sameShape<T>(a: T, b: T): boolean {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

export function useCanvasHistory<T>(initial: T): CanvasHistory<T> {
  // Stack holds snapshots in chronological order; `index` points at the
  // currently-visible snapshot. Pushing new values after an undo discards
  // any redo-able entries to the right of the cursor.
  const [stack, setStack] = useState<T[]>([initial]);
  const [index, setIndex] = useState<number>(0);
  const stackRef = useRef(stack);
  const indexRef = useRef(index);
  useEffect(() => { stackRef.current = stack; }, [stack]);
  useEffect(() => { indexRef.current = index; }, [index]);

  const value = stack[index];

  const push = useCallback((next: T) => {
    const cur = stackRef.current;
    const i = indexRef.current;
    if (sameShape(cur[i], next)) return;
    const head = cur.slice(0, i + 1);
    head.push(next);
    const trimmed = head.length > MAX_HISTORY ? head.slice(head.length - MAX_HISTORY) : head;
    setStack(trimmed);
    setIndex(trimmed.length - 1);
  }, []);

  const replaceTop = useCallback((next: T) => {
    const cur = stackRef.current;
    const i = indexRef.current;
    if (sameShape(cur[i], next)) return;
    const copy = cur.slice();
    copy[i] = next;
    setStack(copy);
  }, []);

  const undo = useCallback(() => {
    if (indexRef.current > 0) setIndex(indexRef.current - 1);
  }, []);

  const redo = useCallback(() => {
    if (indexRef.current < stackRef.current.length - 1) setIndex(indexRef.current + 1);
  }, []);

  const reset = useCallback((next: T) => {
    setStack([next]);
    setIndex(0);
  }, []);

  return {
    value,
    canUndo: index > 0,
    canRedo: index < stack.length - 1,
    push,
    replaceTop,
    undo,
    redo,
    reset,
  };
}
