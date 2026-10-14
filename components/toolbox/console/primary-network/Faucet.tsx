'use client';
import { useState, useCallback } from 'react';
import { EVMFaucetButton } from '@/components/toolbox/components/ConnectWallet/EVMFaucetButton';
import { PChainFaucetButton } from '@/components/toolbox/components/ConnectWallet/PChainFaucetButton';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { useL1List, L1ListItem } from '@/components/toolbox/stores/l1ListStore';

import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { normalizePChainFaucetAddress } from './pchainFaucetAddress';
import { useTestnetFaucet } from '@/hooks/useTestnetFaucet';
import { AccountRequirementsConfigKey } from '../../hooks/useAccountRequirements';
import { useFaucetRateLimit } from '@/hooks/useFaucetRateLimit';
import { useFaucetBalance } from '@/hooks/useFaucetBalance';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Droplets,
  Loader2,
  RefreshCw,
  Server,
  type LucideIcon,
} from 'lucide-react';
import { useWalletStore } from '../../stores/walletStore';
import { useWallet } from '../../hooks/useWallet';
import Link from 'next/link';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { cn } from '@/lib/utils';
import { Board, BoardHeader, Rise, SectionHeader } from '@/components/explorer-v2/ui';

const EYEBROW = 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400';
const COUNT = 'font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-zinc-400 dark:text-zinc-500';
/** Cells draw their right and bottom edges; the grid draws the top and left, so neighbours share one hairline. */
const GRID = 'grid border-l border-t border-zinc-200 dark:border-zinc-800';
const CELL =
  'flex flex-col gap-5 border-b border-r border-zinc-200 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/80';
const PRIMARY_BUTTON =
  'group/btn inline-flex h-9 shrink-0 items-center justify-center gap-2 border border-zinc-900 bg-zinc-900 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:hover:bg-zinc-100';
const CODE =
  'border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[11px] dark:border-zinc-800 dark:bg-zinc-900';

const AVAX_LOGO =
  'https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg';
const PCHAIN_LOGO =
  'https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg';

function ButtonLabel({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/btn:translate-x-0 group-hover/btn:opacity-100 group-disabled/btn:hidden" />
    </>
  );
}

function ChainLogo({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-zinc-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-900">
      <img src={src} alt={alt} className="h-full w-full object-contain" />
    </span>
  );
}

function RateLimitStatus({
  isLoading,
  allowed,
  timeUntilReset,
}: {
  isLoading: boolean;
  allowed: boolean;
  timeUntilReset?: string | null;
}) {
  const tone = isLoading
    ? { dot: 'bg-zinc-300 dark:bg-zinc-600', text: 'text-zinc-400 dark:text-zinc-500', label: 'Checking' }
    : allowed
      ? { dot: 'bg-emerald-500 dark:bg-emerald-400', text: 'text-emerald-700 dark:text-emerald-400', label: 'Ready' }
      : {
          dot: 'bg-amber-500 dark:bg-amber-400',
          text: 'text-amber-700 dark:text-amber-400',
          label: timeUntilReset ? `Cooldown ${timeUntilReset}` : 'Cooldown',
        };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] tabular-nums',
        tone.text,
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
      {tone.label}
    </span>
  );
}

function FaucetBalanceDisplay({
  balance,
  symbol,
  isLoading,
  error,
}: {
  balance?: string;
  symbol: string;
  isLoading: boolean;
  error?: boolean;
}) {
  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-zinc-400 dark:text-zinc-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading
      </span>
    );
  }

  if (error || !balance) {
    return <span className="font-mono text-[12px] text-zinc-400 dark:text-zinc-500">Unavailable</span>;
  }

  const balanceNum = parseFloat(balance);
  const isLow = balanceNum < 10;

  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1 font-mono text-[12.5px] tabular-nums',
        isLow ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-50',
      )}
    >
      {balance}
      <span className="text-zinc-400 dark:text-zinc-500">{symbol}</span>
      {isLow && <span className="ml-1 text-[10px] uppercase tracking-[0.14em]">Low</span>}
    </span>
  );
}

/** Drip amount and faucet balance as two labelled readings. */
function FaucetReadings({
  dripAmount,
  dripSymbol,
  balance,
}: {
  dripAmount: React.ReactNode;
  dripSymbol: string;
  balance: React.ReactNode;
}) {
  return (
    <dl className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-1">
        <dt className={EYEBROW}>Per drip</dt>
        <dd className="flex items-baseline gap-1 font-mono text-xl tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
          {dripAmount}
          <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">{dripSymbol}</span>
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className={EYEBROW}>Faucet balance</dt>
        <dd className="flex min-h-7 items-center">{balance}</dd>
      </div>
    </dl>
  );
}

function CellHead({
  logo,
  name,
  eyebrow,
  description,
  status,
}: {
  logo: React.ReactNode;
  name: string;
  eyebrow: string;
  description?: string;
  status: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      {logo}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <span className={EYEBROW}>{eyebrow}</span>
          {status}
        </div>
        <h3 className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{name}</h3>
        {description && <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
    </div>
  );
}

function EVMFaucetCard({ chain }: { chain: L1ListItem }) {
  const dripAmount = chain.faucetThresholds?.dripAmount || 3;
  const { allowed, isLoading, timeUntilReset } = useFaucetRateLimit({
    faucetType: 'evm',
    chainId: chain.evmChainId.toString(),
  });
  const { getBalanceForChain, isLoading: balanceLoading, error: balanceError } = useFaucetBalance();
  const chainBalance = getBalanceForChain(chain.evmChainId);

  return (
    <div className={CELL}>
      <CellHead
        logo={<ChainLogo src={chain.logoUrl} alt={chain.name} />}
        name={chain.name}
        eyebrow="L1"
        status={<RateLimitStatus isLoading={isLoading} allowed={allowed} timeUntilReset={timeUntilReset} />}
      />
      <FaucetReadings
        dripAmount={dripAmount}
        dripSymbol={chain.coinName}
        balance={
          <FaucetBalanceDisplay
            balance={chainBalance?.balanceFormatted}
            symbol={chain.coinName}
            isLoading={balanceLoading}
            error={!!balanceError}
          />
        }
      />
      <EVMFaucetButton chainId={chain.evmChainId} className={cn(PRIMARY_BUTTON, 'mt-auto w-full')}>
        <ButtonLabel>Drip</ButtonLabel>
      </EVMFaucetButton>
    </div>
  );
}

function ManualPChainFaucetInput() {
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [success, setSuccess] = useState(false);
  const { notify } = useConsoleNotifications();

  const handleClaim = useCallback(async () => {
    const result = normalizePChainFaucetAddress(address);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    const normalizedAddress = result.address;

    setError(null);
    setIsClaiming(true);
    setSuccess(false);

    try {
      const faucetRequest = async () => {
        const response = await fetch(`/api/pchain-faucet?address=${encodeURIComponent(normalizedAddress)}`);
        const rawText = await response.text();

        let data;
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error('Faucet temporarily unavailable. Please try again later.');
        }

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error(data.message || 'Rate limit exceeded. Please try again later.');
          }
          throw new Error(data.message || `Error ${response.status}: Failed to get tokens`);
        }

        if (!data.success) {
          throw new Error(data.message || 'Failed to get tokens');
        }

        return data;
      };

      const faucetPromise = faucetRequest();
      notify({ type: 'local', name: 'P-Chain Manual Faucet Claim' }, faucetPromise);

      await faucetPromise;
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to claim tokens');
    } finally {
      setIsClaiming(false);
    }
  }, [address, notify]);

  return (
    <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <label htmlFor="pchain-manual-address" className={EYEBROW}>
        Send to another address
      </label>
      <p className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Using platform-cli? Paste the address from <code className={CODE}>platform-cli wallet balance</code>. The{' '}
        <code className={CODE}>P-fuji1</code> prefix is added automatically.
      </p>
      <div className="flex gap-2">
        <input
          id="pchain-manual-address"
          type="text"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setError(null);
            setSuccess(false);
          }}
          placeholder="P-fuji1..."
          className="h-9 min-w-0 flex-1 border border-zinc-300 bg-white px-3 font-mono text-[12px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
        />
        <button
          type="button"
          onClick={handleClaim}
          disabled={isClaiming || !address}
          className="inline-flex h-9 shrink-0 items-center gap-2 border border-zinc-300 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-zinc-300 disabled:hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50"
        >
          {isClaiming ? 'Claiming...' : success ? 'Claimed!' : 'Claim'}
        </button>
      </div>
      {error && <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="text-[12px] text-emerald-700 dark:text-emerald-400">Tokens sent.</p>}
    </div>
  );
}

function FaucetLinkRow({
  href,
  icon: Icon,
  label,
  hint,
  external = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  external?: boolean;
}) {
  const className = 'group/row flex items-center gap-3 px-5 py-2.5';
  const Arrow = external ? ArrowUpRight : ArrowRight;
  const inner = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-zinc-900 underline-offset-4 group-hover/row:underline dark:text-zinc-50">
          {label}
        </span>
        <span className="block truncate text-[12px] text-zinc-500 dark:text-zinc-400">{hint}</span>
      </span>
      <Arrow className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/row:translate-x-0 group-hover/row:opacity-100" />
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

const metadata: ConsoleToolMetadata = {
  title: 'Testnet Faucet',
  description: 'Request free test tokens for Fuji testnet and Avalanche L1s',
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected, AccountRequirementsConfigKey.UserLoggedIn],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function Faucet({ onSuccess: _onSuccess }: BaseConsoleToolProps) {
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const { switchChain } = useWallet();
  const _l1List = useL1List();
  const { getChainsWithFaucet } = useTestnetFaucet();
  const EVMChainsWithBuilderHubFaucet = getChainsWithFaucet();
  const { balances, isLoading: balancesLoading, error: balancesError, refetch } = useFaucetBalance();

  if (!isTestnet) {
    return (
      <div className="not-prose flex items-start gap-4 border border-amber-300 bg-amber-50 p-5 dark:border-amber-800/70 dark:bg-amber-950/20">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-amber-900 dark:text-amber-200">
              Faucet is only available on testnet
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
              Switch to Fuji testnet to request free test tokens.
            </p>
          </div>
          <div>
            <button type="button" onClick={() => switchChain(43113, true)} className={PRIMARY_BUTTON}>
              <Droplets className="h-3.5 w-3.5" />
              Switch to Fuji Testnet
            </button>
          </div>
        </div>
      </div>
    );
  }

  const cChain = EVMChainsWithBuilderHubFaucet.find((chain) => chain.evmChainId === 43113);
  const otherEVMChains = EVMChainsWithBuilderHubFaucet.filter((chain) => chain.evmChainId !== 43113);

  const {
    allowed: cChainAllowed,
    isLoading: cChainLoading,
    timeUntilReset: cChainReset,
  } = useFaucetRateLimit({
    faucetType: 'evm',
    chainId: '43113',
  });

  const {
    allowed: pChainAllowed,
    isLoading: pChainLoading,
    timeUntilReset: pChainReset,
  } = useFaucetRateLimit({
    faucetType: 'pchain',
  });

  const cChainBalance = balances?.evmChains.find((c) => c.chainId === 43113);

  return (
    <div className="not-prose flex flex-col gap-10">
      <Rise className="flex flex-col gap-4">
        <SectionHeader
          label="Primary Network"
          action={
            <button
              type="button"
              onClick={() => refetch()}
              disabled={balancesLoading}
              className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-zinc-100"
            >
              <RefreshCw className={cn('h-3 w-3', balancesLoading && 'animate-spin')} />
              Refresh balances
            </button>
          }
        />

        <div className={cn(GRID, 'grid-cols-1 md:grid-cols-2')}>
          <div className={CELL}>
            <CellHead
              logo={<ChainLogo src={cChain?.logoUrl || AVAX_LOGO} alt="C-Chain" />}
              name="C-Chain"
              eyebrow="Fuji"
              description="Smart contracts and DeFi"
              status={
                <RateLimitStatus isLoading={cChainLoading} allowed={cChainAllowed} timeUntilReset={cChainReset} />
              }
            />
            <FaucetReadings
              dripAmount={cChain?.faucetThresholds?.dripAmount || 0.5}
              dripSymbol={cChain?.coinName || 'AVAX'}
              balance={
                <FaucetBalanceDisplay
                  balance={cChainBalance?.balanceFormatted}
                  symbol={cChainBalance?.symbol || 'AVAX'}
                  isLoading={balancesLoading}
                  error={!!balancesError}
                />
              }
            />
            <EVMFaucetButton chainId={43113} className={cn(PRIMARY_BUTTON, 'mt-auto w-full')}>
              <ButtonLabel>Request tokens</ButtonLabel>
            </EVMFaucetButton>
          </div>

          <div className={CELL}>
            <CellHead
              logo={<ChainLogo src={PCHAIN_LOGO} alt="P-Chain" />}
              name="P-Chain"
              eyebrow="Fuji"
              description="Validators and L1 creation"
              status={
                <RateLimitStatus isLoading={pChainLoading} allowed={pChainAllowed} timeUntilReset={pChainReset} />
              }
            />
            <FaucetReadings
              dripAmount="0.5"
              dripSymbol="AVAX"
              balance={
                <FaucetBalanceDisplay
                  balance={balances?.pChain?.balanceFormatted}
                  symbol="AVAX"
                  isLoading={balancesLoading}
                  error={!!balancesError}
                />
              }
            />
            <PChainFaucetButton className={cn(PRIMARY_BUTTON, 'w-full')}>
              <ButtonLabel>Request tokens</ButtonLabel>
            </PChainFaucetButton>
            <ManualPChainFaucetInput />
          </div>
        </div>
      </Rise>

      {otherEVMChains.length > 0 && (
        <Rise delay={0.06} className="flex flex-col gap-4">
          <SectionHeader
            label="Avalanche L1s"
            action={<span className={COUNT}>{otherEVMChains.length} faucets</span>}
          />
          <div className={cn(GRID, 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
            {otherEVMChains.map((chain: L1ListItem) => (
              <EVMFaucetCard key={chain.id} chain={chain} />
            ))}
          </div>
        </Rise>
      )}

      <Rise delay={0.12} className="flex flex-col gap-4">
        <SectionHeader label="More faucets" />
        <Board className="border-x border-t">
          <BoardHeader
            label="Limits"
            action={
              <span className={cn(COUNT, 'inline-flex items-center gap-1.5')}>
                <Clock className="h-3 w-3" />1 request per chain / 24h · Test tokens only
              </span>
            }
          />
          <FaucetLinkRow
            href="https://core.app/tools/testnet-faucet/"
            icon={Droplets}
            label="Core Faucet"
            hint="Fuji AVAX from the Core testnet faucet"
            external
          />
          <FaucetLinkRow
            href="/console/primary-network/devnet-faucet"
            icon={Server}
            label="Devnet Faucet"
            hint="Tokens for Avalanche devnets"
          />
        </Board>
      </Rise>
    </div>
  );
}

export default withConsoleToolMetadata(Faucet, metadata);
