"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Loader2, ExternalLink, Check, Wallet } from "lucide-react";
import { keccak256, toBytes, parseEther } from "viem";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useWalletConnect } from "@/components/toolbox/hooks/useWalletConnect";
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

// Simple ABI parameter encoder
function encodeParameter(type: string, value: string): string {
  try {
    if (type === 'address') {
      return value.toLowerCase().replace('0x', '').padStart(64, '0');
    }
    if (type.startsWith('uint') || type.startsWith('int')) {
      const num = BigInt(value);
      return num.toString(16).padStart(64, '0');
    }
    if (type === 'bool') {
      return (value.toLowerCase() === 'true' || value === '1') ? '1'.padStart(64, '0') : '0'.padStart(64, '0');
    }
    if (type === 'bytes32') {
      return value.replace('0x', '').padEnd(64, '0');
    }
    return value.replace('0x', '').padStart(64, '0');
  } catch {
    return '0'.padStart(64, '0');
  }
}

// Compute function selector using keccak256
function getFunctionSelector(signature: string): string {
  const hash = keccak256(toBytes(signature));
  return hash.slice(2, 10); // First 4 bytes (8 hex chars)
}

export default function ContractWriteSection({
  abi,
  address,
  chainId,
  chainSlug,
  rpcUrl,
  themeColor = "#E57373",
}: ContractWriteSectionProps) {
  const [expandedFunctions, setExpandedFunctions] = useState<Set<string>>(new Set());
  const [functionInputs, setFunctionInputs] = useState<Record<string, Record<string, string>>>({});
  const [functionResults, setFunctionResults] = useState<Record<string, FunctionResult>>({});
  const [payableValues, setPayableValues] = useState<Record<string, string>>({});

  // Wallet state
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
  const { connectWallet } = useWalletConnect();

  const writeFunctions = getWriteFunctions(abi);

  // Check if user is on the correct chain
  const expectedChainId = parseInt(chainId);
  const isOnCorrectChain = walletChainId === expectedChainId;

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

  const switchToCorrectChain = async () => {
    if (!rpcUrl) return;
    
    try {
      const chainIdHex = `0x${expectedChainId.toString(16)}`;
      await window.ethereum?.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
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
    if (!walletEVMAddress || !coreWalletClient) {
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

      // Build function signature
      const inputTypes = inputs.map((i: any) => i.type).join(',');
      const signature = `${func.name}(${inputTypes})`;

      // Get selector using keccak256
      const selector = getFunctionSelector(signature);

      // Build call data
      let callData = '0x' + selector;
      
      for (const input of inputs) {
        const value = inputValues[input.name || `param${inputs.indexOf(input)}`];
        if (value === undefined || value === '') {
          throw new Error(`Missing value for: ${input.name || 'parameter'}`);
        }
        callData += encodeParameter(input.type, value);
      }

      // Handle payable value
      let value: bigint = BigInt(0);
      if (func.stateMutability === 'payable') {
        const payableValue = payableValues[funcKey];
        if (payableValue && payableValue !== '0') {
          value = parseEther(payableValue);
        }
      }

      // Send transaction using the wallet
      const txHash = await window.ethereum?.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletEVMAddress,
          to: address,
          data: callData,
          value: value > 0 ? `0x${value.toString(16)}` : undefined,
        }],
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
      let errorMessage = err instanceof Error ? err.message : 'Transaction failed';
      
      // Handle user rejection
      if (err.code === 4001) {
        errorMessage = 'Transaction rejected by user';
      }

      setFunctionResults(prev => ({
        ...prev,
        [funcKey]: { loading: false, error: errorMessage, status: 'failed' }
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
          <Button onClick={connectWallet} style={{ backgroundColor: themeColor }}>
            <img src="/core-logo.svg" alt="Core" className="mr-2 h-4 w-4 object-contain" />
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
                            href={`/explorer/${chainSlug}/tx/${result.txHash}`}
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

