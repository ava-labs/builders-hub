"use client";

import Image from "next/image";
import Link from "next/link";
import { HeroBackground } from "@/components/landing/hero";
import { ArrowRight, Shield } from "lucide-react";

// Program card data with gradient backgrounds
const programs = [
  {
    title: "Retro9000",
    description: "Build innovative projects on Avalanche and get rewarded for your creativity and impact.",
    href: "https://retro9000.avax.network",
    external: true,
    gradient: "from-orange-500 via-red-500 to-pink-500",
    icon: "🚀",
  },
  {
    title: "Team1 Mini Grants",
    description: "Supporting early stage Avalanche projects with capital, mentorship, and guidance.",
    href: "https://grants.team1.network/",
    external: true,
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    icon: "💰",
  },
  {
    title: "infraBUIDL ( )",
    description: "Strengthen Avalanche's infrastructure by building the foundation for next-generation applications.",
    href: "/grants/infrabuidl",
    external: false,
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    icon: "🔧",
  },
  {
    title: "Codebase by Avalanche™",
    description: "Empower developers to create innovative blockchain solutions and turn visions into reality.",
    href: "/codebase",
    external: false,
    gradient: "from-blue-500 via-indigo-500 to-violet-500",
    icon: "💻",
  },
  {
    title: "infraBUIDL (AI)",
    description: "Support projects that combine artificial intelligence with decentralized infrastructure.",
    href: "/grants/infrabuidlai",
    external: false,
    gradient: "from-cyan-500 via-blue-500 to-indigo-500",
    icon: "🤖",
  },
  {
    title: "Blizzard Fund",
    description: "A $200M+ fund investing in promising Avalanche projects with institutional support.",
    href: "https://www.blizzard.fund/",
    external: true,
    gradient: "from-sky-400 via-blue-500 to-indigo-600",
    icon: "❄️",
  },
];

const partnerPrograms = [
  {
    title: "Game Accelerator",
    description: "Support and fast-track for promising gaming studios and projects building on Avalanche, in partnership with Helika.",
    href: "https://www.helika.io/helika-avalanche-accelerator",
    external: true,
    gradient: "from-rose-500 via-pink-500 to-fuchsia-500",
    icon: "🎮",
  },
  {
    title: "Developer Credits",
    description: "Access credits to build data-suites and vibe-code new projects on the Avalanche C-Chain, in partnership with Space & Time.",
    href: "https://spaceandtimedb.notion.site/Space-and-Time-x-Avalanche-Builder-Credit-Grant-Program-239af37755f580b4929ff9328584f347?pvs=74",
    external: true,
    gradient: "from-amber-500 via-orange-500 to-red-500",
    icon: "🎟️",
  },
  {
    title: "Hexagate Security",
    description: "Onchain security for Avalanche builders, delivering real-time threat detection for smart contracts and protocols.",
    href: "https://hexagate.typeform.com/HexagateForAva?typeform-source=t.co",
    external: true,
    gradient: "from-green-500 via-emerald-500 to-teal-500",
    icon: "🛡️",
  },
  {
    title: "Security Audits",
    description: "Explore 20+ trusted auditing providers and find the right partner to review, test, and strengthen your smart contracts.",
    href: "https://areta.market/avalanche",
    external: true,
    gradient: "from-slate-600 via-zinc-600 to-neutral-600",
    icon: "🔒",
  },
];

interface ProgramCardProps {
  title: string;
  description: string;
  href: string;
  external: boolean;
  gradient: string;
  icon: string;
}

function ProgramCard({ title, description, href, external, gradient, icon }: ProgramCardProps) {
  const CardWrapper = external ? 'a' : Link;
  const linkProps = external ? { href, target: "_blank", rel: "noopener noreferrer" } : { href };

  return (
    <CardWrapper {...linkProps} className="block group">
      <div className="relative overflow-hidden rounded-lg transition-all duration-300 hover:shadow-xl h-[320px] border border-zinc-200/50 dark:border-zinc-800/50">
        {/* Gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />

        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[length:20px_20px]" />
        </div>

        {/* Icon */}
        <div className="absolute top-6 left-6 text-5xl opacity-80 group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
          <h3 className="text-xl font-bold text-white mb-2 group-hover:translate-x-1 transition-transform duration-300">
            {title}
          </h3>
          <p className="text-white/80 text-sm line-clamp-2">
            {description}
          </p>
        </div>

        {/* Hover arrow */}
        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
          <ArrowRight className="w-6 h-6 text-white" />
        </div>
      </div>
    </CardWrapper>
  );
}

export default function Page() {
  return (
    <>
      <HeroBackground />
      <main className="relative">
        {/* Hero Section - Matching homepage style */}
        <section className="min-h-[40vh] w-full flex items-center justify-center relative py-12 lg:py-20 px-4">
          <div className="relative z-10 w-full max-w-7xl mx-auto text-center">
            <div className="space-y-6">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tighter leading-[0.95]">
                <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-slate-100 dark:to-white">
                  Grants
                </span>
              </h1>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
                <span className="bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent">
                  Fund Your Vision
                </span>
              </h2>
              <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
                Empowering innovators to build the future of blockchain technology with scalable and sustainable solutions.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                <a
                  href="#programs"
                  className="group inline-flex items-center justify-center px-8 py-4 text-lg font-bold tracking-[-0.015em] rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white shadow-xl shadow-red-500/30 hover:shadow-2xl hover:shadow-red-500/50 hover:scale-[1.02] transition-all duration-300"
                >
                  View Programs
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </a>
                <a
                  href="https://immunefi.com/bug-bounty/avalanche/information/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center px-8 py-4 text-lg font-bold tracking-[-0.015em] rounded-xl bg-white/10 backdrop-blur-sm border border-slate-200/30 text-slate-900 dark:text-white hover:bg-white/20 hover:scale-[1.02] transition-all duration-300 dark:border-slate-700/40"
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Bug Bounty
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Programs Section */}
        <section id="programs" className="px-4 pb-16">
          <div className="mx-auto max-w-7xl space-y-16">
            {/* Main Programs */}
            <div>
              <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-6">
                Grant Programs
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {programs.map((program) => (
                  <ProgramCard key={program.title} {...program} />
                ))}
              </div>
            </div>

            {/* Partner Programs */}
            <div>
              <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-6">
                Partner Programs
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {partnerPrograms.map((program) => (
                  <ProgramCard key={program.title} {...program} />
                ))}
              </div>
            </div>

            {/* Bug Bounty CTA */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-900 p-8 md:p-12">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(239,68,68,0.15),transparent_50%)]" />
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                    Security Bug Bounty
                  </h3>
                  <p className="text-zinc-400 max-w-xl">
                    Help secure the Avalanche network. Security researchers who identify critical vulnerabilities can earn bounties up to{" "}
                    <span className="text-white font-semibold">$100,000 USD</span>.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="https://immunefi.com/bug-bounty/avalanche/information/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-6 py-3 font-semibold rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    Submit Report
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </a>
                  <a
                    href="https://immunefi.com/bug-bounty/avalanche/scope/#top"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-6 py-3 font-semibold rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                  >
                    View Scope
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
