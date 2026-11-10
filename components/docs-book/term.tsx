import type { ReactNode } from 'react';

export type TermRole = 'pchain' | 'evm' | 'icm';

/**
 * A term in the docs color key. figure.css gives it the color of its role and nothing else: no weight,
 * no underline. The term text names the role ("validator", "L1"), so color never carries the meaning alone.
 * The color key toggle sets every role back to the text color.
 */
export function Term({ role, children }: { role: TermRole; children: ReactNode }) {
  return <span data-bk-role={role}>{children}</span>;
}
