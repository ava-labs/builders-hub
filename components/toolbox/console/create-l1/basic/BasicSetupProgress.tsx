'use client';

import { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Circle, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { useDeploymentStatus } from '@/hooks/useQuickL1Deploy';
import { DEPLOYMENT_STEPS, STEP_LABEL, type DeploymentStep, type TxRecord } from '@/lib/quick-l1/types';
import { Container } from '@/components/toolbox/components/Container';
import { cn } from '@/lib/utils';
import BasicSetupComplete from './BasicSetupComplete';

/**
 * Live deployment tracker. Polls the status endpoint and renders each
 * step with one of three states: done (check), active (spinner), or
 * pending (muted circle). Each step surfaces the tx hash(es) it produced
 * so users can verify the deployment on-chain in real time.
 */
export default function BasicSetupProgress({ jobId }: { jobId: string }) {
  const { job, error } = useDeploymentStatus(jobId);

  const stepState = useMemo(() => {
    const map = new Map<DeploymentStep, 'done' | 'active' | 'pending'>();
    for (const s of DEPLOYMENT_STEPS) map.set(s, 'pending');
    if (job) {
      for (const s of job.completedSteps) map.set(s, 'done');
      if (job.status === 'complete') {
        for (const s of DEPLOYMENT_STEPS) map.set(s, 'done');
      } else if (job.currentStep && job.status === 'running') {
        map.set(job.currentStep, 'active');
      }
    }
    return map;
  }, [job]);

  // Evidence lookup keyed by step — O(1) per row render.
  const evidenceByStep = useMemo(() => {
    const m = new Map<DeploymentStep, TxRecord[]>();
    if (job) for (const e of job.evidence) m.set(e.step, e.txs);
    return m;
  }, [job]);

  // Defer to the Complete screen once the job is done.
  if (job?.status === 'complete' && job.result) {
    return <BasicSetupComplete job={job} />;
  }

  const completedCount = job?.completedSteps.length ?? 0;

  return (
    <Container
      title={job?.status === 'failed' ? 'Deployment Failed' : 'Deploying L1'}
      description={
        job?.status === 'failed'
          ? 'Something went wrong mid-deployment. See details below.'
          : 'This usually takes 1–2 minutes. Feel free to leave this tab open.'
      }
    >
      {job && (
        <div className="grid grid-cols-3 gap-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 text-sm">
          <Detail label="Chain" value={job.request.chainName} />
          <Detail label="Token" value={job.request.tokenSymbol} mono />
          <Detail label="Network" value="Fuji" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Deployment progress</h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
          {completedCount} of {DEPLOYMENT_STEPS.length}
        </span>
      </div>

      {/* Step list — plain bordered panel, no dark hero card */}
      <ol className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
        {DEPLOYMENT_STEPS.map((step) => {
          const state = stepState.get(step)!;
          const isActive = state === 'active';
          const txs = evidenceByStep.get(step) ?? [];
          return (
            <li key={step} className="flex items-start gap-3 px-4 py-3">
              <StepIcon state={state} />
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-sm',
                    state === 'done'
                      ? 'text-zinc-500 dark:text-zinc-400'
                      : state === 'active'
                        ? 'text-zinc-900 dark:text-zinc-100 font-medium'
                        : 'text-zinc-400 dark:text-zinc-500',
                  )}
                >
                  {STEP_LABEL[step]}
                </div>
                {isActive && job?.statusDetail && (
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{job.statusDetail}</div>
                )}
                {txs.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {txs.map((tx) => (
                      <TxRow key={tx.hash} tx={tx} />
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {job?.status === 'failed' && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <div className="font-medium text-red-900 dark:text-red-200">Deployment error</div>
              <div className="mt-0.5 text-red-700 dark:text-red-300">{job.error ?? 'Unknown error'}</div>
            </div>
          </div>
        </div>
      )}

      {error && !job && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Network hiccup fetching status — retrying automatically.
        </p>
      )}
    </Container>
  );
}

function StepIcon({ state }: { state: 'done' | 'active' | 'pending' }) {
  if (state === 'done') return <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />;
  if (state === 'active') return <Loader2 className="h-4 w-4 mt-0.5 text-primary animate-spin flex-shrink-0" />;
  return <Circle className="h-4 w-4 mt-0.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />;
}

/** Truncate a long hash/id in the middle for inline display. */
function truncateMiddle(s: string, leading = 8, trailing = 6): string {
  if (s.length <= leading + trailing + 3) return s;
  return `${s.slice(0, leading)}…${s.slice(-trailing)}`;
}

/**
 * Subnets Explorer URL builder. L1 txs skip the link — each L1 has its
 * own chain id and there isn't a canonical public explorer we can link
 * to without more metadata.
 */
function explorerUrl(tx: TxRecord): string | null {
  const base = tx.network === 'fuji' ? 'https://subnets-test.avax.network' : 'https://subnets.avax.network';
  if (tx.chain === 'p-chain') return `${base}/p-chain/tx/${tx.hash}`;
  if (tx.chain === 'c-chain') return `${base}/c-chain/tx/${tx.hash}`;
  return null; // custom L1 — no canonical explorer
}

function TxRow({ tx }: { tx: TxRecord }) {
  const url = explorerUrl(tx);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(tx.hash);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
        {tx.chain === 'p-chain' ? 'P' : tx.chain === 'c-chain' ? 'C' : 'L1'}
      </span>
      {tx.label && <span className="text-zinc-600 dark:text-zinc-300">{tx.label}</span>}
      <code className="font-mono text-zinc-500 dark:text-zinc-400">{truncateMiddle(tx.hash)}</code>
      <button
        type="button"
        onClick={onCopy}
        title="Copy hash"
        className="rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
      >
        <Copy className="h-3 w-3" />
      </button>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          title="View on explorer"
          className="rounded p-0.5 text-zinc-400 hover:text-primary transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={cn('mt-0.5 text-zinc-900 dark:text-zinc-100 truncate', mono && 'font-mono')}>{value}</div>
    </div>
  );
}
