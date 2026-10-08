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
import { EcosystemMarquee } from '@/components/console/ecosystem-marquee';
import { AlphaSequence } from '@/components/console/alpha-sequence';
import { PromptComposer } from '@/components/studio/PromptComposer';

const ECOSYSTEM_CHAINS = [
  // Gaming
  {
    name: 'FIFA',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/27QiWdtdwCaIeFbYhA47KG/5b4245767fc39d68b566f215e06c8f3a/FIFA_logo.png',
    link: 'https://collect.fifa.com/',
  },
  {
    name: 'MapleStory',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/Uu31h98BapTCwbhHGBtFu/6b72f8e30337e4387338c82fa0e1f246/MSU_symbol.png',
    link: 'https://maplestoryuniverse.com/',
  },
  {
    name: 'Beam',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/2ZXZw0POSuXhwoGTiv2fzh/5b9d9e81acb434461da5addb1965f59d/chain-logo.png',
    link: 'https://onbeam.com/',
  },
  {
    name: 'DeFi Kingdoms',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/6ee8eu4VdSJNo93Rcw6hku/2c6c5691e8a7c3b68654e5a4f219b2a2/chain-logo.png',
    link: 'https://defikingdoms.com/',
  },
  {
    name: 'Gunzilla',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/3z2BVey3D1mak361p87Vu/ca7191fec2aa23dfa845da59d4544784/unnamed.png',
    link: 'https://gunzillagames.com/',
  },
  {
    name: 'PLAYA3ULL',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/27mn0a6a5DJeUxcJnZr7pb/8a28d743d65bf35dfbb2e63ba2af7f61/brandmark_-_square_-_Sam_Thompson.png',
    link: 'https://playa3ull.games/',
  },
  {
    name: 'Blitz',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/5ZhwQeXUwtVZPIRoWXhgrw/03d0ed1c133e59f69bcef52e27d1bdeb/image__2___2_.png',
    link: 'https://blitz.gg/',
  },
  {
    name: 'Shrapnel',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/3vru4toe9KAyUXpn5XQthq/714286de3f35ee92426853037e985f77/chain-logo.png',
    link: 'https://shrapnel.com/',
  },
  {
    name: 'PLYR',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/5K1xUbrhZPhSOEtsHoghux/b64edf007db24d8397613f7d9338260a/logomark_fullorange.svg',
    link: 'https://plyr.network/',
  },
  {
    name: 'Tiltyard',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/5iZkicfOvjuwJYQqqCQN4y/9bdb761652d929459610c8b2da862cd5/android-chrome-512x512.png',
    link: 'https://tiltyard.gg/',
  },
  {
    name: 'Artery',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/7plQHTCA1MePklfF2lDgaE/1f4d00bf534a1ae180b3ea1de76308c8/SLIR8rz7_400x400.jpg',
    link: 'https://studioartery.com/',
  },
  // DeFi & Finance
  {
    name: 'Dexalot',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/6tKCXL3AqxfxSUzXLGfN6r/be31715b87bc30c0e4d3da01a3d24e9a/dexalot-subnet.png',
    link: 'https://dexalot.com/',
  },
  {
    name: 'StraitsX',
    image: 'https://images.ctfassets.net/gcj8jwzm6086/3jGGJxIwb3GjfSEJFXkpj9/2ea8ab14f7280153905a29bb91b59ccb/icon.png',
    link: 'https://straitsx.com/',
  },
  {
    name: 'Blaze',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/6Whg7jeebEhQfwGAXEsGVh/ecbb11c6c54af7ff3766b58433580721/2025-04-10_16.28.46.jpg',
    link: 'https://blaze.stream/',
  },
  // Infrastructure & Enterprise
  {
    name: 'Lamina1',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/5KPky47nVRvtHKYV0rQy5X/e0d153df56fd1eac204f58ca5bc3e133/L1-YouTube-Avatar.png',
    link: 'https://lamina1.com/',
  },
  {
    name: 'UPTN',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/5jmuPVLmmUSDrfXxbIrWwo/4bdbe8d55b775b613156760205d19f9f/symbol_UPTN_-_js_won.png',
    link: 'https://uptn.io/',
  },
  {
    name: 'Innovo',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/5wd9o1kxI1nG0Kb2LrEooJ/9e14075a20dc67c4ba5ab0ca404192b8/1675173474597.png',
    link: 'https://innovomarkets.com/',
  },
  {
    name: 'Coqnet',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/1r0LuDAKrZv9jgKqaeEBN3/9a7efac3099b861366f9e776e6131617/Isotipo_coq.png',
    link: 'https://coq.fi/',
  },
  {
    name: 'Intersect',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/4mDZ5q3a5lxHJcBLTORuMr/b47935fa6007cb3430acabef7e13e9ca/explorer.png',
    link: 'https://intersect.io/',
  },
  {
    name: 'Watr',
    image: 'https://f005.backblazeb2.com/file/tracehawk-prod/logo/watr/Light.svg',
    link: 'https://watr.org/',
  },
  {
    name: 'Hashfire',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/4TCWxdtzvtZ8iD4255nAgU/e4d12af0a594bcf38b53a27e6beb07a3/FlatIcon_Large_.png',
    link: 'https://hashfire.xyz/',
  },
  {
    name: 'Space',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/27oUMNb9hSTA7HfFRnqUtZ/2f80e6b277f4b4ee971675b5f73c06bf/Space_Symbol_256X256__v2.svg',
    link: 'https://space.id/',
  },
  {
    name: 'Numi',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/411JTIUnbER3rI5dpOR54Y/3c0a8e47d58818a66edd868d6a03a135/numine_main_icon.png',
    link: 'https://numine.io/',
  },
  {
    name: 'Feature',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/2hWSbxXPv2QTPCtCaEp7Kp/522b520e7e5073f7e7459f9bd581bafa/FTR_LOGO_-_FLAT_BLACK.png',
    link: 'https://feature.io/',
  },
  {
    name: 'Kali Chain',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/r9EB5XcOIS39mZlXrFAsO/9bb66b54f61d0566588056782865aed2/logoKalichain.png',
    link: 'https://kalichain.com/',
  },
  {
    name: 'Orange',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/4jmmb8oMQwW5My8YYcEmAx/ee1f1cef8766cc934e9190c5c1c7fa21/Orange_Logo_Mark_Slightly_Padded.png',
    link: 'https://orangeweb3.com/',
  },
  {
    name: 'Zeroone',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/1lOFyhAJ0JkDkAmpeCznxL/9729fd9e4e75009f38a0e2c564259ead/icon-512.png',
    link: 'https://zeroone.art/',
  },
  {
    name: 'Titan',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/5m6pgoG1znzD3CA0HEh7D0/6850391f9ba90d9a97e37790b32f89ba/TITAN_mainnet_logo.png',
    link: 'https://www.avax.network/about/blog/titan-content-launches-2gathr-on-avalanche',
  },
  {
    name: 'Turf Network',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/2OGwSmo36iWhvmPfgUUnEb/0812275eac56a8d82907fb96d96002bc/with_green_background.png',
    link: 'https://turf.network/',
  },
  {
    name: 'Quboid',
    image:
      'https://images.ctfassets.net/gcj8jwzm6086/5jRNt6keCaCe0Z35ZQbwtL/94f81aa95f9d9229111693aa6a705437/Quboid_Logo.jpg',
    link: 'https://qubo.id/',
  },
];

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
        label="ICTT bridge"
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
      <h1 className="sr-only">Avalanche Builder Console</h1>

      <Rise className="flex flex-col gap-3">
        <SectionHeader
          label="Built on Avalanche"
          action={
            <Link
              href="/explorer/mainnet"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              View all
            </Link>
          }
        />
        <EcosystemMarquee chains={ECOSYSTEM_CHAINS} rows={2} />
      </Rise>

      <Rise
        delay={0.04}
        className="grid grid-cols-1 items-center gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)] md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]"
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className={EYEBROW}>Builder console</p>
            <p className="max-w-3xl text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-zinc-50">
              Launch an L1, connect it to Avalanche, and run what keeps it live.
            </p>
            <p className="max-w-2xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Every tool for the Primary Network and your own Layer 1s: validators, tokenomics, interop, nodes and
              monitoring, on Fuji first and then mainnet.
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
          beam="avalanche"
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
