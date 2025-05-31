"use client";

import { useState } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Container } from "../../components/Container";
import { useWalletStore } from "../../stores/walletStore";
import { getSubnetVMInfo, type SubnetVMAnalysis, STANDARD_SUBNET_EVM_VM_ID } from "../../coreViem/methods/getSubnetVMInfo";

export default function VMAnalysisTest() {
    const [subnetId, setSubnetId] = useState("");
    const [vmAnalysis, setVmAnalysis] = useState<SubnetVMAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { coreWalletClient } = useWalletStore();

    const handleAnalyze = async () => {
        if (!coreWalletClient || !subnetId) return;

        setIsAnalyzing(true);
        setError(null);
        setVmAnalysis(null);

        try {
            const analysis = await getSubnetVMInfo(coreWalletClient, subnetId);
            setVmAnalysis(analysis);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const generateVMAliasesConfig = (vmAnalysis: SubnetVMAnalysis) => {
        if (!vmAnalysis.hasNonStandardVMs) return null;

        return Object.entries(vmAnalysis.vmAliases)
            .map(([vmId, alias]) => `${alias}=${vmId}`)
            .join('\n');
    };

    return (
        <Container
            title="VM Analysis Test"
            description="Test the VM analysis functionality for detecting non-standard VMs in subnets."
        >
            <div className="space-y-4">
                <Input
                    label="Subnet ID"
                    value={subnetId}
                    onChange={setSubnetId}
                    placeholder="Enter a subnet ID to analyze"
                />

                <Button
                    onClick={handleAnalyze}
                    loading={isAnalyzing}
                    disabled={!subnetId || !coreWalletClient}
                    variant="primary"
                >
                    Analyze VM Configuration
                </Button>

                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-800 dark:text-red-200">
                            <strong>Error:</strong> {error}
                        </p>
                    </div>
                )}

                {vmAnalysis && (
                    <div className="space-y-4">
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-3">Analysis Results</h3>

                            <div className="space-y-2">
                                <div className="text-sm">
                                    <strong>Chains found:</strong> {vmAnalysis.chains.length}
                                </div>
                                <div className="text-sm">
                                    <strong>Has non-standard VMs:</strong> {vmAnalysis.hasNonStandardVMs ? 'Yes' : 'No'}
                                </div>
                                <div className="text-sm">
                                    <strong>Standard VM ID:</strong> <code className="text-xs">{STANDARD_SUBNET_EVM_VM_ID}</code>
                                </div>
                            </div>

                            {vmAnalysis.chains.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="font-medium text-sm mb-2">Chains:</h4>
                                    <div className="space-y-2">
                                        {vmAnalysis.chains.map((chain) => (
                                            <div key={chain.blockchainId} className="p-2 bg-white dark:bg-zinc-700 rounded border">
                                                <div className="text-sm">
                                                    <strong>Name:</strong> {chain.blockchainName}
                                                </div>
                                                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                                    <strong>Blockchain ID:</strong> {chain.blockchainId}
                                                </div>
                                                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                                    <strong>VM ID:</strong> {chain.vmId}
                                                </div>
                                                <div className="text-xs">
                                                    <strong>Standard VM:</strong>{' '}
                                                    <span className={chain.isStandardVM ? 'text-green-600' : 'text-yellow-600'}>
                                                        {chain.isStandardVM ? 'Yes' : 'No'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {vmAnalysis.hasNonStandardVMs && Object.keys(vmAnalysis.vmAliases).length > 0 && (
                                <div className="mt-4">
                                    <h4 className="font-medium text-sm mb-2">VM Aliases Configuration:</h4>
                                    <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 p-2 rounded border overflow-x-auto">
                                        {generateVMAliasesConfig(vmAnalysis)}
                                    </pre>
                                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                        This configuration would be added to the Docker environment as AVAGO_VM_ALIASES_FILE_CONTENT (base64 encoded).
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Container>
    );
} 