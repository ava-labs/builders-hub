'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Detects if the page is being viewed in embed mode (?embed=true)
 * and adds a class to the document for CSS targeting.
 */
export function EmbedModeDetector() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const isEmbed = searchParams.get('embed') === 'true';

    if (isEmbed) {
      document.documentElement.classList.add('embed-mode');
    } else {
      document.documentElement.classList.remove('embed-mode');
    }

    return () => {
      document.documentElement.classList.remove('embed-mode');
    };
  }, [searchParams]);

  return null;
}
