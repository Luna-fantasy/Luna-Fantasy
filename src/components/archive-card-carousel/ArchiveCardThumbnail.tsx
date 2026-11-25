/* eslint-disable @next/next/no-img-element -- the local art registry already supplies both compressed image sizes. */
import type { ReactEventHandler } from 'react';

type Props = {
  src: string;
  highDensitySrc?: string;
  alt: string;
  className: string;
  onError?: ReactEventHandler<HTMLImageElement>;
};

export function ArchiveCardThumbnail({ src, highDensitySrc, alt, className, onError }: Props) {
  return (
    <img
      src={src}
      srcSet={highDensitySrc && highDensitySrc !== src ? `${src} 1x, ${highDensitySrc} 2x` : undefined}
      width={300}
      height={highDensitySrc ? 450 : 420}
      loading="lazy"
      decoding="async"
      alt={alt}
      className={className}
      onError={(event) => {
        const image = event.currentTarget;
        if (image.hasAttribute('srcset')) {
          image.removeAttribute('srcset');
          image.src = src;
        } else {
          onError?.(event);
        }
      }}
    />
  );
}
