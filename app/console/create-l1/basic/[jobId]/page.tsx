'use client';

import { use } from 'react';
import BasicSetupProgress from '@/components/toolbox/console/create-l1/basic/BasicSetupProgress';

/**
 * Progress + completion page for a Basic L1 Setup job. Behavior toggles
 * on the job's status inside <BasicSetupProgress/>: `running` shows the
 * live step tracker, `complete` swaps in the success screen, `failed`
 * shows the error panel.
 */
export default function Page({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  return <BasicSetupProgress jobId={jobId} />;
}
