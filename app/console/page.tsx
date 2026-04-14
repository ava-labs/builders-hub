"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import {
  ChevronRight,
  Bell,
  Users,
  Settings,
  MessagesSquare,
  ArrowUpDown,
  Terminal,
  Copy,
  Check,
  ExternalLink,
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
  pulseDelay,
  children,
}: {
  href: string;
  className?: string;
  pulseDelay?: number;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <motion.div variants={itemVariants}>
      <div
        onClick={() => router.push(href)}
        className="block h-full cursor-pointer"
        role="link"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push(href); }}
      >
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}
          className={`group relative h-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-4 transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-700 ${className}`}
          style={{
            boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)",
            ...(pulseDelay !== undefined && {
              outline: "2px solid transparent",
              animation: `cardPulse 1.0s ease-in-out ${pulseDelay}s 1`,
            }),
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)"; }}
        >
          {children}
        </motion.div>
      </div>
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

function CrossChainCard() {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push("/console/icm/setup")}
      className="block h-full cursor-pointer"
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push("/console/icm/setup"); }}
    >
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}
        className="group relative h-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-5 overflow-hidden transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg"
      >
        {/* AVAX mark — exact geometry from partner portal */}
        <div className="absolute right-4 top-4 bottom-4 w-[50%] pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            {/* Slash left edge */}
            <circle cx="9.6" cy="86" r="1.2" className="fill-red-400/30 dark:fill-red-400/25" />
            <circle cx="14.1" cy="77" r="1" className="fill-zinc-400/40 dark:fill-zinc-500/40" />
            <circle cx="18.6" cy="68" r="1.3" className="fill-blue-400/30 dark:fill-blue-400/25" />
            <circle cx="23.2" cy="59" r="0.9" className="fill-zinc-400/35 dark:fill-zinc-500/35" />
            <circle cx="27.8" cy="50" r="1.2" className="fill-emerald-400/28 dark:fill-emerald-400/22" />
            <circle cx="32.3" cy="41" r="1.1" className="fill-zinc-400/50 dark:fill-zinc-500/50" />
            <circle cx="36.8" cy="32" r="1" className="fill-violet-400/28 dark:fill-violet-400/22" />
            <circle cx="41.4" cy="23" r="1.3" className="fill-zinc-400/55 dark:fill-zinc-500/55" />
            <circle cx="46" cy="14" r="0.9" className="fill-orange-400/25 dark:fill-orange-400/20" />
            {/* Slash top edge */}
            <circle cx="54.7" cy="12.4" r="1.2" className="fill-zinc-400/50 dark:fill-zinc-500/50" />
            <circle cx="59" cy="19.8" r="1" className="fill-sky-400/25 dark:fill-sky-400/20" />
            <circle cx="63.2" cy="27.1" r="1.3" className="fill-zinc-400/55 dark:fill-zinc-500/55" />
            {/* Slash right edge */}
            <circle cx="63.8" cy="42.1" r="1.2" className="fill-rose-400/28 dark:fill-rose-400/22" />
            <circle cx="60.2" cy="49.6" r="1" className="fill-zinc-400/40 dark:fill-zinc-500/40" />
            <circle cx="56.6" cy="57.2" r="1.3" className="fill-zinc-400/55 dark:fill-zinc-500/55" />
            <circle cx="53.1" cy="64.8" r="0.9" className="fill-teal-400/22 dark:fill-teal-400/16" />
            <circle cx="49.5" cy="72.3" r="1.2" className="fill-zinc-400/45 dark:fill-zinc-500/45" />
            <circle cx="45.9" cy="79.9" r="1.1" className="fill-amber-400/28 dark:fill-amber-400/22" />
            <circle cx="42.3" cy="87.4" r="1" className="fill-zinc-400/40 dark:fill-zinc-500/40" />
            {/* Slash base */}
            <circle cx="32" cy="95" r="1.2" className="fill-indigo-400/28 dark:fill-indigo-400/22" />
            <circle cx="25.2" cy="95" r="1" className="fill-zinc-400/40 dark:fill-zinc-500/40" />
            <circle cx="18.5" cy="95" r="1.3" className="fill-zinc-400/55 dark:fill-zinc-500/55" />
            <circle cx="11.7" cy="95" r="0.9" className="fill-pink-400/22 dark:fill-pink-400/16" />
            {/* Slash corners */}
            <circle cx="5" cy="95" r="1.5" className="fill-red-500/35 dark:fill-red-400/25" />
            <circle cx="50.5" cy="5" r="1.5" className="fill-blue-500/35 dark:fill-blue-400/25" />
            <circle cx="67.4" cy="34.5" r="1.5" className="fill-emerald-500/32 dark:fill-emerald-400/25" />
            <circle cx="38.7" cy="95" r="1.5" className="fill-violet-500/32 dark:fill-violet-400/25" />
            {/* Slash interior */}
            <circle cx="45.8" cy="78.4" r="0.8" className="fill-zinc-400/22 dark:fill-zinc-500/22" />
            <circle cx="45.5" cy="40.9" r="0.6" className="fill-zinc-400/25 dark:fill-zinc-500/25" />
            <circle cx="47.9" cy="69.5" r="1" className="fill-zinc-400/22 dark:fill-zinc-500/22" />
            <circle cx="45.2" cy="32.8" r="0.7" className="fill-zinc-400/20 dark:fill-zinc-500/20" />
            <circle cx="44" cy="27.4" r="0.8" className="fill-zinc-400/20 dark:fill-zinc-500/20" />
            <circle cx="48.2" cy="59.3" r="0.7" className="fill-zinc-400/18 dark:fill-zinc-500/18" />
            <circle cx="61.6" cy="46.2" r="0.7" className="fill-zinc-400/25 dark:fill-zinc-500/25" />
            <circle cx="31.7" cy="85.6" r="0.9" className="fill-zinc-400/25 dark:fill-zinc-500/25" />
            <circle cx="30" cy="89.4" r="0.8" className="fill-zinc-400/25 dark:fill-zinc-500/25" />
            <circle cx="51.2" cy="32" r="0.8" className="fill-zinc-400/18 dark:fill-zinc-500/18" />
            <circle cx="42.9" cy="66.9" r="1.1" className="fill-zinc-400/18 dark:fill-zinc-500/18" />
            <circle cx="41.8" cy="61.6" r="0.9" className="fill-zinc-400/15 dark:fill-zinc-500/15" />
            <circle cx="29.8" cy="86.6" r="1" className="fill-zinc-400/15 dark:fill-zinc-500/15" />
            <circle cx="16.3" cy="92.2" r="0.7" className="fill-zinc-400/18 dark:fill-zinc-500/18" />
            <circle cx="48" cy="49.7" r="1" className="fill-zinc-400/20 dark:fill-zinc-500/20" />
            <circle cx="56.4" cy="32.4" r="0.9" className="fill-zinc-400/20 dark:fill-zinc-500/20" />

            {/* Triangle left edge */}
            <circle cx="70.6" cy="54.8" r="1.2" className="fill-zinc-400/50 dark:fill-zinc-500/50" />
            <circle cx="67.1" cy="62.8" r="1" className="fill-cyan-400/25 dark:fill-cyan-400/20" />
            <circle cx="63.6" cy="70.8" r="1.3" className="fill-zinc-400/55 dark:fill-zinc-500/55" />
            <circle cx="60.2" cy="78.9" r="0.9" className="fill-purple-400/22 dark:fill-purple-400/16" />
            <circle cx="56.7" cy="87" r="1.2" className="fill-zinc-400/45 dark:fill-zinc-500/45" />
            {/* Triangle right edge */}
            <circle cx="77.6" cy="54.8" r="1.2" className="fill-orange-400/28 dark:fill-orange-400/22" />
            <circle cx="81.1" cy="62.8" r="1" className="fill-zinc-400/40 dark:fill-zinc-500/40" />
            <circle cx="84.5" cy="70.8" r="1.3" className="fill-lime-400/28 dark:fill-lime-400/22" />
            <circle cx="88" cy="78.9" r="0.9" className="fill-zinc-400/35 dark:fill-zinc-500/35" />
            <circle cx="91.5" cy="87" r="1.2" className="fill-blue-400/28 dark:fill-blue-400/22" />
            {/* Triangle base */}
            <circle cx="59.2" cy="95" r="1.2" className="fill-zinc-400/50 dark:fill-zinc-500/50" />
            <circle cx="65.1" cy="95" r="1" className="fill-rose-400/25 dark:fill-rose-400/20" />
            <circle cx="71.1" cy="95" r="1.3" className="fill-zinc-400/55 dark:fill-zinc-500/55" />
            <circle cx="77.1" cy="95" r="0.9" className="fill-emerald-400/22 dark:fill-emerald-400/25" />
            <circle cx="83.1" cy="95" r="1.2" className="fill-zinc-400/45 dark:fill-zinc-500/45" />
            <circle cx="89" cy="95" r="1.1" className="fill-sky-400/28 dark:fill-sky-400/22" />
            {/* Triangle corners */}
            <circle cx="74.1" cy="46.7" r="1.4" className="fill-red-500/32 dark:fill-red-400/25" />
            <circle cx="53.2" cy="95" r="1.4" className="fill-amber-500/32 dark:fill-amber-400/25" />
            <circle cx="95" cy="95" r="1.4" className="fill-indigo-500/32 dark:fill-indigo-400/25" />
            {/* Triangle interior */}
            <circle cx="60.8" cy="77.4" r="0.7" className="fill-zinc-400/20 dark:fill-zinc-500/20" />
            <circle cx="78.5" cy="77.1" r="0.8" className="fill-zinc-400/12 dark:fill-zinc-500/12" />
            <circle cx="77" cy="59.6" r="0.8" className="fill-zinc-400/12 dark:fill-zinc-500/12" />
            <circle cx="71.3" cy="78" r="0.8" className="fill-zinc-400/18 dark:fill-zinc-500/18" />
            <circle cx="60.9" cy="86.7" r="0.9" className="fill-zinc-400/18 dark:fill-zinc-500/18" />
            <circle cx="75.7" cy="87.1" r="0.6" className="fill-zinc-400/20 dark:fill-zinc-500/20" />
            <circle cx="72.6" cy="73.6" r="1" className="fill-zinc-400/18 dark:fill-zinc-500/18" />
            <circle cx="82.4" cy="87.4" r="1" className="fill-zinc-400/15 dark:fill-zinc-500/15" />
            <circle cx="68" cy="68" r="0.7" className="fill-zinc-400/15 dark:fill-zinc-500/15" />
            <circle cx="84" cy="92" r="0.6" className="fill-zinc-400/12 dark:fill-zinc-500/12" />

            {/* Edge — up the slash (pulsing radius = "important" message) */}
            <circle r="1.4" opacity="0" className="fill-red-500/70 dark:fill-red-400/60">
              <animateMotion dur="3s" repeatCount="indefinite" path="M5,95 L50.5,5" />
              <animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.06;0.88;1" dur="3s" repeatCount="indefinite" />
              <animate attributeName="r" values="1.4;1.8;1.4" dur="0.7s" repeatCount="indefinite" />
            </circle>
            {/* Cross — TL to Peak (request) */}
            <circle r="1.2" opacity="0" className="fill-blue-500/70 dark:fill-blue-400/60">
              <animateMotion dur="2s" repeatCount="indefinite" path="M50.5,5 Q55,35 74.1,46.7" begin="0.6s" />
              <animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.1;0.88;1" dur="2s" repeatCount="indefinite" begin="0.6s" />
            </circle>
            {/* Cross — Peak to TL (response) */}
            <circle r="1.0" opacity="0" className="fill-indigo-500/60 dark:fill-indigo-400/50">
              <animateMotion dur="2.2s" repeatCount="indefinite" path="M74.1,46.7 Q68,18 50.5,5" begin="1.8s" />
              <animate attributeName="opacity" values="0;0.8;0.8;0" keyTimes="0;0.1;0.88;1" dur="2.2s" repeatCount="indefinite" begin="1.8s" />
            </circle>
            {/* Cross — TR to TriBL (dramatic rightward sweep) */}
            <circle r="1.1" opacity="0" className="fill-amber-500/65 dark:fill-amber-400/55">
              <animateMotion dur="2.8s" repeatCount="indefinite" path="M67.4,34.5 Q82,68 53.2,95" begin="0.2s" />
              <animate attributeName="opacity" values="0;0.85;0.85;0" keyTimes="0;0.06;0.88;1" dur="2.8s" repeatCount="indefinite" begin="0.2s" />
            </circle>
            {/* Cross — interior diagonal (slash mid to triangle mid) */}
            <circle r="1.1" opacity="0" className="fill-violet-500/65 dark:fill-violet-400/55">
              <animateMotion dur="2.4s" repeatCount="indefinite" path="M45,41 Q63,42 72,74" begin="1.4s" />
              <animate attributeName="opacity" values="0;0.85;0.85;0" keyTimes="0;0.1;0.88;1" dur="2.4s" repeatCount="indefinite" begin="1.4s" />
            </circle>
            {/* Cross — base to peak (long arc, pulsing = relay message) */}
            <circle r="1.2" opacity="0" className="fill-cyan-500/65 dark:fill-cyan-400/55">
              <animateMotion dur="3.2s" repeatCount="indefinite" path="M38.7,95 Q38,52 74.1,46.7" begin="2.6s" />
              <animate attributeName="opacity" values="0;0.85;0.85;0" keyTimes="0;0.06;0.88;1" dur="3.2s" repeatCount="indefinite" begin="2.6s" />
              <animate attributeName="r" values="1.2;1.5;1.2" dur="0.9s" repeatCount="indefinite" />
            </circle>
            {/* Edge — down the triangle right side */}
            <circle r="1.1" opacity="0" className="fill-emerald-500/65 dark:fill-emerald-400/55">
              <animateMotion dur="2s" repeatCount="indefinite" path="M74.1,46.7 L95,95" begin="3.4s" />
              <animate attributeName="opacity" values="0;0.85;0.85;0" keyTimes="0;0.1;0.88;1" dur="2s" repeatCount="indefinite" begin="3.4s" />
            </circle>
            {/* Cross — triangle interior back to slash (return path) */}
            <circle r="0.9" opacity="0" className="fill-rose-500/60 dark:fill-rose-400/50">
              <animateMotion dur="2.2s" repeatCount="indefinite" path="M80,80 Q62,82 38.7,95" begin="4.4s" />
              <animate attributeName="opacity" values="0;0.8;0.8;0" keyTimes="0;0.1;0.88;1" dur="2.2s" repeatCount="indefinite" begin="4.4s" />
            </circle>
          </svg>
        </div>

        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 overflow-hidden transition-colors group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80">
            <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400 arrows-zip overflow-visible" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <g className="arrow-zip-left">
                <path d="M8 3 4 7 8 11"/>
                <path d="M4 7h16"/>
              </g>
              <g className="arrow-zip-right">
                <path d="M16 21l4-4-4-4"/>
                <path d="M20 17H4"/>
              </g>
            </svg>
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Cross-Chain</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">ICM & ICTT bridges</p>
          <div className="space-y-1">
            <SubLink href="/console/icm/setup" icon={MessagesSquare} label="ICM Setup" />
            <SubLink href="/console/ictt/setup" icon={ArrowUpDown} label="ICTT Bridge" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const INSTALL_CMD = "curl -sSfL https://build.avax.network/install/platform-cli | sh";

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
      className="w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-3 flex items-center gap-2.5 overflow-x-auto cursor-pointer transition-colors duration-200 hover:border-zinc-300 dark:hover:border-zinc-600"
    >
      <span className="text-xs text-zinc-400 dark:text-zinc-500 select-none font-mono shrink-0">$</span>
      <code className="text-xs font-mono whitespace-nowrap text-zinc-600 dark:text-zinc-300">
        curl -sSfL build.avax.network/install/platform-cli | sh
      </code>
      <span className="ml-auto p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors shrink-0">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </span>
    </button>
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
    { name: "Shrapnel", image: "https://images.ctfassets.net/gcj8jwzm6086/3vru4toe9KAyUXpn5XQthq/714286de3f35ee92426853037e985f77/chain-logo.png", link: "https://shrapnel.com/" },
    { name: "PLYR", image: "https://images.ctfassets.net/gcj8jwzm6086/5K1xUbrhZPhSOEtsHoghux/b64edf007db24d8397613f7d9338260a/logomark_fullorange.svg", link: "https://plyr.network/" },
    { name: "Tiltyard", image: "https://images.ctfassets.net/gcj8jwzm6086/5iZkicfOvjuwJYQqqCQN4y/9bdb761652d929459610c8b2da862cd5/android-chrome-512x512.png", link: "https://tiltyard.gg/" },
    { name: "Artery", image: "https://images.ctfassets.net/gcj8jwzm6086/7plQHTCA1MePklfF2lDgaE/1f4d00bf534a1ae180b3ea1de76308c8/SLIR8rz7_400x400.jpg", link: "https://studioartery.com/" },
    { name: "Hatchyverse", image: "https://dashboard-assets.dappradar.com/document/8825/hatchyverse-project-games-8825-logo_aaafc4cafbea89ae57991f888d963abb.png", link: "https://hatchyverse.com/" },
    // DeFi & Finance
    { name: "Dexalot", image: "https://images.ctfassets.net/gcj8jwzm6086/6tKCXL3AqxfxSUzXLGfN6r/be31715b87bc30c0e4d3da01a3d24e9a/dexalot-subnet.png", link: "https://dexalot.com/" },
    { name: "StraitsX", image: "https://images.ctfassets.net/gcj8jwzm6086/3jGGJxIwb3GjfSEJFXkpj9/2ea8ab14f7280153905a29bb91b59ccb/icon.png", link: "https://straitsx.com/" },
    { name: "Blaze", image: "https://images.ctfassets.net/gcj8jwzm6086/6Whg7jeebEhQfwGAXEsGVh/ecbb11c6c54af7ff3766b58433580721/2025-04-10_16.28.46.jpg", link: "https://blaze.stream/" },
    // Infrastructure & Enterprise
    { name: "Lamina1", image: "https://images.ctfassets.net/gcj8jwzm6086/5KPky47nVRvtHKYV0rQy5X/e0d153df56fd1eac204f58ca5bc3e133/L1-YouTube-Avatar.png", link: "https://lamina1.com/" },
    { name: "UPTN", image: "https://images.ctfassets.net/gcj8jwzm6086/5jmuPVLmmUSDrfXxbIrWwo/4bdbe8d55b775b613156760205d19f9f/symbol_UPTN_-_js_won.png", link: "https://uptn.io/" },
    { name: "Innovo", image: "https://images.ctfassets.net/gcj8jwzm6086/5wd9o1kxI1nG0Kb2LrEooJ/9e14075a20dc67c4ba5ab0ca404192b8/1675173474597.png", link: "https://innovomarkets.com/" },
    { name: "Coqnet", image: "https://images.ctfassets.net/gcj8jwzm6086/1r0LuDAKrZv9jgKqaeEBN3/9a7efac3099b861366f9e776e6131617/Isotipo_coq.png", link: "https://coq.fi/" },
    { name: "Intersect", image: "https://images.ctfassets.net/gcj8jwzm6086/4mDZ5q3a5lxHJcBLTORuMr/b47935fa6007cb3430acabef7e13e9ca/explorer.png", link: "https://intersect.io/" },
    { name: "Watr", image: "https://f005.backblazeb2.com/file/tracehawk-prod/logo/watr/Light.svg", link: "https://watr.org/" },
    { name: "Hashfire", image: "https://images.ctfassets.net/gcj8jwzm6086/4TCWxdtzvtZ8iD4255nAgU/e4d12af0a594bcf38b53a27e6beb07a3/FlatIcon_Large_.png", link: "https://hashfire.xyz/" },
    { name: "Space", image: "https://images.ctfassets.net/gcj8jwzm6086/27oUMNb9hSTA7HfFRnqUtZ/2f80e6b277f4b4ee971675b5f73c06bf/Space_Symbol_256X256__v2.svg", link: "https://space.id/" },
    { name: "Numi", image: "https://images.ctfassets.net/gcj8jwzm6086/411JTIUnbER3rI5dpOR54Y/3c0a8e47d58818a66edd868d6a03a135/numine_main_icon.png", link: "https://numine.io/" },
    { name: "Feature", image: "https://images.ctfassets.net/gcj8jwzm6086/2hWSbxXPv2QTPCtCaEp7Kp/522b520e7e5073f7e7459f9bd581bafa/FTR_LOGO_-_FLAT_BLACK.png", link: "https://feature.io/" },
    { name: "Kali Chain", image: "https://images.ctfassets.net/gcj8jwzm6086/r9EB5XcOIS39mZlXrFAsO/9bb66b54f61d0566588056782865aed2/logoKalichain.png", link: "https://kalichain.com/" },
    { name: "Orange", image: "https://images.ctfassets.net/gcj8jwzm6086/4jmmb8oMQwW5My8YYcEmAx/ee1f1cef8766cc934e9190c5c1c7fa21/Orange_Logo_Mark_Slightly_Padded.png", link: "https://orangeweb3.com/" },
    { name: "Zeroone", image: "https://images.ctfassets.net/gcj8jwzm6086/1lOFyhAJ0JkDkAmpeCznxL/9729fd9e4e75009f38a0e2c564259ead/icon-512.png", link: "https://zeroone.art/" },
    { name: "Titan", image: "https://images.ctfassets.net/gcj8jwzm6086/5m6pgoG1znzD3CA0HEh7D0/6850391f9ba90d9a97e37790b32f89ba/TITAN_mainnet_logo.png", link: "https://www.avax.network/about/blog/titan-content-launches-2gathr-on-avalanche" },
    { name: "Turf Network", image: "https://images.ctfassets.net/gcj8jwzm6086/2OGwSmo36iWhvmPfgUUnEb/0812275eac56a8d82907fb96d96002bc/with_green_background.png", link: "https://turf.network/" },
    { name: "Quboid", image: "https://images.ctfassets.net/gcj8jwzm6086/5jRNt6keCaCe0Z35ZQbwtL/94f81aa95f9d9229111693aa6a705437/Quboid_Logo.jpg", link: "https://qubo.id/" },
  ];

  return (
    <div className="relative -m-8 p-8" style={{ minHeight: "calc(100vh - var(--header-height, 3rem))" }}>
      <style jsx global>{`
        @keyframes cardPulse {
          0%, 100% { outline-color: transparent; }
          50% { outline-color: rgba(161, 161, 170, 0.3); }
        }
        /* ── Bell jingle ── */
        @keyframes bellJingle {
          0% { transform: rotate(0deg); }
          10% { transform: rotate(14deg); }
          20% { transform: rotate(-12deg); }
          30% { transform: rotate(10deg); }
          40% { transform: rotate(-8deg); }
          50% { transform: rotate(6deg); }
          60% { transform: rotate(-4deg); }
          70% { transform: rotate(2deg); }
          80% { transform: rotate(-1deg); }
          100% { transform: rotate(0deg); }
        }
        .bell-jingle { transform-origin: top center; }
        .group:hover .bell-jingle {
          animation: bellJingle 0.6s ease-in-out;
        }

        /* ── Create L1: layers fan apart ── */
        .layers-fan path {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
                      opacity 0.3s ease;
        }
        .group:hover .layers-fan .layer-top {
          transform: translateY(-3px);
          opacity: 1;
        }
        .group:hover .layers-fan .layer-mid {
          transform: translateY(0px);
        }
        .group:hover .layers-fan .layer-bot {
          transform: translateY(3px);
          opacity: 1;
        }

        /* ── Faucet: gleam sweep up the AVAX mark ── */
        .faucet-gleam {
          clip-path: inset(100% 0 0 0);
          transition: clip-path 0.45s ease-out;
        }
        .group:hover .faucet-gleam {
          clip-path: inset(0 0 0 0);
        }

        /* ── Primary Network: AVAX mark splits apart + turns red ── */
        .avax-split path {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
                      fill 0.3s ease;
        }
        .group:hover .avax-split .avax-slash {
          transform: translateX(-2px);
        }
        .group:hover .avax-split .avax-tri {
          transform: translateX(2px);
        }
        .group:hover .avax-split path {
          fill: #E84142;
        }

        /* ── Your L1: dashboard panels explode outward ── */
        .dash-panels rect {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .group:hover .dash-panels .panel-tl { transform: translate(-1.5px, -1.5px); }
        .group:hover .dash-panels .panel-tr { transform: translate(1.5px, -1.5px); }
        .group:hover .dash-panels .panel-br { transform: translate(1.5px, 1.5px); }
        .group:hover .dash-panels .panel-bl { transform: translate(-1.5px, 1.5px); }

        /* ── Cross-Chain: arrows zip apart ── */
        .arrows-zip g {
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .group:hover .arrows-zip .arrow-zip-left {
          transform: translateX(-3px);
        }
        .group:hover .arrows-zip .arrow-zip-right {
          transform: translateX(3px);
        }

        /* ── Create L1: chevron bounce-right ── */
        @keyframes chevronBounce {
          0%, 100% { transform: translateX(0); }
          30% { transform: translateX(6px); }
          50% { transform: translateX(2px); }
          70% { transform: translateX(5px); }
        }
        .group:hover .chevron-bounce {
          animation: chevronBounce 0.7s ease-in-out;
        }

      `}</style>
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
        {/* Ecosystem Marquee */}
        <motion.div
          className="mb-6 pt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="flex items-center justify-between mb-2.5">
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
          <EcosystemMarquee chains={ecosystemChains} rows={2} />
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Row 1: Create L1 (4) + Faucet (2) */}
          <motion.div className="md:col-span-4 p-px" variants={itemVariants}>
            <Link href="/console/create-l1" className="block h-full">
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}
                className="group h-full rounded-2xl border border-zinc-700 dark:border-zinc-700 bg-zinc-800 dark:bg-zinc-800 p-5 transition-all duration-200 hover:border-zinc-600 dark:hover:border-zinc-600"
                style={{
                  boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)",
                  outline: "2px solid transparent",
                  animation: "cardPulse 1.0s ease-in-out 1.0s 2",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.2), 0 16px 40px rgba(0,0,0,0.15)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)"; }}
              >
                <div className="flex items-start justify-between h-full">
                  <div>
                    <div className="w-9 h-9 rounded-xl bg-white/[0.08] flex items-center justify-center mb-3 transition-colors group-hover:bg-white/[0.14]">
                      <svg className="layers-fan w-5 h-5 text-zinc-300 group-hover:text-white transition-colors overflow-visible" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path className="layer-top" opacity="0.55" d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84Z"/>
                        <path className="layer-mid" d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
                        <path className="layer-bot" opacity="0.7" d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-white dark:text-white mb-1.5">
                      Create L1
                    </h2>
                    <p className="text-zinc-400 dark:text-zinc-400 text-sm max-w-sm leading-relaxed">
                      Launch a new Layer 1 blockchain with custom validators, tokenomics, and governance
                    </p>

                  </div>
                  <div className="flex items-center self-center ml-4">
                    <ChevronRight className="w-5 h-5 text-zinc-600 transition-colors duration-200 group-hover:text-zinc-400 chevron-bounce" />
                  </div>
                </div>
              </motion.div>
            </Link>
          </motion.div>

          {/* Row 1 right: Faucet + API Keys stacked */}
          <div className="md:col-span-2 flex flex-col gap-3">
            <BentoCard href="/console/primary-network/faucet" pulseDelay={3.8}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 transition-colors group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80">
                  <svg viewBox="38 28 158 142" className="w-5 h-5">
                    <path fill="#eab308" d="M95.2 163.4h-43c-4.5 0-6.7 0-8-1a5.7 5.7 0 0 1-2.2-4.6c.1-1.6 1.3-3.5 3.5-7.3l62.7-110c2.3-3.9 3.4-5.8 4.8-6.5a5.7 5.7 0 0 1 5 0c1.4.7 2.6 2.6 4.9 6.5l12.9 22.5.1.1c2.5 4.3 3.7 6.5 4.3 8.8a19 19 0 0 1 0 9.3c-.6 2.3-1.8 4.5-4.3 9l-33 57.8-.1.2c-2.4 4.3-3.7 6.5-5.4 8.2a19 19 0 0 1-8 4.8c-2.2.8-4.7.8-9.7.8Zm62.4 0h31.2c4.5 0 6.7 0 8-1a5.7 5.7 0 0 0 2.2-4.6c-.1-1.6-1.2-3.5-3.5-7.2l-15.7-27.2c-2.2-3.8-3.4-5.7-4.8-6.4a5.7 5.7 0 0 0-5 0c-1.3.7-2.5 2.6-4.8 6.4L149.6 151l-.1.2c-2.3 3.8-3.4 5.7-3.4 7.3a5.7 5.7 0 0 0 2.2 4.5c1.3 1 3.6 1 8 1Z"/>
                    <path fill="white" opacity="0.45" className="faucet-gleam" d="M95.2 163.4h-43c-4.5 0-6.7 0-8-1a5.7 5.7 0 0 1-2.2-4.6c.1-1.6 1.3-3.5 3.5-7.3l62.7-110c2.3-3.9 3.4-5.8 4.8-6.5a5.7 5.7 0 0 1 5 0c1.4.7 2.6 2.6 4.9 6.5l12.9 22.5.1.1c2.5 4.3 3.7 6.5 4.3 8.8a19 19 0 0 1 0 9.3c-.6 2.3-1.8 4.5-4.3 9l-33 57.8-.1.2c-2.4 4.3-3.7 6.5-5.4 8.2a19 19 0 0 1-8 4.8c-2.2.8-4.7.8-9.7.8Zm62.4 0h31.2c4.5 0 6.7 0 8-1a5.7 5.7 0 0 0 2.2-4.6c-.1-1.6-1.2-3.5-3.5-7.2l-15.7-27.2c-2.2-3.8-3.4-5.7-4.8-6.4a5.7 5.7 0 0 0-5 0c-1.3.7-2.5 2.6-4.8 6.4L149.6 151l-.1.2c-2.3 3.8-3.4 5.7-3.4 7.3a5.7 5.7 0 0 0 2.2 4.5c1.3 1 3.6 1 8 1Z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">Testnet Faucet</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Get test AVAX</p>
                </div>
              </div>
            </BentoCard>
            <BentoCard href="/console/primary-network/validator-alerts" pulseDelay={4.7}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 transition-colors group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80">
                  <Bell className="w-4 h-4 text-red-500 bell-jingle" />
                </div>
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">Validator Alerts</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Monitor uptime</p>
                </div>
              </div>
            </BentoCard>
          </div>

          {/* Row 2: Primary Network + Your L1 */}
          <div className="md:col-span-3">
            <BentoCard href="/console/primary-network/node-setup" pulseDelay={5.6}>
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2 transition-colors group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80">
                <svg className="w-4 h-4 text-zinc-600 dark:text-zinc-400 avax-split" viewBox="38 28 158 142">
                  <path className="avax-slash" fill="currentColor" d="M95.2 163.4h-43c-4.5 0-6.7 0-8-1a5.7 5.7 0 0 1-2.2-4.6c.1-1.6 1.3-3.5 3.5-7.3l62.7-110c2.3-3.9 3.4-5.8 4.8-6.5a5.7 5.7 0 0 1 5 0c1.4.7 2.6 2.6 4.9 6.5l12.9 22.5.1.1c2.5 4.3 3.7 6.5 4.3 8.8a19 19 0 0 1 0 9.3c-.6 2.3-1.8 4.5-4.3 9l-33 57.8-.1.2c-2.4 4.3-3.7 6.5-5.4 8.2a19 19 0 0 1-8 4.8c-2.2.8-4.7.8-9.7.8Z"/>
                  <path className="avax-tri" fill="currentColor" d="M157.6 163.4h31.2c4.5 0 6.7 0 8-1a5.7 5.7 0 0 0 2.2-4.6c-.1-1.6-1.2-3.5-3.5-7.2l-15.7-27.2c-2.2-3.8-3.4-5.7-4.8-6.4a5.7 5.7 0 0 0-5 0c-1.3.7-2.5 2.6-4.8 6.4L149.6 151l-.1.2c-2.3 3.8-3.4 5.7-3.4 7.3a5.7 5.7 0 0 0 2.2 4.5c1.3 1 3.6 1 8 1Z"/>
                </svg>
              </div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Primary Network</h3>
              <div className="space-y-0 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <SubLink href="/console/primary-network/node-setup" icon={Settings} label="Node Setup" />
                <SubLink href="/console/primary-network/c-p-bridge" icon={ArrowUpDown} label="C/P Bridge" />
                <SubLink href="/console/primary-network/stake" icon={Users} label="Stake AVAX" />
              </div>
            </BentoCard>
          </div>

          <div className="md:col-span-3">
            <BentoCard href="/console/layer-1/validator-set" pulseDelay={6.5}>
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2 transition-colors group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80">
                <svg className="w-4 h-4 text-zinc-600 dark:text-zinc-400 dash-panels" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect className="panel-tl" width="7" height="9" x="3" y="3" rx="1"/>
                  <rect className="panel-tr" width="7" height="5" x="14" y="3" rx="1"/>
                  <rect className="panel-br" width="7" height="9" x="14" y="12" rx="1"/>
                  <rect className="panel-bl" width="7" height="5" x="3" y="16" rx="1"/>
                </svg>
              </div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Your L1</h3>
              <div className="space-y-0 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <SubLink href="/console/layer-1/validator-set" icon={Users} label="Validators" />
                <SubLink href="/console/l1-tokenomics/fee-manager" icon={Settings} label="Tokenomics" />
                <SubLink href="/console/layer-1/performance-monitor" icon={ChevronRight} label="Performance" />
              </div>
            </BentoCard>
          </div>

          {/* Row 3: Platform CLI (4) + Cross-Chain (2) */}
          <motion.div variants={itemVariants} className="md:col-span-4">
            <div className="h-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <Terminal className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                </div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Platform CLI</h3>
                <a
                  href="https://github.com/ava-labs/platform-cli"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors inline-flex items-center gap-1"
                >
                  GitHub <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                Manage L1s, validators, and P-Chain operations from the terminal
              </p>
              <CliCopyBlock />
            </div>
          </motion.div>
          <motion.div variants={itemVariants} className="md:col-span-2">
            <CrossChainCard />
          </motion.div>
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
