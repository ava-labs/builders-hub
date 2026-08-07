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

const QUORUM_REMEDIATION: RemediationLink[] = [
  {
    label: 'Remove Legacy Subnet Validators',
    href: '/console/permissioned-l1s/remove-legacy-validators',
  },
  {
    label: 'Advance P-Chain View (fixes delivery, not aggregation)',
    href: '/console/layer-1/advance-pchain-view',
  },
  {
    label: 'ProposerVM troubleshooting',
    href: '/docs/nodes/architecture/proposervm#troubleshooting-warp-delivery-fails-on-an-idle-chain',
  },
];

/**
 * Turns a signature-aggregation failure into a user-actionable message, or
 * null when the error is not aggregation-shaped (caller falls through to
 * its existing error path).
 *
 * The two below-quorum causes look identical in a single attempt and need
 * opposite remedies, so the message names both instead of guessing:
 * validators whose own P-Chain view lags (heals in minutes, just retry) vs
 * offline legacy Subnet validators still counted in the signing set
 * (permanent until removed).
 */
export function parseAggregationError(err: unknown): MappedAggregationError | null {
  const classified = classifyAggregationError(err);

  if (classified.kind === 'below-quorum') {
    const reached =
      classified.achievedPercent !== undefined
        ? `Signature aggregation reached only ${classified.achievedPercent}% of the required 67% of stake.`
        : 'Signature aggregation could not reach the required 67% of stake.';
    return {
      message:
        `${reached} Two causes look identical: validators whose own P-Chain view has not caught up with your ` +
        'transaction yet (heals within minutes; retry), and offline legacy Subnet validators still counted in ' +
        'the signing set (permanent until they are removed).',
      remediation: QUORUM_REMEDIATION,
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
