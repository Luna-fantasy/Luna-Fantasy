'use client';

import { useState, type ComponentProps } from 'react';
import Image from 'next/image';
import { EImg } from '@/components/edit-mode/EditableImage';
import { useEditMode } from '@/lib/edit-mode/context';
import { PEOPLE_HERO, peopleHeroSources } from '@/lib/cinematic/people-art';

type EditableProps = Omit<ComponentProps<typeof EImg>, 'src' | 'onError'>;
type DisplayImageProps = Omit<ComponentProps<typeof Image>, 'src' | 'onError'>;
type ArtworkProps = { approved?: string; original: string; nativeDetail?: string };

function useArtworkSource({ approved, original, nativeDetail }: ArtworkProps) {
  const { editMode } = useEditMode();
  const [failed, setFailed] = useState<string>();
  const [failedNative, setFailedNative] = useState<string>();
  const showNative = !!nativeDetail && !editMode && nativeDetail !== failedNative;
  const showApproved = !!approved && !editMode && approved !== failed;
  return {
    src: showNative ? nativeDetail : showApproved ? approved : original,
    isNative: showNative,
    onError: () => {
      if (showNative) setFailedNative(nativeDetail);
      else if (showApproved) setFailed(approved);
    },
  };
}

export function CinematicArtwork({ approved, original, nativeDetail, ...image }: ArtworkProps & DisplayImageProps) {
  const { isNative, ...source } = useArtworkSource({ approved, original, nativeDetail });
  return <Image {...image} {...source} unoptimized={isNative || source.src === approved || image.unoptimized} />;
}

type HeroSource = (typeof PEOPLE_HERO)[keyof typeof PEOPLE_HERO];

export function EditableCinematicArtwork({
  approved, original, nativeDetail, responsiveHero, ...image
}: ArtworkProps & EditableProps & { responsiveHero?: HeroSource }) {
  const { isNative, ...source } = useArtworkSource({ approved, original, nativeDetail });
  const isResponsive = !!responsiveHero && source.src === responsiveHero;
  // Avoid Next preloading the 1920px fallback alongside the browser's selected artwork.
  const imageNode = <EImg {...image} {...source}
    priority={!isResponsive && image.priority}
    loading={isResponsive ? 'eager' : image.loading}
    fetchPriority={isResponsive ? 'high' : image.fetchPriority}
    unoptimized={isNative || source.src === approved || image.unoptimized}
  />;
  // In edit or failed-image fallback, keep the established editable image unwrapped.
  if (!responsiveHero || !isResponsive) return imageNode;
  const hero = peopleHeroSources(responsiveHero);
  return <picture><source srcSet={hero.srcSet} sizes="100vw" type="image/webp" />{imageNode}</picture>;
}
