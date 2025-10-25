"use client";

import { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { Input, RawInput } from '@/components/toolbox/components/Input';
import { Button } from '@/components/toolbox/components/Button';
import { Note } from '@/components/toolbox/components/Note';
import { RefreshCw } from 'lucide-react';

interface RelayerFundingProps {
    relayerAddress: string | null;
    selectedChains: L1ListItem[];
    balances: Record<string, string>;
    isLoadingBalances: boolean;
    isSending: boolean;
    tokenAmounts: Record<string, string>;
    onRefreshBalances: () => void;
    onSendCoins: (chainId: string) => void;
    onUpdateTokenAmount: (chainId: string, amount: string) => void;
    onFocusAddress?: () => void;
    onBlurAddress?: () => void;
}

export function RelayerFunding({
    relayerAddress,
    selectedChains,
    balances,
    isLoadingBalances,
    isSending,
    tokenAmounts,
    onRefreshBalances,
    onSendCoins,
    onUpdateTokenAmount,
    onFocusAddress,
    onBlurAddress
}: RelayerFundingProps) {
    return (
        <div className="space-y-4">
            <div>
                <Input
                    label="Relayer EVM Address"
                    value={relayerAddress || ''}
                    disabled
                    onFocus={onFocusAddress}
                    onBlur={onBlurAddress}
                />
                <Note variant="warning" className="mt-2">
                    <span className="font-semibold">Important:</span> The Relayer EVM Address above uses a temporary private key generated in your browser. Feel free to replace it with another private key in the relayer config file (field <code>account-private-key</code> of all destination blockchains).
                    This generated key is stored only in session storage and will be <span className="font-semibold">lost when you close this browser tab</span>.
                    Ensure you fund this address sufficiently.
                </Note>
            </div>

            <div className="space-y-3">
                <div className="text-base font-semibold">Fund Relayer Address</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    Ensure the relayer address maintains a positive balance on all selected chains to cover transaction fees.
                </div>
                <div className="space-y-2">
                    {selectedChains.map((chain: L1ListItem) => (
                        <div 
                            key={`balance-${chain.id}`} 
                            className="flex items-center justify-between p-3 border rounded-md bg-white dark:bg-gray-950"
                        >
                            <div>
                                <div className="font-medium text-sm">{chain.name}</div>
                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                    {balances[chain.id] !== undefined ? (
                                        `${balances[chain.id]} ${chain.coinName}`
                                    ) : (
                                        <span className="text-gray-400">
                                            {isLoadingBalances ? 'Loading...' : '0 ' + chain.coinName}
                                        </span>
                                    )}
                                    <button
                                        onClick={onRefreshBalances}
                                        disabled={isLoadingBalances}
                                        className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
                                        style={{ lineHeight: 0 }}
                                    >
                                        <RefreshCw className={`h-4 w-4 ${isLoadingBalances ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <RawInput
                                    value={tokenAmounts[chain.id] || '1'}
                                    onChange={(e) => onUpdateTokenAmount(chain.id, e.target.value)}
                                    placeholder="1.0"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    className="w-20 h-8"
                                />
                                <Button
                                    size="sm"
                                    variant="primary"
                                    className="w-24 px-2 flex-shrink-0 h-8 text-sm"
                                    onClick={() => onSendCoins(chain.id)}
                                    loading={isSending}
                                >
                                    Send
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

