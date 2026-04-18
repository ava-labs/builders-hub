'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useStartDeployment } from '@/hooks/useQuickL1Deploy';
import { Container } from '@/components/toolbox/components/Container';
import { RawInput } from '@/components/toolbox/components/Input';
import { Button } from '@/components/toolbox/components/Button';

/**
 * Basic Setup intake form.
 *
 * Three inputs, one button. The shared `Input` component renders helper
 * text in a boxed card below each field — great for tool pages, too
 * heavy for a three-field onboarding form. We use the plain `RawInput`
 * with an inline label + muted hint instead to keep the page breathable.
 */
export default function BasicSetupForm() {
  const router = useRouter();
  const { walletEVMAddress, isTestnet } = useWalletStore();
  const { deploy, submitting, error } = useStartDeployment();

  const [chainName, setChainName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [ownerAddress, setOwnerAddress] = useState<string>('');

  // Pre-fill owner with the connected wallet address on first render
  // (and only when the user hasn't typed yet). Prevents us from stomping
  // a deliberate override on rerenders.
  const [ownerTouched, setOwnerTouched] = useState(false);
  useEffect(() => {
    if (!ownerTouched && walletEVMAddress && !ownerAddress) {
      setOwnerAddress(walletEVMAddress);
    }
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
      description="Give your L1 a name, a token symbol, and an owner address. We'll handle the rest."
    >
      {!isTestnet && (
        <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          Basic setup is Fuji-testnet only. Switch your wallet to Fuji to continue.
        </div>
      )}

      <Field label="Chain name" hint="Shown in wallets and explorers. 2–32 characters.">
        <RawInput
          value={chainName}
          onChange={(e) => setChainName(e.target.value)}
          placeholder="My Awesome L1"
          maxLength={32}
        />
      </Field>

      <Field label="Token symbol" hint="Native currency ticker. 2–6 characters, uppercase.">
        <RawInput
          value={tokenSymbol}
          onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
          placeholder="MYTOKEN"
          maxLength={6}
        />
      </Field>

      <Field label="Owner address" hint="Receives 1M initial tokens and owns the Validator Manager.">
        <RawInput
          value={ownerAddress}
          onChange={(e) => {
            setOwnerTouched(true);
            setOwnerAddress(e.target.value);
          }}
          placeholder="0x…"
        />
      </Field>

      {error && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit} stickLeft>
          Create Chain
        </Button>
      </div>
    </Container>
  );
}

/**
 * Minimal label + input + hint group. Keeps the whitespace between
 * label/input/hint tight, and defers the spacing *between* groups to
 * the parent Container's `space-y-8`.
 */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}
