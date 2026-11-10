import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoreWalletTransactionButton } from '@/components/toolbox/components/CoreWalletTransactionButton';

// The button names the connected wallet ('Signs with …') through wagmi's useAccount, which needs a WagmiProvider.
// The test renders it with no wallet connected, so an account with no connector is enough.
vi.mock('wagmi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  useAccount: () => ({ connector: undefined }),
}));

// With no Core wallet, the button shows the platform-cli command block as the main action.
const html = renderToStaticMarkup(
  createElement(CoreWalletTransactionButton, { cliCommand: 'platform-cli subnet create --network fuji' }, 'Create'),
);
const copyButton = html.match(/<button[^>]*aria-label="Copy command"[^>]*>/)?.[0] ?? '';

describe('the CLI command copy button', () => {
  // The button is always visible (no color that is transparent until hover), and keyboard focus shows a ring.
  it('has a name and shows when it has keyboard focus', () => {
    expect(copyButton).not.toBe('');
    expect(copyButton).not.toMatch(/text-[\w-]+\/0\b/);
    expect(copyButton).toContain('focus-visible:ring-2');
  });

  // The region must exist before the copy, so that a screen reader reads 'Copied' when it changes.
  it('has an empty polite live region before a copy', () => {
    expect(html).toMatch(/<span class="sr-only" aria-live="polite"><\/span>/);
  });
});
