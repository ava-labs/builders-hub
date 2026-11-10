'use client';

import { ChevronRight, Pencil } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HashChip, SpecPlate, SpecRow } from '@/components/explorer-v2/ui';
import { useEditRpcUrlModal } from '@/components/toolbox/providers/modals/EditRpcUrlModal';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import type { L1ValidatorManagerInfo } from '@/lib/console/my-l1/useL1ValidatorManager';
import { DISCLOSURE, DISCLOSURE_HINT, DISCLOSURE_LABEL, FRAME } from './chrome';

// Network identifiers (RPC URL, Subnet ID, Blockchain ID, EVM Chain ID) are
// reference data the user looks up once per session — not on-glance content.
// A Radix Collapsible keeps them one click away without dominating the
// dashboard; opened, they read as a spec plate with a copy chip per value.
export function NetworkDetailsCard({
  l1,
  validatorManager,
}: {
  l1: CombinedL1;
  validatorManager?: L1ValidatorManagerInfo;
}) {
  const { openEditRpcUrl } = useEditRpcUrlModal();

  // Managed L1s get their RPC URL from the server-side node registration,
  // which wins over the wallet store in the dashboard merge, so an edit
  // there would not show up here. Only wallet-sourced entries are editable.
  const canEditRpc = l1.source === 'wallet' && l1.evmChainId !== null;
  const handleEditRpc = () => {
    if (l1.evmChainId === null) return;
    void openEditRpcUrl({
      evmChainId: l1.evmChainId,
      name: l1.chainName,
      rpcUrl: l1.rpcUrl,
      isTestnet: l1.isTestnet,
    });
  };

  // Network identifiers first, then the Validator Manager pair.
  type Item = {
    label: string;
    value: string;
    id: string;
    /** When true, the row is read-only — no copy affordance, muted
     *  text — and reads as "we know this slot exists, it just has no
     *  value yet." Used for VMC rows on managed L1s where the contract
     *  hasn't been deployed yet but the user can configure it via the
     *  prominent banner above. */
    placeholder?: boolean;
    /** Opens an editor for this value. Only the RPC URL of wallet-sourced
     *  L1s is editable today (issue #4450). */
    onEdit?: () => void;
  };
  const items: Item[] = [
    { label: 'RPC URL', value: l1.rpcUrl, id: 'rpc-url', onEdit: canEditRpc ? handleEditRpc : undefined },
    { label: 'Subnet ID', value: l1.subnetId, id: 'subnet-id' },
    { label: 'Blockchain ID', value: l1.blockchainId, id: 'blockchain-id' },
  ];
  if (l1.evmChainId !== null) {
    items.push({ label: 'EVM Chain ID', value: String(l1.evmChainId), id: 'evm-chain-id' });
  }
  const validatorManagerAddress = validatorManager?.address ?? l1.validatorManagerAddress;
  const validatorManagerBlockchainId = validatorManager?.blockchainId ?? l1.validatorManagerBlockchainId;
  // For managed L1s the dashboard knows it's an L1 even before the VMC
  // is deployed (the setup checklist above has "Configure Validator
  // Manager" as one of the steps). Show placeholder rows so the user
  // knows the slots exist and that completing setup will populate them.
  // For wallet-only L1s we keep the previous behavior: hide the rows
  // when missing — absence becomes the "this is just a subnet, not an
  // L1" signal that OS-1 leaned on.
  const isManaged = l1.source === 'managed';
  if (validatorManagerAddress) {
    items.push({ label: 'Validator Manager', value: validatorManagerAddress, id: 'validator-manager' });
  } else if (isManaged) {
    items.push({
      label: 'Validator Manager',
      value:
        'Not deployed yet. Run the Configure Validator Manager step from the banner above to populate this address.',
      id: 'validator-manager',
      placeholder: true,
    });
  }
  if (validatorManagerBlockchainId) {
    items.push({
      label: 'Validator Manager Blockchain',
      value: validatorManagerBlockchainId,
      id: 'validator-manager-blockchain',
    });
  } else if (isManaged) {
    items.push({
      label: 'Validator Manager Blockchain',
      value: 'Auto-detected once the Validator Manager contract is deployed.',
      id: 'validator-manager-blockchain',
      placeholder: true,
    });
  }

  return (
    <Collapsible className={FRAME}>
      <CollapsibleTrigger asChild>
        <button type="button" className={DISCLOSURE}>
          <ChevronRight
            className="disclosure-chevron h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform"
            aria-hidden="true"
          />
          <span className={DISCLOSURE_LABEL}>Network identifiers</span>
          <span className={DISCLOSURE_HINT}>{items.map((item) => item.label).join(' · ')}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <SpecPlate className="px-5 md:px-6">
          {items.map((item) => (
            <SpecRow key={item.id} label={item.label}>
              {item.placeholder ? (
                <span className="text-[13px] font-normal italic leading-relaxed text-zinc-400 dark:text-zinc-500">
                  {item.value}
                </span>
              ) : (
                <span className="inline-flex min-w-0 max-w-full items-center gap-3">
                  <HashChip value={item.value} len={120} />
                  {item.onEdit && (
                    <button
                      type="button"
                      onClick={item.onEdit}
                      className="-m-1.5 shrink-0 p-1.5 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                      aria-label={`Edit ${item.label}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </span>
              )}
            </SpecRow>
          ))}
        </SpecPlate>
      </CollapsibleContent>
    </Collapsible>
  );
}
