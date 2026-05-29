'use client';

import React, { useEffect, useState } from 'react';
import { DynamicIcon } from 'lucide-react/dynamic';

const DEFAULT_FRAME = 'w-32 md:w-40 h-32 md:h-40';

export type SafeImageProps = {
  src: string | undefined | null;
  alt: string;
  /** Applied to the outer wrapper in both success and fallback states */
  className?: string;
  /** Extra classes on the img only (e.g. object-contain, filters) */
  imageClassName?: string;
  /** Constrains the image/placeholder box; defaults to a medium portrait frame */
  frameClassName?: string;
  /** lucide-react/dynamic icon name when src is empty or load fails */
  fallbackIcon?: string;
};

/**
 * Renders a remote or data URL image with a native img and a placeholder on
 * empty src or load error. Prefer this over next/image when URLs may be invalid
 * or unlisted in remotePatterns (e.g. previews, user-provided links).
 */
export function SafeImage({
  src,
  alt,
  className = '',
  imageClassName = '',
  frameClassName,
  fallbackIcon = 'user-circle',
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  const trimmed = (src ?? '').trim();
  const showImage = trimmed !== '' && !failed;
  const frame = frameClassName ?? DEFAULT_FRAME;

  useEffect(() => {
    setFailed(false);
  }, [trimmed]);

  if (!showImage) {
    return (
      <div
        className={`${frame} bg-zinc-700 rounded-md flex items-center justify-center ${className}`}
      >
        <DynamicIcon name={fallbackIcon as any} size={48} color="#9CA3AF" />
      </div>
    );
  }

  return (
    <div
      className={`${frame} flex items-center justify-center rounded-md overflow-hidden ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- intentional: avoids next/image remotePatterns and invalid src crashes in live preview */}
      <img
        src={trimmed}
        alt={alt}
        className={`max-h-full max-w-full object-cover ${imageClassName}`}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
