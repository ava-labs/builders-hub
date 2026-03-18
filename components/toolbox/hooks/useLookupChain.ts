'use client';

import { useState } from 'react';
import { useWallet } from './useWallet';
import { utils } from "@avalabs/avalanchejs";
import { getBlockchainInfo } from '../coreViem/utils/glacier';

interface LookupResult {
    rpcUrl: string;
    coinName: string;
}

export function useLookupChain() {
    const [anyChainId, setAnyChainId] = useState("");
    const [error, setError] = useState("");
    const [isLookingUp, setIsLookingUp] = useState(false);
    const { switchChain, client: coreWalletClient } = useWallet();

    const lookup = async (): Promise<LookupResult | null> => {
        setError("");
        setIsLookingUp(true);
        
        try {
            let evmChainId: number;

            if (/^[0-9]+$/.test(anyChainId)) {
                evmChainId = parseInt(anyChainId, 10);
            } else {
                try {
                    utils.base58check.decode(anyChainId); // Validate Avalanche Chain ID format
                    const chain = await getBlockchainInfo(anyChainId);
                    evmChainId = chain.evmChainId;
                } catch (e) {
                    console.error("Failed to lookup chain:", e);
                    setError("Invalid chain ID. Please enter either a valid EVM chain ID number or an Avalanche blockchain ID in base58 format.");
                    return null;
                }
            }

            await switchChain(evmChainId);
            
            // Get chain info and verify the switch was successful
            const evmInfo = await coreWalletClient!.getEthereumChain();
            if (parseInt(evmInfo.chainId, 16) !== evmChainId) {
                setError("Chain not found in wallet.");
                return null;
            }

            return {
                rpcUrl: evmInfo.rpcUrls[0],
                coinName: evmInfo.nativeCurrency.name
            };
        } catch (e) {
            console.error("Failed to lookup chain:", e);
            setError("Failed to lookup chain. Please try again.");
            return null;
        } finally {
            setIsLookingUp(false);
        }
    };

    return {
        anyChainId,
        setAnyChainId,
        error,
        isLookingUp,
        lookup
    };
}
