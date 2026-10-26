'use client';
import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SessionProvider } from 'next-auth/react';

export function Body({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <SessionProvider>
      {/* framer-motion ignores the OS "Reduce Motion" setting unless told to follow it: "user" does, so under that
          setting every motion component snaps its movement (transforms, layout) and keeps its fades, like the
          stylesheet's reduced-motion rule (app/global.css, site-reduced-motion-policy). One tooltip provider for every
          page, so once a tooltip has opened, a neighbour opens at once (site-tooltips, components/ui/tooltip.tsx). */}
      <TooltipProvider>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </TooltipProvider>
      {/* Custom wrapper from components/ui/sonner.tsx adds the project's
          theme observer (so toasts match site light/dark) and per-variant
          classNames (tone-colored left border, refined action buttons). */}
      <Toaster position="bottom-right" richColors expand visibleToasts={3} />
    </SessionProvider>
  );
}
