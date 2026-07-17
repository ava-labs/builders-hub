import type { UnlinkClient } from '@unlink-xyz/sdk/browser';

export const UNLINK_APP_ID = 'avax-builder-hub';
export const UNLINK_ENVIRONMENT = 'avalanche-fuji';
export const FUJI_CHAIN_ID = 43_113;
export const USDCM_TOKEN_ADDRESS = '0x10Da0EBc5942E12834d165C569b86Fa6635C73A0';
export const USDCM_DECIMALS = 18;
export const FAUCET_AMOUNT = '10000000000000000000';
export const TRANSFER_AMOUNT = '1000000000000000000';
// Registered Fuji Engine faucet account. Keep this in sync with the deployed
// environment so completed demo transfers return test inventory to the faucet.
export const DEMO_RECIPIENT_ADDRESS =
  'unlink1qqg9ma7nxn4gpq98wdqgp7aq0l9ud0xn9wry8gmkevp529dw5txye7psk5v4exlrac3tm86nxw9ltdya79u7lvz0lr4z6eceqevh9wua2jc6uh';

const DECIMAL_INTEGER = /^\d+$/;

type DemoBalancesData = Awaited<ReturnType<UnlinkClient['getBalances']>>;
type DemoTransactionsData = Awaited<ReturnType<UnlinkClient['getTransactions']>>;

export type DemoBalance = DemoBalancesData['balances'][number];
export type DemoTransaction = DemoTransactionsData['transactions'][number];

export type DemoErrorAction = 'network' | 'derive' | 'register' | 'faucet' | 'transfer' | 'activity';

export class DemoPollingTimeoutError extends Error {
  constructor(label: string) {
    super(`${label} timed out`);
    this.name = 'DemoPollingTimeoutError';
  }
}

export function makeAbortError(): Error {
  const error = new Error('Operation aborted');
  error.name = 'AbortError';
  return error;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function readTokenBalance(balances: DemoBalance[], token: string): bigint {
  const match = balances.find((balance) => balance.token.toLowerCase() === token.toLowerCase());
  if (!match || !DECIMAL_INTEGER.test(match.amount)) return 0n;

  try {
    return BigInt(match.amount);
  } catch {
    return 0n;
  }
}

export function formatTokenAmount(amount: string, decimals = USDCM_DECIMALS, maxFractionDigits = 4): string {
  if (!DECIMAL_INTEGER.test(amount) || decimals < 0 || maxFractionDigits < 0) return '-';

  const value = BigInt(amount);
  if (decimals === 0) return value.toString();

  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, '0').slice(0, maxFractionDigits).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function shortenIdentifier(value: string, edgeLength = 8): string {
  if (value.length <= edgeLength * 2 + 1) return value;
  return `${value.slice(0, edgeLength)}...${value.slice(-edgeLength)}`;
}

/** Stable key used to discard all in-memory account state after wallet or chain changes. */
export function getWalletIdentity(walletAddress: string | null, chainId: number | null): string {
  return `${walletAddress?.toLowerCase() ?? 'unknown'}:${chainId ?? 'unknown'}`;
}

export function findMatchingTransaction(
  transactions: DemoTransaction[],
  transactionId: string,
): DemoTransaction | null {
  return (
    transactions.find((transaction) => transaction.id === transactionId && transaction.type === 'transfer') ?? null
  );
}

export function isFailedTransaction(transaction: DemoTransaction | null): boolean {
  return transaction?.status === 'failed' || transaction?.confirmation_status === 'failed';
}

function readErrorCode(error: unknown): string | number | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' || typeof code === 'number' ? code : undefined;
}

function hasErrorCode(code: string | number | undefined, ...expected: Array<string | number>): boolean {
  if (code === undefined) return false;
  const normalizedCode = code.toString().toUpperCase();
  return expected.some((candidate) => candidate.toString().toUpperCase() === normalizedCode);
}

export function getDemoErrorMessage(error: unknown, action: DemoErrorAction): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const code = readErrorCode(error);

  if (code === 4001 || code === 'ACTION_REJECTED' || /user rejected|user denied|rejected the request/.test(message)) {
    return 'The wallet request was rejected. Nothing was created or sent.';
  }
  if (
    /wrong network|chain mismatch|unsupported (?:network|chain)|expected (?:network|chain)(?: id)? 43113|chain 43113 (?:is )?required/.test(
      message,
    )
  ) {
    return 'Switch the wallet to Avalanche Fuji (chain 43113) and try again.';
  }
  if (/non-standard signature|smart-account|smart account|does not recover/.test(message)) {
    return 'This demo currently supports EOA wallets only.';
  }
  if (error instanceof DemoPollingTimeoutError || /timed out|timeout/.test(message)) {
    if (action === 'faucet') {
      return 'Funding is taking longer than expected. The request may still finish; check the balance again.';
    }
    if (action === 'transfer' || action === 'activity') {
      return 'The transfer is taking longer than expected. It may still finish; check its status before retrying.';
    }
  }
  if (
    action === 'faucet' &&
    (hasErrorCode(code, 429, 'RATE_LIMITED') || /rate limit|too many requests/.test(message))
  ) {
    return 'The Fuji demo faucet is temporarily rate-limited. Please try again later.';
  }
  if (
    hasErrorCode(code, 401, 403, 'UNAUTHORIZED', 'FORBIDDEN') ||
    /unauthorized|authorization|session expired/.test(message)
  ) {
    return 'The demo authorization expired. Recreate the private account and try again.';
  }
  if (
    action === 'transfer' &&
    /private balance is too low|insufficient (?:private )?balance|insufficient funds/.test(message)
  ) {
    return 'The private balance is below 1 USDCm. Request demo funds or check the balance, then try again.';
  }

  const fallbacks: Record<DemoErrorAction, string> = {
    network: 'Could not switch the wallet to Avalanche Fuji. Switch networks in the wallet and try again.',
    derive: 'Could not create the private account. Confirm that an EOA wallet is connected and try again.',
    register: 'The private account could not be registered. Please try again.',
    faucet: 'The Fuji demo faucet could not fund this account. Please try again later.',
    transfer: 'The private transfer could not be completed. No second transfer was submitted automatically.',
    activity: 'Account activity could not be loaded. Please try again.',
  };
  return fallbacks[action];
}

type Sleep = (delayMs: number, signal?: AbortSignal) => Promise<void>;

async function abortableSleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw makeAbortError();

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(makeAbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function pollUntil<T, Result>({
  load,
  select,
  label,
  intervalMs,
  timeoutMs,
  signal,
  now = Date.now,
  sleep = abortableSleep,
}: {
  load: () => Promise<T>;
  select: (value: T) => Result | undefined;
  label: string;
  intervalMs: number;
  timeoutMs: number;
  signal?: AbortSignal;
  now?: () => number;
  sleep?: Sleep;
}): Promise<Result> {
  const startedAt = now();

  for (;;) {
    if (signal?.aborted) throw makeAbortError();
    const value = await load();
    if (signal?.aborted) throw makeAbortError();

    const result = select(value);
    if (result !== undefined) return result;

    const elapsed = now() - startedAt;
    if (elapsed >= timeoutMs) throw new DemoPollingTimeoutError(label);
    await sleep(Math.min(intervalMs, timeoutMs - elapsed), signal);
  }
}
