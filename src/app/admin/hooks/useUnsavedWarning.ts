'use client';

import { useEffect } from 'react';

export function useUnsavedWarning(hasChanges: boolean) {
  useEffect(() => {
    if (!hasChanges) return;
    function onBeforeUnload(e: BeforeUnloadEvent) { e.preventDefault(); }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasChanges]);
}
