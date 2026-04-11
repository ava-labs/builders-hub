import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { Alert } from '@/components/toolbox/components/Alert';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useSubmitPChainTx } from '@/components/toolbox/hooks/useSubmitPChainTx';
import { Check } from 'lucide-react';
import { extractWarpMessageFromReceipt, validateAndCleanTxHash } from '@/components/toolbox/utils/warp';
import { PChainManualSubmit } from '@/components/toolbox/components/PChainManualSubmit';
import { StepFlowCard } from '@/components/toolbox/components/StepCard';
import { parsePChainError } from '@/components/toolbox/hooks/contracts';

interface SubmitPChainTxRegisterL1ValidatorProps {
  subnetIdL1: string;
  signingSubnetId: string;
  validatorBalance?: string;
  userPChainBalanceNavax?: bigint | null;
  blsProofOfPossession?: string;
  evmTxHash?: string;
  onSuccess: (pChainTxId: string) => void;
  onError: (message: string) => void;
}

const SubmitPChainTxRegisterL1Validator: React.FC<SubmitPChainTxRegisterL1ValidatorProps> = ({
  subnetIdL1,
  signingSubnetId,
  validatorBalance,
  userPChainBalanceNavax,
  blsProofOfPossession,
  evmTxHash,
  onSuccess,
  onError,
}) => {
  const { coreWalletClient, pChainAddress, isTestnet } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const walletType = useWalletStore((s) => s.walletType);
  const isCoreWallet = walletType === 'core';
  const { aggregateSignature } = useAvalancheSDKChainkit();
  const { notify } = useConsoleNotifications();
  const { submitPChainTx } = useSubmitPChainTx();
  const [evmTxHashState, setEvmTxHashState] = useState(evmTxHash || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [unsignedWarpMessage, setUnsignedWarpMessage] = useState<string | null>(null);
  const [signedWarpMessage, setSignedWarpMessage] = useState<string | null>(null);

  useEffect(() => {
    if (evmTxHash && !evmTxHashState) {
      setEvmTxHashState(evmTxHash);
    }
  }, [evmTxHash, evmTxHashState]);

  useEffect(() => {
    let cancelled = false;
    const extractWarpMessage = async () => {
      const validTxHash = validateAndCleanTxHash(evmTxHashState);
      if (!chainPublicClient || !validTxHash) {
        setUnsignedWarpMessage(null);
        setSignedWarpMessage(null);
        return;
      }

      try {
        const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: validTxHash });
        if (cancelled) return;
        const extracted = extractWarpMessageFromReceipt(receipt);
        if (cancelled) return;
        setUnsignedWarpMessage(extracted);
        setErrorState(null);
      } catch (err: any) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setErrorState(`Failed to extract warp message: ${message}`);
        setUnsignedWarpMessage(null);
        setSignedWarpMessage(null);
      }
    };

    extractWarpMessage();
    return () => { cancelled = true; };
  }, [evmTxHashState, chainPublicClient]);

  const handleSubmitPChainTx = async () => {
    setErrorState(null);
    setTxSuccess(null);

    if (isCoreWallet && !coreWalletClient) {
      setErrorState("Core wallet not found");
      return;
    }

    if (!evmTxHashState.trim()) {
      setErrorState("EVM transaction hash is required.");
      onError("EVM transaction hash is required.");
      return;
    }
    if (!subnetIdL1) {
      setErrorState("L1 Subnet ID is required.");
      onError("L1 Subnet ID is required.");
      return;
    }
    if (!validatorBalance) {
      setErrorState("Validator balance is required.");
      onError("Validator balance is required.");
      return;
    }
    if (!blsProofOfPossession) {
      setErrorState("BLS Proof of Possession is required.");
      onError("BLS Proof of Possession is required.");
      return;
    }
    if (!unsignedWarpMessage) {
      setErrorState("Unsigned warp message not found. Check the transaction hash.");
      onError("Unsigned warp message not found.");
      return;
    }
    if (isCoreWallet && !pChainAddress) {
      setErrorState("P-Chain address is missing. Please connect your wallet.");
      onError("P-Chain address is missing.");
      return;
    }

    setIsProcessing(true);
    try {
      const aggregateSignaturePromise = aggregateSignature({
        message: unsignedWarpMessage,
        signingSubnetId,
      });
      notify({
        type: 'local',
        name: 'Aggregate Signatures'
      }, aggregateSignaturePromise);
      const { signedMessage } = await aggregateSignaturePromise;

      setSignedWarpMessage(signedMessage);

      if (!isCoreWallet) {
        // Generic wallet: aggregation done, CLI command shown in render
        return;
      }

      const pChainTxId = await submitPChainTx(async (client) => {
        const registerL1ValidatorPromise = client.registerL1Validator({
          balance: validatorBalance!.trim(),
          blsProofOfPossession: blsProofOfPossession!.trim(),
          signedWarpMessage: signedMessage,
        });
        notify('registerL1Validator', registerL1ValidatorPromise);
        return registerL1ValidatorPromise;
      });

      setTxSuccess(pChainTxId);
      onSuccess(pChainTxId);
    } catch (err: any) {
      const message = parsePChainError(err);

      setErrorState(`P-Chain transaction failed: ${message}`);
      onError(`P-Chain transaction failed: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTxHashChange = (value: string) => {
    setEvmTxHashState(value);
    setErrorState(null);
    setTxSuccess(null);
    setSignedWarpMessage(null);
  };

  const handleContinueWithManualTxId = (pChainTxId: string) => {
    setTxSuccess(pChainTxId);
    onSuccess(pChainTxId);
  };

  const generateCLICommand = () => {
    if (!signedWarpMessage) return '';
    const network = isTestnet ? 'fuji' : 'mainnet';
    return [
      `platform l1 register-validator \\`,
      `  --message "${signedWarpMessage}" \\`,
      `  --pop "${blsProofOfPossession || '<BLS_PROOF>'}" \\`,
      `  --balance ${validatorBalance || '<BALANCE_AVAX>'} \\`,
      `  --network ${network} \\`,
      `  --key-name <your-key-name>`,
    ].join('\n');
  };

  if (!subnetIdL1) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        Please select an L1 subnet first.
      </div>
    );
  }

  const step1Complete = !!unsignedWarpMessage;
  const step2Complete = !!signedWarpMessage;
  const step3Complete = !!txSuccess;
  const hasInsufficientBalance = !!(userPChainBalanceNavax && validatorBalance && BigInt(Math.round(Number(validatorBalance) * 1e9)) > userPChainBalanceNavax);

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="error">{error}</Alert>
      )}

      {/* Step 1: Extract Warp Message */}
      <StepFlowCard step={1} title="Extract Warp Message" description="Enter the EVM transaction hash to extract the unsigned Warp message" isComplete={step1Complete}>
        <div className="mt-2">
          <Input
            label="initiateValidatorRegistration Transaction Hash"
            value={evmTxHashState}
            onChange={handleTxHashChange}
            placeholder="Enter the transaction hash from the previous step (0x...)"
            disabled={isProcessing || txSuccess !== null}
          />
        </div>
        {step1Complete && (
          <div className="mt-2 space-y-1">
            {(validatorBalance || blsProofOfPossession) && (
              <div className="space-y-1.5">
                {validatorBalance && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-green-600 dark:text-green-400 font-medium">Initial Balance:</span>
                    <code className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-[10px] font-mono">{validatorBalance} AVAX</code>
                  </div>
                )}
                {hasInsufficientBalance && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Exceeds P-Chain balance ({(Number(userPChainBalanceNavax) / 1e9).toFixed(2)} AVAX)
                  </p>
                )}
                {blsProofOfPossession && (
                  <details>
                    <summary className="text-[10px] text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300">
                      Show BLS Proof of Possession ({blsProofOfPossession.length / 2} bytes)
                    </summary>
                    <div className="mt-1">
                      <DynamicCodeBlock lang="text" code={blsProofOfPossession} />
                    </div>
                  </details>
                )}
              </div>
            )}
            <details className="mt-1">
              <summary className="text-[10px] text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300">
                Show unsigned Warp message ({unsignedWarpMessage ? unsignedWarpMessage.length / 2 : 0} bytes)
              </summary>
              <div className="mt-1">
                <DynamicCodeBlock lang="text" code={unsignedWarpMessage || ''} />
              </div>
            </details>
          </div>
        )}
      </StepFlowCard>

      {/* Step 2: Aggregate Signatures & Submit */}
      <StepFlowCard
        step={2}
        title="Sign & Submit to P-Chain"
        description={<>Aggregate BLS signatures from L1 validators and submit <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono">RegisterL1ValidatorTx</code></>}
        isComplete={step2Complete}
        isActive={step1Complete}
      >
        {step2Complete ? (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <Check className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Signatures aggregated</span>
            </div>
            <details>
              <summary className="text-[10px] text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300">
                Show signed Warp message ({signedWarpMessage ? signedWarpMessage.length / 2 : 0} bytes)
              </summary>
              <div className="mt-1">
                <DynamicCodeBlock lang="text" code={signedWarpMessage || ''} />
              </div>
            </details>
          </div>
        ) : step1Complete && !step3Complete ? (
          <div className="mt-2">
            <Button
              onClick={handleSubmitPChainTx}
              disabled={isProcessing || !unsignedWarpMessage || !validatorBalance || !blsProofOfPossession}
              loading={isProcessing}
              className="w-full"
            >
              {isProcessing ? 'Processing...' : (isCoreWallet ? 'Sign & Submit to P-Chain' : 'Aggregate Signatures')}
            </Button>
          </div>
        ) : null}
      </StepFlowCard>

      {/* Non-Core: CLI command */}
      {!isCoreWallet && signedWarpMessage && !txSuccess && (
        <PChainManualSubmit
          cliCommand={generateCLICommand()}
          onSubmit={handleContinueWithManualTxId}
        />
      )}

      {/* Step 3: Success */}
      {txSuccess && (
        <Success
          label="P-Chain Transaction ID"
          value={txSuccess}
        />
      )}
    </div>
  );
};

export default SubmitPChainTxRegisterL1Validator;
