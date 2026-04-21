'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import Image, { type ImageProps } from 'next/image';
import { useTranslations } from 'next-intl';
import { useEditMode } from '@/lib/edit-mode/context';

interface EditableImageProps extends Omit<ImageProps, 'onClick'> {
  editId: string;
  source?: 'r2' | 'public';
  dbCollection?: string;
  dbId?: string;
  dbField?: string;
  /**
   * Optional explicit key override for the alt-text translation. Defaults to
   * `editId`, so most callers don't set this — the same identifier backs both
   * the image swap and its alt override under the `alts.*` namespace.
   */
  altKey?: string;
}

/**
 * Wraps a Next.js Image for inline editing.
 * - Normal mode: renders a standard Image. The `alt` attribute comes from
 *   the `alts.{altKey ?? editId}` translation override when one exists; falls
 *   back to the JSX `alt` prop. This lets masterminds rewrite alt text for
 *   a11y / SEO without touching source code.
 * - Edit mode: shows a "replace image" overlay on hover + click, and a
 *   separate "alt" affordance that opens an inline textbox. Image swaps
 *   upload to R2; alt changes flow through the existing translation pipeline.
 */
export function EImg({
  editId,
  source = 'public',
  dbCollection,
  dbId,
  dbField,
  altKey,
  ...imageProps
}: EditableImageProps) {
  const { editMode, locale, changes, addChange, removeChange } = useEditMode();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [altEditing, setAltEditing] = useState(false);
  const [altDraft, setAltDraft] = useState<string>('');
  const altInputRef = useRef<HTMLInputElement>(null);

  const resolvedAltKey = altKey ?? editId;
  const altTranslationKey = `alts.${resolvedAltKey}`;
  const altChangeKey = `alt:${resolvedAltKey}`;

  // Read the live alt from the `alts` namespace; if the key doesn't exist
  // (most won't, since we only create them on first edit), fall back to the
  // JSX prop. next-intl throws on missing keys — catch and swallow silently.
  const tAlts = useTranslations('alts');
  let liveAlt = imageProps.alt ?? '';
  try {
    const candidate = tAlts(resolvedAltKey as any);
    if (candidate && candidate !== resolvedAltKey) liveAlt = candidate;
  } catch {
    /* key missing — fall back to JSX alt */
  }

  const handleReplaceClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) return;
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

      e.target.value = '';
    },
    [editId, source, dbCollection, dbId, dbField, addChange]
  );

  const openAltEditor = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const pending = changes.get(altChangeKey);
      const seed = pending && pending.type === 'translation' ? pending.value : liveAlt;
      setAltDraft(seed);
      setAltEditing(true);
    },
    [changes, altChangeKey, liveAlt]
  );

  const commitAlt = useCallback(() => {
    const trimmed = altDraft.trim();
    setAltEditing(false);
    // If unchanged from the live alt, clear any pending change so the badge
    // doesn't falsely claim there's an edit.
    if (trimmed === liveAlt) {
      removeChange(altChangeKey);
      return;
    }
    addChange(altChangeKey, {
      type: 'translation',
      key: altTranslationKey,
      locale,
      value: trimmed,
      original: liveAlt,
    });
  }, [altDraft, liveAlt, altChangeKey, altTranslationKey, locale, addChange, removeChange]);

  const cancelAlt = useCallback(() => {
    setAltEditing(false);
  }, []);

  // Auto-focus the alt input when it opens
  useEffect(() => {
    if (altEditing) altInputRef.current?.focus();
  }, [altEditing]);

  if (!editMode) {
    return <Image {...imageProps} alt={liveAlt} />;
  }

  const pendingImage = changes.get(`img:${editId}`);
  const hasImageChange = !!pendingImage;
  const displaySrc = hasImageChange && pendingImage.type === 'image'
    ? pendingImage.previewUrl
    : imageProps.src;

  const pendingAlt = changes.get(altChangeKey);
  const hasAltChange = !!pendingAlt;
  const previewAlt = hasAltChange && pendingAlt.type === 'translation' ? pendingAlt.value : liveAlt;

  return (
    <div
      className={`editable-image-wrapper ${hasImageChange || hasAltChange ? 'has-change' : ''}`}
      role="group"
      aria-label={`Edit image ${editId}`}
    >
      <div
        className="editable-image-target"
        onClick={handleReplaceClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') handleReplaceClick(); }}
      >
        <Image {...imageProps} src={displaySrc} alt={previewAlt} />
        <div className="editable-image-overlay">
          <div className="editable-image-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>{hasImageChange ? 'Change Image' : 'Replace Image'}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={`editable-image-alt-btn${hasAltChange ? ' has-change' : ''}`}
        onClick={openAltEditor}
        title={`Edit alt text — currently: ${previewAlt || '(empty)'}`}
        aria-label="Edit alt text"
      >
        ✎ alt
      </button>

      {altEditing && (
        <div className="editable-image-alt-popover" onClick={(e) => e.stopPropagation()}>
          <label className="editable-image-alt-label">Alt text</label>
          <input
            ref={altInputRef}
            type="text"
            className="editable-image-alt-input"
            value={altDraft}
            onChange={(e) => setAltDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAlt();
              else if (e.key === 'Escape') cancelAlt();
            }}
            maxLength={300}
            placeholder="Describe this image…"
          />
          <div className="editable-image-alt-actions">
            <button type="button" className="editable-image-alt-cancel" onClick={cancelAlt}>Cancel</button>
            <button type="button" className="editable-image-alt-save" onClick={commitAlt}>Save</button>
          </div>
        </div>
      )}

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
