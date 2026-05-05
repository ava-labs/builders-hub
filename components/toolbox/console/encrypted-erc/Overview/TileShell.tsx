'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Shared bento card for the EERC Overview.
 *
 * All non-hero cards (CanonicalDeployment, RecentActivity, Compare) use
 * this shell so the radius, ring, and diffusion shadow match
 * pixel-for-pixel. The hero rolls its own variant with a slightly
 * heavier emerald-tinted shadow and a status bar / stepper section.
 */
interface TileShellProps {
  children: React.ReactNode;
  className?: string;
}

export function TileShell({ children, className }: TileShellProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring' as const, stiffness: 320, damping: 22 }}
      className={cn(
        'relative h-full rounded-2xl border border-zinc-200/80 bg-white p-5 ring-1 ring-zinc-900/[0.02] transition-colors duration-300 dark:border-zinc-800/80 dark:bg-zinc-950 dark:ring-white/[0.04] hover:border-zinc-300 dark:hover:border-zinc-700',
        className,
      )}
      style={{
        boxShadow:
          '0 14px 40px -20px rgba(0,0,0,0.06), 0 4px 12px -6px rgba(0,0,0,0.04), inset 0 1px 0 0 rgba(255,255,255,0.04)',
      }}
    >
      {children}
    </motion.div>
  );
}
