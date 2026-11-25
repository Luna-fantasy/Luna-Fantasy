'use client';

import { useState, type ComponentProps } from 'react';
import { EImg } from './EditableImage';
import { useEditMode } from '@/lib/edit-mode/context';
import { STORY_COVER_BASE, storyCoverPresentationSrc } from '@/lib/cinematic/v19-visual-fix-src';

export function StoryCoverImage(props: Omit<ComponentProps<typeof EImg>, 'src' | 'unoptimized' | 'onError'>) {
  const { editMode } = useEditMode();
  const [failed, setFailed] = useState<string>();
  const src = !editMode ? storyCoverPresentationSrc() : undefined;
  const overlay = src && src !== failed ? src : undefined;
  return <EImg {...props} src={overlay || STORY_COVER_BASE}
    unoptimized={!!overlay || undefined} onError={overlay ? () => setFailed(overlay) : undefined} />;
}
