"use client";

import { useState } from 'react';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';

export interface L1SubnetState {
    subnetIdL1: string;
    setSubnetIdL1: (value: string) => void;
    resetKey: number;
    incrementResetKey: () => void;
    isValidatorManagerDetailsExpanded: boolean;
    setIsValidatorManagerDetailsExpanded: (value: boolean) => void;
    toggleValidatorManagerDetails: () => void;
    viemChain: ReturnType<typeof useViemChainStore>;
    validatorManagerDetails: ReturnType<typeof useValidatorManagerDetails>;
}

export function useL1SubnetState(): L1SubnetState {
    const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
    const [subnetIdL1, setSubnetIdL1] = useState<string>(createChainStoreSubnetId || "");
    const [resetKey, setResetKey] = useState<number>(0);
    const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState<boolean>(false);
    const viemChain = useViemChainStore();

    const validatorManagerDetails = useValidatorManagerDetails({ subnetId: subnetIdL1 });

    const incrementResetKey = () => setResetKey(prev => prev + 1);
    const toggleValidatorManagerDetails = () => setIsValidatorManagerDetailsExpanded(prev => !prev);

    return {
        subnetIdL1,
        setSubnetIdL1,
        resetKey,
        incrementResetKey,
        isValidatorManagerDetailsExpanded,
        setIsValidatorManagerDetailsExpanded,
        toggleValidatorManagerDetails,
        viemChain,
        validatorManagerDetails,
    };
}
