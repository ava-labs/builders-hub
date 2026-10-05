import type { MappedAggregationError, RemediationLink } from './parseAggregationError';

const SETUP_REMEDIATION: RemediationLink[] = [
  {
    label: 'Validator Manager Setup (Initialize step)',
    href: '/console/permissioned-l1s/validator-manager-setup',
  },
];

const DELIVERY_REMEDIATION: RemediationLink[] = [
  {
    label: 'Advance P-Chain View',
    href: '/console/layer-1/advance-pchain-view',
  },
  {
    label: 'ProposerVM troubleshooting',
    href: '/docs/nodes/architecture/proposervm#troubleshooting-warp-delivery-fails-on-an-idle-chain',
  },
];

/**
 * Maps initializeValidatorSet reverts to actionable guidance, or null when
 * the error is not one of the unambiguous shapes (caller shows the raw
 * message).
 *
 * InvalidTotalWeight during initialization is a misdirection: the contract
 * checks `totalWeight * maximumChurnPercentage < 100`, and initialize()
 * rejects a churn percentage of zero, so a zero product means initialize()
 * never ran at the CALLED address. The conversion records the proxy
 * (0xfacade...) as the manager, while the setup flow can leave the user
 * initializing the freshly deployed implementation instead (issue #4464).
 *
 * InvalidWarpMessage on an idle L1 is a stale ProposerVM view of the
 * P-Chain. A manager on the C-Chain (`managerOnCChain`) cannot have that
 * cause: the C-Chain produces blocks all the time. Its P-Chain view can still
 * be up to one 5-minute epoch old (proposervm.mdx), so the text says to wait.
 */
export function parseInitValidatorSetError(
  err: unknown,
  managerAddress: string | null,
  managerOnCChain = false,
): MappedAggregationError | null {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';

  if (message.includes('InvalidTotalWeight')) {
    const target = managerAddress ?? 'the manager address recorded in the conversion';
    return {
      message:
        `The ValidatorManager at ${target} has never been initialized: its churn settings read zero, and ` +
        'initialize() rejects zero, so initialize() cannot have run at this address. This usually means the ' +
        'Initialize step ran against a different address, for example the implementation contract instead of ' +
        `the proxy. Run the Initialize step against ${target}, then retry.`,
      remediation: SETUP_REMEDIATION,
    };
  }

  if (message.includes('InvalidWarpMessage') && managerOnCChain) {
    return {
      message:
        'The C-Chain rejected the signed conversion message. The C-Chain produces blocks all the time, so you do ' +
        'not need to produce a block. Select Re-aggregate signatures, then retry. If it fails again, wait 5 ' +
        'minutes, then retry.',
      remediation: [],
    };
  }

  if (message.includes('InvalidWarpMessage')) {
    return {
      message:
        "The chain rejected the signed conversion message. The usual cause is the L1's ProposerVM view of the " +
        'P-Chain: it only advances when the chain produces blocks, so on an idle chain it can pin a P-Chain ' +
        'height from before your conversion. Produce a block (a zero-value transfer works), then retry.',
      remediation: DELIVERY_REMEDIATION,
    };
  }

  if (message.includes('InvalidInitializationStatus')) {
    return {
      message:
        'The validator set is already initialized on this manager. Refresh the page to re-check the on-chain status.',
      remediation: [],
    };
  }

  return null;
}
