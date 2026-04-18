'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useStartDeployment } from '@/hooks/useQuickL1Deploy';
import { Container } from '@/components/toolbox/components/Container';
import { Input } from '@/components/toolbox/components/Input';
import { Button } from '@/components/toolbox/components/Button';

/**
 * Basic Setup intake form.
 *
 * Deliberately minimal: chain name, token symbol, owner address
 * (pre-filled from connected wallet). Everything else — genesis config,
 * node count, validator type, interoperability — is chosen for them.
 * The whole point of Basic is "do it for me."
 */
export default function BasicSetupForm() {
  const router = useRouter();
  const { walletEVMAddress, isTestnet } = useWalletStore();
  const { deploy, submitting, error } = useStartDeployment();

  const [chainName, setChainName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [ownerAddress, setOwnerAddress] = useState<string>(walletEVMAddress || '');

  // Keep the owner field in sync with the connected wallet when the user
  // hasn't manually edited it. `touched` prevents us from stomping a
  // deliberate override.
  const [ownerTouched, setOwnerTouched] = useState(false);
  useMemo(() => {
    if (!ownerTouched && walletEVMAddress && !ownerAddress) setOwnerAddress(walletEVMAddress);
  }, [walletEVMAddress, ownerAddress, ownerTouched]);

  const canSubmit =
    chainName.trim().length >= 2 && tokenSymbol.trim().length >= 2 && /^0x[a-fA-F0-9]{40}$/.test(ownerAddress);

  async function handleSubmit() {
    if (!canSubmit || submitting) return;

    const jobId = await deploy({
      chainName: chainName.trim(),
      tokenSymbol: tokenSymbol.trim().toUpperCase(),
      ownerEvmAddress: ownerAddress as `0x${string}`,
      network: 'fuji',
    });

    if (jobId) router.push(`/console/create-l1/basic/${jobId}`);
  }

  return (
    <Container
      title="Basic Setup"
      description="Give your L1 a name and a token symbol. We'll configure subnet, genesis, a managed validator node, and the Validator Manager for you."
    >
      {!isTestnet && (
        <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          Basic setup is Fuji-testnet only. Switch your wallet to Fuji to continue, or use Advanced for mainnet.
        </div>
      )}

      <div className="space-y-4">
        <Input
          id="chainName"
          label="Chain name"
          value={chainName}
          onChange={setChainName}
          placeholder="My Awesome L1"
          helperText="Shown in wallets and explorers. 2–32 characters."
          maxLength={32}
        />
        <Input
          id="tokenSymbol"
          label="Token symbol"
          value={tokenSymbol}
          onChange={(v) => setTokenSymbol(v.toUpperCase())}
          placeholder="MYTOKEN"
          helperText="Native currency ticker. 2–6 characters, uppercase."
          maxLength={6}
        />
        <Input
          id="ownerAddress"
          label="Owner address"
          value={ownerAddress}
          onChange={(v) => {
            setOwnerTouched(true);
            setOwnerAddress(v);
          }}
          placeholder="0x…"
          helperText="Receives 1M initial tokens and owns the Validator Manager. Defaults to your connected wallet."
        />
      </div>

      {/* What Basic Setup configures for you — neutral bordered panel */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
          What we&apos;ll set up
        </div>
        <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
          <li>• Subnet-EVM chain with sensible gas + genesis defaults</li>
          <li>• Warp + Teleporter messenger preinstalled for cross-chain messaging</li>
          <li>• 1 managed Fuji validator node (3-day TTL)</li>
          <li>• Proof-of-Authority Validator Manager deployed on the L1</li>
          <li>• Subnet + Validator Manager ownership transferred to your address</li>
        </ul>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => router.push('/console/create-l1')} stickLeft>
          Back
        </Button>
        <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit} stickLeft>
          {submitting ? 'Starting deployment…' : 'Deploy L1'}
        </Button>
      </div>
    </Container>
  );
}
