import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { Alert } from '@/components/toolbox/components/Alert';
import { Steps, Step } from '@/components/toolbox/components/Steps';
import { Field, Reveal, Status } from '@/components/toolbox/console/shared/validator-flow-ui';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useSubmitPChainTx } from '@/components/toolbox/hooks/useSubmitPChainTx';
import { Check } from 'lucide-react';
import { extractWarpMessageFromReceipt } from '@avalanche-sdk/interchain/warp';
import { validateAndCleanTxHash } from '@/components/toolbox/utils/warp';
import { PChainManualSubmit } from '@/components/toolbox/components/PChainManualSubmit';
import { parsePChainError } from '@/components/toolbox/hooks/contracts';
import { CoreWalletTransactionButton } from '@/components/toolbox/components/CoreWalletTransactionButton';
import { waitForPChainConfirmation } from '@/components/toolbox/utils/pchainConfirmation';

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
    return () => {
      cancelled = true;
    };
  }, [evmTxHashState, chainPublicClient]);

  const handleSubmitPChainTx = async () => {
    setErrorState(null);
    setTxSuccess(null);

    if (isCoreWallet && !coreWalletClient) {
      setErrorState('Connect Core or a Console wallet to sign P-Chain transactions.');
      return;
    }

    if (!evmTxHashState.trim()) {
      setErrorState('EVM transaction hash is required.');
      onError('EVM transaction hash is required.');
      return;
    }
    if (!subnetIdL1) {
      setErrorState('L1 Subnet ID is required.');
      onError('L1 Subnet ID is required.');
      return;
    }
    if (!validatorBalance) {
      setErrorState('Validator balance is required.');
      onError('Validator balance is required.');
      return;
    }
    if (!blsProofOfPossession) {
      setErrorState('BLS Proof of Possession is required.');
      onError('BLS Proof of Possession is required.');
      return;
    }
    if (!unsignedWarpMessage) {
      setErrorState('Unsigned warp message not found. Check the transaction hash.');
      onError('Unsigned warp message not found.');
      return;
    }
    if (isCoreWallet && !pChainAddress) {
      setErrorState('P-Chain address is missing. Please connect your wallet.');
      onError('P-Chain address is missing.');
      return;
    }

    setIsProcessing(true);
    try {
      const aggregateSignaturePromise = aggregateSignature({
        message: unsignedWarpMessage,
        signingSubnetId,
      });
      notify(
        {
          type: 'local',
          name: 'Aggregate Signatures',
        },
        aggregateSignaturePromise,
      );
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

      // Wait for P-Chain confirmation before declaring success
      await waitForPChainConfirmation(pChainTxId, isTestnet);

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
      `platform-cli l1 register-validator \\`,
      `  --message "${signedWarpMessage}" \\`,
      `  --pop "${blsProofOfPossession || '<BLS_PROOF>'}" \\`,
      `  --balance ${validatorBalance || '<BALANCE_AVAX>'} \\`,
      `  --network ${network} \\`,
      `  --key-name <your-key-name>`,
    ].join('\n');
  };

  if (!subnetIdL1) {
    return <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Select an L1 subnet first.</p>;
  }

  const step1Complete = !!unsignedWarpMessage;
  const step2Complete = !!signedWarpMessage;
  const step3Complete = !!txSuccess;
  const hasInsufficientBalance = !!(
    userPChainBalanceNavax &&
    validatorBalance &&
    BigInt(Math.round(Number(validatorBalance) * 1e9)) > userPChainBalanceNavax
  );

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert variant="error">{error}</Alert>}

      <Steps>
        <Step>
          <div>
            <h3 className="flex items-center justify-between gap-3">
              Extract the warp message
              {step1Complete && <Status tone="ok">Extracted</Status>}
            </h3>
            <p>Paste the EVM transaction hash to pull out the unsigned warp message.</p>
          </div>
          <Input
            label="initiateValidatorRegistration transaction hash"
            value={evmTxHashState}
            onChange={handleTxHashChange}
            placeholder="0x… from the previous step"
            disabled={isProcessing || txSuccess !== null}
          />
          {step1Complete && (
            <div className="flex flex-col gap-3">
              {validatorBalance && (
                <Field label="Initial balance">
                  <span className="font-mono tabular-nums">{validatorBalance} AVAX</span>
                </Field>
              )}
              {hasInsufficientBalance && (
                <p className="text-[12px] text-red-600 dark:text-red-400">
                  More than your P-Chain balance (
                  <span className="font-mono">{(Number(userPChainBalanceNavax) / 1e9).toFixed(2)} AVAX</span>).
                </p>
              )}
              {blsProofOfPossession && <Reveal label="BLS proof of possession" value={blsProofOfPossession} />}
              <Reveal label="Unsigned warp message" value={unsignedWarpMessage || ''} />
            </div>
          )}
        </Step>

        <Step>
          <div>
            <h3 className="flex items-center justify-between gap-3">
              Sign and submit to the P-Chain
              {step2Complete && <Status tone="ok">Aggregated</Status>}
            </h3>
            <p>
              Aggregates BLS signatures from the L1 validators and submits{' '}
              <code className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">RegisterL1ValidatorTx</code>.
            </p>
          </div>
          {step2Complete ? (
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Signatures aggregated
              </p>
              <Reveal label="Signed warp message" value={signedWarpMessage || ''} />
            </div>
          ) : step1Complete && !step3Complete ? (
            isCoreWallet ? (
              <CoreWalletTransactionButton
                onClick={handleSubmitPChainTx}
                loading={isProcessing}
                loadingText="Submitting…"
                disabled={isProcessing || !unsignedWarpMessage || !validatorBalance || !blsProofOfPossession}
                className="w-full"
              >
                Sign and submit to P-Chain
              </CoreWalletTransactionButton>
            ) : (
              <Button
                onClick={handleSubmitPChainTx}
                disabled={isProcessing || !unsignedWarpMessage || !validatorBalance || !blsProofOfPossession}
                loading={isProcessing}
                loadingText="Aggregating…"
                className="w-full"
              >
                Aggregate signatures
              </Button>
            )
          ) : (
            <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Waiting on the warp message.</p>
          )}
        </Step>
      </Steps>

      {/* Non-Core: CLI command */}
      {!isCoreWallet && signedWarpMessage && !txSuccess && (
        <PChainManualSubmit cliCommand={generateCLICommand()} onSubmit={handleContinueWithManualTxId} />
      )}
    </div>
  );
};

export default SubmitPChainTxRegisterL1Validator;
