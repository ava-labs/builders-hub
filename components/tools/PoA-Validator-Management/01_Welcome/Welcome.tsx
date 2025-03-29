import NextPrev from "@/components/tools/common/ui/NextPrev";
import { usePoAValidatorManagementWizardStore } from "../config/store";
import { useState } from "react";
import { checkCoreWallet } from '@/components/tools/common/api/coreWallet';

export default function Welcome() {
    const { goToNextStep, goToPreviousStep } = usePoAValidatorManagementWizardStore();
    const [error, setError] = useState<string | null>(null);

    const handleNext = async () => {
        try {
            await checkCoreWallet();
            goToNextStep();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to check Core wallet");
        }
    };

    return <>
        <h1 className="text-2xl font-medium mb-6">Welcome</h1>

        <p className="mb-4">
            The PoA Manager helps you manage your L1's validator set. You can add new validators, disable existing ones, and adjust their weight. This tool is designed for developers who need to maintain their Proof of Authority (PoA) validator set through a simple web interface.
        </p>
        <p className="mb-4">
            The tool is completely open source and available on <a href="https://github.com/ava-labs/builders-hub" target="_blank" className="text-blue-500 hover:text-blue-700 underline">GitHub</a>
        </p>

        <div className="p-4 mb-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <h2 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">Prerequisites</h2>
            <p className="mb-2 text-gray-800 dark:text-gray-200">
                Before using the L1 Manager, please ensure you have the <a
                    href="https://core.app/"
                    target="_blank"
                    className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                >Core wallet browser extension</a> installed. This extension is required for interacting with the P-Chain.
            </p>
            <p className="mb-2 text-gray-800 dark:text-gray-200">
                You will also need to have AVAX balance on the P-Chain to perform validator management operations. If your AVAX is on the C-Chain, you can transfer it to the P-Chain using the <a
                    href="https://test.core.app/stake/cross-chain-transfer/"
                    target="_blank"
                    className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                >Cross-Chain Transfer tool</a> in Core.
            </p>
        </div>

        {error && (
            <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-red-700 dark:text-red-200">
                    {error} {error.includes("not installed") ? (
                        <>Please install <a
                            href="https://core.app/"
                            target="_blank"
                            className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                        >Core wallet</a> to continue. After installing, refresh this page.</>
                    ) : (
                        <>Please refresh the page and make sure the Core extension is unlocked.</>
                    )}
                </p>
            </div>
        )}

        <NextPrev
            nextDisabled={false}
            prevHidden={false}
            onNext={handleNext}
            onPrev={goToPreviousStep}
        />
    </>;
}
