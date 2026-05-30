import type { CombinedL1 } from './types';

export type ValidatorManagerKind = 'poa' | 'pos-native' | 'pos-erc20';

export function validatorManagerKindLabel(kind: ValidatorManagerKind | null): string | null {
  if (kind === 'poa') return 'PoA';
  if (kind === 'pos-native') return 'PoS · Native';
  if (kind === 'pos-erc20') return 'PoS · ERC-20';
  return null;
}

export function getAddValidatorPath(
  _kind: ValidatorManagerKind | null | undefined,
  l1?: CombinedL1,
  options?: { nodeId?: string },
): string {
  // Unified flow auto-detects PoA / PoS-Native / PoS-ERC20 from the subnet,
  // so we no longer branch on kind. The arg is kept for call-site compatibility
  // and future preset-routing (e.g., pre-filled stake amounts).
  const base = '/console/add-validator/select-subnet';
  const params = new URLSearchParams();
  if (l1?.subnetId) params.set('subnetId', l1.subnetId);
  if (options?.nodeId) params.set('nodeId', options.nodeId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
