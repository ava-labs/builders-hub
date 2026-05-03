'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Shared bento card for the EERC Overview.
 *
 * All non-hero cards (Journey, CanonicalDeployment, Compare,
 * RecentActivity) use this shell so the radius / border / shadow match
 * pixel-for-pixel and the `whileHover` lift reads as the same gesture
 * across the page. Hero rolls its own dark variant.
 */
interface TileShellProps {
  children: React.ReactNode;
  className?: string;
}

export function TileShell({ children, className }: TileShellProps) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
      className={cn(
        'relative h-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-4 transition-colors duration-200 hover:border-zinc-300 dark:hover:border-zinc-700',
        className,
      )}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)' }}
    >
      {children}
    </motion.div>
  );
}
