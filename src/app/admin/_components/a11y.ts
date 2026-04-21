import { useEffect, type KeyboardEvent, type RefObject } from 'react';

/**
 * Keyboard handler for role="button" / tabIndex={0} divs and list items.
 * Native <button> gets Enter/Space activation for free — ARIA buttons don't,
 * so we bind it ourselves. Pair with onClick={handler} and the same callback.
 */
export function onButtonKey(handler: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      handler();
    }
  };
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function visibleFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
  );
}

/**
 * Traps Tab/Shift+Tab focus within a container while `active` is true.
 * On mount: focuses the first [data-autofocus] element, else the first focusable.
 * On unmount: restores focus to whatever was active before the trap started.
 * Escape key fires `onEscape` (typical use: close the dialog).
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(ref, open, onClose);
 *   return <div ref={ref} role="dialog" aria-modal="true">...</div>;
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement>,
  active: boolean,
  onEscape?: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const prevActive = document.activeElement as HTMLElement | null;
    const initial =
      container.querySelector<HTMLElement>('[data-autofocus]') ??
      visibleFocusables(container)[0] ??
      container;
    queueMicrotask(() => {
      try { initial.focus({ preventScroll: true } as FocusOptions); } catch { /* ignore */ }
    });

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!container.contains(document.activeElement)) return;
      if (e.key === 'Escape') {
        if (onEscape) {
          e.preventDefault();
          onEscape();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = visibleFocusables(container);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (current === first || !container.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (current === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (prevActive && typeof prevActive.focus === 'function') {
        try { prevActive.focus({ preventScroll: true } as FocusOptions); } catch { /* ignore */ }
      }
    };
  }, [ref, active, onEscape]);
}
