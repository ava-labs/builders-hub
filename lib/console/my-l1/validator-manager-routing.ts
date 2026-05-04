import type { CombinedL1 } from './types';

export type ValidatorManagerKind = 'poa' | 'pos-native' | 'pos-erc20';

export function validatorManagerKindLabel(kind: ValidatorManagerKind | null): string | null {
  if (kind === 'poa') return 'PoA';
  if (kind === 'pos-native') return 'PoS · Native';
  if (kind === 'pos-erc20') return 'PoS · ERC-20';
  return null;
}

export function getAddValidatorPath(
  kind: ValidatorManagerKind | null | undefined,
  l1?: CombinedL1,
  options?: { nodeId?: string },
): string {
  const base =
    kind === 'pos-native'
      ? '/console/permissionless-l1s/stake/native/select-subnet'
      : kind === 'pos-erc20'
        ? '/console/permissionless-l1s/stake/erc20/select-subnet'
        : '/console/permissioned-l1s/add-validator/select-subnet';

  const params = new URLSearchParams();
  if (l1?.subnetId) params.set('subnetId', l1.subnetId);
  if (options?.nodeId) params.set('nodeId', options.nodeId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
