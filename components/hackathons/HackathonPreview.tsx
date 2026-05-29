'use client';

import React, { useEffect, useRef } from 'react';
import type { HackathonHeader } from '@/types/hackathons';
import LegacyEventLayout from '@/components/hackathons/event-layouts/LegacyEventLayout';
import ModernEventLayout from '@/components/hackathons/event-layouts/ModernEventLayout';

export type HackathonPreviewProps = {
  hackathon: HackathonHeader;
  isRegistered?: boolean;
  scrollTarget?: string;
};

export default function HackathonPreview({
  hackathon,
  isRegistered = false,
  scrollTarget,
}: HackathonPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollTarget && previewRef.current) {
      const targetElement = previewRef.current.querySelector(`#${scrollTarget}`);
      if (targetElement) {
        const containerRect = previewRef.current.getBoundingClientRect();
        const elementRect = targetElement.getBoundingClientRect();
        const offset = elementRect.top - containerRect.top + previewRef.current.scrollTop;
        previewRef.current.scrollTo({ top: offset, behavior: 'smooth' });
      }
    }
  }, [scrollTarget]);

  const hasData = Boolean(
    hackathon.title?.trim() || hackathon.description?.trim() || hackathon.location?.trim(),
  );

  const useModernLayout = hackathon.new_layout === true;

  return (
    <div ref={previewRef} className="h-full overflow-y-auto bg-white dark:bg-zinc-900">
      {!hasData && (
        <div className="flex items-center justify-center h-full min-h-[400px] container sm:px-2 py-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-zinc-600 dark:text-zinc-400 mb-4">Live Preview</h2>
            <p className="text-zinc-500 dark:text-zinc-500">
              Start editing a hackathon to see the live preview here
            </p>
          </div>
        </div>
      )}
      {hasData &&
        (useModernLayout ? (
          <ModernEventLayout
            hackathon={hackathon}
            id={hackathon.id}
            isRegistered={isRegistered}
            isAuthenticated={false}
            utm=""
            isPreview
          />
        ) : (
          <LegacyEventLayout
            hackathon={hackathon}
            id={hackathon.id}
            isRegistered={isRegistered}
            isAuthenticated={false}
            utm=""
            isPreview
          />
        ))}
    </div>
  );
}
