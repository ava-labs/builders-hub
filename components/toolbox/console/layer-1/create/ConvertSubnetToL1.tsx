'use client';

import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useEffect, useState } from 'react';
import { isAddress } from 'viem';
import { type ConvertToL1Validator } from '@/components/toolbox/components/ValidatorListInput';
import { ValidatorListInput } from '@/components/toolbox/components/ValidatorListInput';
import InputChainId from '@/components/toolbox/components/InputChainId';
import SelectSubnet, { SubnetSelection } from '@/components/toolbox/components/SelectSubnet';
import { EVMAddressInput } from '@/components/toolbox/components/EVMAddressInput';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { Step, Steps } from '@/components/toolbox/components/Steps';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { CoreWalletTransactionButton } from '@/components/toolbox/components/CoreWalletTransactionButton';
import { useSubmitPChainTx } from '@/components/toolbox/hooks/useSubmitPChainTx';
import { Alert } from '@/components/toolbox/components/Alert';
import { waitForPChainConfirmation } from '@/components/toolbox/utils/pchainConfirmation';
import { usePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { C_CHAIN_IDS, conversionProblems, isCB58Id, readCChainManager, type CChainManager } from './conversionChecks';

const metadata: ConsoleToolMetadata = {
  title: 'Convert Subnet to L1',
  description: (
    <>
      Converting a Subnet to an{' '}
      <Link href="/docs/avalanche-l1s" className="text-primary hover:underline">
        L1
      </Link>{' '}
      enables sovereign{' '}
      <Link href="/docs/avalanche-l1s/validator-manager/contract" className="text-primary hover:underline">
        validator management
      </Link>{' '}
      through a smart contract. This conversion is <strong>irreversible</strong>.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function ConvertToL1({ onSuccess }: BaseConsoleToolProps) {
  const {
    subnetId: storeSubnetId,
    chainID: storeChainID,
    managerAddress: validatorManagerAddress,
    setManagerAddress: setValidatorManagerAddress,
    convertToL1TxId: _convertToL1TxId,
    setConvertToL1TxId,
    genesisData: storeGenesisData,
  } = useCreateChainStore()();

  const [selection, setSelection] = useState<SubnetSelection>({
    subnetId: storeSubnetId,
    subnet: null,
  });
  const [validatorManagerChainID, setValidatorManagerChainID] = useState(storeChainID);
  const [validators, setValidators] = useState<ConvertToL1Validator[]>([]);

  const { pChainAddress, isTestnet } = useWalletStore();
  const pChainBalance = useWalletStore((s) => s.balances.pChain);
  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);

  const [isConverting, setIsConverting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const { notify } = useConsoleNotifications();
  const { submitPChainTx } = useSubmitPChainTx();

  // What the manager address holds on the C-Chain decides which chain the
  // conversion may name, so read it before anything is signed.
  const cChainId = isTestnet ? C_CHAIN_IDS.testnet : C_CHAIN_IDS.mainnet;
  const cChainClient = usePublicClientForChain(cChainId);
  const [cChainManager, setCChainManager] = useState<CChainManager | null>(null);
  const [cChainReadError, setCChainReadError] = useState<string | null>(null);
  const [cChainReadAttempt, setCChainReadAttempt] = useState(0);
  const [chainTouched, setChainTouched] = useState(false);

  useEffect(() => {
    setCChainManager(null);
    setCChainReadError(null);
    const subnetId = selection.subnetId;
    if (!cChainClient || !isAddress(validatorManagerAddress) || !isCB58Id(subnetId)) return;
    let cancelled = false;
    readCChainManager(cChainClient, validatorManagerAddress as `0x${string}`, subnetId)
      .then((manager) => {
        if (!cancelled) setCChainManager(manager);
      })
      .catch((err) => {
        if (!cancelled) setCChainReadError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [cChainClient, validatorManagerAddress, selection.subnetId, cChainReadAttempt]);

  // A manager on the C-Chain names the C-Chain, whatever chain the create
  // flow made last. The store default used to pair the C-Chain proxy with
  // the new L1's chain, which no contract can ever manage.
  const managerOnCChain = cChainManager?.kind === 'bound' || cChainManager?.kind === 'unset';
  useEffect(() => {
    if (managerOnCChain && !chainTouched) setValidatorManagerChainID(cChainId);
  }, [managerOnCChain, chainTouched, cChainId]);

  const problems = conversionProblems({
    managerChainId: validatorManagerChainID,
    managerAddress: validatorManagerAddress,
    validators,
    cChainId,
    subnetChainIds: selection.subnet ? selection.subnet.blockchains.map((b) => b.blockchainId) : null,
    cChainManager,
    managerChainGenesis: validatorManagerChainID === storeChainID ? storeGenesisData : null,
  });
  const checkingCChain =
    !cChainManager && !cChainReadError && isAddress(validatorManagerAddress) && isCB58Id(selection.subnetId);
  const blocked = !selection.subnet || checkingCChain || !!cChainReadError || problems.length > 0;

  function buildConvertCliCommand() {
    const parts = [
      `platform-cli subnet convert-to-l1`,
      `--subnet-id ${selection.subnetId || '<subnet-id>'}`,
      `--chain-id ${validatorManagerChainID || '<chain-id>'}`,
      `--manager ${validatorManagerAddress || '<address>'}`,
    ];

    if (validators.length > 0) {
      const nodeIds = validators.map((v) => v.nodeID || '<node-id>').join(',');
      const blsKeys = validators.map((v) => v.nodePOP.publicKey || '<bls-key>').join(',');
      const blsPops = validators.map((v) => v.nodePOP.proofOfPossession || '<bls-pop>').join(',');
      const balanceAvax = validators[0]?.validatorBalance
        ? (Number(validators[0].validatorBalance) / 1e9).toString()
        : '1.0';
      parts.push(`--validator-node-ids ${nodeIds}`);
      parts.push(`--validator-bls-public-keys ${blsKeys}`);
      parts.push(`--validator-bls-pops ${blsPops}`);
      parts.push(`--validator-balance ${balanceAvax}`);
    } else {
      parts.push(`--mock-validator`);
    }

    parts.push(`--network ${isTestnet ? 'fuji' : 'mainnet'}`);
    return parts.join(' ');
  }

  async function handleConvertToL1() {
    if (!coreWalletClient || blocked) return;

    setConvertToL1TxId('');
    setConvertError(null);
    setIsConverting(true);

    let txID: string | null = null;
    try {
      txID = await submitPChainTx(async (client) => {
        const convertSubnetToL1Tx = client.convertToL1({
          subnetId: selection.subnetId,
          chainId: validatorManagerChainID,
          managerAddress: validatorManagerAddress,
          subnetAuth: [0],
          validators,
        });

        notify('convertToL1', convertSubnetToL1Tx);

        return convertSubnetToL1Tx;
      });

      // Don't advance until the P-Chain actually accepts the conversion:
      // everything downstream (initializeValidatorSet, Glacier lookups)
      // reads state that only exists once this tx is Committed.
      setIsConfirming(true);
      await waitForPChainConfirmation(txID, isTestnet);

      setConvertToL1TxId(txID);
      onSuccess?.();
    } catch (err) {
      // Keep an issued-but-unconfirmed txID visible so the user can track
      // it and paste it into the initialize step once it commits.
      if (txID) setConvertToL1TxId(txID);
      setConvertError((err as Error).message);
    } finally {
      setIsConfirming(false);
      setIsConverting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Steps>
        <Step>
          <h3 className="text-sm font-semibold mb-3">Select Subnet</h3>
          <SelectSubnet
            value={selection.subnetId}
            onChange={setSelection}
            error={null}
            onlyNotConverted={true}
            hideDetails
          />
        </Step>

        <Step>
          <h3 className="text-sm font-semibold mb-3">Validator Manager</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The validator manager contract controls your L1's validator set. If you used{' '}
            <strong>Console defaults</strong> for your L1 genesis, a proxy is pre-deployed at{' '}
            <code className="border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[12px] text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              0xfacade...
            </code>
          </p>

          <p className="mb-4 flex items-center gap-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>
              These values are <strong>permanent</strong> and cannot be changed after conversion.
            </span>
          </p>

          <div className="space-y-4">
            <InputChainId
              value={validatorManagerChainID}
              onChange={(value) => {
                setChainTouched(true);
                setValidatorManagerChainID(value);
              }}
              error={null}
              label="Manager Chain ID"
              helperText={
                managerOnCChain && validatorManagerChainID === cChainId
                  ? 'A Validator Manager exists at this address on the C-Chain, so the C-Chain is selected.'
                  : 'Chain where the manager contract is deployed'
              }
            />
            <EVMAddressInput
              value={validatorManagerAddress}
              onChange={setValidatorManagerAddress}
              label="Manager Contract Address"
              disabled={isConverting}
              helperText="Address of the validator manager contract"
            />
          </div>
        </Step>

        <Step>
          <h3 className="text-sm font-semibold mb-3">Initial Validators</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add at least one validator. Existing Subnet validators cannot be transferred.
          </p>
          <ValidatorListInput
            validators={validators}
            onChange={setValidators}
            defaultAddress={pChainAddress}
            label=""
            description=""
            userPChainBalanceNavax={BigInt(Math.round(pChainBalance * 1e9))}
            selectedSubnetId={selection.subnetId}
            isTestnet={isTestnet}
          />
        </Step>

        <Step>
          <div>
            <h2 className="text-sm font-semibold mb-1">Convert to L1</h2>
            <p className="text-xs text-muted-foreground">
              Issues a{' '}
              <Link
                href="/docs/rpcs/p-chain/txn-format#unsigned-convert-subnet-to-l1-tx"
                className="text-primary hover:underline"
              >
                ConvertSubnetToL1Tx
              </Link>{' '}
              on the P-Chain.
            </p>
          </div>
          {checkingCChain && <Alert variant="info">Checking the manager address on the C-Chain...</Alert>}
          {cChainReadError && (
            <Alert variant="error">
              Could not read the manager address on the C-Chain: {cChainReadError}{' '}
              <button type="button" className="underline" onClick={() => setCChainReadAttempt((n) => n + 1)}>
                Try again
              </button>
            </Alert>
          )}
          {selection.subnetId && problems.length > 0 && (
            <Alert variant="warning">
              <ul className="list-disc space-y-1 pl-4">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </Alert>
          )}
          <CoreWalletTransactionButton
            variant="primary"
            onClick={handleConvertToL1}
            disabled={!selection.subnetId || validators.length === 0 || selection.subnet?.isL1 || blocked}
            loading={isConverting}
            loadingText={isConfirming ? 'Waiting for P-Chain confirmation...' : 'Converting...'}
            className="w-full"
            cliCommand={buildConvertCliCommand()}
          >
            {selection.subnet?.isL1 ? 'Already Converted' : 'Convert to L1'}
          </CoreWalletTransactionButton>
          {convertError && <Alert variant="error">{convertError}</Alert>}
        </Step>
      </Steps>
    </div>
  );
}

export default withConsoleToolMetadata(ConvertToL1, metadata);
