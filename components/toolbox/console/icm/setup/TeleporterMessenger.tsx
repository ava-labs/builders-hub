'use client';

import { useState, useEffect } from 'react';
import { formatEther, parseEther } from 'viem';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import TeleporterMessengerDeploymentTransaction from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Deployment_Transaction_v1.0.0.txt.json';
import TeleporterMessengerDeployerAddress from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Deployer_Address_v1.0.0.txt.json';
import TeleporterMessengerAddress from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import versions from '@/scripts/versions.json';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { ContractDeployViewer, ContractSource } from '@/components/console/contract-deploy-viewer';
import { Button } from '@/components/toolbox/components/Button';
import { RawInput } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Steps, Step } from '@/components/toolbox/components/Steps';
import {
  CopyValue,
  DocsLink,
  Fact,
  Facts,
  Loading,
  MONO_VALUE,
  Panel,
  StatusLine,
} from '@/components/toolbox/console/icm/ui';

const MINIMUM_BALANCE = parseEther('11');

const ICM_COMMIT = versions['ava-labs/icm-services'];

const CONTRACT_SOURCES: ContractSource[] = [
  {
    name: 'TeleporterMessenger',
    filename: 'TeleporterMessenger.sol',
    url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/teleporter/TeleporterMessenger.sol`,
    description: 'Core ICM contract for cross-chain message sending and receiving',
  },
  {
    name: 'ITeleporterMessenger',
    filename: 'ITeleporterMessenger.sol',
    url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/teleporter/ITeleporterMessenger.sol`,
    description: 'Interface defining the Teleporter messenger protocol',
  },
];

const metadata: ConsoleToolMetadata = {
  title: 'Deploy ICM Messenger',
  description: 'Deploy the ICM messenger contract to your L1 to enable cross-L1 messaging and applications like ICTT',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function TeleporterMessenger({ onSuccess }: BaseConsoleToolProps) {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { walletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployerBalance, setDeployerBalance] = useState(BigInt(0));
  const [isCheckingBalance, setIsCheckingBalance] = useState(true);
  const [isDeployed, setIsDeployed] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [amount, setAmount] = useState(formatEther(MINIMUM_BALANCE));
  const [isSending, setIsSending] = useState(false);

  if (criticalError) {
    throw criticalError;
  }

  const deployerAddress = TeleporterMessengerDeployerAddress.content as `0x${string}`;
  const expectedContractAddress = TeleporterMessengerAddress.content;

  const checkDeployerBalance = async () => {
    setIsCheckingBalance(true);
    try {
      const balance = await publicClient.getBalance({
        address: deployerAddress,
      });

      setDeployerBalance(balance);

      const code = await publicClient.getBytecode({
        address: expectedContractAddress as `0x${string}`,
      });

      setIsDeployed(code !== undefined && code !== '0x');
    } catch (error) {
      console.error('Failed to check balance:', error);
    } finally {
      setIsCheckingBalance(false);
    }
  };

  useEffect(() => {
    checkDeployerBalance();
  }, []);

  const handleTopUp = async () => {
    setIsSending(true);
    try {
      const hash = await walletClient.sendTransaction({
        to: deployerAddress as `0x${string}`,
        value: parseEther(amount),
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await checkDeployerBalance();
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsSending(false);
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const hash = await walletClient.sendRawTransaction({
        serializedTransaction: TeleporterMessengerDeploymentTransaction.content as `0x${string}`,
      });

      setTxHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        throw new Error('Deployment transaction reverted');
      }
      setIsDeployed(true);
      onSuccess?.();

      await checkDeployerBalance();
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsDeploying(false);
    }
  };

  const hasEnoughBalance = deployerBalance >= MINIMUM_BALANCE;

  const deployForm = (
    <Panel
      eyebrow="Deterministic deploy"
      title="Deploy TeleporterMessenger"
      description="The contract that sends and receives cross-chain messages. Its address is the same on every chain: fund the deployer, then broadcast the pre-signed transaction."
      footer={
        <>
          <DocsLink href="https://github.com/ava-labs/icm-services/blob/main/icm-contracts/avalanche/teleporter/README.md">
            Teleporter docs
          </DocsLink>
          <span className="font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">@{ICM_COMMIT.slice(0, 7)}</span>
        </>
      }
    >
      <Steps>
        <Step>
          <h3>Fund the deployer</h3>
          <p>The pre-signed transaction is paid from this address.</p>
          <Facts>
            <Fact label="Deployer">
              <CopyValue value={deployerAddress} />
            </Fact>
            {!isDeployed && (
              <Fact label="Balance">
                {isCheckingBalance ? (
                  <Loading>Checking balance…</Loading>
                ) : (
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className={MONO_VALUE}>{formatEther(deployerBalance)} coins</span>
                    <StatusLine tone={hasEnoughBalance ? 'done' : 'warn'}>
                      {hasEnoughBalance ? 'Enough to deploy' : `Needs ${formatEther(MINIMUM_BALANCE)}`}
                    </StatusLine>
                  </span>
                )}
              </Fact>
            )}
          </Facts>
          {isDeployed && <StatusLine tone="done">Not needed: the contract is already deployed.</StatusLine>}
          {!hasEnoughBalance && !isDeployed && (
            <div className="flex items-stretch">
              <label htmlFor="messenger-topup" className="sr-only">
                Amount to send to the deployer
              </label>
              <RawInput
                id="messenger-topup"
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 font-mono tabular-nums"
                placeholder="Amount"
              />
              <Button onClick={handleTopUp} loading={isSending} loadingText="Sending" stickLeft>
                Send to deployer
              </Button>
            </div>
          )}
        </Step>

        <Step>
          <h3>Deploy the contract</h3>
          <p>It lands at this address on every chain.</p>
          <Facts>
            <Fact label="Contract">
              <CopyValue value={expectedContractAddress} />
            </Fact>
          </Facts>
          {isDeployed ? (
            <StatusLine tone="done">Deployed. TeleporterMessenger is ready for cross-chain messages.</StatusLine>
          ) : (
            <Button onClick={handleDeploy} loading={isDeploying} loadingText="Deploying" disabled={!hasEnoughBalance}>
              Deploy TeleporterMessenger
            </Button>
          )}
          {txHash && <Success label="Deployment transaction" value={txHash} confirmed={isDeployed} />}
        </Step>
      </Steps>
    </Panel>
  );

  return <ContractDeployViewer contracts={CONTRACT_SOURCES}>{deployForm}</ContractDeployViewer>;
}

export default withConsoleToolMetadata(TeleporterMessenger, metadata);
