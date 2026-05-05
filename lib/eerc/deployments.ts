import deploymentsJson from '@/constants/eerc-deployments.json';
import type { EERCDeployment, EERCDeploymentsFile, EERCMode } from './types';

const file = deploymentsJson as unknown as EERCDeploymentsFile;

/**
 * Resolve a canonical eERC deployment for a given chain + mode.
 * Returns `undefined` when no known deployment exists (e.g. custom L1s).
 *
 * Deployments without a populated `encryptedERC` address are treated as absent —
 * the constants file ships with empty placeholders until the Fuji deploy script runs.
 */
export function getEERCDeployment(
  chainId: number,
  mode: EERCMode,
): EERCDeployment | undefined {
  const entry = file.deployments[String(chainId)];
  if (!entry) return undefined;
  const candidate = entry[mode];
  if (!candidate) return undefined;
  if (!candidate.encryptedERC || candidate.encryptedERC === '0x') return undefined;
  return candidate;
}

export function hasEERCDeployment(chainId: number, mode: EERCMode): boolean {
  return getEERCDeployment(chainId, mode) !== undefined;
}

export function listKnownChains(): { chainId: number; chainName: string; modes: EERCMode[] }[] {
  return Object.entries(file.deployments).map(([chainId, entry]) => ({
    chainId: Number(chainId),
    chainName: entry.chainName,
    modes: (['standalone', 'converter'] as EERCMode[]).filter((m) =>
      hasEERCDeployment(Number(chainId), m),
    ),
  }));
}
