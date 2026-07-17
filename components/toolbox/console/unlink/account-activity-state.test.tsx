import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AccountActivity, getTransactionDisplayState } from './AccountActivity';
import { type DemoTransaction, USDCM_TOKEN_ADDRESS } from './demo';

const sender = `unlink1${'a'.repeat(76)}`;
const recipient = `unlink1${'b'.repeat(76)}`;

const transaction: DemoTransaction = {
  id: 'current-transaction',
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
  tx_hash: `0x${'c'.repeat(64)}`,
  created_at: '2026-07-18T12:00:00.000Z',
  updated_at: '2026-07-18T12:01:00.000Z',
};

describe('transaction display state', () => {
  it('gives failure precedence over a processed status', () => {
    expect(
      getTransactionDisplayState({
        ...transaction,
        status: 'processed',
        confirmation_status: 'failed',
      }),
    ).toBe('failed');
  });

  it('keeps a transaction pending until a processed status is present', () => {
    expect(
      getTransactionDisplayState({
        ...transaction,
        status: 'prepared',
        confirmation_status: 'pending',
      }),
    ).toBe('pending');
  });
});

describe('AccountActivity transaction guards', () => {
  it('does not display a stale transaction with a different ID', () => {
    const html = renderToStaticMarkup(
      <AccountActivity
        unlinkAddress={sender}
        transactionId="new-transaction"
        transaction={transaction}
        isRefreshing={false}
      />,
    );

    expect(html).toContain('The matching transaction is not visible yet.');
    expect(html).not.toContain('1 USDCm');
    expect(html).not.toContain('Matching private transfer processed');
  });

  it('renders failed activity as an error instead of a success', () => {
    const html = renderToStaticMarkup(
      <AccountActivity
        unlinkAddress={sender}
        transactionId={transaction.id}
        transaction={{ ...transaction, confirmation_status: 'failed' }}
        isRefreshing={false}
      />,
    );

    expect(html).toContain('The matching private transfer failed.');
    expect(html).not.toContain('Matching private transfer processed');
    expect(html).not.toContain('border-emerald-300');
  });

  it('shows the derived failed status when raw status fields disagree', () => {
    const html = renderToStaticMarkup(
      <AccountActivity
        unlinkAddress={sender}
        transactionId={transaction.id}
        transaction={{ ...transaction, status: 'failed', confirmation_status: 'processed' }}
        isRefreshing={false}
      />,
    );

    expect(html).toMatch(/Status<\/dt><dd[^>]*>failed<\/dd>/);
    expect(html).toContain('The matching private transfer failed.');
  });

  it('does not fabricate a zero amount when the amount is unavailable', () => {
    const html = renderToStaticMarkup(
      <AccountActivity
        unlinkAddress={sender}
        transactionId={transaction.id}
        transaction={{ ...transaction, amount: null }}
        isRefreshing={false}
      />,
    );

    expect(html).toContain('Unavailable');
    expect(html).not.toContain('0 USDCm');
  });

  it('handles malformed timestamps without breaking the activity panel', () => {
    const html = renderToStaticMarkup(
      <AccountActivity
        unlinkAddress={sender}
        transactionId={transaction.id}
        transaction={{ ...transaction, created_at: 'not-a-date' }}
        isRefreshing={false}
      />,
    );

    expect(html).toContain('Created');
    expect(html).toContain('Unavailable');
  });
});
