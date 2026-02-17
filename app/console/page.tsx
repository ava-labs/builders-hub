"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import {
  ChevronRight,
  Layers,
  Sparkles,
  BookKey,
  LayoutDashboard,
  ArrowLeftRight,
  Network,
  Users,
  Settings,
  MessagesSquare,
  ArrowUpDown,
  Terminal,
  Copy,
  Check,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { EcosystemMarquee } from "@/components/console/ecosystem-marquee";

function RedirectLogic() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Note: PostHog tracking is handled by the layout's TrackNewUser component
    // This component only handles the redirect logic to avoid duplicate tracking
    //
    // IMPORTANT: Don't redirect if user is a "pending" user (hasn't accepted terms yet)
    // The LoginModalWrapper will handle showing Terms and BasicProfile modals
    // Only redirect after they've completed the full registration flow
    if (status === "authenticated" && session?.user?.is_new_user) {
      // Check if this is a pending user who hasn't accepted terms yet
      const isPendingUser = session.user.id?.startsWith("pending_");
      if (isPendingUser) {
        // Let LoginModalWrapper handle the Terms/BasicProfile flow
        // Don't redirect - the modals will appear
        return;
      }

      // Redirect existing new users (who have accepted terms but notifications is null) to profile page
      if (pathname !== "/profile") {
        // Store the original URL with search params (including UTM) in localStorage
        const originalUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
        if (typeof window !== "undefined") {
          localStorage.setItem("redirectAfterProfile", originalUrl);
        }
        router.replace("/profile");
      }
    }
  }, [session, status, pathname, router, searchParams]);

  return null;
}

function RedirectIfNewUser() {
  return (
    <Suspense fallback={null}>
      <RedirectLogic />
    </Suspense>
  );
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 200, damping: 20 },
  },
};

function BentoCard({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div variants={itemVariants}>
      <Link href={href} className="block h-full">
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}
          className={`group relative h-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-5 transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-700 ${className}`}
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)" }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)"; }}
        >
          {children}
        </motion.div>
      </Link>
    </motion.div>
  );
}

function SubLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 text-sm rounded-md px-2 py-1.5 -mx-2 transition-colors text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-700 dark:hover:text-zinc-200"
      onClick={(e) => e.stopPropagation()}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </Link>
  );
}

const INSTALL_CMD = "curl -sSfL https://raw.githubusercontent.com/ava-labs/platform-cli/main/install.sh | sh";

function CliInstallSnippet() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div
      className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-5"
      style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Terminal className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
        <h3 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">Install the P-Chain CLI</h3>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2.5 overflow-hidden">
        <span className="text-xs text-zinc-400 dark:text-zinc-500 select-none">$</span>
        <code className="text-sm font-mono truncate flex-1">
          <span className="text-emerald-600 dark:text-emerald-400">curl</span>
          <span className="text-zinc-500 dark:text-zinc-400"> -sSfL </span>
          <span className="text-sky-600 dark:text-sky-400">https://raw.githubusercontent.com/ava-labs/platform-cli/main/install.sh</span>
          <span className="text-zinc-500 dark:text-zinc-400"> | </span>
          <span className="text-amber-600 dark:text-amber-400">sh</span>
        </code>
        <button
          onClick={handleCopy}
          className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors shrink-0"
          aria-label="Copy install command"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function ConsoleDashboard() {
  const ecosystemChains = [
    // Gaming
    { name: "FIFA", image: "https://images.ctfassets.net/gcj8jwzm6086/27QiWdtdwCaIeFbYhA47KG/5b4245767fc39d68b566f215e06c8f3a/FIFA_logo.png", link: "https://collect.fifa.com/" },
    { name: "MapleStory", image: "https://images.ctfassets.net/gcj8jwzm6086/Uu31h98BapTCwbhHGBtFu/6b72f8e30337e4387338c82fa0e1f246/MSU_symbol.png", link: "https://maplestoryuniverse.com/" },
    { name: "Beam", image: "https://images.ctfassets.net/gcj8jwzm6086/2ZXZw0POSuXhwoGTiv2fzh/5b9d9e81acb434461da5addb1965f59d/chain-logo.png", link: "https://onbeam.com/" },
    { name: "DeFi Kingdoms", image: "https://images.ctfassets.net/gcj8jwzm6086/6ee8eu4VdSJNo93Rcw6hku/2c6c5691e8a7c3b68654e5a4f219b2a2/chain-logo.png", link: "https://defikingdoms.com/" },
    { name: "Gunzilla", image: "https://images.ctfassets.net/gcj8jwzm6086/3z2BVey3D1mak361p87Vu/ca7191fec2aa23dfa845da59d4544784/unnamed.png", link: "https://gunzillagames.com/" },
    { name: "PLAYA3ULL", image: "https://images.ctfassets.net/gcj8jwzm6086/27mn0a6a5DJeUxcJnZr7pb/8a28d743d65bf35dfbb2e63ba2af7f61/brandmark_-_square_-_Sam_Thompson.png", link: "https://playa3ull.games/" },
    { name: "Blitz", image: "https://images.ctfassets.net/gcj8jwzm6086/5ZhwQeXUwtVZPIRoWXhgrw/03d0ed1c133e59f69bcef52e27d1bdeb/image__2___2_.png", link: "https://blitz.gg/" },
    // DeFi
    { name: "Dexalot", image: "https://images.ctfassets.net/gcj8jwzm6086/6tKCXL3AqxfxSUzXLGfN6r/be31715b87bc30c0e4d3da01a3d24e9a/dexalot-subnet.png", link: "https://dexalot.com/" },
    { name: "StraitsX", image: "https://images.ctfassets.net/gcj8jwzm6086/3jGGJxIwb3GjfSEJFXkpj9/2ea8ab14f7280153905a29bb91b59ccb/icon.png", link: "https://straitsx.com/" },
    // Infrastructure & Enterprise
    { name: "Lamina1", image: "https://images.ctfassets.net/gcj8jwzm6086/5KPky47nVRvtHKYV0rQy5X/e0d153df56fd1eac204f58ca5bc3e133/L1-YouTube-Avatar.png", link: "https://lamina1.com/" },
    { name: "UPTN", image: "https://images.ctfassets.net/gcj8jwzm6086/5jmuPVLmmUSDrfXxbIrWwo/4bdbe8d55b775b613156760205d19f9f/symbol_UPTN_-_js_won.png", link: "https://uptn.io/" },
    { name: "Dispatch", image: "https://images.ctfassets.net/gcj8jwzm6086/60XrKdf99PqQKrHiuYdwTE/908622f5204311dbb11be9c6008ead44/Dispatch_Subnet_Logo.png", link: "https://dispatch.network/" },
    { name: "Coqnet", image: "https://images.ctfassets.net/gcj8jwzm6086/1r0LuDAKrZv9jgKqaeEBN3/9a7efac3099b861366f9e776e6131617/Isotipo_coq.png", link: "https://coq.fi/" },
    { name: "Intersect", image: "https://images.ctfassets.net/gcj8jwzm6086/4mDZ5q3a5lxHJcBLTORuMr/b47935fa6007cb3430acabef7e13e9ca/explorer.png", link: "https://intersect.io/" },
    { name: "Watr", image: "https://images.ctfassets.net/gcj8jwzm6086/6fYsX43BQpMUkKsxwOXAB8/b5fe68097302d624723567b46b045561/watr.png", link: "https://watr.org/" },
    { name: "PLYR", image: "https://images.ctfassets.net/gcj8jwzm6086/5K1xUbrhZPhSOEtsHoghux/b64edf007db24d8397613f7d9338260a/logomark_fullorange.svg", link: "https://plyr.network/" },
    { name: "Hashfire", image: "https://images.ctfassets.net/gcj8jwzm6086/4TCWxdtzvtZ8iD4255nAgU/e4d12af0a594bcf38b53a27e6beb07a3/FlatIcon_Large_.png", link: "https://hashfire.xyz/" },
    { name: "Space", image: "https://images.ctfassets.net/gcj8jwzm6086/27oUMNb9hSTA7HfFRnqUtZ/2f80e6b277f4b4ee971675b5f73c06bf/Space_Symbol_256X256__v2.svg", link: "https://space.id/" },
    { name: "Numi", image: "https://images.ctfassets.net/gcj8jwzm6086/411JTIUnbER3rI5dpOR54Y/3c0a8e47d58818a66edd868d6a03a135/numine_main_icon.png", link: "https://numine.io/" },
  ];

  return (
    <div className="relative -m-8 p-8 min-h-full">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.4] dark:opacity-[0.15]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(148 163 184 / 0.3) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(148 163 184 / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative max-w-6xl mx-auto">
        {/* Hero */}
        <div className="mb-10 pt-2">
          <motion.h1
            className="text-4xl md:text-5xl font-bold tracking-tight"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-zinc-900 dark:text-zinc-100">Builder</span>{" "}
            <span className="text-zinc-400 dark:text-zinc-500">Console</span>
          </motion.h1>
          <motion.p
            className="mt-3 text-zinc-500 dark:text-zinc-400 text-base md:text-lg max-w-lg"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
          >
            Create and manage Avalanche infrastructure
          </motion.p>
        </div>

        {/* Ecosystem Marquee */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
              Built on Avalanche
            </h3>
            <a
              href="https://build.avax.network/stats/l1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              View all →
            </a>
          </div>
          <EcosystemMarquee chains={ecosystemChains} />
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-12"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Row 1: Create L1 (span-4) + Blueprints (span-2) */}
          <motion.div className="md:col-span-4" variants={itemVariants}>
            <Link href="/console/layer-1/create" className="block h-full">
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}
                className="group h-full min-h-[200px] rounded-2xl border border-zinc-800 dark:border-zinc-800 bg-zinc-900 dark:bg-zinc-900 p-6 transition-all duration-200 hover:border-zinc-700 dark:hover:border-zinc-700"
                style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.2), 0 16px 40px rgba(0,0,0,0.15)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)"; }}
              >
                <div className="flex items-start justify-between h-full">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-white/[0.08] flex items-center justify-center mb-4 transition-colors group-hover:bg-white/[0.14]">
                      <Layers className="w-5 h-5 text-zinc-300 transition-colors group-hover:text-white" />
                    </div>
                    <h2 className="text-xl font-semibold text-white dark:text-white mb-1.5">
                      Create L1
                    </h2>
                    <p className="text-zinc-400 dark:text-zinc-400 text-sm max-w-sm leading-relaxed">
                      Launch a new Layer 1 blockchain with custom validators, tokenomics, and governance
                    </p>

                  </div>
                  <div className="flex items-center self-center ml-4">
                    <ChevronRight className="w-5 h-5 text-zinc-600 transition-all duration-200 group-hover:text-zinc-400 group-hover:translate-x-1" />
                  </div>
                </div>
              </motion.div>
            </Link>
          </motion.div>

          <motion.div className="md:col-span-2" variants={itemVariants}>
            <Link href="/console/blueprints" className="block h-full">
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}
                className="group h-full min-h-[200px] rounded-2xl border border-zinc-200/80 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-6 transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)"; }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center transition-colors group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80">
                    <Sparkles className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                    New
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
                  Blueprints
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                  Pre-configured L1 templates for gaming, DeFi, and enterprise
                </p>
              </motion.div>
            </Link>
          </motion.div>

          {/* CLI Install */}
          <motion.div className="md:col-span-6" variants={itemVariants}>
            <CliInstallSnippet />
          </motion.div>

          {/* Row 2: Faucet (3) + API Keys (3) */}
          <div className="md:col-span-3">
            <BentoCard href="/console/primary-network/faucet">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 transition-colors group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80">
                <img
                  src="/images/avax.png"
                  alt="AVAX"
                  className="w-4 h-4 opacity-50 dark:opacity-40 grayscale group-hover:opacity-70 dark:group-hover:opacity-60 transition-opacity"
                />
              </div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-0.5">Testnet Faucet</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Get test AVAX for development</p>
            </BentoCard>
          </div>

          <div className="md:col-span-3">
            <BentoCard href="/console/utilities/data-api-keys">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 transition-colors group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80">
                <BookKey className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-0.5">Data API Keys</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage your API access keys</p>
            </BentoCard>
          </div>

          {/* Row 3: Primary Network (2) + Your L1 (2) + Cross-Chain (2) */}
          <div className="md:col-span-2">
            <BentoCard href="/console/primary-network/node-setup">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 transition-colors group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80">
                <Network className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Primary Network</h3>
              <div className="space-y-0.5 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <SubLink href="/console/primary-network/node-setup" icon={Settings} label="Node Setup" />
                <SubLink href="/console/primary-network/stake" icon={Users} label="Stake AVAX" />
                <SubLink href="/console/primary-network/c-p-bridge" icon={ArrowUpDown} label="C/P Bridge" />
              </div>
            </BentoCard>
          </div>

          <div className="md:col-span-2">
            <BentoCard href="/console/layer-1/validator-set">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 transition-colors group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80">
                <LayoutDashboard className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Your L1</h3>
              <div className="space-y-0.5 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <SubLink href="/console/layer-1/validator-set" icon={Users} label="Validators" />
                <SubLink href="/console/l1-tokenomics/fee-manager" icon={Settings} label="Tokenomics" />
                <SubLink href="/console/layer-1/performance-monitor" icon={ChevronRight} label="Performance" />
              </div>
            </BentoCard>
          </div>

          <div className="md:col-span-2">
            <BentoCard href="/console/icm/setup">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 transition-colors group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80">
                <ArrowLeftRight className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Cross-Chain</h3>
              <div className="space-y-0.5 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <SubLink href="/console/icm/setup" icon={MessagesSquare} label="ICM Setup" />
                <SubLink href="/console/ictt/setup" icon={ArrowUpDown} label="ICTT Bridge" />
                <SubLink href="/console/ictt/token-transfer" icon={ArrowUpDown} label="Token Transfer" />
              </div>
            </BentoCard>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

export default function ConsolePage() {
  return (
    <>
      <RedirectIfNewUser />
      <ConsoleDashboard />
    </>
  );
}
