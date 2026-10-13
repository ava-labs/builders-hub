'use client';

import { useEffect } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'framer-motion';
import L1Assembly from '@/components/landing-v2/L1Assembly';

/**
 * The home's L1 drawing, assembled once as the page opens: the core, the validator ring, then the boundary.
 * Drawn at about half its home size, so it keeps only the geometry: its labels would be too small to read.
 */
export function AssemblyArt() {
  const progress = useMotionValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const run = animate(progress, 1, { duration: 2.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] });
    return () => run.stop();
  }, [progress, reduced]);

  return (
    <L1Assembly
      progress={progress}
      staticMode={Boolean(reduced)}
      ringLabel={[]}
      modes={false}
      titleBlock={null}
      coreLabel={null}
    />
  );
}
