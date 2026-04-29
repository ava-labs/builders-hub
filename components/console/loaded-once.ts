'use client';

import { useEffect, useState } from 'react';

// Tracks whether a loading→loaded transition has been observed since mount.
//
//   `loaded`     flips true the moment `isLoading` first becomes false and
//                stays true forever. Mirrors the pattern in LiveCharts so
//                refetches don't re-trigger skeleton states.
//   `sawLoading` flips true if `isLoading` was ever true since mount. Use
//                this to gate fade-in animations: cache-hit mounts (where
//                loading was never observed) should skip the fade so they
//                feel instant, real loads (skeleton was visible) should fade
//                so the swap doesn't feel abrupt.
export function useLoadedOnce(isLoading: boolean): { loaded: boolean; sawLoading: boolean } {
  const [loaded, setLoaded] = useState(!isLoading);
  const [sawLoading, setSawLoading] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setSawLoading(true);
      return;
    }
    setLoaded(true);
  }, [isLoading]);

  return { loaded, sawLoading };
}
