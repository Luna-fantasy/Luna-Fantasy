'use client';

import { useRef, useCallback } from 'react';
import Image, { type ImageProps } from 'next/image';
import { useEditMode } from '@/lib/edit-mode/context';

interface EditableImageProps extends Omit<ImageProps, 'onClick'> {
  editId: string;
  source?: 'r2' | 'public';
  dbCollection?: string;
  dbId?: string;
  dbField?: string;
}

/**
 * Wraps a Next.js Image for inline editing.
 * In normal mode, renders a standard Image.
 * In edit mode, shows an overlay on hover and opens file picker on click.
 */
export function EImg({
  editId,
  source = 'public',
  dbCollection,
  dbId,
  dbField,
  ...imageProps
}: EditableImageProps) {
  const { editMode, changes, addChange } = useEditMode();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) return;
      // 10MB max
      if (file.size > 10 * 1024 * 1024) return;

      const previewUrl = URL.createObjectURL(file);
      addChange(`img:${editId}`, {
        type: 'image',
        id: editId,
        source,
        file,
        previewUrl,
        dbCollection,
        dbId,
        dbField,
      });

      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [editId, source, dbCollection, dbId, dbField, addChange]
  );

  if (!editMode) {
    return <Image {...imageProps} />;
  }

  const pendingChange = changes.get(`img:${editId}`);
  const hasChange = !!pendingChange;
  const displaySrc = hasChange && pendingChange.type === 'image'
    ? pendingChange.previewUrl
    : imageProps.src;

  return (
    <div
      className={`editable-image-wrapper ${hasChange ? 'has-change' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
    >
      <Image {...imageProps} src={displaySrc} />
      <div className="editable-image-overlay">
        <div className="editable-image-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span>{hasChange ? 'Change Image' : 'Replace Image'}</span>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
