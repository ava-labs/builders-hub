'use client';

import { useState, useEffect } from 'react';
import { Container } from '@/components/toolbox/components/Container';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import { Input } from '@/components/toolbox/components/Input';
import InputChainId from '@/components/toolbox/components/InputChainId';
import InputSubnetId from '@/components/toolbox/components/InputSubnetId';
import BlockchainDetailsDisplay from '@/components/toolbox/components/BlockchainDetailsDisplay';
import { getBlockchainInfo, getSubnetInfo } from '@/components/toolbox/coreViem/utils/glacier';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { useNetworkInfo } from '@/components/toolbox/stores/walletStore';
import DockerBlockscoutSetup from '../create/SelfHostedExplorer';
import TerraformBlockscout from './TerraformBlockscout';
import KubernetesBlockscout from './KubernetesBlockscout';

type DeployMethod = 'terraform' | 'kubernetes' | 'docker';

const METHODS: { value: DeployMethod; label: string; details: string }[] = [
  { value: 'terraform', label: 'Terraform + Ansible', details: 'Cloud VMs via avalanche-deploy' },
  { value: 'kubernetes', label: 'Kubernetes', details: 'Helm chart via avalanche-deploy' },
  { value: 'docker', label: 'Docker', details: 'Docker Compose on a single machine' },
];

export default function ExplorerSetup() {
  const [method, setMethod] = useState<DeployMethod>('docker');

  const [chainId, setChainId] = useState('');
  const [subnetId, setSubnetId] = useState('');
  const [subnet, setSubnet] = useState<any>(null);
  const [resolvedEvmChainId, setResolvedEvmChainId] = useState<number>(0);
  const [manualEvmChainId, setManualEvmChainId] = useState('');
  const [chainName, setChainName] = useState('');
  const [chainIsTestnet, setChainIsTestnet] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [subnetIdError, setSubnetIdError] = useState<string | null>(null);

  const l1Info = useL1ByChainId(chainId);
  const { isTestnet: walletIsTestnet, chainId: walletChainId } = useNetworkInfo();

  useEffect(() => {
    setSubnetIdError(null);
    setSubnetId('');
    setSubnet(null);
    setResolvedEvmChainId(0);
    setManualEvmChainId('');
    setChainIsTestnet(null);
    if (!chainId) return;

    // Set defaults from L1 store if available
    if (l1Info) {
      setChainName(l1Info.name);
      if (l1Info.evmChainId) setResolvedEvmChainId(l1Info.evmChainId);
    }

    // Abort superseded lookups: a stale Glacier response for a previous
    // chainId must not clobber the current chain's network/name/ids —
    // isTestnet feeds AVAGO_NETWORK_ID and container versions downstream.
    const controller = new AbortController();
    const { signal } = controller;
    setIsLoading(true);
    getBlockchainInfo(chainId, signal)
      .then(async (chainInfo) => {
        if (signal.aborted) return;
        setSubnetId(chainInfo.subnetId);
        setChainIsTestnet(chainInfo.isTestnet);
        if (chainInfo.evmChainId) setResolvedEvmChainId(chainInfo.evmChainId);
        if (!l1Info && chainInfo.blockchainName) setChainName(chainInfo.blockchainName);
        try {
          const subnetInfo = await getSubnetInfo(chainInfo.subnetId, signal);
          if (!signal.aborted) setSubnet(subnetInfo);
        } catch (error) {
          if (!signal.aborted) setSubnetIdError((error as Error).message);
        }
      })
      .catch((error) => {
        if (!signal.aborted) setSubnetIdError((error as Error).message);
      })
      .finally(() => {
        if (!signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [chainId]);

  const manualEvmValid = /^[1-9]\d*$/.test(manualEvmChainId);
  const evmChainId = resolvedEvmChainId > 0 ? resolvedEvmChainId : manualEvmValid ? parseInt(manualEvmChainId, 10) : 0;
  // Commands target the chain's network (Glacier-derived), not the wallet's —
  // the page must keep working with no wallet connected.
  const isTestnet = chainIsTestnet ?? walletIsTestnet;
  // Preserve the pre-rework behavior of not generating anything while the
  // chain lookup errored: bodies gate their chain-dependent steps on subnetId.
  const effectiveSubnetId = subnetIdError ? '' : subnetId;
  const networkMismatch =
    !!subnetId && walletChainId !== 0 && chainIsTestnet !== null && chainIsTestnet !== walletIsTestnet;

  return (
    <Container
      title="Explorer Setup"
      description="Deploy a Blockscout block explorer for your L1 via Terraform, Kubernetes, or Docker."
      githubUrl="https://github.com/ava-labs/builders-hub/edit/master/components/toolbox/console/layer-1/explorer/ExplorerSetup.tsx"
    >
      <Steps>
        <Step>
          <h3 className="text-xl font-bold mb-4">Choose Your Deployment Method</h3>
          <p>
            Terraform and Kubernetes deploy Blockscout through the{' '}
            <a
              href="https://github.com/ava-labs/avalanche-deploy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              avalanche-deploy
            </a>{' '}
            repo; Docker generates a standalone Docker Compose setup.
          </p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  method === m.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                <div className="font-medium text-sm">{m.label}</div>
                <div className="text-xs text-zinc-500">{m.details}</div>
              </button>
            ))}
          </div>
        </Step>

        <Step>
          <h3 className="text-xl font-bold mb-4">Select L1</h3>
          <p>Enter the Avalanche Blockchain ID (not EVM chain ID) of the L1 you want to run an explorer for.</p>

          <InputChainId value={chainId} onChange={setChainId} error={subnetIdError} hidePrimaryNetwork={true} />

          <InputSubnetId value={subnetId} onChange={setSubnetId} readOnly={true} />

          {/* Show subnet details if available */}
          <BlockchainDetailsDisplay subnet={subnet} isLoading={isLoading} />

          {method !== 'docker' && subnetId && (
            <Input
              label="Chain Name"
              value={chainName}
              onChange={setChainName}
              helperText="Display name used by the explorer (e.g. My L1)"
            />
          )}

          {subnetId && !isLoading && resolvedEvmChainId === 0 && (
            <Input
              label="EVM Chain ID"
              value={manualEvmChainId}
              onChange={setManualEvmChainId}
              error={manualEvmChainId && !manualEvmValid ? 'Must be a positive integer' : null}
              helperText="Couldn't resolve the EVM chain ID automatically — enter the chainId from your genesis file"
            />
          )}

          {networkMismatch && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm">
              This chain is on <strong>{chainIsTestnet ? 'Fuji' : 'Mainnet'}</strong> but your wallet is connected to{' '}
              <strong>{walletIsTestnet ? 'Fuji' : 'Mainnet'}</strong>. The commands below target the chain's network.
            </div>
          )}
        </Step>

        <div hidden={method !== 'terraform'}>
          <TerraformBlockscout
            blockchainId={effectiveSubnetId ? chainId : ''}
            evmChainId={evmChainId}
            chainName={chainName}
          />
        </div>
        <div hidden={method !== 'kubernetes'}>
          <KubernetesBlockscout
            blockchainId={effectiveSubnetId ? chainId : ''}
            evmChainId={evmChainId}
            chainName={chainName}
          />
        </div>
        <div hidden={method !== 'docker'}>
          <DockerBlockscoutSetup
            blockchainId={chainId}
            subnetId={effectiveSubnetId}
            evmChainId={evmChainId}
            isTestnet={isTestnet}
          />
        </div>
      </Steps>
    </Container>
  );
}
