'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useDeploymentStatus } from '@/hooks/useQuickL1Deploy';
import { DEPLOYMENT_STEPS, STEP_LABEL, type DeploymentStep } from '@/lib/quick-l1/types';
import BasicSetupComplete from './BasicSetupComplete';
import { cn } from '@/lib/utils';

/**
 * Live deployment tracker. Polls the status endpoint and renders each
 * step with one of three states: done (check), active (spinner), or
 * pending (muted dot). Swaps to the Complete screen when the job
 * reaches its terminal state.
 */
export default function BasicSetupProgress({ jobId }: { jobId: string }) {
  const { job, error } = useDeploymentStatus(jobId);

  const stepState = useMemo(() => {
    const map = new Map<DeploymentStep, 'done' | 'active' | 'pending'>();
    for (const s of DEPLOYMENT_STEPS) map.set(s, 'pending');
    if (job) {
      for (const s of job.completedSteps) map.set(s, 'done');
      if (job.status === 'complete') {
        // All steps green when complete
        for (const s of DEPLOYMENT_STEPS) map.set(s, 'done');
      } else if (job.currentStep && job.status === 'running') {
        map.set(job.currentStep, 'active');
      }
    }
    return map;
  }, [job]);

  // Defer to the Complete screen once the job is done — cleaner than
  // trying to render two different layouts in this file.
  if (job?.status === 'complete' && job.result) {
    return <BasicSetupComplete job={job} />;
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-blue-700 dark:text-blue-300">
          <Sparkles className="h-3 w-3" />
          Basic setup
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {job?.status === 'failed' ? 'Deployment failed' : 'Deploying your L1…'}
        </h1>
        <p className="mt-2 text-[15px] text-zinc-500 dark:text-zinc-400">
          {job?.status === 'failed'
            ? 'Something went wrong mid-deployment. See details below.'
            : 'This usually takes 1–2 minutes. Feel free to leave this tab open.'}
        </p>
      </div>

      {/* Request summary */}
      {job && (
        <div className="mb-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 grid grid-cols-3 gap-4 text-sm">
          <Detail label="Chain" value={job.request.chainName} />
          <Detail label="Token" value={job.request.tokenSymbol} mono />
          <Detail label="Network" value="Fuji" />
        </div>
      )}

      {/* Step list */}
      <div
        className="rounded-2xl border border-zinc-700 bg-zinc-800 p-6"
        style={{
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">Deployment progress</h3>
          <span className="text-sm text-zinc-400 tabular-nums">
            {job?.completedSteps.length ?? 0} of {DEPLOYMENT_STEPS.length}
          </span>
        </div>

        <ol className="space-y-0">
          {DEPLOYMENT_STEPS.map((step, idx) => {
            const state = stepState.get(step)!;
            const isLast = idx === DEPLOYMENT_STEPS.length - 1;
            const isActive = state === 'active';
            return (
              <li key={step} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <StepIcon state={state} />
                  {!isLast && <div className={cn('w-px h-6', state === 'done' ? 'bg-zinc-500' : 'bg-zinc-700')} />}
                </div>
                <div className="pt-0.5 pb-2 flex-1">
                  <div
                    className={cn(
                      'text-sm font-medium',
                      state === 'done' ? 'text-zinc-300' : state === 'active' ? 'text-white' : 'text-zinc-500',
                    )}
                  >
                    {STEP_LABEL[step]}
                  </div>
                  {isActive && job?.statusDetail && (
                    <motion.div
                      key={job.statusDetail}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-0.5 text-xs text-zinc-400"
                    >
                      {job.statusDetail}
                    </motion.div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Error panel */}
      {job?.status === 'failed' && (
        <div className="mt-6 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-900 dark:text-red-200">Deployment error</p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{job.error ?? 'Unknown error'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Polling error — don't want to scare the user unless it's persistent */}
      {error && !job && (
        <div className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
          Network hiccup fetching status — retrying automatically.
        </div>
      )}
    </div>
  );
}

function StepIcon({ state }: { state: 'done' | 'active' | 'pending' }) {
  if (state === 'done') {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10 text-green-400">
        <CheckCircle2 className="h-4 w-4" />
      </div>
    );
  }
  if (state === 'active') {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-[10px] text-zinc-500">○</div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={cn('mt-0.5 text-zinc-900 dark:text-zinc-100 truncate', mono && 'font-mono')}>{value}</div>
    </div>
  );
}
