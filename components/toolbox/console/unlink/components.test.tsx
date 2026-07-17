import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AccountActivity } from './AccountActivity';
import { PrivateTransfer } from './PrivateTransfer';
import UnlinkOverview from './UnlinkOverview';
import { FUJI_CHAIN_ID, USDCM_TOKEN_ADDRESS } from './demo';

const noop = vi.fn();

describe('PrivateTransfer', () => {
  it('blocks the flow on the wrong network and offers a Fuji switch', () => {
    const html = renderToStaticMarkup(
      <PrivateTransfer
        chainId={1}
        walletAddress="0x1111111111111111111111111111111111111111"
        unlinkAddress={null}
        balance="0"
        fundingRequested={false}
        fundingComplete={false}
        transferSubmitted={false}
        transferComplete={false}
        busyAction={null}
        statusMessage="Switch to Fuji to begin."
        error={null}
        onSwitchToFuji={noop}
        onCreateAccount={noop}
        onRequestFunding={noop}
        onCheckFunding={noop}
        onTransfer={noop}
        onRefreshActivity={noop}
      />,
    );

    expect(html).toContain(`Avalanche Fuji (chain ${FUJI_CHAIN_ID})`);
    expect(html).toContain('Switch to Avalanche Fuji');
    expect(html).toContain('Use an existing private balance, or request 10 demo USDCm');
  });

  it('offers a retry after a submitted transfer is marked failed', () => {
    const html = renderToStaticMarkup(
      <PrivateTransfer
        chainId={FUJI_CHAIN_ID}
        walletAddress="0x1111111111111111111111111111111111111111"
        unlinkAddress={`unlink1${'a'.repeat(76)}`}
        balance="10000000000000000000"
        fundingRequested
        fundingComplete
        transferSubmitted={false}
        transferComplete={false}
        busyAction={null}
        statusMessage="Transfer failed. The fixed transfer can be retried."
        error="The private transfer failed."
        onSwitchToFuji={noop}
        onCreateAccount={noop}
        onRequestFunding={noop}
        onCheckFunding={noop}
        onTransfer={noop}
        onRefreshActivity={noop}
      />,
    );

    expect(html).toContain('Send 1 USDCm Privately');
    expect(html).toContain('The private transfer failed.');
  });
});

describe('AccountActivity', () => {
  it('renders the required fields as a connected-account view', () => {
    const sender = `unlink1${'a'.repeat(76)}`;
    const recipient = `unlink1${'b'.repeat(76)}`;
    const txHash = `0x${'c'.repeat(64)}`;
    const html = renderToStaticMarkup(
      <AccountActivity
        unlinkAddress={sender}
        transactionId="transaction-id"
        transaction={{
          id: 'transaction-id',
          user_address: sender,
          sender_address: sender,
          recipient_address: recipient,
          token: USDCM_TOKEN_ADDRESS,
          amount: '1000000000000000000',
          type: 'transfer',
          status: 'processed',
          confirmation_status: 'processed',
          funds_usable: true,
          environment: 'avalanche-fuji-production',
          tx_hash: txHash,
          created_at: '2026-07-18T12:00:00.000Z',
          updated_at: '2026-07-18T12:01:00.000Z',
        }}
        isRefreshing={false}
      />,
    );

    expect(html).toContain('My Private Activity');
    expect(html).toContain('available to the connected account');
    expect(html).toContain('Sender');
    expect(html).toContain(sender);
    expect(html).toContain('Recipient');
    expect(html).toContain(recipient);
    expect(html).toContain(USDCM_TOKEN_ADDRESS);
    expect(html).toContain('1 USDCm');
    expect(html).toContain('processed');
    expect(html).toContain(txHash);
    expect(html).toContain(`/explorer/avalanche-c-chain/tx/${txHash}`);
  });
});

describe('Unlink product pages', () => {
  it('combines the product, integration, and privacy boundaries on one page', () => {
    const html = renderToStaticMarkup(<UnlinkOverview />);

    expect(html).toContain('Private transfers,');
    expect(html).toContain('same wallet.');
    expect(html).toContain('Existing EOA wallet');
    expect(html).toContain('No contracts to deploy');
    expect(html).toContain('Unlink runs the contracts and privacy infrastructure.');
    expect(html).toContain('id="integration"');
    expect(html).toContain('Add 2 Server Routes');
    expect(html).toContain('The project API key stays on your server.');
    expect(html).toContain('Wallet-derived spending keys stay in the browser.');
    expect(html).toContain('Pool transaction, timing, and proof.');
    expect(html).toContain('Commitments are also public.');
    expect(html).toContain('sender, recipient, token, or amount');
    expect(html).toContain('Deposits expose the source, token, and amount');
    expect(html).toContain('withdrawals expose the destination, token, and amount');
    expect(html).toContain('href="/console/unlink/demo"');
    expect(html).toContain('https://dashboard.unlink.xyz/sign-up');
    expect(html).toContain('https://docs.unlink.xyz/quickstart');
    expect(html).toContain('https://docs.unlink.xyz/how-unlink-works');
    expect(html).not.toContain('/console/unlink/configure');
  });
});
