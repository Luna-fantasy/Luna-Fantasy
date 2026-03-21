'use client';

import { useRef, useCallback, type ReactNode, type KeyboardEvent, type MouseEvent } from 'react';
import { useEditMode } from '@/lib/edit-mode/context';

interface EditableDbTextProps {
  collection: string;
  id: string;
  field: string;
  children: ReactNode;
  tag?: keyof JSX.IntrinsicElements;
  className?: string;
}

/**
 * Wraps DB-backed text for inline editing.
 * Same editing behavior as <E> but registers db_field change type.
 */
export function EDb({ collection, id, field, children, tag, className }: EditableDbTextProps) {
  const { editMode, changes, addChange, removeChange } = useEditMode();
  const ref = useRef<HTMLElement>(null);
  const originalRef = useRef<string>('');
  const editKey = `db:${collection}:${id}:${field}`;

  const handleFocus = useCallback(() => {
    if (ref.current && !originalRef.current) {
      originalRef.current = ref.current.textContent ?? '';
    }
  }, []);

  const handleBlur = useCallback(() => {
    if (!ref.current) return;
    const newText = ref.current.textContent ?? '';
    const original = originalRef.current;

    if (newText !== original && newText.trim() !== '') {
      addChange(editKey, {
        type: 'db_field',
        collection,
        id,
        field,
        value: newText,
        original,
      });
    } else if (newText === original) {
      removeChange(editKey);
    }
  }, [editKey, collection, id, field, addChange, removeChange]);

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
