'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NEED_TEXT, useConsoleSigner } from '@/lib/console-wallets/react';
import { api, errorText, type DeploymentView, type NextAction } from './api';
import { BROWSER_STEP_LABEL, STAGE_LABEL, canRunInBrowser, runBrowserStep } from './eerc-runner';
import { walletErrorText } from './wallet';

export const studioSignerScope = (projectId: string) => `studio:${projectId}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ReportBody =
  | { kind: 'tx'; stepId: string; txHash: string }
  | { kind: 'confirm'; stepId: string }
  | { kind: 'skip'; stepId: string; reason: string }
  | { kind: 'offchain'; stepId: string; txHash?: string; outputs?: Record<string, string> };

/**
 * Drives a deployment from the browser. The server decides every step and
 * prepares every transaction; this hook only asks the wallet to sign them
 * and reports the hash back for the server to verify on-chain.
 */
export function useDeployRunner(projectId: string, deploymentId: string | null, onChanged: () => void) {
  const [view, setView] = useState<DeploymentView | null>(null);
  const wallet = useConsoleSigner(studioSignerScope(projectId), { pinnedAddress: view?.signer });
  const { signer } = wallet;
  const address = signer?.address ?? null;
  const [action, setAction] = useState<NextAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewRef = useRef<DeploymentView | null>(null);
  const stopRef = useRef(false);
  const base = `/api/studio/projects/${projectId}/deployments/${deploymentId}`;

  const refresh = useCallback(async () => {
    if (!deploymentId) return null;
    const { deployment } = await api<{ deployment: DeploymentView }>(base);
    viewRef.current = deployment;
    setView(deployment);
    return deployment;
  }, [base, deploymentId]);

  useEffect(() => {
    viewRef.current = null;
    setView(null);
    setAction(null);
    setError(null);
    if (deploymentId) refresh().catch((e) => setError(errorText(e)));
  }, [deploymentId, refresh]);

  const report = useCallback(
    async (body: ReportBody) => {
      const result = await api<{ status: string; deployment: DeploymentView }>(`${base}/report`, {
        method: 'POST',
        json: body,
      });
      viewRef.current = result.deployment;
      setView(result.deployment);
      return result.status;
    },
    [base],
  );

  const waitForReceipt = useCallback(
    async (stepId: string, txHash: string) => {
      for (let i = 0; i < 120; i++) {
        const status = await report({ kind: 'tx', stepId, txHash });
        if (status !== 'pending' || stopRef.current) return status;
        await sleep(2_500);
      }
      return 'pending';
    },
    [report],
  );

  const run = useCallback(
    async ({ continuous = true, confirmProduction = false } = {}) => {
      if (!deploymentId) return;
      if (!signer) {
        setError(wallet.needs ? NEED_TEXT[wallet.needs] : 'Choose the wallet that signs each deployment step.');
        return;
      }
      setBusy(true);
      setError(null);
      stopRef.current = false;
      let confirm = confirmProduction;
      try {
        // Enough rounds to sit through a Quick L1 launch or a CCIP delivery polling every few seconds.
        for (let guard = 0; guard < 400 && !stopRef.current; guard++) {
          const { action: next } = await api<{ action: NextAction }>(`${base}/next`, {
            method: 'POST',
            json: { signer: signer.address, confirmProduction: confirm },
          });
          confirm = false;
          setAction(next);

          if (next.kind === 'tx') {
            const current = viewRef.current ?? (await refresh());
            const hash = await signer.send(next.chainId, current?.chains[next.chainId], next.request);
            const status = await waitForReceipt(next.stepId, hash);
            if (status === 'failed') {
              setError(
                `"${next.title}" reverted on-chain. Check the transaction, fix the cause, then run the step again.`,
              );
              break;
            }
            if (status !== 'done' || next.production || !continuous) break;
            continue;
          }
          if (next.kind === 'pending') {
            const status = await waitForReceipt(next.stepId, next.txHash);
            if (status !== 'done' || !continuous) break;
            continue;
          }
          // eERC steps run here: the key is derived from a signature and the proof is generated in this browser.
          if (next.kind === 'manual' && next.browser && canRunInBrowser(next.browser, signer)) {
            const step = next.browser;
            setAction({
              kind: 'wait',
              stepId: next.stepId,
              title: next.title,
              detail: BROWSER_STEP_LABEL[step.action] ?? 'Working in this browser…',
              retryInMs: 0,
            });
            const current = viewRef.current ?? (await refresh());
            const result = await runBrowserStep(step, signer, current?.chains[step.chainId], (stage) =>
              setAction({
                kind: 'wait',
                stepId: next.stepId,
                title: next.title,
                detail: STAGE_LABEL[stage],
                retryInMs: 0,
              }),
            ).catch((e) => {
              // Back to the manual card, so the step can still be done in the eERC console and marked done.
              setAction(next);
              throw e;
            });
            for (let attempt = 0; ; attempt++) {
              try {
                await report({ kind: 'offchain', stepId: next.stepId, ...result });
                break;
              } catch (e) {
                // The server reads the chain; a node a block behind says the transaction isn't mined yet.
                if ((e as { code?: string }).code !== 'not_mined' || attempt >= 10) throw e;
                await sleep(2_000);
              }
            }
            if (!continuous) break;
            continue;
          }
          if (next.kind === 'wait' && continuous) {
            await sleep(next.retryInMs);
            continue;
          }
          break;
        }
      } catch (e) {
        setError(walletErrorText(e));
      } finally {
        setBusy(false);
        await refresh().catch(() => undefined);
        onChanged();
      }
    },
    [base, deploymentId, onChanged, refresh, signer, wallet.needs, waitForReceipt],
  );

  const confirmManual = useCallback(
    async (stepId: string) => {
      try {
        await report({ kind: 'confirm', stepId });
        setAction(null);
        await run();
      } catch (e) {
        setError(errorText(e));
      }
    },
    [report, run],
  );

  const skip = useCallback(
    async (stepId: string, reason: string) => {
      try {
        await report({ kind: 'skip', stepId, reason });
        setAction(null);
        await run();
      } catch (e) {
        setError(errorText(e));
      }
    },
    [report, run],
  );

  const cancel = useCallback(async () => {
    try {
      await api(base, { method: 'DELETE' });
      await refresh();
      onChanged();
    } catch (e) {
      setError(errorText(e));
    }
  }, [base, onChanged, refresh]);

  return {
    view,
    action,
    busy,
    error,
    address,
    wallet,
    run,
    stop: () => {
      stopRef.current = true;
    },
    confirmManual,
    skip,
    cancel,
    refresh,
  };
}
