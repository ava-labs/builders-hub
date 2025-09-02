import { useState } from 'react';
import NextPrev from "../../components/NextPrev";
import CheckContractLogs from './04_CheckContractLogs';
import CollectSignatures from './01_CollectSignatures';
import ContractInitialize from './02_ContractInitialize';
import ContractInitializeValidatorSet from './03_ContractInitializeValidatorSet';
import { RequireChain } from '../../../components/RequireChain';
import { useViemChainStore } from '../../L1LauncherStore';

export default function InitializeValidatorManager() {
    const [isInitialized, setIsInitialized] = useState(false);
    const chain = useViemChainStore()

    if (!chain) {
        return <div>Loading...</div>;
    }

    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-2xl font-medium mb-4">Initialize Validator Manager</h1>
                <p>This step will initialize your validator manager contract with the required signatures.</p>
            </div>

            <RequireChain chain={chain}>
                <CollectSignatures />
                <ContractInitialize />
                <ContractInitializeValidatorSet />
                <CheckContractLogs onSuccess={() => setIsInitialized(true)} />
            </RequireChain>

            <NextPrev
                nextEnabled={isInitialized}
            />
        </div>
    );
}
