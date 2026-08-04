'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { formatEther, defineChain, isAddress } from 'viem';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { Copy, Check, Droplets, ExternalLink, RefreshCw, Wallet } from 'lucide-react';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { AccountRequirementsConfigKey } from '../../hooks/useAccountRequirements';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';

const DEVNET_RPC_URL = 'https://api.avax-dev.network/ext/bc/C/rpc';
const DEVNET_CHAIN_ID = 43117;
const DEVNET_CHAIN_ID_HEX = '0xa86d';
const DEFAULT_DRIP_AMOUNT = '2';
const MIN_DRIP_AMOUNT = 1;
const MAX_DRIP_AMOUNT = 2005;

const devnetCChain = defineChain({
  id: DEVNET_CHAIN_ID,
  name: 'Avalanche Devnet C-Chain',
  nativeCurrency: { decimals: 18, name: 'AVAX', symbol: 'AVAX' },
  rpcUrls: {
    default: { http: [DEVNET_RPC_URL] },
  },
});

// Module-scope client for the devnet RPC. Made non-null by construction
// since DEVNET_RPC_URL is a literal string, but we guard anyway so the
// type narrowing works in consumers below.
const devnetPublicClient = makePublicClientForChain(DEVNET_RPC_URL, [], devnetCChain)!;

const metadata: ConsoleToolMetadata = {
  title: 'Devnet Faucet',
  description: 'Request free devnet AVAX on the C-Chain (Ava Labs, or with a coupon code)',
  toolRequirements: [AccountRequirementsConfigKey.UserLoggedIn],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function isValidDripAmount(amount: string) {
  const trimmedAmount = amount.trim();
  if (!/^[1-9]\d*$/.test(trimmedAmount)) {
    return false;
  }

  const parsedAmount = Number(trimmedAmount);
  return Number.isSafeInteger(parsedAmount) && parsedAmount >= MIN_DRIP_AMOUNT && parsedAmount <= MAX_DRIP_AMOUNT;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
      title={`Copy ${label || text}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : label || 'Copy'}
    </button>
  );
}

function DevnetFaucet({ onSuccess: _onSuccess }: BaseConsoleToolProps) {
  const { data: session } = useSession();
  const { walletEVMAddress } = useWalletStore();
  const [isDripping, setIsDripping] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    txHash?: string;
    destinationAddress?: string;
  } | null>(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [hasEditedRecipientAddress, setHasEditedRecipientAddress] = useState(false);
  const [dripAmount, setDripAmount] = useState(DEFAULT_DRIP_AMOUNT);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);

  const [faucetBalance, setFaucetBalance] = useState<string | null>(null);
  const [faucetAddress, setFaucetAddress] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const [userBalance, setUserBalance] = useState<string | null>(null);
  const [isLoadingUserBalance, setIsLoadingUserBalance] = useState(false);

  const userEmail = session?.user?.email || '';
  const isAvaLabs = userEmail.endsWith('@avalabs.org');

  const fetchBalance = useCallback(async () => {
    setIsLoadingBalance(true);
    try {
      const res = await fetch('/api/devnet-faucet/balance');
      const data = await res.json();
      if (data.success) {
        setFaucetBalance(data.balance);
        setFaucetAddress(data.address);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  const fetchUserBalance = useCallback(async () => {
    if (!walletEVMAddress) return;
    setIsLoadingUserBalance(true);
    try {
      const balanceWei = await devnetPublicClient.getBalance({
        address: walletEVMAddress as `0x${string}`,
      });
      setUserBalance(formatEther(balanceWei));
    } catch {
      setUserBalance(null);
    } finally {
      setIsLoadingUserBalance(false);
    }
  }, [walletEVMAddress]);

  useEffect(() => {
    if (isAvaLabs) {
      fetchBalance();
    }
  }, [isAvaLabs, fetchBalance]);

  useEffect(() => {
    if (walletEVMAddress) {
      fetchUserBalance();
    }
  }, [walletEVMAddress, fetchUserBalance]);

  useEffect(() => {
    if (walletEVMAddress && !hasEditedRecipientAddress) {
      setRecipientAddress(walletEVMAddress);
    }
  }, [walletEVMAddress, hasEditedRecipientAddress]);

  const handleAddNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: DEVNET_CHAIN_ID_HEX,
            chainName: 'Avalanche Devnet C-Chain',
            nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
            rpcUrls: [DEVNET_RPC_URL],
          },
        ],
      });
    } catch (err) {
      console.error('Failed to add network:', err);
    }
  };

  const handleSwitchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: DEVNET_CHAIN_ID_HEX }],
      });
    } catch (err: any) {
      // 4902 = chain not added yet
      if (err?.code === 4902) {
        await handleAddNetwork();
      } else {
        console.error('Failed to switch network:', err);
      }
    }
  };

  const handleDrip = async () => {
    if (isDripping) return;

    const destinationAddress = recipientAddress.trim();
    if (!isAddress(destinationAddress)) {
      setRecipientError('Enter a valid EVM address');
      return;
    }

    const requestedAmount = dripAmount.trim();
    if (!isValidDripAmount(requestedAmount)) {
      setAmountError(`Enter a whole number from ${MIN_DRIP_AMOUNT} to ${MAX_DRIP_AMOUNT}`);
      return;
    }

    const trimmedCoupon = couponCode.trim();
    if (!isAvaLabs && !trimmedCoupon) {
      setCouponError('Enter the coupon code you were given');
      return;
    }

    setIsDripping(true);
    setResult(null);
    setRecipientError(null);
    setAmountError(null);
    setCouponError(null);

    try {
      const couponParam = !isAvaLabs ? `&coupon=${encodeURIComponent(trimmedCoupon)}` : '';
      const response = await fetch(
        `/api/devnet-faucet?address=${encodeURIComponent(destinationAddress)}&amount=${encodeURIComponent(requestedAmount)}${couponParam}`,
      );
      const data = await response.json();

      if (!response.ok) {
        setResult({ success: false, message: data.message || 'Failed to drip tokens' });
        return;
      }

      setResult({
        success: true,
        message: `Sent ${data.amount} AVAX`,
        txHash: data.txHash,
        destinationAddress: data.destinationAddress,
      });
      // Refresh balances after drip
      setTimeout(() => {
        fetchBalance();
        if (walletEVMAddress && destinationAddress.toLowerCase() === walletEVMAddress.toLowerCase()) {
          fetchUserBalance();
        }
      }, 2000);
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setIsDripping(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto not-prose">
      {/* Network Info */}
      <div className="mb-6">
        <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">Devnet Network</h2>

        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">RPC Endpoint</span>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                {DEVNET_RPC_URL}
              </code>
              <CopyButton text={DEVNET_RPC_URL} label="RPC" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Chain ID</span>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                {DEVNET_CHAIN_ID}
              </code>
              <CopyButton text={DEVNET_CHAIN_ID.toString()} label="Chain ID" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Network</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-white">Avalanche Devnet C-Chain</span>
          </div>
          {isAvaLabs && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" />
                Faucet Balance
              </span>
              <div className="flex items-center gap-2">
                {isLoadingBalance ? (
                  <span className="text-sm text-zinc-400 animate-pulse">Loading...</span>
                ) : faucetBalance !== null ? (
                  <span className="text-sm font-mono font-semibold text-zinc-900 dark:text-white">
                    {parseFloat(faucetBalance).toLocaleString(undefined, { maximumFractionDigits: 4 })} AVAX
                  </span>
                ) : (
                  <span className="text-sm text-zinc-400">Unavailable</span>
                )}
                <button
                  onClick={fetchBalance}
                  disabled={isLoadingBalance}
                  className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50"
                  title="Refresh balance"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          )}
          {faucetAddress && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Faucet Address</span>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded truncate max-w-[200px]">
                  {faucetAddress}
                </code>
                <CopyButton text={faucetAddress} label="Address" />
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={handleSwitchNetwork}
              className="w-full px-4 py-2 text-sm font-medium bg-zinc-800 dark:bg-zinc-700 text-white hover:bg-zinc-900 dark:hover:bg-zinc-600 transition-colors rounded flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Add / Switch to Devnet in Wallet
            </button>
          </div>
        </div>
      </div>

      {/* C-Chain Faucet */}
      <div className="mb-6">
        <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">Contract Chain (Devnet)</h2>

        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-8">
          <div className="flex items-center gap-3 mb-8">
            <img
              src="https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg"
              alt="C-Chain"
              className="w-10 h-10 shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-medium text-zinc-900 dark:text-white leading-tight">C-Chain</h3>
                <span className="shrink-0">
                  <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                    {isValidDripAmount(dripAmount) ? dripAmount.trim() : DEFAULT_DRIP_AMOUNT}
                  </span>
                  <span className="text-sm text-zinc-500 ml-1">AVAX</span>
                </span>
              </div>
              <p className="text-xs text-zinc-500 leading-tight">Devnet smart contracts & testing</p>
            </div>
          </div>

          <div className="space-y-3">
            {!isAvaLabs && (
              <div className="space-y-1.5">
                <label htmlFor="devnet-faucet-coupon" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Faucet coupon code
                </label>
                <input
                  id="devnet-faucet-coupon"
                  type="text"
                  value={couponCode}
                  onChange={(event) => {
                    setCouponCode(event.target.value);
                    setCouponError(null);
                    setResult(null);
                  }}
                  placeholder="Enter your coupon code"
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                {couponError && <p className="text-xs text-red-500">{couponError}</p>}
                <p className="text-xs text-zinc-500">Required to claim devnet AVAX without an Ava Labs account.</p>
              </div>
            )}
            {walletEVMAddress && (
              <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 rounded px-3 py-2">
                <div className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                  <Wallet className="w-3.5 h-3.5" />
                  Your Balance
                </div>
                <div className="flex items-center gap-2">
                  {isLoadingUserBalance ? (
                    <span className="text-sm text-zinc-400 animate-pulse">Loading...</span>
                  ) : userBalance !== null ? (
                    <span className="text-sm font-mono font-semibold text-zinc-900 dark:text-white">
                      {parseFloat(userBalance).toLocaleString(undefined, { maximumFractionDigits: 4 })} AVAX
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-400">Unavailable</span>
                  )}
                  <button
                    onClick={fetchUserBalance}
                    disabled={isLoadingUserBalance}
                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50"
                    title="Refresh balance"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUserBalance ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="devnet-faucet-recipient"
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Recipient Address
                </label>
                {walletEVMAddress && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecipientAddress(walletEVMAddress);
                      setRecipientError(null);
                      setResult(null);
                      setHasEditedRecipientAddress(false);
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    Use connected wallet
                  </button>
                )}
              </div>
              <input
                id="devnet-faucet-recipient"
                type="text"
                value={recipientAddress}
                onChange={(event) => {
                  setRecipientAddress(event.target.value);
                  setRecipientError(null);
                  setResult(null);
                  setHasEditedRecipientAddress(true);
                }}
                placeholder="0x..."
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {recipientError && <p className="text-xs text-red-500">{recipientError}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="devnet-faucet-amount" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Amount
              </label>
              <div className="relative">
                <input
                  id="devnet-faucet-amount"
                  type="number"
                  min={MIN_DRIP_AMOUNT}
                  max={MAX_DRIP_AMOUNT}
                  step={1}
                  value={dripAmount}
                  onChange={(event) => {
                    setDripAmount(event.target.value);
                    setAmountError(null);
                    setResult(null);
                  }}
                  className="w-full px-3 py-2 pr-16 text-sm font-mono bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">
                  AVAX
                </span>
              </div>
              <p className="text-xs text-zinc-500">Whole AVAX only, up to {MAX_DRIP_AMOUNT.toLocaleString()}.</p>
              {amountError && <p className="text-xs text-red-500">{amountError}</p>}
            </div>
            {walletEVMAddress && (
              <p className="text-xs text-zinc-500 truncate">
                Connected wallet: <span className="font-mono">{walletEVMAddress}</span>
              </p>
            )}
            <button
              onClick={handleDrip}
              disabled={isDripping || !recipientAddress.trim() || !dripAmount.trim()}
              className="w-full px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-zinc-400 disabled:cursor-not-allowed rounded flex items-center justify-center gap-2"
            >
              <Droplets className="w-4 h-4" />
              {isDripping
                ? 'Dripping...'
                : `Drip ${isValidDripAmount(dripAmount) ? dripAmount.trim() : DEFAULT_DRIP_AMOUNT} AVAX`}
            </button>
          </div>

          {result && (
            <div
              className={`mt-4 p-3 rounded text-sm ${
                result.success
                  ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
              }`}
            >
              <p>{result.message}</p>
              {result.destinationAddress && (
                <p className="mt-1 text-xs font-mono break-all text-zinc-500">to: {result.destinationAddress}</p>
              )}
              {result.txHash && <p className="mt-1 text-xs font-mono break-all text-zinc-500">tx: {result.txHash}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-4 text-xs text-zinc-400 dark:text-zinc-600">
        <span>{isAvaLabs ? 'Ava Labs internal' : 'Coupon access'}</span>
        <span>&middot;</span>
        <span>Devnet tokens only</span>
        <span>&middot;</span>
        <span className="font-mono">{userEmail}</span>
      </div>
    </div>
  );
}

export default withConsoleToolMetadata(DevnetFaucet, metadata);
