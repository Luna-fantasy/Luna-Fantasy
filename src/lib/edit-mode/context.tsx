'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { PendingChange, EditModeContextValue } from './types';

const STORAGE_KEY = 'luna_edit_changes';

const EditModeContext = createContext<EditModeContextValue>({
  editMode: false,
  locale: 'en',
  changes: new Map(),
  addChange: () => {},
  removeChange: () => {},
  clearChanges: () => {},
});

export function useEditMode() {
  return useContext(EditModeContext);
}

function serializeChanges(changes: Map<string, PendingChange>): string {
  const entries: [string, PendingChange][] = [];
  changes.forEach((value, key) => {
    if (value.type !== 'image') {
      entries.push([key, value]);
    }
  });
  return JSON.stringify(entries);
}

function deserializeChanges(json: string): Map<string, PendingChange> {
  try {
    const entries: [string, PendingChange][] = JSON.parse(json);
    return new Map(entries);
  } catch {
    return new Map();
  }
}

interface EditModeProviderProps {
  children: ReactNode;
  locale: string;
}

/**
 * Detects editMode=1 from the URL client-side.
 * Middleware already strips this param for non-Masterminds,
 * so if it's present, the user is authorized.
 * When editMode is off, this is zero-overhead — just passes children through.
 */
export function EditModeProvider({ children, locale }: EditModeProviderProps) {
  const [editMode, setEditMode] = useState(false);
  const [changes, setChanges] = useState<Map<string, PendingChange>>(new Map());
  const [mounted, setMounted] = useState(false);

  // Detect editMode from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isEdit = params.get('editMode') === '1';
    setEditMode(isEdit);

    if (isEdit) {
      // Load persisted changes
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        setChanges(deserializeChanges(stored));
      }
      // Add body class for toolbar offset
      document.body.classList.add('edit-mode-active');
    }

    setMounted(true);

    return () => {
      document.body.classList.remove('edit-mode-active');
    };
  }, []);

  // Persist to sessionStorage on change
  useEffect(() => {
    if (!mounted) return;
    if (editMode) {
      sessionStorage.setItem(STORAGE_KEY, serializeChanges(changes));
    }
  }, [changes, editMode, mounted]);

  // Warn about unsaved changes on unload
  useEffect(() => {
    if (!editMode || changes.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editMode, changes.size]);

  const addChange = useCallback((key: string, change: PendingChange) => {
    setChanges(prev => {
      const next = new Map(prev);
      next.set(key, change);
      return next;
    });
  }, []);

  const removeChange = useCallback((key: string) => {
    setChanges(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clearChanges = useCallback(() => {
    setChanges(new Map());
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <EditModeContext.Provider
      value={{ editMode, locale, changes, addChange, removeChange, clearChanges }}
    >
      {children}
    </EditModeContext.Provider>
  );
}
