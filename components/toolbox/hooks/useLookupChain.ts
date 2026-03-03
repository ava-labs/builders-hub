'use client';

import { useState } from 'react';
import { utils } from "@avalabs/avalanchejs";
import { getBlockchainInfo, getChainDetails } from '../coreViem/utils/glacier';

interface LookupResult {
    rpcUrl: string;
    coinName: string;
}

export function useLookupChain() {
    const [anyChainId, setAnyChainId] = useState("");
    const [error, setError] = useState("");
    const [isLookingUp, setIsLookingUp] = useState(false);

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

            // Use Glacier API to get chain details instead of Core-specific getEthereumChain
            const chainDetails = await getChainDetails(String(evmChainId));

            return {
                rpcUrl: chainDetails.rpcUrl,
                coinName: chainDetails.networkToken?.symbol || chainDetails.networkToken?.name || 'COIN'
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
