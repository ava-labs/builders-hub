'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { ConsoleRouteError } from '@/components/console/route-error';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Permissionless L1s Error:', error);
    posthog.captureException(error);
  }, [error]);

  return <ConsoleRouteError error={error} reset={reset} fallbackMessage="Something went wrong with this operation" />;
}
