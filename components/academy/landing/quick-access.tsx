import Link from 'next/link';
import { cn } from '@/utils/cn';
import { FOCUS_RING } from './course-marks';

/** Six shortcuts into the courses: the pages the Quick Access cards opened before the single landing. */
export const QUICK_ACCESS: readonly { label: string; href: string }[] = [
  { label: 'Create an L1', href: '/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1' },
  { label: 'Create your Native Token', href: '/academy/avalanche-l1/l1-native-tokenomics/02-custom-tokens/02-custom-native-vs-erc20-native' },
  { label: 'Send Cross-Chain Messages', href: '/academy/avalanche-l1/interchain-messaging/03-icm-protocol/01-what-is-icm' },
  { label: 'Bridge Tokens', href: '/academy/avalanche-l1/erc20-bridge' },
  { label: 'Write Smart Contracts', href: '/academy/blockchain/solidity-foundry/03-smart-contracts/01-building-programs-on-blockchain' },
  { label: 'HTTP-Native Payments', href: '/academy/blockchain/x402-payment-infrastructure' },
];

/** Quick Access as one text row under the courses: no icons, no numbers. */
export function QuickAccess() {
  return (
    <div className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2 border-t border-ac-rule pt-[15px] text-[14px]">
      <p className="mr-1 text-[12px] text-ac-ink-3">Quick access</p>
      {QUICK_ACCESS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn('border-b border-ac-rule-2 pb-px font-medium text-ac-ink-2 hover:border-ac-ink hover:text-ac-ink', FOCUS_RING)}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
