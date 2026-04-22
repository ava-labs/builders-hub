'use client';

import React, { useEffect, useState } from 'react';
import { DynamicIcon } from 'lucide-react/dynamic';

type SafeSpeakerPictureProps = {
  src: string | undefined | null;
  alt: string;
  /** Applied to both the image and the placeholder wrapper */
  className?: string;
};

export function SafeSpeakerPicture({ src, alt, className = '' }: SafeSpeakerPictureProps) {
  const [failed, setFailed] = useState(false);
  const trimmed = (src ?? '').trim();
  const showImage = trimmed !== '' && !failed;

  useEffect(() => {
    setFailed(false);
  }, [trimmed]);

  if (!showImage) {
    return (
      <div
        className={`w-32 md:w-40 h-32 md:h-40 bg-zinc-700 rounded-md flex items-center justify-center ${className}`}
      >
        <DynamicIcon name="user-circle" size={48} color="#9CA3AF" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- intentional: avoids next/image remotePatterns and invalid src crashes in live preview
    <img
      src={trimmed}
      alt={alt}
      className={`rounded-md w-32 md:w-40 h-32 md:h-40 object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
