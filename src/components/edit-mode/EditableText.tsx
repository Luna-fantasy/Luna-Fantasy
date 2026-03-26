'use client';

import { useRef, useCallback, type ReactNode, type KeyboardEvent, type MouseEvent } from 'react';
import { useEditMode } from '@/lib/edit-mode/context';

interface EditableTextProps {
  ns: string;
  k: string;
  children: ReactNode;
  tag?: keyof JSX.IntrinsicElements;
  className?: string;
}

/**
 * Wraps a translation value for inline editing.
 * In normal mode, renders children as-is (zero overhead).
 * In edit mode, renders a contentEditable element.
 */
export function E({ ns, k, children, tag, className }: EditableTextProps) {
  const { editMode, locale, changes, addChange, removeChange } = useEditMode();
  const ref = useRef<HTMLElement>(null);
  const originalRef = useRef<string>('');
  const editKey = `${ns}.${k}`;

  const handleFocus = useCallback(() => {
    if (ref.current && !originalRef.current) {
      originalRef.current = ref.current.textContent ?? '';
    }
  }, []);

  const handleBlur = useCallback(() => {
    if (!ref.current) return;
    const newText = ref.current.textContent ?? '';
    const original = originalRef.current;

    if (newText !== original) {
      addChange(editKey, {
        type: 'translation',
        key: editKey,
        locale,
        value: newText,
        original,
      });
    } else {
      removeChange(editKey);
    }
  }, [editKey, locale, addChange, removeChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
    if (e.key === 'Escape') {
      if (ref.current && originalRef.current) {
        ref.current.textContent = originalRef.current;
      }
      (e.target as HTMLElement).blur();
    }
  }, []);

  // Prevent clicks from bubbling to parent links/buttons
  const handleClick = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  if (!editMode) {
    if (tag) {
      const Tag = tag as any;
      return <Tag className={className}>{children}</Tag>;
    }
    return <>{children}</>;
  }

  const hasChange = changes.has(editKey);
  const Tag = (tag ?? 'span') as any;

  return (
    <Tag
      ref={ref}
      className={`editable-text ${hasChange ? 'has-change' : ''} ${className ?? ''}`}
      contentEditable
      suppressContentEditableWarning
      data-edit-key={editKey}
      onClick={handleClick}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      {hasChange ? (changes.get(editKey) as any)?.value : children}
    </Tag>
  );
}
