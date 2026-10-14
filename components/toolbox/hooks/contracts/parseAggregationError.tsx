import Link from 'next/link';
import { classifyAggregationError } from '@/components/toolbox/utils/aggregationRetry';

export interface RemediationLink {
  label: string;
  href: string;
}

export interface MappedAggregationError {
  message: string;
  remediation: RemediationLink[];
}

const REMOVE_LEGACY_LINK: RemediationLink = {
  label: 'Remove Legacy Subnet Validators',
  href: '/console/permissioned-l1s/remove-legacy-validators',
};

const CONNECT_REMEDIATION: RemediationLink[] = [
  {
    label: 'Node networking (port 9651)',
    href: '/docs/nodes/system-requirements#networking',
  },
  REMOVE_LEGACY_LINK,
];

const VALIDATOR_ONLY_LINK: RemediationLink = {
  label: 'Validators ignore the aggregator on a validator-only L1',
  href: '/docs/avalanche-l1s/validator-manager/registration-flow#validator-only-l1',
};

// A P-Chain-sourced message (registration ack, weight ack, removal ack,
// SubnetToL1Conversion) is delivered to the L1 after the aggregation, so the
// delivery links apply too. The first two links match the two causes in order.
const PCHAIN_SIGN_REMEDIATION: RemediationLink[] = [
  {
    label: 'Validators refuse the P-Chain-sourced aggregation',
    href: '/docs/avalanche-l1s/validator-manager/registration-flow#pchain-sourced-refusal',
  },
  REMOVE_LEGACY_LINK,
  {
    label: 'Advance P-Chain View (fixes delivery, not aggregation)',
    href: '/console/layer-1/advance-pchain-view',
  },
  {
    label: 'ProposerVM troubleshooting',
    href: '/docs/nodes/architecture/proposervm#troubleshooting-warp-delivery-fails-on-an-idle-chain',
  },
];

const L1_SIGN_REMEDIATION: RemediationLink[] = [REMOVE_LEGACY_LINK, VALIDATOR_ONLY_LINK];

/**
 * The chain that emitted the message under aggregation. 'p-chain': a
 * P-Chain-sourced message. 'l1': a message that a Validator Manager on the L1
 * emitted, signed by the L1's own validators. A message from a manager on the
 * C-Chain is signed by the Primary Network and is neither.
 */
export type AggregationSource = 'p-chain' | 'l1';

/**
 * Turns a signature-aggregation failure into a user-actionable message, or
 * null when the error is not aggregation-shaped (caller falls through to
 * its existing error path).
 *
 * A connect failure means the aggregator reached too little of the signing
 * stake: validators are offline, or their staking port 9651 is closed to
 * the internet (a private network).
 *
 * A signing failure has causes that look identical in a single attempt and
 * need different remedies, so the message names each one instead of
 * guessing. Both sources: validators that lag (heals in minutes, just
 * retry), and offline legacy Subnet validators still counted in the signing
 * set (permanent until removed). An L1-sourced message has a third cause: an
 * L1 with validatorOnly set, whose validators ignore the aggregator. The
 * validatorOnly setting never applies to a P-Chain-sourced message, because
 * the P-Chain is part of the Primary Network (registration-flow.mdx).
 */
export function parseAggregationError(
  err: unknown,
  source: AggregationSource = 'p-chain',
): MappedAggregationError | null {
  const classified = classifyAggregationError(err);

  if (classified.kind === 'below-quorum' && classified.cause === 'connect') {
    return {
      message:
        'Signature aggregation could not connect to enough validators: the connected validators hold less than ' +
        '67% of the signing stake. The validators can be offline, or their staking port (9651) is not reachable ' +
        'from the internet, for example on a private network.',
      remediation: CONNECT_REMEDIATION,
    };
  }

  if (classified.kind === 'below-quorum') {
    const reached =
      classified.achievedPercent !== undefined
        ? `Signature aggregation reached only ${classified.achievedPercent}% of the required 67% of stake.`
        : 'Signature aggregation could not reach the required 67% of stake.';
    const legacyCause =
      'Offline legacy Subnet validators are still in the signing set. This continues until you remove them.';
    if (source === 'l1') {
      return {
        message:
          `${reached} Three causes give the same error. ` +
          '(1) Some validators have not accepted the L1 block with your transaction yet. This heals within ' +
          `minutes, so retry. (2) ${legacyCause} ` +
          '(3) The L1 sets validatorOnly, so its validators ignore the aggregator.',
        remediation: L1_SIGN_REMEDIATION,
      };
    }
    return {
      message:
        `${reached} Two causes give the same error. ` +
        '(1) The P-Chain view of some validators does not include your transaction yet. This heals within ' +
        `minutes, so retry. (2) ${legacyCause}`,
      remediation: PCHAIN_SIGN_REMEDIATION,
    };
  }

  // Everything else returns null on purpose. The catch blocks feeding this
  // mapper wrap whole multi-step flows, so generic shapes (fetch failures,
  // timeouts) may come from viem, Glacier, or the P-Chain rather than the
  // aggregator; relabelling them would hide the real error. Only the
  // quorum shapes above are unambiguous.
  return null;
}

/** Compact link row rendered under an aggregation error message. */
export function AggregationRemediation({ items }: { items: RemediationLink[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="text-xs underline"
          target={item.href.startsWith('/docs') ? '_blank' : undefined}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
