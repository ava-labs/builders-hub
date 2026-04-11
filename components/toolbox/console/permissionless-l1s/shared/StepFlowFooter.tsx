'use client';

import React from 'react';
import { Button } from '@/components/toolbox/components/Button';

interface StepFlowFooterProps {
  globalSuccess: string | null;
  showReset: boolean;
  onReset: () => void;
  successLabel?: string;
}

export default function StepFlowFooter({
  globalSuccess,
  showReset,
  onReset,
  successLabel = 'Process Complete',
}: StepFlowFooterProps) {
  return (
    <>
      {showReset && (
        <Button onClick={onReset} variant="secondary" className="mt-6">
          Reset All Steps
        </Button>
      )}
    </>
  );
}
