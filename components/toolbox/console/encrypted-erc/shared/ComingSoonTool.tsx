'use client';

import React from 'react';
import {
  withConsoleToolMetadata,
  type ConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';

/**
 * Factory that produces a wrapped "Coming soon" tool with its own metadata.
 *
 * Lets us scaffold the entire Encrypted ERC sidebar as clickable, themed
 * pages while the real implementations ship phase-by-phase. Each phase
 * swaps the placeholder for a real component with matching metadata.
 */
export function makeComingSoonTool(metadata: ConsoleToolMetadata) {
  function Inner() {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
        <h3 className="text-lg font-medium mb-2">Coming soon</h3>
        <p className="text-sm text-muted-foreground">
          {metadata.title} is being built. Track progress in the PR on the branch{' '}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">fix/withdraw-staking-manager-address</code>.
        </p>
      </div>
    );
  }
  return withConsoleToolMetadata(Inner, metadata);
}
