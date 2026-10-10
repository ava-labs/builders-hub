import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoreWalletTransactionButton } from '@/components/toolbox/components/CoreWalletTransactionButton';

// With no Core wallet, the button shows the platform-cli command block as the main action.
const html = renderToStaticMarkup(
  createElement(CoreWalletTransactionButton, { cliCommand: 'platform-cli subnet create --network fuji' }, 'Create'),
);
const copyButton = html.match(/<button[^>]*aria-label="Copy command"[^>]*>/)?.[0] ?? '';

describe('the CLI command copy button', () => {
  it('has a name and shows when it has keyboard focus', () => {
    expect(copyButton).not.toBe('');
    expect(copyButton).toContain('focus-visible:text-muted-foreground');
  });

  // The region must exist before the copy, so that a screen reader reads 'Copied' when it changes.
  it('has an empty polite live region before a copy', () => {
    expect(html).toMatch(/<span class="sr-only" aria-live="polite"><\/span>/);
  });
});
