'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpDown,
  Bell,
  Check,
  Copy,
  Droplets,
  ExternalLink,
  Layers,
  LayoutDashboard,
  Lock,
  MessagesSquare,
  Server,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Board, BoardHeader, Rise, SectionHeader } from '@/components/explorer-v2/ui';
import { AlphaSequence } from '@/components/console/alpha-sequence';
import { PromptComposer } from '@/components/studio/PromptComposer';

const EYEBROW = 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400';

/** A grid cell that is one door: eyebrow, title, one line, and the red arrow on hover. */
function Door({
  href,
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group/door flex min-h-40 flex-col gap-3 border-b border-r border-zinc-200 bg-white/80 p-5 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:bg-zinc-900"
    >
      <span className="flex items-center justify-between">
        <span className={EYEBROW}>{eyebrow}</span>
        <Icon className="h-4 w-4 text-zinc-400 transition-colors group-hover/door:text-zinc-900 dark:group-hover/door:text-zinc-100" />
      </span>
      <span className="mt-auto flex items-center gap-2 text-[16px] font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
        <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/door:translate-x-0 group-hover/door:opacity-100" />
      </span>
      <span className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</span>
    </Link>
  );
}

function LinkRow({ href, icon: Icon, label, hint }: { href: string; icon: LucideIcon; label: string; hint: string }) {
  return (
    <Link
      href={href}
      className="group/row flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">{label}</span>
        <span className="block truncate text-[12px] text-zinc-500 dark:text-zinc-400">{hint}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/row:translate-x-0 group-hover/row:opacity-100" />
    </Link>
  );
}

const INSTALL_CMD = 'curl -sSfL https://build.avax.network/install/platform-cli | sh';

function CliCopyBlock() {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);
  return (
    <button
      onClick={handleCopy}
      aria-label="Copy install command"
      className="group flex w-full cursor-pointer items-center gap-2.5 overflow-x-auto border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <span className="shrink-0 select-none font-mono text-xs text-zinc-400 dark:text-zinc-500">$</span>
      <code className="whitespace-nowrap text-left font-mono text-xs text-zinc-700 dark:text-zinc-200">
        curl -sSfL build.avax.network/install/platform-cli | sh
      </code>
      <span className="ml-auto shrink-0 p-1 text-zinc-400 transition-colors group-hover:text-zinc-700 dark:group-hover:text-zinc-200">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

function CrossChainBoard() {
  return (
    <Board>
      <BoardHeader label="Cross-chain" />
      <LinkRow
        href="/console/icm/setup"
        icon={MessagesSquare}
        label="ICM setup"
        hint="Teleporter messenger and registry"
      />
      <LinkRow
        href="/console/ictt/setup"
        icon={ArrowUpDown}
        label="ICTT setup"
        hint="Bridge tokens between Avalanche chains"
      />
      <LinkRow
        href="/console/testnet-infra/icm-relayer"
        icon={Server}
        label="ICM relayer"
        hint="Managed relayer for Fuji"
      />
    </Board>
  );
}

function ConsoleHome() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 pb-20 pt-2">
      <Rise
        delay={0.04}
        className="grid grid-cols-1 items-center gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)] md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]"
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className={EYEBROW}>Avalanche</p>
            <h1
              aria-label="Avalanche Builder Console"
              className="max-w-3xl text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-zinc-50"
            >
              Builder Console
            </h1>
            <p className="max-w-2xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Tools for the Primary Network and your own L1s. Start on Fuji, then go to mainnet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/console/create-l1"
              className="inline-flex h-9 items-center gap-2 border border-zinc-900 bg-zinc-900 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Create an L1 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/console/primary-network/faucet"
              className="inline-flex h-9 items-center gap-2 border border-zinc-300 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50"
            >
              Get test AVAX
            </Link>
          </div>
        </div>
        {/* The avax.network alpha sequence, beside the headline. */}
        <div aria-hidden className="pointer-events-none hidden aspect-square w-full sm:block">
          <AlphaSequence className="h-full w-full" />
        </div>
      </Rise>

      <Rise delay={0.06} className="flex flex-col gap-4">
        <SectionHeader label="Start" />
        <div className="grid grid-cols-1 border-l border-t border-zinc-200 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800">
          <Door
            href="/console/create-l1"
            icon={Layers}
            eyebrow="Layer 1"
            title="Create an L1"
            description="Launch a Layer 1 with its own validators, gas token and governance."
          />
          <Door
            href="/console/my-l1"
            icon={LayoutDashboard}
            eyebrow="Operate"
            title="My L1 dashboard"
            description="Validators, fees, nodes and interop for the L1s you run."
          />
          <Door
            href="/console/primary-network/faucet"
            icon={Droplets}
            eyebrow="Fuji"
            title="Testnet faucet"
            description="Test AVAX for the C-Chain and your testnet L1s."
          />
          <Door
            href="/console/primary-network/validator-alerts"
            icon={Bell}
            eyebrow="Monitor"
            title="Validator alerts"
            description="Uptime and expiry notifications for your validators."
          />
        </div>
      </Rise>

      <Rise delay={0.12} className="flex flex-col gap-4">
        <SectionHeader label="Operate" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Board>
            <BoardHeader label="Primary Network" />
            <LinkRow
              href="/console/primary-network/node-setup"
              icon={Settings}
              label="Node setup"
              hint="Run an AvalancheGo validator"
            />
            <LinkRow
              href="/console/primary-network/c-p-bridge"
              icon={ArrowUpDown}
              label="C/P bridge"
              hint="Move AVAX between C-Chain and P-Chain"
            />
            <LinkRow
              href="/console/primary-network/stake"
              icon={Users}
              label="Stake AVAX"
              hint="Validate or delegate on the Primary Network"
            />
          </Board>
          <Board>
            <BoardHeader label="Your L1" />
            <LinkRow
              href="/console/layer-1/validator-set"
              icon={Users}
              label="Validators"
              hint="Add, remove and reweight validators"
            />
            <LinkRow
              href="/console/l1-tokenomics/fee-manager"
              icon={Settings}
              label="Tokenomics"
              hint="Fees, rewards and native minting"
            />
            <LinkRow
              href="/console/testnet-infra/nodes"
              icon={Server}
              label="Testnet nodes"
              hint="Managed nodes for your testnet L1"
            />
            <LinkRow
              href="/console/layer-1/monitoring-setup"
              icon={LayoutDashboard}
              label="Monitoring"
              hint="Dashboards for your nodes"
            />
          </Board>
          <CrossChainBoard />
        </div>
      </Rise>

      <Rise delay={0.18} className="flex flex-col gap-4">
        <SectionHeader label="Tools" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Board>
            <BoardHeader
              label="Platform CLI"
              action={
                <a
                  href="https://github.com/ava-labs/platform-cli"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  GitHub <ExternalLink className="h-3 w-3" />
                </a>
              }
            />
            <div className="flex flex-col gap-3 px-5 py-4">
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                Manage L1s, validators and P-Chain operations from the terminal.
              </p>
              <CliCopyBlock />
            </div>
          </Board>
          <Board>
            <BoardHeader label="More" />
            <LinkRow
              href="/console/encrypted-erc/overview"
              icon={Lock}
              label="Encrypted ERC"
              hint="Private balances with an auditor key"
            />
            <LinkRow href="/console/toolbox" icon={Wrench} label="Toolbox" hint="Every console tool in one grid" />
            <LinkRow href="/audits" icon={ShieldCheck} label="Security audits" hint="Quotes from vetted audit firms" />
          </Board>
        </div>
      </Rise>

      {/* A scrim fades the page out behind the docked box so it reads on top of whatever scrolls under it. */}
      <div className="pointer-events-none sticky bottom-0 z-30 -mb-20 pb-20 pt-14">
        {/* A soft scroll edge centred on the 48px box, which sits 5rem off the bottom. Upward it is one masked
            blur. Downward it is stacked blur bands and a tint gradient: Chrome drops a masked backdrop blur
            in that strip, so the fade comes from bands that get shorter toward the bottom. */}
        <div
          aria-hidden
          className="absolute inset-x-0 -top-24 bottom-20 bg-white/60 backdrop-blur-[3px] [mask-image:linear-gradient(to_top,black,black_48px,transparent)] dark:bg-zinc-900/60"
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-white/60 to-transparent dark:from-zinc-900/60">
          <div className="absolute inset-x-0 top-0 h-full backdrop-blur-[1px]" />
          <div className="absolute inset-x-0 top-0 h-2/3 backdrop-blur-[1px]" />
          <div className="absolute inset-x-0 top-0 h-1/3 backdrop-blur-[1px]" />
        </div>
        <PromptComposer
          compact
          beam="colorful"
          className="pointer-events-auto relative mx-auto w-3/4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)]"
        />
      </div>
    </div>
  );
}

export default function ConsolePage() {
  return (
    <>
      <ConsoleHome />
    </>
  );
}
