import { useState } from 'react';

import { Label } from '@radix-ui/react-label';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle } from 'lucide-react';
import NextPrev from "@/components/tools/common/ui/NextPrev";
import RequireWalletConnection from '@/components/tools/common/ui/RequireWalletConnection__deprecated';

import { usePoAValidatorManagementWizardStore } from '../config/store';

import PoAValidatorManagerAbi from '../contract_compiler/compiled/PoAValidatorManager.json';
import { Address, Chain, createPublicClient, createWalletClient, custom, defineChain, http } from 'viem';

import {
    fetchValidators,
    checkEndpoint,
    fetchSubnetIdByValidationID,
    getEndpoints,
    avaCloudSDK
} from '../../common/api/validator-info';

import { isValidUrl } from '@/components/tools/common/utils/validation';
import { isAddress } from 'viem';
import { deduplicateEthRequestAccounts } from '@/components/tools/common/ui/deduplicateEthRequestAccounts';

export default function ChainParameters() {
    const {
        rpcUrl,
        setRpcUrl,
        setEvmChainId,
        evmChainId,
        tokenSymbol,
        setTokenSymbol,
        transparentProxyAddress,
        setTransparentProxyAddress,
        l1Name,
        setL1Name,
        poaOwnerAddress,
        setPoaOwnerAddress,
        goToNextStep,
        goToPreviousStep,
        setValidators,
        setSubnetId,
        setChainConfig,
        setCoreWalletClient
    } = usePoAValidatorManagementWizardStore();

    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [endpointStatus, setEndpointStatus] = useState({
        platform: false,
        info: false,
        validators: false
    });
    const [showWallet, setShowWallet] = useState(false);
    const [ownerCheckStatus, setOwnerCheckStatus] = useState<'none' | 'checking' | 'success' | 'error'>('none');

    const fetchChainConfig = async () => {
        if (!isValidUrl(rpcUrl)) return;

        setIsLoading(true);
        setError("");
        setShowWallet(false);

        try {
            // First validate the endpoints
            const endpoints = getEndpoints(rpcUrl);
            console.log('Generated endpoints:', endpoints);

            const [platformOk, infoOk, validatorsOk] = await Promise.all([
                checkEndpoint(endpoints.platform),
                checkEndpoint(endpoints.info),
                checkEndpoint(endpoints.validators)
            ]);

            console.log('Endpoint check results:', {
                platform: platformOk,
                info: infoOk,
                validators: validatorsOk
            });

            setEndpointStatus({
                platform: platformOk,
                info: infoOk,
                validators: validatorsOk
            });

            if (!platformOk || !infoOk || !validatorsOk) {
                const failedEndpoints = [
                    !platformOk && 'Platform Chain API',
                    !infoOk && 'Info API',
                    !validatorsOk && 'Validators API'
                ].filter(Boolean);

                throw new Error(`The following endpoints are not accessible: ${failedEndpoints.join(', ')}`);
            }

            // Then proceed with chain config fetch
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getChainConfig',
                    params: [],
                    id: 1
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message);
            }

            if (data.result && data.result.chainId) {
                setEvmChainId(Number(data.result.chainId));

                // Try to get chain name using eth_chainId
                try {
                    const publicClient = createPublicClient({
                        transport: http(rpcUrl)
                    });

                    const chainId = await publicClient.getChainId()
                    if (chainId) {
                        setL1Name(`L1 ${chainId}`);
                    }
                } catch (chainErr) {
                    console.error("Error fetching chain name:", chainErr);
                    setL1Name("My L1");
                }

                setError("");
                setShowWallet(true);
            } else {
                throw new Error("Chain ID not found in response");
            }

            // After successful endpoint checks, fetch validators
            const validators = await fetchValidators(rpcUrl);
            setValidators(validators);
            console.log('validators', validators);
            let subnetId = '';
            if (validators.length > 0 && validators[0].validationID) {
                subnetId = await fetchSubnetIdByValidationID(validators[0].validationID);
                setSubnetId(subnetId);
                // const validatorResponse = await avaCloudSDK.data.primaryNetwork.listL1Validators({
                //     l1ValidationId: validators[0].validationID,
                //     network: "fuji",
                //   }) as ListL1ValidatorsResponse;
                // console.log('validatorResponse', validatorResponse);
                // subnetId = validatorResponse.result.validators[0].subnetId;

            }
            console.log('subnetId', subnetId);
            try {
                // get validator manager address from subnet info
                const subnetInfo = await avaCloudSDK.data.primaryNetwork.getSubnetById({
                    network: "fuji",
                    subnetId: subnetId,
                });

                if (subnetInfo.isL1 && subnetInfo.l1ValidatorManagerDetails) {
                    setTransparentProxyAddress(subnetInfo.l1ValidatorManagerDetails.contractAddress);
                } else {
                    // If no contract address is found, clear any existing address
                    setTransparentProxyAddress('');
                    throw new Error("No validator manager contract found for this subnet");
                }
            } catch (err) {
                console.error("Failed to fetch subnet info:", err);
                setTransparentProxyAddress('');
                setError("Failed to fetch validator manager contract address");
            }

        } catch (err) {
            console.error("Error:", err);
            setError(err instanceof Error ? err.message : "Failed to fetch chain configuration");
            setEvmChainId(0);
            setShowWallet(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleWalletConnectionCallback = async () => {
        await handleCheckPoaOwner();
        const config = defineAndSaveChainConfig();
        saveCoreWalletClient(config);
    }

    const defineAndSaveChainConfig = () => {
        const chainConfig = defineChain({
            id: evmChainId,
            name: l1Name,
            network: l1Name.toLowerCase(),
            nativeCurrency: {
                name: tokenSymbol,
                symbol: tokenSymbol,
                decimals: 18,
            },
            rpcUrls: {
                default: { http: [rpcUrl] },
                public: { http: [rpcUrl] },
            },
        })
        setChainConfig(chainConfig)
        return chainConfig;
    }

    const saveCoreWalletClient = (chainConfig: Chain) => {
        if (!window.avalanche) return;
        const noopProvider = { request: () => Promise.resolve(null) }
        const provider = typeof window !== 'undefined' ? window.avalanche! : noopProvider
        const walletClient = createWalletClient({
            chain: chainConfig,
            transport: custom(provider),
        })
        setCoreWalletClient(walletClient)

    }

    const handleCheckPoaOwner = async () => {
        if (!window.ethereum) return;
        setOwnerCheckStatus('checking');

        if (!window.avalanche) return;
        // Get connected account from wallet
        const accounts = await deduplicateEthRequestAccounts()
        if (!accounts || accounts.length === 0) return;

        // Create public client to read contract
        const publicClient = createPublicClient({
            transport: http(rpcUrl)
        });

        try {
            // Get owner from PoA Validator Manager contract
            const owner = await publicClient.readContract({
                address: transparentProxyAddress as Address,
                abi: PoAValidatorManagerAbi.abi,
                functionName: 'owner'
            }) as Address;

            // Check if connected account matches contract owner
            if (owner.toLowerCase() === accounts[0].toLowerCase()) {
                setPoaOwnerAddress(accounts[0]);
                setOwnerCheckStatus('success');
                setError("");
            } else {
                setError("Connected wallet is not the contract owner");
                setPoaOwnerAddress("undefined");
                setOwnerCheckStatus('error');
            }
        } catch (err) {
            console.error("Error checking contract owner:", err);
            setError("Failed to verify contract owner");
            setPoaOwnerAddress("undefined");
            setOwnerCheckStatus('error');
        }
    };

    return (
        <div className="space-y-12">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-medium dark:text-white">Chain Configuration</h1>
            </div>

            <div className="space-y-6">
                <div>
                    <Label className="dark:text-gray-200">Developer RPC URL</Label>
                    <div className="flex gap-2 mt-1.5">
                        <Input
                            type='text'
                            value={rpcUrl}
                            onChange={(e) => setRpcUrl(e.target.value)}
                            placeholder="https://example.com/ext/bc/<BlockchainID>/rpc"
                            disabled={isLoading}
                        />
                        <button
                            onClick={fetchChainConfig}
                            disabled={!isValidUrl(rpcUrl) || isLoading}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed min-w-[100px]"
                        >
                            {isLoading ? "Loading..." : "Load"}
                        </button>
                    </div>

                    {rpcUrl && isValidUrl(rpcUrl) && (endpointStatus.platform || endpointStatus.info || endpointStatus.validators) && (
                        <div className="mt-3 space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                            <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Endpoint Status:</h3>
                            <div className="flex items-center gap-2 text-sm">
                                {endpointStatus.platform ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className={endpointStatus.platform ? "text-green-700" : "text-red-700"}>
                                    Platform Chain API
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-sm">
                                {endpointStatus.info ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className={endpointStatus.info ? "text-green-700" : "text-red-700"}>
                                    Info API
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-sm">
                                {endpointStatus.validators ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className={endpointStatus.validators ? "text-green-700" : "text-red-700"}>
                                    Validators API
                                </span>
                            </div>
                        </div>
                    )}

                    {rpcUrl && !isValidUrl(rpcUrl) && (
                        <p className="mt-2 text-sm text-red-500">
                            Please enter a valid URL.
                        </p>
                    )}
                    {error && (
                        <p className="mt-2 text-sm text-red-500">
                            {error}
                        </p>
                    )}
                    <div className="flex items-start gap-2 mt-2 text-sm text-gray-600 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/30 p-3 rounded-md">
                        <svg className="w-5 h-5 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                            Enter the Developer RPC endpoint URL of your L1. The endpoint must have access to P-Chain and Subnet-EVM API for validator management (<a href="https://build.avax.network/docs/api-reference/subnet-evm-api#validators_getcurrentvalidators" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">see documentation</a>).
                        </span>
                    </div>
                </div>

                {evmChainId !== 0 && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                            <div>
                                <Label className="dark:text-gray-200">L1 Name</Label>
                                <Input
                                    type='text'
                                    value={l1Name}
                                    onChange={(e) => setL1Name(e.target.value)}
                                    placeholder="My L1"
                                    className="mt-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                    Enter the name for your existing L1.
                                </p>
                            </div>

                            <div>
                                <Label className="dark:text-gray-200">Chain ID</Label>
                                <div className="mt-1.5 text-sm font-mono bg-white dark:bg-gray-700 p-2.5 rounded border border-gray-200 dark:border-gray-600 dark:text-white">
                                    {evmChainId}
                                </div>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                    Automatically detected from RPC endpoint.
                                </p>
                            </div>

                            <div>
                                <Label className="dark:text-gray-200">Native Token Symbol</Label>
                                <Input
                                    type='text'
                                    value={tokenSymbol}
                                    onChange={(e) => setTokenSymbol(e.target.value)}
                                    placeholder="TEST"
                                    className="mt-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                    Enter the symbol for your L1's native token.
                                </p>
                            </div>

                            <div>
                                <Label className="dark:text-gray-200">PoA Validator Manager Contract Address</Label>
                                <Input
                                    type='text'
                                    value={transparentProxyAddress}
                                    readOnly
                                    placeholder="0x..."
                                    className="mt-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white bg-gray-50"
                                />
                                {transparentProxyAddress && !isAddress(transparentProxyAddress, { strict: false }) && (
                                    <p className="mt-2 text-sm text-red-500">
                                        Invalid contract address detected.
                                    </p>
                                )}
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                    Automatically fetched from L1 info. Learn more about the validator manager contract in the <a href="https://build.avax.network/docs/avalanche-l1s/validator-manager/contract" target="_blank" className="text-blue-500 dark:text-blue-400 hover:underline">documentation</a>.
                                </p>
                            </div>
                        </div>

                        {showWallet && (
                            <div className="mt-8 border-t dark:border-gray-700 pt-8">
                                <RequireWalletConnection
                                    chainConfig={{
                                        chainId: `0x${evmChainId.toString(16)}`,
                                        chainName: l1Name,
                                        nativeCurrency: {
                                            name: tokenSymbol,
                                            symbol: tokenSymbol,
                                            decimals: 18
                                        },
                                        rpcUrls: [rpcUrl],
                                        blockExplorerUrls: [],
                                        isTestnet: true
                                    }}
                                    requiredBalance={0.1}
                                    onConnection={handleWalletConnectionCallback}
                                />

                                {ownerCheckStatus === 'checking' && (
                                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                        <p className="text-blue-700 dark:text-blue-300">Checking contract owner...</p>
                                    </div>
                                )}

                                {ownerCheckStatus === 'success' && (
                                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                                        <p className="text-green-700 dark:text-green-300">
                                            Successfully verified PoA Validator Manager owner: {poaOwnerAddress}
                                        </p>
                                    </div>
                                )}

                                {ownerCheckStatus === 'error' && error && (
                                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 rounded-lg">
                                        <p className="text-red-700 dark:text-red-300">{error}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            <NextPrev
                nextDisabled={
                    !isValidUrl(rpcUrl) ||
                    !evmChainId ||
                    !l1Name ||
                    !tokenSymbol ||
                    !transparentProxyAddress ||
                    !isAddress(transparentProxyAddress, { strict: false }) ||
                    !endpointStatus.platform ||
                    !endpointStatus.info ||
                    !endpointStatus.validators ||
                    ownerCheckStatus !== 'success'
                }
                onNext={goToNextStep}
                onPrev={goToPreviousStep}
            />
        </div>
    );
}
