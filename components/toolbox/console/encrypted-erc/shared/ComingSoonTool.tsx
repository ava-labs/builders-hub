'use client';

import React from 'react';
import {
  withConsoleToolMetadata,
  type ConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { EmptyBoard } from './ui';

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
      <EmptyBoard eyebrow="Coming soon">
        {metadata.title} is still being built. Track progress on the{' '}
        <code className="font-mono text-[12px]">fix/withdraw-staking-manager-address</code> branch.
      </EmptyBoard>
    );
  }
  return withConsoleToolMetadata(Inner, metadata);
}
