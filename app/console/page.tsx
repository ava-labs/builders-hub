"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { ChevronRight, Layers, Users, MessagesSquare, ArrowUpDown, Settings, Droplets, Shield, Zap, Building2, Wrench } from "lucide-react";
import Link from "next/link";

function RedirectLogic() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (
      status === "authenticated" &&
      session.user.is_new_user &&
      pathname !== "/profile"
    ) {
      // Store the original URL with search params (including UTM) in localStorage
      const originalUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      if (typeof window !== "undefined") {
        localStorage.setItem("redirectAfterProfile", originalUrl);
      }
      router.replace("/profile");
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
  // Primary tier - Most important partnerships (larger display)
  const primaryNetworks = [
    {
      name: "FIFA Blockchain",
      image: "https://images.ctfassets.net/gcj8jwzm6086/27QiWdtdwCaIeFbYhA47KG/5b4245767fc39d68b566f215e06c8f3a/FIFA_logo.png",
      link: "https://collect.fifa.com/",
      type: "Gaming"
    },
    {
      name: "MapleStory Henesys",
      image: "https://images.ctfassets.net/gcj8jwzm6086/Uu31h98BapTCwbhHGBtFu/6b72f8e30337e4387338c82fa0e1f246/MSU_symbol.png",
      link: "https://nexon.com",
      type: "Gaming"
    },
    {
      name: "Dexalot Exchange",
      image: "https://images.ctfassets.net/gcj8jwzm6086/6tKCXL3AqxfxSUzXLGfN6r/be31715b87bc30c0e4d3da01a3d24e9a/dexalot-subnet.png",
      link: "https://dexalot.com/",
      type: "DeFi"
    },
    {
      name: "DeFi Kingdoms",
      image: "https://images.ctfassets.net/gcj8jwzm6086/6ee8eu4VdSJNo93Rcw6hku/2c6c5691e8a7c3b68654e5a4f219b2a2/chain-logo.png",
      link: "https://defikingdoms.com/",
      type: "Gaming"
    },
    {
      name: "Lamina1",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5KPky47nVRvtHKYV0rQy5X/e0d153df56fd1eac204f58ca5bc3e133/L1-YouTube-Avatar.png",
      link: "https://lamina1.com/",
      type: "Creative"
    },
    {
      name: "Green Dot Deloitte",
      image: "https://images.ctfassets.net/gcj8jwzm6086/zDgUqvR4J10suTQcNZ3dU/842b9f276bef338e68cb5d9f119cf387/green-dot.png",
      link: "https://www2.deloitte.com/us/en/pages/about-deloitte/solutions/future-forward-blockchain-alliances.html",
      type: "Enterprise"
    }
  ];

  // Secondary tier - Important but smaller display
  const secondaryNetworks = [
    {
      name: "Beam Gaming",
      image: "https://images.ctfassets.net/gcj8jwzm6086/2ZXZw0POSuXhwoGTiv2fzh/5b9d9e81acb434461da5addb1965f59d/chain-logo.png",
      link: "https://onbeam.com/",
      type: "Gaming"
    },
    {
      name: "KOROSHI Gaming",
      image: "https://images.ctfassets.net/gcj8jwzm6086/1cZxf8usDbuJng9iB3fkFd/1bc34bc28a2c825612eb697a4b72d29d/2025-03-30_07.28.32.jpg",
      link: "https://www.thekoroshi.com/",
      type: "Gaming"
    },
    {
      name: "Gunzilla Games",
      image: "https://images.ctfassets.net/gcj8jwzm6086/3z2BVey3D1mak361p87Vu/ca7191fec2aa23dfa845da59d4544784/unnamed.png",
      link: "https://gunzillagames.com/en/",
      type: "Gaming"
    },
    {
      name: "PLAYA3ULL Games",
      image: "https://images.ctfassets.net/gcj8jwzm6086/27mn0a6a5DJeUxcJnZr7pb/8a28d743d65bf35dfbb2e63ba2af7f61/brandmark_-_square_-_Sam_Thompson.png",
      link: "https://playa3ull.games/",
      type: "Gaming"
    },
    {
      name: "StraitsX",
      image: "https://images.ctfassets.net/gcj8jwzm6086/3jGGJxIwb3GjfSEJFXkpj9/2ea8ab14f7280153905a29bb91b59ccb/icon.png",
      link: "https://www.straitsx.com/",
      type: "DeFi"
    },
    {
      name: "CX Chain",
      image: "https://images.ctfassets.net/gcj8jwzm6086/3wVuWA4oz9iMadkIpywUMM/377249d5b8243e4dfa3a426a1af5eaa5/14.png",
      link: "https://node.cxchain.xyz/",
      type: "Gaming"
    }
  ];

  // Combine primary and secondary networks, limiting to 12 for display
  const ecosystemChains = [...primaryNetworks, ...secondaryNetworks].slice(0, 12);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to Builder Console</h2>
        <p className="text-muted-foreground">
          Manage your Avalanche L1s, validators, and deployments from one central location.
        </p>
      </div>

      {/* Call to Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* Primary Network Actions */}
        <Link href="/console/primary-network/node-setup" className="group block">
          <div className="p-6 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 cursor-pointer h-full">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-muted">
                <Settings className="w-5 h-5 text-muted-foreground" />
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Setup Primary Network Node</h3>
            <p className="text-sm text-muted-foreground mb-4">Configure and deploy your Avalanche Primary Network node infrastructure</p>
            <div className="text-xs text-muted-foreground font-medium">Get Started →</div>
          </div>
        </Link>

        {/* Layer 1 Creation */}
        <Link href="/console/layer-1/create" className="group block">
          <div className="p-6 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 cursor-pointer h-full">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-muted">
                <Layers className="w-5 h-5 text-muted-foreground" />
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Create New L1</h3>
            <p className="text-sm text-muted-foreground mb-4">Launch your custom Layer 1 blockchain with custom configurations</p>
            <div className="text-xs text-muted-foreground font-medium">Create L1 →</div>
          </div>
        </Link>

        {/* Validator Management */}
        <Link href="/console/permissioned-l1s/add-validator" className="group block">
          <div className="p-6 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 cursor-pointer h-full">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-muted">
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Manage Validators</h3>
            <p className="text-sm text-muted-foreground mb-4">Add, remove, and configure validators for your L1 networks</p>
            <div className="text-xs text-muted-foreground font-medium">Manage →</div>
          </div>
        </Link>

        {/* Interchain Messaging */}
        <Link href="/console/icm/setup" className="group block">
          <div className="p-6 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 cursor-pointer h-full">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-muted">
                <MessagesSquare className="w-5 h-5 text-muted-foreground" />
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Setup Cross-Chain Messaging</h3>
            <p className="text-sm text-muted-foreground mb-4">Enable communication between your L1s with Interchain Messaging</p>
            <div className="text-xs text-muted-foreground font-medium">Setup ICM →</div>
          </div>
        </Link>

        {/* Token Transfer */}
        <Link href="/console/ictt/setup" className="group block">
          <div className="p-6 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 cursor-pointer h-full">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-muted">
                <ArrowUpDown className="w-5 h-5 text-muted-foreground" />
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Bridge Setup</h3>
            <p className="text-sm text-muted-foreground mb-4">Configure token bridges for seamless cross-chain transfers</p>
            <div className="text-xs text-muted-foreground font-medium">Setup Bridge →</div>
          </div>
        </Link>

        {/* Testnet Faucet */}
        <Link href="/console/primary-network/faucet" className="group block">
          <div className="p-6 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 cursor-pointer h-full">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-muted">
                <Droplets className="w-5 h-5 text-muted-foreground" />
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Get Test Tokens</h3>
            <p className="text-sm text-muted-foreground mb-4">Access the testnet faucet to get AVAX for development and testing</p>
            <div className="text-xs text-muted-foreground font-medium">Get Tokens →</div>
          </div>
        </Link>
      </div>

      {/* Ecosystem Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
          Explore Avalanche L1s
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          {ecosystemChains.map((chain, index) => (
            <a
              key={index}
              href={chain.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-4 py-2.5 rounded-full bg-card border border-border hover:bg-accent hover:border-accent-foreground/20 transition-all duration-300 hover:scale-105"
              title={`${chain.name}${chain.type ? ` - ${chain.type}` : ''}`}
            >
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                <img 
                  src={chain.image} 
                  alt={chain.name}
                  className="w-full h-full object-contain filter dark:brightness-90 group-hover:scale-110 transition-transform duration-300 rounded-full"
                  onError={(e) => {
                    // Fallback to a placeholder if image fails to load
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = `<div class="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">${chain.name.substring(0, 2).toUpperCase()}</div>`;
                  }}
                />
              </div>
              <span className="text-sm font-medium text-foreground group-hover:text-accent-foreground transition-colors duration-200 whitespace-nowrap">
                {chain.name}
              </span>
            </a>
          ))}
        </div>
        <div className="text-center mt-6">
          <a
            href="https://subnets.avax.network/subnets/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            View all ecosystem projects
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
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
