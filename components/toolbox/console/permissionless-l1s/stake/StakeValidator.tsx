"use client";

import React, { useState } from 'react';
import { Steps, Step } from "fumadocs-ui/components/steps";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Success } from '@/components/toolbox/components/Success';
import { Input } from '@/components/toolbox/components/Input';
import InitiateValidatorRegistration from '@/components/toolbox/console/permissionless-l1s/stake/InitiateValidatorRegistration';
import CompletePChainRegistration from '@/components/toolbox/console/shared/CompletePChainRegistration';
import SubmitPChainTxRegisterL1Validator from '@/components/toolbox/console/permissioned-l1s/AddValidator/SubmitPChainTxRegisterL1Validator';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { BaseConsoleToolProps } from '../../../components/WithConsoleToolMetadata';
import { Alert } from '@/components/toolbox/components/Alert';
import { L1SubnetStep, StepFlowFooter, useL1SubnetState } from '../shared';

export type TokenType = 'native' | 'erc20';

export interface StakeValidatorProps extends BaseConsoleToolProps {
    tokenType: TokenType;
}

export default function StakeValidator({ tokenType, onSuccess }: StakeValidatorProps) {
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

    // State for passing data between components
    const [nodeID, setNodeID] = useState<string>('');
    const [blsPublicKey, setBlsPublicKey] = useState<string>('');
    const [blsProofOfPossession, setBlsProofOfPossession] = useState<string>('');
    const [nodeInfoJson, setNodeInfoJson] = useState<string>('');
    const [nodeInfoError, setNodeInfoError] = useState<string | null>(null);
    const [validationID, setValidationID] = useState<string>('');
    const [initiateRegistrationTxHash, setInitiateRegistrationTxHash] = useState<string>('');
    const [completeRegistrationTxHash, setCompleteRegistrationTxHash] = useState<string>('');
    const [pChainTxId, setPChainTxId] = useState<string>('');
    const [validatorBalance, setValidatorBalance] = useState<string>('0.1'); // Initial P-Chain balance for validator

    // Parse the JSON response from info.getNodeID
    const parseNodeInfoJson = (json: string) => {
        setNodeInfoJson(json);
        setNodeInfoError(null);
        
        if (!json.trim()) {
            setNodeID('');
            setBlsPublicKey('');
            setBlsProofOfPossession('');
            return;
        }

        try {
            const parsed = JSON.parse(json);
            
            if (parsed.result) {
                if (parsed.result.nodeID) {
                    setNodeID(parsed.result.nodeID);
                }
                if (parsed.result.nodePOP?.publicKey) {
                    setBlsPublicKey(parsed.result.nodePOP.publicKey);
                }
                if (parsed.result.nodePOP?.proofOfPossession) {
                    setBlsProofOfPossession(parsed.result.nodePOP.proofOfPossession);
                }
            } else {
                setNodeInfoError('Invalid response format. Expected a JSON-RPC response with "result" field.');
            }
        } catch {
            setNodeInfoError('Invalid JSON. Please paste the complete response from the curl command.');
        }
    };

    const { exampleErc20Address } = useToolboxStore();
    const { pChainBalance } = useWalletStore();
    const l1State = useL1SubnetState();
    const { validatorManagerDetails } = l1State;
    
    // Convert P-Chain balance to nAVAX (bigint)
    const userPChainBalanceNavax = pChainBalance ? BigInt(Math.floor(pChainBalance * 1e9)) : null;

    const isNative = tokenType === 'native';
    const tokenLabel = isNative ? 'Native Token' : 'ERC20 Token';

    const handleReset = () => {
        setGlobalError(null);
        setGlobalSuccess(null);
        setNodeID('');
        setBlsPublicKey('');
        setBlsProofOfPossession('');
        setNodeInfoJson('');
        setNodeInfoError(null);
        setValidationID('');
        setInitiateRegistrationTxHash('');
        setCompleteRegistrationTxHash('');
        setPChainTxId('');
        setValidatorBalance('0.1');
        l1State.setSubnetIdL1('');
        l1State.incrementResetKey();
    };

    return (
        <div className="space-y-6">
            {globalError && (
                <Alert variant="error">Error: {globalError}</Alert>
            )}

            <Steps>
                <L1SubnetStep
                    subnetId={l1State.subnetIdL1}
                    onSubnetIdChange={l1State.setSubnetIdL1}
                    description={`Choose the L1 subnet where you want to register a validator with ${tokenLabel} staking.`}
                    validatorManagerDetails={validatorManagerDetails}
                    validatorManagerError={validatorManagerDetails.error}
                    isExpanded={l1State.isValidatorManagerDetailsExpanded}
                    onToggleExpanded={l1State.toggleValidatorManagerDetails}
                />

                <Step>
                    <h2 className="text-lg font-semibold">Set Up Your Validator Node</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Before registering a validator, you need to have a node running and synced with your L1.
                    </p>

                    <Alert variant="info" className="mb-4">
                        <p className="text-sm mb-2">
                            <strong>Node Setup Required:</strong> If you haven&apos;t set up your validator node yet, use our{' '}
                            <a href="/console/layer-1/l1-node-setup" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline font-medium">
                                L1 Node Setup with Docker
                            </a>{' '}
                            tool to configure and run your node.
                        </p>
                    </Alert>

                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                        <h3 className="text-sm font-semibold mb-2">Get your Node ID and BLS Keys</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Once your node is running, run this command to get your Node ID and BLS public key:
                        </p>
                        <DynamicCodeBlock
                            lang="bash"
                            code={`curl -X POST --data '{"jsonrpc":"2.0","method":"info.getNodeID","params":{},"id":1}' -H 'content-type:application/json;' 127.0.0.1:9650/ext/info`}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            Copy the entire JSON response and paste it in the next step.
                        </p>
                    </div>
                </Step>

                <Step>
                    <h2 className="text-lg font-semibold">Enter Validator Details</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Paste the JSON response from the previous step. We&apos;ll automatically extract your Node ID and BLS keys.
                    </p>

                    {validatorManagerDetails.ownerType && validatorManagerDetails.ownerType !== 'StakingManager' && (
                        <Alert variant="error" className="mb-4">
                            This L1 is not using a Staking Manager. This tool is only for L1s with {tokenLabel} Staking Managers.
                        </Alert>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                JSON Response from info.getNodeID
                            </label>
                            <textarea
                                value={nodeInfoJson}
                                onChange={(e) => parseNodeInfoJson(e.target.value)}
                                placeholder='{"jsonrpc":"2.0","result":{"nodeID":"NodeID-...","nodePOP":{"publicKey":"0x...","proofOfPossession":"0x..."}},"id":1}'
                                className="w-full h-24 px-3 py-2 text-sm font-mono border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {nodeInfoError && (
                                <p className="text-xs text-red-500 mt-1">{nodeInfoError}</p>
                            )}
                        </div>

                        {(nodeID || blsPublicKey) && (
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800 space-y-3">
                                <h4 className="text-sm font-semibold text-green-800 dark:text-green-200">Extracted Values</h4>
                                
                                {nodeID && (
                                    <div>
                                        <p className="text-xs text-green-700 dark:text-green-300 font-medium">Node ID</p>
                                        <code className="text-xs text-green-900 dark:text-green-100 break-all">{nodeID}</code>
                                    </div>
                                )}
                                
                                {blsPublicKey && (
                                    <div>
                                        <p className="text-xs text-green-700 dark:text-green-300 font-medium">BLS Public Key</p>
                                        <code className="text-xs text-green-900 dark:text-green-100 break-all">{blsPublicKey}</code>
                                    </div>
                                )}
                                
                                {blsProofOfPossession && (
                                    <div>
                                        <p className="text-xs text-green-700 dark:text-green-300 font-medium">BLS Proof of Possession</p>
                                        <code className="text-xs text-green-900 dark:text-green-100 break-all">{blsProofOfPossession}</code>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Step>

                <Step>
                    <h2 className="text-lg font-semibold">Initiate Validator Registration</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Register your validator on the staking manager contract and lock your {isNative ? 'native token' : 'ERC20 token'} stake.
                        {!isNative && ' You will need to approve ERC20 tokens first.'}
                    </p>

                    <InitiateValidatorRegistration
                        key={`initiate-${l1State.resetKey}-${tokenType}`}
                        nodeID={nodeID}
                        blsPublicKey={blsPublicKey}
                        stakingManagerAddress={validatorManagerDetails.contractOwner || ''}
                        tokenType={tokenType}
                        erc20TokenAddress={!isNative ? exampleErc20Address : undefined}
                        onSuccess={(data) => {
                            setInitiateRegistrationTxHash(data.txHash);
                            setValidationID(data.validationID);
                            setGlobalError(null);
                        }}
                        onError={(message) => setGlobalError(message)}
                    />
                </Step>

                <Step>
                    <h2 className="text-lg font-semibold">Submit P-Chain Transaction</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Sign the warp message and submit the validator registration to the P-Chain.
                    </p>

                    <div className="mb-4">
                        <Input
                            label="Initial Validator Balance (AVAX)"
                            value={validatorBalance}
                            onChange={setValidatorBalance}
                            type="number"
                            min="0.1"
                            step="0.1"
                            placeholder="0.1"
                            helperText="The initial P-Chain balance for your validator (minimum 0.1 AVAX). This covers transaction fees on the P-Chain."
                        />
                    </div>

                    <SubmitPChainTxRegisterL1Validator
                        subnetIdL1={l1State.subnetIdL1}
                        validatorBalance={validatorBalance}
                        userPChainBalanceNavax={userPChainBalanceNavax}
                        blsProofOfPossession={blsProofOfPossession}
                        evmTxHash={initiateRegistrationTxHash}
                        signingSubnetId={l1State.subnetIdL1}
                        onSuccess={(txId) => {
                            setPChainTxId(txId);
                            setGlobalError(null);
                        }}
                        onError={(message) => setGlobalError(message)}
                    />

                    {pChainTxId && (
                        <div className="mt-4">
                            <Success
                                label="P-Chain Transaction ID"
                                value={pChainTxId}
                            />
                        </div>
                    )}
                </Step>

                <Step>
                    <h2 className="text-lg font-semibold">Complete Validator Registration</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        After the P-Chain transaction is confirmed, complete the registration
                        to activate your validator on the L1.
                    </p>

                    <CompletePChainRegistration
                        key={`complete-${l1State.resetKey}-${tokenType}`}
                        subnetIdL1={l1State.subnetIdL1}
                        pChainTxId={pChainTxId}
                        validationID={validationID}
                        signingSubnetId={l1State.subnetIdL1}
                        managerType={tokenType === 'native' ? 'PoS-Native' : 'PoS-ERC20'}
                        managerAddress={validatorManagerDetails.contractOwner || ''}
                        onSuccess={(data) => {
                            setCompleteRegistrationTxHash(data.txHash);
                            setGlobalSuccess(data.message);
                            setGlobalError(null);
                            onSuccess?.();
                        }}
                        onError={(message) => setGlobalError(message)}
                    />
                </Step>
            </Steps>

            <StepFlowFooter
                globalSuccess={globalSuccess}
                showReset={!!(initiateRegistrationTxHash || pChainTxId || completeRegistrationTxHash || globalError || globalSuccess)}
                onReset={handleReset}
            />
        </div>
    );
}
