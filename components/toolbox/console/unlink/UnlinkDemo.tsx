'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Eip1193Provider, UnlinkClient } from '@unlink-xyz/sdk/browser';
import type { WalletClient } from 'viem';

import {
  type ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';

import { AccountActivity, getTransactionDisplayState } from './AccountActivity';
import { type DemoBusyAction, PrivateTransfer } from './PrivateTransfer';
import {
  type DemoErrorAction,
  type DemoTransaction,
  DEMO_RECIPIENT_ADDRESS,
  FAUCET_AMOUNT,
  FUJI_CHAIN_ID,
  TRANSFER_AMOUNT,
  UNLINK_APP_ID,
  UNLINK_ENVIRONMENT,
  USDCM_TOKEN_ADDRESS,
  findMatchingTransaction,
  getDemoErrorMessage,
  getWalletIdentity,
  isAbortError,
  pollUntil,
  readTokenBalance,
} from './demo';

type UnlinkBrowserSdk = typeof import('@unlink-xyz/sdk/browser');

const metadata: ConsoleToolMetadata = {
  title: 'Unlink Private Transfer',
  description: 'Create a wallet-derived private account, fund it with demo USDCm, and send a private transfer on Fuji.',
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

let browserSdkPromise: Promise<UnlinkBrowserSdk> | null = null;

async function loadBrowserSdk(): Promise<UnlinkBrowserSdk> {
  if (!browserSdkPromise) {
    browserSdkPromise = import('@unlink-xyz/sdk/browser').catch((error) => {
      browserSdkPromise = null;
      throw error;
    });
  }
  return browserSdkPromise;
}

function getWalletAddress(walletClient: WalletClient): string | null {
  const account = walletClient.account;
  if (!account) return null;
  return typeof account === 'string' ? account : account.address;
}

function createWalletProvider(walletClient: WalletClient): Eip1193Provider {
  const transportRequest = walletClient.transport.request as unknown as Eip1193Provider['request'];
  return { request: (args) => transportRequest(args) };
}

function parseChainId(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 16) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function UnlinkDemoSession({
  walletClient,
  walletAddress,
  chainId,
}: {
  walletClient: WalletClient;
  walletAddress: string | null;
  chainId: number | null;
}) {
  const clientRef = useRef<UnlinkClient | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const fundingTargetRef = useRef<bigint | null>(null);

  const [unlinkAddress, setUnlinkAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState('0');
  const [fundingRequested, setFundingRequested] = useState(false);
  const [fundingComplete, setFundingComplete] = useState(false);
  const [transferSubmitted, setTransferSubmitted] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<DemoTransaction | null>(null);
  const [busyAction, setBusyAction] = useState<DemoBusyAction>(null);
  const [statusMessage, setStatusMessage] = useState(() =>
    chainId === FUJI_CHAIN_ID ? 'Ready to create a private account.' : 'Switch to Fuji to begin.',
  );
  const [error, setError] = useState<string | null>(null);

  const currentTransaction = transaction?.id === transactionId ? transaction : null;
  const transferComplete = currentTransaction ? getTransactionDisplayState(currentTransaction) === 'processed' : false;

  useEffect(
    () => () => {
      runIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      clientRef.current = null;
      fundingTargetRef.current = null;
    },
    [],
  );

  const beginOperation = useCallback((action: Exclude<DemoBusyAction, null>, message: string) => {
    // React state does not update synchronously. This ref gate prevents a
    // rapid second click from submitting another faucet or transfer request.
    if (abortRef.current) return null;

    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setBusyAction(action);
    setStatusMessage(message);
    setError(null);
    return { controller, runId };
  }, []);

  const isCurrentRun = useCallback((runId: number) => runIdRef.current === runId, []);

  const finishOperation = useCallback(
    (runId: number) => {
      if (!isCurrentRun(runId)) return;
      abortRef.current = null;
      setBusyAction(null);
    },
    [isCurrentRun],
  );

  const failOperation = useCallback(
    (runId: number, caught: unknown, action: DemoErrorAction) => {
      if (!isCurrentRun(runId) || isAbortError(caught)) return;
      setError(getDemoErrorMessage(caught, action));
      setStatusMessage('Action needs attention.');
      finishOperation(runId);
    },
    [finishOperation, isCurrentRun],
  );

  const readBalance = useCallback(async (client: UnlinkClient) => {
    const result = await client.getBalances({ token: USDCM_TOKEN_ADDRESS });
    return readTokenBalance(result.balances, USDCM_TOKEN_ADDRESS);
  }, []);

  const waitForBalance = useCallback(
    async (client: UnlinkClient, minimum: bigint, signal: AbortSignal) =>
      pollUntil({
        label: 'Private funding',
        intervalMs: 2_000,
        timeoutMs: 180_000,
        signal,
        load: () => client.getBalances({ token: USDCM_TOKEN_ADDRESS }),
        select: (result) => {
          const current = readTokenBalance(result.balances, USDCM_TOKEN_ADDRESS);
          setBalance(current.toString());
          return current >= minimum ? current : undefined;
        },
      }),
    [],
  );

  const handleSwitchToFuji = useCallback(async () => {
    const operation = beginOperation('network', 'Opening the Fuji network request...');
    if (!operation) return;
    const { runId } = operation;
    try {
      await walletClient.switchChain({ id: FUJI_CHAIN_ID });
      if (!isCurrentRun(runId)) return;
      setStatusMessage('Wallet switched to Avalanche Fuji.');
      finishOperation(runId);
    } catch (caught) {
      failOperation(runId, caught, 'network');
    }
  }, [beginOperation, failOperation, finishOperation, isCurrentRun, walletClient]);

  const handleCreateAccount = useCallback(async () => {
    const expectedWalletAddress = walletAddress;
    if (!expectedWalletAddress || chainId !== FUJI_CHAIN_ID) {
      setError(getDemoErrorMessage(new Error('wrong network'), 'derive'));
      return;
    }

    const operation = beginOperation('derive', 'Loading private account tools...');
    if (!operation) return;
    const { controller, runId } = operation;
    try {
      const provider = createWalletProvider(walletClient);
      const liveChainId = parseChainId(await provider.request({ method: 'eth_chainId' }));
      if (liveChainId !== FUJI_CHAIN_ID) throw new Error('wrong network: chain 43113 required');

      const sdk = await loadBrowserSdk();
      if (!isCurrentRun(runId) || controller.signal.aborted) return;
      setStatusMessage('Approve the deterministic account signature in your wallet...');

      const derived = await sdk.account.fromWallet({
        provider,
        appId: UNLINK_APP_ID,
        chainId: FUJI_CHAIN_ID,
      });
      if (!isCurrentRun(runId) || controller.signal.aborted) return;
      if (derived.address.toLowerCase() !== expectedWalletAddress.toLowerCase()) {
        throw new Error('Wallet account changed while signing');
      }

      const client = sdk.createUnlinkClient({
        environment: UNLINK_ENVIRONMENT,
        account: derived.account,
      });
      const address = await client.getAddress();
      if (!isCurrentRun(runId) || controller.signal.aborted) return;

      setStatusMessage('Registering the private account...');
      try {
        await client.ensureRegistered();
      } catch (caught) {
        failOperation(runId, caught, 'register');
        return;
      }
      if (!isCurrentRun(runId) || controller.signal.aborted) return;

      clientRef.current = client;
      setUnlinkAddress(address);
      try {
        const currentBalance = await readBalance(client);
        if (!isCurrentRun(runId) || controller.signal.aborted) return;
        setBalance(currentBalance.toString());
        if (currentBalance >= BigInt(TRANSFER_AMOUNT)) {
          setFundingComplete(true);
          setStatusMessage('Private account ready with enough balance to send exactly 1 USDCm.');
        } else {
          setStatusMessage('Private account ready. Fund it with demo USDCm.');
        }
      } catch {
        if (!isCurrentRun(runId) || controller.signal.aborted) return;
        setError('The private account is ready, but its balance could not be checked. Try the funding step again.');
        setStatusMessage('Private account ready. Balance check needs attention.');
      }
      finishOperation(runId);
    } catch (caught) {
      failOperation(runId, caught, 'derive');
    }
  }, [beginOperation, chainId, failOperation, finishOperation, isCurrentRun, readBalance, walletAddress, walletClient]);

  const handleRequestFunding = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    const operation = beginOperation('faucet', 'Requesting exactly 10 demo USDCm...');
    if (!operation) return;
    const { controller, runId } = operation;
    try {
      let before: bigint;
      try {
        before = await readBalance(client);
      } catch {
        if (!isCurrentRun(runId) || controller.signal.aborted) return;
        setError('The private balance could not be checked. No faucet request was submitted. Please try again.');
        setStatusMessage('Balance check needs attention.');
        finishOperation(runId);
        return;
      }
      if (!isCurrentRun(runId) || controller.signal.aborted) return;
      setBalance(before.toString());
      if (before >= BigInt(TRANSFER_AMOUNT)) {
        setFundingComplete(true);
        setStatusMessage('Private balance is ready. No additional faucet request was needed.');
        finishOperation(runId);
        return;
      }

      await client.faucet.requestPrivateTokens({
        token: USDCM_TOKEN_ADDRESS,
        amount: FAUCET_AMOUNT,
      });
      if (!isCurrentRun(runId) || controller.signal.aborted) return;

      const target = before + BigInt(FAUCET_AMOUNT);
      fundingTargetRef.current = target;
      setFundingRequested(true);
      setStatusMessage('Funding accepted. Waiting for the private balance...');
      const fundedBalance = await waitForBalance(client, target, controller.signal);
      if (!isCurrentRun(runId) || controller.signal.aborted) return;

      setBalance(fundedBalance.toString());
      setFundingComplete(true);
      setStatusMessage('Private balance funded. Ready to send exactly 1 USDCm.');
      finishOperation(runId);
    } catch (caught) {
      failOperation(runId, caught, 'faucet');
    }
  }, [beginOperation, failOperation, finishOperation, isCurrentRun, readBalance, waitForBalance]);

  const handleCheckFunding = useCallback(async () => {
    const client = clientRef.current;
    const target = fundingTargetRef.current;
    if (!client || target === null) return;

    const operation = beginOperation('funding-check', 'Checking the private balance...');
    if (!operation) return;
    const { controller, runId } = operation;
    try {
      const fundedBalance = await waitForBalance(client, target, controller.signal);
      if (!isCurrentRun(runId) || controller.signal.aborted) return;
      setBalance(fundedBalance.toString());
      setFundingComplete(true);
      setStatusMessage('Private balance funded. Ready to send exactly 1 USDCm.');
      finishOperation(runId);
    } catch (caught) {
      failOperation(runId, caught, 'faucet');
    }
  }, [beginOperation, failOperation, finishOperation, isCurrentRun, waitForBalance]);

  const loadMatchingTransaction = useCallback(async (client: UnlinkClient, id: string) => {
    const result = await client.getTransactions({ type: 'transfer', limit: 50 });
    return findMatchingTransaction(result.transactions, id);
  }, []);

  const handleRefreshActivity = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !transactionId) return;

    const operation = beginOperation('activity', 'Checking account activity...');
    if (!operation) return;
    const { controller, runId } = operation;
    try {
      const match = await loadMatchingTransaction(client, transactionId);
      if (!isCurrentRun(runId) || controller.signal.aborted) return;
      setTransaction(match);
      const transactionState = match ? getTransactionDisplayState(match) : null;
      let balanceRefreshFailed = false;
      try {
        const currentBalance = await readBalance(client);
        if (!isCurrentRun(runId) || controller.signal.aborted) return;
        setBalance(currentBalance.toString());
      } catch {
        balanceRefreshFailed = true;
      }
      if (transactionState === 'failed') {
        setTransferSubmitted(false);
        setError('The private transfer failed. Check the private balance, then submit it again when ready.');
        setStatusMessage('Transfer failed. The fixed transfer can be retried.');
      } else if (transactionState === 'processed') {
        setStatusMessage('Private transfer processed and visible in account activity.');
      } else {
        setStatusMessage(
          match ? `Transfer status: ${match.confirmation_status}.` : 'The matching transfer is not visible yet.',
        );
      }
      if (balanceRefreshFailed && transactionState !== 'failed') {
        setError(
          match
            ? 'Transfer status loaded, but the private balance could not be refreshed.'
            : 'Account activity was checked, but the private balance could not be refreshed.',
        );
      }
      finishOperation(runId);
    } catch (caught) {
      failOperation(runId, caught, 'activity');
    }
  }, [
    beginOperation,
    failOperation,
    finishOperation,
    isCurrentRun,
    loadMatchingTransaction,
    readBalance,
    transactionId,
  ]);

  const handleTransfer = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    const operation = beginOperation('transfer', 'Preparing the fixed private transfer...');
    if (!operation) return;
    const { controller, runId } = operation;
    setTransactionId(null);
    setTransaction(null);
    setTransferSubmitted(false);
    try {
      const currentBalance = await readBalance(client);
      if (!isCurrentRun(runId) || controller.signal.aborted) return;
      setBalance(currentBalance.toString());
      if (currentBalance < BigInt(TRANSFER_AMOUNT)) {
        fundingTargetRef.current = null;
        setFundingRequested(false);
        setFundingComplete(false);
        setError('At least 1 USDCm is required for this transfer. Request demo funds, then try again.');
        setStatusMessage('Private balance is too low.');
        finishOperation(runId);
        return;
      }

      const handle = await client.transfer({
        recipientAddress: DEMO_RECIPIENT_ADDRESS,
        token: USDCM_TOKEN_ADDRESS,
        amount: TRANSFER_AMOUNT,
      });
      if (!isCurrentRun(runId) || controller.signal.aborted) return;
      setTransactionId(handle.txId);
      setTransferSubmitted(true);
      setStatusMessage('Transfer accepted. Waiting for processed status...');

      const result = await handle.wait({
        until: 'processed',
        intervalMs: 2_000,
        timeoutMs: 240_000,
        signal: controller.signal,
        onStatus: (status) => {
          if (isCurrentRun(runId)) setStatusMessage(`Private transfer status: ${status}.`);
        },
      });
      if (!isCurrentRun(runId) || controller.signal.aborted) return;
      if (result.status === 'failed' || result.confirmationStatus === 'failed') {
        setTransferSubmitted(false);
        throw new Error('Transfer failed');
      }

      setStatusMessage('Transfer processed. Loading the matching account activity...');
      const match = await pollUntil({
        label: 'Account activity',
        intervalMs: 2_000,
        timeoutMs: 60_000,
        signal: controller.signal,
        load: () => client.getTransactions({ type: 'transfer', limit: 50 }),
        select: (transactions) => findMatchingTransaction(transactions.transactions, handle.txId) ?? undefined,
      });
      if (!isCurrentRun(runId) || controller.signal.aborted) return;

      setTransaction(match);
      const transactionState = getTransactionDisplayState(match);
      if (transactionState === 'failed') {
        setTransferSubmitted(false);
        setError('The private transfer failed. Check the private balance, then submit it again when ready.');
        setStatusMessage('Transfer failed. The fixed transfer can be retried.');
        finishOperation(runId);
        return;
      }
      if (transactionState === 'pending') {
        setStatusMessage('The matching private transfer is still processing. Check its status again.');
        finishOperation(runId);
        return;
      }
      try {
        const remainingBalance = await readBalance(client);
        if (!isCurrentRun(runId) || controller.signal.aborted) return;
        setBalance(remainingBalance.toString());
      } catch {
        if (!isCurrentRun(runId) || controller.signal.aborted) return;
        setError('The transfer completed, but the private balance could not be refreshed.');
      }
      setStatusMessage('Private transfer processed and visible in account activity.');
      finishOperation(runId);
    } catch (caught) {
      failOperation(runId, caught, 'transfer');
    }
  }, [beginOperation, failOperation, finishOperation, isCurrentRun, readBalance]);

  const activityRefreshing = busyAction === 'activity' || (busyAction === 'transfer' && transferSubmitted);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start">
      <PrivateTransfer
        chainId={chainId}
        walletAddress={walletAddress}
        unlinkAddress={unlinkAddress}
        balance={balance}
        fundingRequested={fundingRequested}
        fundingComplete={fundingComplete}
        transferSubmitted={transferSubmitted}
        transferComplete={transferComplete}
        busyAction={busyAction}
        statusMessage={statusMessage}
        error={error}
        onSwitchToFuji={handleSwitchToFuji}
        onCreateAccount={handleCreateAccount}
        onRequestFunding={handleRequestFunding}
        onCheckFunding={handleCheckFunding}
        onTransfer={handleTransfer}
        onRefreshActivity={handleRefreshActivity}
      />
      <AccountActivity
        unlinkAddress={unlinkAddress}
        transactionId={transactionId}
        transaction={currentTransaction}
        isRefreshing={activityRefreshing}
      />
    </div>
  );
}

function UnlinkDemoBase() {
  const { walletClient } = useConnectedWallet();
  const walletAddress = getWalletAddress(walletClient);
  const chainId = walletClient.chain?.id ?? null;
  const walletIdentity = getWalletIdentity(walletAddress, chainId);

  // A wallet or network change synchronously remounts the session subtree. This
  // discards private account state before the new identity can render it.
  return (
    <UnlinkDemoSession
      key={walletIdentity}
      walletClient={walletClient}
      walletAddress={walletAddress}
      chainId={chainId}
    />
  );
}

export default withConsoleToolMetadata(UnlinkDemoBase, metadata);
