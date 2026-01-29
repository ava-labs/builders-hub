"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { ChevronRight, Layers, Users, MessagesSquare, ArrowUpDown, Settings, Droplets, Sparkles } from "lucide-react";
import Link from "next/link";

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

function ConsoleDashboard() {
  const quickActions = [
    {
      title: "Create L1",
      description: "Launch a new Layer 1 blockchain",
      href: "/console/layer-1/create",
      icon: Layers,
    },
    {
      title: "Blueprints",
      description: "Pre-configured L1 templates",
      href: "/console/blueprints",
      icon: Sparkles,
      highlight: true,
    },
    {
      title: "Testnet Faucet",
      description: "Get test AVAX for development",
      href: "/console/primary-network/faucet",
      icon: Droplets,
    },
  ];

  const tools = [
    {
      category: "Primary Network",
      items: [
        { title: "Node Setup", href: "/console/primary-network/node-setup", icon: Settings },
        { title: "Stake AVAX", href: "/console/primary-network/stake", icon: Users },
        { title: "C/P Bridge", href: "/console/primary-network/c-p-bridge", icon: ArrowUpDown },
      ],
    },
    {
      category: "Your L1",
      items: [
        { title: "Validators", href: "/console/layer-1/validator-set", icon: Users },
        { title: "Tokenomics", href: "/console/l1-tokenomics/fee-manager", icon: Settings },
        { title: "Performance", href: "/console/layer-1/performance-monitor", icon: ChevronRight },
      ],
    },
    {
      category: "Cross-Chain",
      items: [
        { title: "ICM Setup", href: "/console/icm/setup", icon: MessagesSquare },
        { title: "Bridge Setup", href: "/console/ictt/setup", icon: ArrowUpDown },
        { title: "Token Transfer", href: "/console/ictt/token-transfer", icon: ArrowUpDown },
      ],
    },
  ];

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
    { name: "Hashfire", image: "https://images.ctfassets.net/gcj8jwzm6086/4TCWxdtzvtZ8iD4255nAgU/e4d12af0a594bcf38b53a27e6beb07a3/FlatIcon_Large_.png", link: "https://hashfire.io/" },
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

      <div className="relative max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Builder Console
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Create and manage Avalanche L1 blockchains
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                href={action.href}
                className={`group block p-5 rounded-xl border transition-all duration-200 hover:shadow-lg dark:hover:shadow-zinc-900/50 ${
                  action.highlight
                    ? "bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                  action.highlight
                    ? "bg-white/10 dark:bg-zinc-900/20"
                    : "bg-zinc-100 dark:bg-zinc-800"
                }`}>
                  <Icon className={`w-5 h-5 ${
                    action.highlight
                      ? "text-white dark:text-zinc-900"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`} />
                </div>
                <div className={`font-medium ${
                  action.highlight
                    ? "text-white dark:text-zinc-900"
                    : "text-zinc-900 dark:text-zinc-100"
                }`}>
                  {action.title}
                </div>
                <div className={`text-sm mt-0.5 ${
                  action.highlight
                    ? "text-zinc-300 dark:text-zinc-600"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}>
                  {action.description}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {tools.map((section) => (
            <div key={section.category}>
              <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                {section.category}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.title}
                      href={item.href}
                      className="group flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <Icon className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                        {item.title}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Ecosystem */}
        <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Built on Avalanche
            </h3>
            <a
              href="https://build.avax.network/stats/l1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              View all →
            </a>
          </div>
          <div className="flex flex-wrap gap-3">
            {ecosystemChains.map((chain) => (
              <a
                key={chain.name}
                href={chain.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
              >
                <img
                  src={chain.image}
                  alt={chain.name}
                  className="w-6 h-6 rounded-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {chain.name}
                </span>
              </a>
            ))}
          </div>
        </div>
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
