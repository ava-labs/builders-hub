"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Loader2, ExternalLink, Check, Wallet } from "lucide-react";
import { encodeFunctionData, parseEther } from "viem";
import { useWalletConnect } from "@/components/toolbox/hooks/useWalletConnect";
import { useExplorerNetwork } from "@/components/explorer/useExplorerNetwork";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ContractWriteSectionProps {
  abi: any[];
  address: string;
  chainId: string;
  chainSlug: string;
  rpcUrl?: string;
  themeColor?: string;
}

interface FunctionResult {
  loading: boolean;
  txHash?: string;
  error?: string;
  status?: 'pending' | 'success' | 'failed';
}

// Get write functions from ABI (non-view, non-pure)
function getWriteFunctions(abi: any[]): any[] {
  return abi.filter(item => 
    item.type === 'function' && 
    item.stateMutability !== 'view' && 
    item.stateMutability !== 'pure'
  ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/**
 * Turn a form field into the JS value viem expects for an ABI type.
 *
 * Throws on anything it cannot make sense of, which is the point: the
 * previous encoder answered a value it couldn't parse with 32 zero bytes,
 * so a typo became a transaction that ran successfully and did the wrong
 * thing. Refusing to send is the only safe failure here.
 */
function parseArgument(type: string, raw: string): unknown {
  const value = raw.trim();

  if (type.endsWith(']')) {
    const element = type.slice(0, type.lastIndexOf('['));
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(`${type} needs a JSON array, for example ["1","2"]`);
    }
    if (!Array.isArray(parsed)) throw new Error(`${type} needs a JSON array`);
    return parsed.map((item) => parseArgument(element, typeof item === 'string' ? item : JSON.stringify(item)));
  }

  if (type.startsWith('tuple')) {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`${type} needs a JSON object`);
    }
  }

  if (type.startsWith('uint') || type.startsWith('int')) {
    try {
      return BigInt(value);
    } catch {
      throw new Error(`"${value}" is not a whole number`);
    }
  }

  if (type === 'bool') {
    const lowered = value.toLowerCase();
    if (['true', '1', 'false', '0'].includes(lowered)) return lowered === 'true' || lowered === '1';
    throw new Error(`"${value}" is not true or false`);
  }

  if (type === 'address') {
    if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`"${value}" is not an address`);
    return value as `0x${string}`;
  }

  if (type.startsWith('bytes')) {
    if (!/^0x[0-9a-fA-F]*$/.test(value)) throw new Error(`${type} needs 0x-prefixed hex`);
    return value as `0x${string}`;
  }

  return value;
}

/**
 * Providers reject with plain objects carrying `code` and `message`, not
 * with Error instances, so an `instanceof Error` check throws the reason
 * away and leaves the caller staring at "Transaction failed".
 */
function describeError(error: any): string {
  if (error?.code === 4001 || error?.cause?.code === 4001) return 'Transaction rejected in wallet';

  const detail =
    error?.data?.message ??
    error?.error?.message ??
    error?.cause?.shortMessage ??
    error?.cause?.message ??
    error?.shortMessage ??
    error?.message;

  if (typeof detail === 'string' && detail.trim()) return detail;
  if (typeof error === 'string' && error.trim()) return error;
  return 'Transaction failed';
}

export default function ContractWriteSection({
  abi,
  address,
  chainId,
  chainSlug,
  rpcUrl,
  themeColor = "#E57373",
}: ContractWriteSectionProps) {
  const network = useExplorerNetwork();
  const [expandedFunctions, setExpandedFunctions] = useState<Set<string>>(new Set());
  const [functionInputs, setFunctionInputs] = useState<Record<string, Record<string, string>>>({});
  const [functionResults, setFunctionResults] = useState<Record<string, FunctionResult>>({});
  const [payableValues, setPayableValues] = useState<Record<string, string>>({});

  /* Wallet state comes from the injected provider and from nowhere else.
     The console's wallet store is populated by WalletSync, mounted in the
     console header and nowhere near the explorer, so here it reports
     whatever it was left holding — an address with no way to sign, a chain
     id of zero, an account the user has since disconnected. The provider is
     what actually signs, so it is the only honest source: display, chain
     check, and capability all read the same place. */
  const [account, setAccount] = useState<string>('');
  const [liveChainId, setLiveChainId] = useState<number | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const { connectWallet } = useWalletConnect();

  useEffect(() => {
    const provider = typeof window !== 'undefined' ? window.ethereum : undefined;
    if (!provider?.request) return;

    let cancelled = false;
    const read = async () => {
      try {
        const [accounts, chainIdHex] = await Promise.all([
          provider.request({ method: 'eth_accounts' }) as Promise<string[]>,
          provider.request({ method: 'eth_chainId' }) as Promise<string>,
        ]);
        if (cancelled) return;
        setAccount(accounts?.[0] ?? '');
        setLiveChainId(chainIdHex ? parseInt(chainIdHex, 16) : null);
      } catch {
        /* a wallet that won't answer is treated as not connected */
      }
    };

    void read();
    const onAccounts = (accounts: string[]) => setAccount(accounts?.[0] ?? '');
    const onChain = (chainIdHex: string) => setLiveChainId(parseInt(chainIdHex, 16));
    provider.on?.('accountsChanged', onAccounts);
    provider.on?.('chainChanged', onChain);

    return () => {
      cancelled = true;
      provider.removeListener?.('accountsChanged', onAccounts);
      provider.removeListener?.('chainChanged', onChain);
    };
  }, []);

  const walletEVMAddress = account;
  const writeFunctions = getWriteFunctions(abi);

  // Check if user is on the correct chain
  const expectedChainId = parseInt(chainId);
  const isOnCorrectChain = liveChainId === expectedChainId;

  const toggleFunction = (funcKey: string) => {
    setExpandedFunctions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(funcKey)) {
        newSet.delete(funcKey);
      } else {
        newSet.add(funcKey);
      }
      return newSet;
    });
  };

  const updateInput = (funcKey: string, inputName: string, value: string) => {
    setFunctionInputs(prev => ({
      ...prev,
      [funcKey]: {
        ...(prev[funcKey] || {}),
        [inputName]: value
      }
    }));
  };

  const updatePayableValue = (funcKey: string, value: string) => {
    setPayableValues(prev => ({
      ...prev,
      [funcKey]: value
    }));
  };

  /** Ask the provider where it stands, rather than waiting for an event
   *  that some wallets don't emit. */
  const refreshWalletState = async () => {
    const provider = window.ethereum;
    if (!provider?.request) return;
    try {
      const [accounts, chainIdHex] = await Promise.all([
        provider.request({ method: 'eth_accounts' }) as Promise<string[]>,
        provider.request({ method: 'eth_chainId' }) as Promise<string>,
      ]);
      setAccount(accounts?.[0] ?? '');
      setLiveChainId(chainIdHex ? parseInt(chainIdHex, 16) : null);
    } catch {
      /* leave the last known state alone */
    }
  };

  /** Open the wallet's account picker. `wallet_requestPermissions` is what
   *  forces the chooser even when the site is already authorized, which is
   *  the only way to switch accounts from here. */
  const chooseAccount = async () => {
    const provider = window.ethereum;
    if (!provider?.request) return;
    setAccountMenuOpen(false);
    try {
      await provider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
    } catch {
      // Wallets that don't implement it still expose the picker this way.
      await provider.request({ method: 'eth_requestAccounts' }).catch(() => undefined);
    }
    await refreshWalletState();
  };

  /** Forget the connection. Wallets that support revocation are told; the
   *  rest simply stop being used until the user connects again. */
  const disconnect = async () => {
    const provider = window.ethereum;
    setAccountMenuOpen(false);
    try {
      await provider?.request?.({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
    } catch {
      /* not supported everywhere, and not required for the local reset */
    }
    setAccount('');
  };

  const switchToCorrectChain = async () => {
    if (!rpcUrl) return;
    
    try {
      const chainIdHex = `0x${expectedChainId.toString(16)}`;
      await window.ethereum?.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
      await refreshWalletState();
    } catch (switchError: any) {
      // If chain not found, try to add it
      if (switchError.code === 4902 || switchError.code === -32603) {
        try {
          await window.ethereum?.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${expectedChainId.toString(16)}`,
              rpcUrls: [rpcUrl],
            }],
          });
        } catch (addError) {
          console.error('Failed to add chain:', addError);
        }
      }
    }
  };

  const writeFunction = async (func: any, funcKey: string) => {
    // Everything below signs through window.ethereum, so that — not any
    // client held in a store — is what has to be present.
    if (!walletEVMAddress || !window.ethereum?.request) {
      setFunctionResults(prev => ({
        ...prev,
        [funcKey]: { loading: false, error: 'Wallet not connected' }
      }));
      return;
    }

    if (!isOnCorrectChain) {
      setFunctionResults(prev => ({
        ...prev,
        [funcKey]: { loading: false, error: 'Please switch to the correct network' }
      }));
      return;
    }

    setFunctionResults(prev => ({
      ...prev,
      [funcKey]: { loading: true, status: 'pending' }
    }));

    try {
      const inputs = func.inputs || [];
      const inputValues = functionInputs[funcKey] || {};

      const args = inputs.map((input: any, index: number) => {
        const raw = inputValues[input.name || `param${index}`];
        if (raw === undefined || raw === '') {
          throw new Error(`Missing value for ${input.name || `parameter ${index + 1}`}`);
        }
        return parseArgument(input.type, raw);
      });

      // Encoded against this one overload rather than the whole ABI, so a
      // contract with several functions of the same name still resolves.
      const callData = encodeFunctionData({ abi: [func], functionName: func.name, args });

      // Handle payable value
      let value: bigint = BigInt(0);
      if (func.stateMutability === 'payable') {
        const payableValue = payableValues[funcKey];
        if (payableValue && payableValue !== '0') {
          value = parseEther(payableValue);
        }
      }

      // eth_accounts answers without granting anything, so an address in
      // hand does not mean this origin may spend from it — sending then
      // fails with 4100, "not been authorized by the user". Asking for
      // accounts is silent when permission already exists and prompts when
      // it doesn't, and its answer is the account the wallet will actually
      // sign with.
      const authorized = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];
      const from = authorized?.[0];
      if (!from) throw new Error('No account authorized for this site');
      if (from.toLowerCase() !== walletEVMAddress.toLowerCase()) setAccount(from);

      // Send transaction using the wallet
      const request: Record<string, string> = {
        from,
        to: address,
        data: callData,
      };
      // Only sent when non-zero: some wallets reject an explicit undefined.
      if (value > 0) request.value = `0x${value.toString(16)}`;

      const txHash = await window.ethereum?.request({
        method: 'eth_sendTransaction',
        params: [request],
      });

      if (!txHash) {
        throw new Error('Transaction rejected or failed');
      }

      setFunctionResults(prev => ({
        ...prev,
        [funcKey]: { loading: false, txHash, status: 'success' }
      }));

      // Optionally wait for confirmation
      // This could be enhanced to poll for transaction receipt
    } catch (err: any) {
      setFunctionResults(prev => ({
        ...prev,
        [funcKey]: { loading: false, error: describeError(err), status: 'failed' }
      }));
    }
  };

  // Warning: No RPC URL
  if (!rpcUrl) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">RPC Not Available</span>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              No RPC URL is configured for this chain. Contract write functionality is not available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Warning: No write functions
  if (writeFunctions.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <AlertCircle className="w-5 h-5 text-zinc-500 dark:text-zinc-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No Write Functions</span>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              This contract has no public state-changing functions available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Connect wallet prompt
  if (!walletEVMAddress) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <Wallet className="w-6 h-6 text-zinc-400" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">Connect Wallet</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Connect your wallet to interact with this contract.
            </p>
          </div>
          <Button
            onClick={async () => {
              await connectWallet();
              await refreshWalletState();
            }}
            style={{ backgroundColor: themeColor }}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  // Wrong chain warning
  if (!isOnCorrectChain) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 w-full max-w-md">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Wrong Network</span>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Please switch to the correct network to write to this contract.
              </p>
            </div>
          </div>
          <Button onClick={switchToCorrectChain} variant="outline">
            Switch Network
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {/* Connected wallet indicator */}
      <div className="px-4 py-3 bg-green-50/50 dark:bg-green-900/10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Connected: {walletEVMAddress.slice(0, 6)}...{walletEVMAddress.slice(-4)}</span>
        </div>

        {/* The wallet may hold several accounts, and the one it offers is
            not always the one you meant to use. */}
        <div className="relative">
          <button
            onClick={() => setAccountMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer"
          >
            Account
            <ChevronDown className="w-3 h-3" />
          </button>

          {accountMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAccountMenuOpen(false)} />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
              >
                <button
                  role="menuitem"
                  onClick={chooseAccount}
                  className="block w-full px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Switch account
                </button>
                <button
                  role="menuitem"
                  onClick={disconnect}
                  className="block w-full px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {writeFunctions.map((func, index) => {
        const funcKey = `${func.name}-${index}`;
        const isExpanded = expandedFunctions.has(funcKey);
        const inputs = func.inputs || [];
        const isPayable = func.stateMutability === 'payable';
        const result = functionResults[funcKey];

        return (
          <div key={funcKey}>
            {/* Function Header */}
            <button
              onClick={() => toggleFunction(funcKey)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 flex items-center justify-center text-xs font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-white">{func.name}</span>
                {isPayable && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    payable
                  </span>
                )}
                {func.stateMutability === 'nonpayable' && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    write
                  </span>
                )}
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {/* Function Body */}
            {isExpanded && (
              <div className="px-4 py-4 bg-zinc-50/50 dark:bg-zinc-800/20 space-y-4">
                {/* Payable value input */}
                {isPayable && (
                  <div>
                    <label className="block text-xs text-amber-600 dark:text-amber-400 mb-1 font-medium">
                      payableAmount (native token)
                    </label>
                    <input
                      type="text"
                      placeholder="0.0"
                      value={payableValues[funcKey] || ''}
                      onChange={(e) => updatePayableValue(funcKey, e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-white placeholder-zinc-400"
                    />
                  </div>
                )}

                {/* Inputs */}
                {inputs.length > 0 && (
                  <div className="space-y-3">
                    {inputs.map((input: any, inputIndex: number) => (
                      <div key={inputIndex}>
                        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                          {input.name || `param${inputIndex}`} 
                          <span className="text-zinc-400 dark:text-zinc-500 ml-1">({input.type})</span>
                        </label>
                        <input
                          type="text"
                          placeholder={`Enter ${input.type}`}
                          value={functionInputs[funcKey]?.[input.name || `param${inputIndex}`] || ''}
                          onChange={(e) => updateInput(funcKey, input.name || `param${inputIndex}`, e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 text-zinc-900 dark:text-white placeholder-zinc-400"
                          style={{ '--tw-ring-color': themeColor } as any}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Write Button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => writeFunction(func, funcKey)}
                    disabled={result?.loading}
                    className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    style={{ backgroundColor: themeColor }}
                  >
                    {result?.loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {result?.loading ? 'Sending...' : 'Write'}
                  </button>
                </div>

                {/* Result */}
                {result && !result.loading && (
                  <div>
                    {result.error ? (
                      <div className="p-3 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                        {result.error}
                      </div>
                    ) : result.txHash ? (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-green-700 dark:text-green-300">Transaction Submitted</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-600 dark:text-green-400 font-mono break-all">
                            {result.txHash}
                          </span>
                          <Link
                            href={`/explorer/${network}/${chainSlug}/tx/${result.txHash}`}
                            className="flex items-center gap-1 text-xs font-medium hover:underline cursor-pointer"
                            style={{ color: themeColor }}
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

