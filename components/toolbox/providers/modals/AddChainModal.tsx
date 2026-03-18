'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { Button } from '../../components/Button';
import { useL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { getBlockchainInfo, getSubnetInfo, getChainDetails } from '../../coreViem/utils/glacier';
import { Dialog, DialogOverlay, DialogContent, DialogTitle } from '../../components/ui/dialog';
import { fetchChainId } from '../../lib/chainId';
import { useWallet } from '../../hooks/useWallet';
import { useModalState } from '../../hooks/useModal';
import { useLookupChain } from '@/components/toolbox/hooks/useLookupChain';
import { toast } from '@/lib/toast';
import { type Chain } from 'viem';
import type { ChainData } from '@/types/wallet';

interface AddChainFormData {
    rpcUrl: string;
    chainName: string;
    coinName: string;
    evmChainId: number;
    chainId: string;
    subnetId: string;
    wrappedTokenAddress: string;
    validatorManagerAddress: string;
    logoUrl: string;
    isTestnet: boolean;
}

export function AddChainModal() {
    const { isOpen, options, closeModal } = useModalState();
    const { client: coreWalletClient } = useWallet();
    const { l1List } = useL1ListStore()();
    const { addL1 } = useL1ListStore()();
    const { anyChainId, setAnyChainId, error, isLookingUp, lookup } = useLookupChain();
    const [showLookup, setShowLookup] = useState(false);
    const [isFetchingChainData, setIsFetchingChainData] = useState(false);
    const modalContentRef = useRef<HTMLDivElement>(null);

    const form = useForm<AddChainFormData>({
        defaultValues: {
            rpcUrl: '',
            chainName: '',
            coinName: 'COIN',
            evmChainId: 0,
            chainId: '',
            subnetId: '',
            wrappedTokenAddress: '',
            validatorManagerAddress: '',
            logoUrl: '',
            isTestnet: false,
        }
    });

    const { control, handleSubmit, reset, setValue, watch, trigger, formState: { isSubmitting, errors } } = form;
    
    // Watch rpcUrl for chain detection
    const rpcUrl = useWatch({ control, name: 'rpcUrl' });
    const chainName = watch('chainName');
    const coinName = watch('coinName');
    const evmChainId = watch('evmChainId');
    const chainId = watch('chainId');
    const logoUrl = watch('logoUrl');

    // Check if chain already exists
    const checkChainExists = useCallback((chainIdToCheck: string, evmChainIdToCheck: number) => {
        if (!chainIdToCheck && !evmChainIdToCheck) return null;
        
        const existingChain = l1List.find((chain: L1ListItem) => 
            chain.id === chainIdToCheck || chain.evmChainId === evmChainIdToCheck
        );
        
        return existingChain;
    }, [l1List]);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            reset({
                rpcUrl: options?.rpcUrl || '',
                coinName: options?.coinName || 'COIN',
                chainName: options?.chainName || '',
                evmChainId: 0,
                chainId: '',
                subnetId: '',
                wrappedTokenAddress: '',
                validatorManagerAddress: '',
                logoUrl: '',
                isTestnet: false,
            });
        } else if (!isOpen) {
            // Reset form when modal closes
            reset();
        }
    }, [isOpen, options, reset]);

    // Fetch chain data when RPC URL changes
    useEffect(() => {
        async function fetchChainData() {
            // Reset chain-related fields
            setValue('evmChainId', 0);
            setValue('chainId', '');
            setValue('chainName', '');
            setValue('logoUrl', '');

            if (!rpcUrl) {
                setIsFetchingChainData(false);
                return;
            }

            setIsFetchingChainData(true);
            if (!rpcUrl.startsWith("https://") && !rpcUrl.includes("localhost") && !rpcUrl.includes("127.0.0.1")) {
                form.setError('rpcUrl', { 
                    type: 'validation', 
                    message: "The RPC URL must start with https:// or include localhost or 127.0.0.1" 
                });
                setIsFetchingChainData(false);
                return;
            }

            try {
                // Clear any previous RPC URL errors
                form.clearErrors('rpcUrl');
                
                const { ethereumChainId, avalancheChainId } = await fetchChainId(rpcUrl);
                setValue('evmChainId', ethereumChainId);
                setValue('chainId', avalancheChainId);

                const blockchainInfo = await getBlockchainInfo(avalancheChainId);
                setValue('subnetId', blockchainInfo.subnetId);
                setValue('chainName', blockchainInfo.blockchainName || "");
                setValue('isTestnet', blockchainInfo.isTestnet);
                setValue('wrappedTokenAddress', "");
                
                const subnetInfo = await getSubnetInfo(blockchainInfo.subnetId);
                setValue('validatorManagerAddress', subnetInfo.l1ValidatorManagerDetails?.contractAddress || "");

                // Fetch logo URL
                try {
                    const chainDetails = await getChainDetails(String(ethereumChainId));
                    setValue('logoUrl', chainDetails.chainLogoUri || "");
                } catch (e) {
                    setValue('logoUrl', ""); // fallback if not found
                }

                // Check if chain already exists
                const existingChain = checkChainExists(avalancheChainId, ethereumChainId);
                if (existingChain) {
                    form.setError('root', { 
                        type: 'duplicate', 
                        message: `This chain already exists in your wallet as "${existingChain.name}". You cannot add the same chain twice.` 
                    });
                } else {
                    // Clear any previous duplicate errors
                    form.clearErrors('root');
                }

                // Trigger validation for fields that were populated
                await trigger(['chainName', 'evmChainId', 'chainId']);
            } catch (error) {
                //Fatal error, toolbox has a hard dependency on glacier
                form.setError('rpcUrl', { 
                    type: 'api', 
                    message: (error as Error)?.message || String(error) 
                });
            } finally {
                setIsFetchingChainData(false);
                // Scroll to bottom of modal after fetch completes
                setTimeout(() => {
                    if (modalContentRef.current) {
                        modalContentRef.current.scrollTo({
                            top: modalContentRef.current.scrollHeight,
                            behavior: 'smooth'
                        });
                    }
                }, 100);
            }
        }

        fetchChainData();
    }, [rpcUrl, setValue, form, trigger, checkChainExists]);

    const addChainDirect = async (chainData: ChainData): Promise<boolean> => {
        if (!coreWalletClient) {
            toast.error('Wallet not connected', 'Please connect your wallet first');
            return false;
        }

        try {
            const viemChain: Chain = {
                id: chainData.evmChainId,
                name: chainData.name,
                rpcUrls: {
                    default: { http: [chainData.rpcUrl] },
                },
                nativeCurrency: {
                    name: chainData.coinName,
                    symbol: chainData.coinName,
                    decimals: 18,
                }
            };

            await coreWalletClient.addChain({ 
                chain: { ...viemChain, isTestnet: chainData.isTestnet } 
            });
            
            await coreWalletClient.switchChain({
                id: chainData.evmChainId
            });

            addL1(chainData);
            
            toast.success('Chain added successfully!', `${chainData.name} has been added to your wallet`);
            return true;
        } catch (error) {
            const errorMessage = (error as Error)?.message || String(error);
            toast.error('Failed to add chain', errorMessage);
            return false;
        }
    };

    const onSubmit = async (data: AddChainFormData) => {
        try {
            // Final check for duplicates before submission
            const existingChain = checkChainExists(data.chainId, data.evmChainId);
            if (existingChain) {
                form.setError('root', { 
                    type: 'duplicate', 
                    message: `This chain already exists in your wallet as "${existingChain.name}". You cannot add the same chain twice.` 
                });
                return;
            }

            const chainData: ChainData = {
                id: data.chainId,
                name: data.chainName,
                rpcUrl: data.rpcUrl,
                evmChainId: data.evmChainId,
                coinName: data.coinName,
                isTestnet: data.isTestnet,
                subnetId: data.subnetId,
                wrappedTokenAddress: data.wrappedTokenAddress,
                validatorManagerAddress: data.validatorManagerAddress,
                logoUrl: data.logoUrl,
            };

            await addChainDirect(chainData);
            closeModal({ success: true, chainData });
        } catch (error) {
            console.error("Failed to add chain:", error);
            form.setError('root', { 
                type: 'api', 
                message: (error as Error)?.message || String(error) 
            });
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog.Root open={true} onOpenChange={() => closeModal({ success: false })}>
            <Dialog.Portal>
                <DialogOverlay />
                <DialogContent ref={modalContentRef}>
                    <DialogTitle>
                        Add an existing Avalanche L1
                    </DialogTitle>

                    {(isFetchingChainData || logoUrl) && (
                        <div className="flex justify-center mb-4">
                            {isFetchingChainData ? (
                                <div className="h-6 w-6 rounded-full border border-transparent border-t-blue-500 animate-spin"></div>
                            ) : logoUrl ? (
                                <img src={logoUrl} alt="Chain Logo" className="h-12 w-12 rounded-full" />
                            ) : null}
                        </div>
                    )}

                    <form id="add-chain-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {(options?.allowLookup ?? true) && (
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setShowLookup(!showLookup)}
                                    className="text-blue-500 border-b border-dashed border-blue-500 hover:text-blue-700 focus:outline-none"
                                >
                                    {showLookup ? "Hide lookup form" : "Lookup from Core Wallet"}
                                </button>

                                {showLookup && (
                                    <div className="mt-3">
                                        <Input
                                            id="anyChainId"
                                            label="Chain ID (EVM number or Avalanche base58 format)"
                                            value={anyChainId}
                                            onChange={setAnyChainId}
                                            placeholder="e.g. 43114 or 2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5"
                                            error={error}
                                            button={<Button stickLeft onClick={async () => {
                                                const result = await lookup();
                                                if (result) {
                                                    setValue('rpcUrl', result.rpcUrl);
                                                    setValue('coinName', result.coinName);
                                                    // Trigger validation for the fields we just set
                                                    await trigger(['rpcUrl', 'coinName']);
                                                    setShowLookup(false);
                                                }
                                            }} loading={isLookingUp}>Lookup</Button>}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {errors.root && (
                            <div className="text-red-500 mb-4">
                                {errors.root.message}
                            </div>
                        )}

                        <Controller
                            name="rpcUrl"
                            control={control}
                            rules={{ required: 'RPC URL is required' }}
                            render={({ field, fieldState }) => (
                                <Input
                                    id="rpcUrl"
                                    label="RPC URL"
                                    value={field.value}
                                    onChange={field.onChange}
                                    disabled={!!options?.rpcUrl}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />

                        <Controller
                            name="coinName"
                            control={control}
                            rules={{ required: 'Coin name is required' }}
                            render={({ field, fieldState }) => (
                                <Input
                                    id="coinName"
                                    label="Coin Name (Symbol)"
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="MYCOIN"
                                    error={fieldState.error?.message}
                                />
                            )}
                        />

                        <Controller
                            name="chainName"
                            control={control}
                            rules={{ required: 'Chain name is required' }}
                            render={({ field, fieldState }) => (
                                <Input
                                    label="Chain Name"
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="MYCHAIN"
                                    error={fieldState.error?.message}
                                />
                            )}
                        />

                        <Controller
                            name="evmChainId"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    id="evmChainId"
                                    label="EVM Chain ID"
                                    value={field.value ? field.value.toString() : ""}
                                    disabled={true}
                                    placeholder="Detected EVM chain ID"
                                />
                            )}
                        />

                        <Controller
                            name="chainId"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    id="avalancheChainId"
                                    label="Avalanche Chain ID (base58)"
                                    value={field.value}
                                    disabled={true}
                                />
                            )}
                        />

                        <Controller
                            name="validatorManagerAddress"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    label="Validator Manager Address"
                                    value={field.value}
                                    disabled={true}
                                    placeholder="0x1234567890123456789012345678901234567890"
                                />
                            )}
                        />

                        <Controller
                            name="logoUrl"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    label="Logo URL"
                                    value={field.value}
                                    disabled={true}
                                />
                            )}
                        />

                        <Controller
                            name="isTestnet"
                            control={control}
                            render={({ field }) => (
                                <Select
                                    label="Is Testnet"
                                    value={field.value ? "Yes" : "No"}
                                    onChange={() => { }}
                                    disabled={true}
                                    options={[
                                        { label: "Yes", value: "Yes" },
                                        { label: "No", value: "No" },
                                    ]}
                                />
                            )}
                        />
                    </form>

                    <div className="flex justify-end space-x-3 mt-6">
                        <Button
                            onClick={() => closeModal({ success: false })}
                            className="bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-black dark:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit(onSubmit)}
                            className="bg-black hover:bg-zinc-800 text-white"
                            loading={isSubmitting}
                            disabled={
                                !chainName || 
                                !coinName || 
                                !rpcUrl || 
                                !chainId || 
                                !evmChainId || 
                                !!errors.root || 
                                !!checkChainExists(chainId, evmChainId)
                            }
                        >
                            Add Chain
                        </Button>
                    </div>
                </DialogContent>
            </Dialog.Portal>
        </Dialog.Root>
    );
}