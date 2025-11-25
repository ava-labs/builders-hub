"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, DollarSign, LinkIcon, Bitcoin, Zap, Shield, Wrench, Coins, Flame, Globe } from "lucide-react";
import Link from "next/link";
import { HeroBackground } from "@/components/landing/hero";

interface CaseCardProps {
  title: string;
  company: string;
  description: string;
  icon: React.ReactNode;
  link?: string;
}

function CaseCard({ title, company, description, icon, link }: CaseCardProps) {
  const content = (
    <div className="group bg-card border border-border rounded-2xl p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-avax-red/40 hover:border-avax-red hover:bg-avax-red/10 hover:-translate-y-2">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-avax-red/20 flex items-center justify-center text-white text-xl transition-all duration-300 group-hover:scale-110 flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <div className="text-avax-red font-semibold text-xs uppercase tracking-widest opacity-90">
            {company}
          </div>
        </div>
      </div>
      <p className="text-muted-foreground text-sm mb-6">{description}</p>
      <div className="inline-flex items-center gap-2 text-avax-red font-medium text-sm transition-all duration-300 group-hover:gap-3">
        Learn More{" "}
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </div>
    </div>
  );

  return link ? (
    <Link href={link} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

interface MetricCardProps {
  title: string;
  number: string;
  description: string;
  icon: React.ReactNode;
  featured?: boolean;
  gradientIndex?: number;
}

function MetricCard({
  title,
  number,
  description,
  icon,
  featured,
  gradientIndex = 0,
}: MetricCardProps) {
  const gradients = [
    "bg-gradient-to-br from-blue-50/50 to-indigo-100/50 border-blue-200/40 dark:from-blue-950/20 dark:to-indigo-950/30 dark:border-blue-800/30",
    "bg-gradient-to-br from-emerald-50/50 to-teal-100/50 border-emerald-200/40 dark:from-emerald-950/20 dark:to-teal-950/30 dark:border-emerald-800/30",
    "bg-gradient-to-br from-purple-50/50 to-violet-100/50 border-purple-200/40 dark:from-purple-950/20 dark:to-violet-950/30 dark:border-purple-800/30",
    "bg-gradient-to-br from-orange-50/50 to-amber-100/50 border-orange-200/40 dark:from-orange-950/20 dark:to-amber-950/30 dark:border-orange-800/30",
  ];

  return (
    <div
      className={`group relative rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10 ${
        featured ? "bg-gradient-to-br from-red-50/70 to-rose-100/70 border-red-200/50 dark:from-red-950/30 dark:to-rose-950/40 dark:border-red-800/40" : gradients[gradientIndex]
      }`}
    >
      {featured && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-avax-red rounded-t-2xl" />
      )}
      <div className="text-3xl mb-5 transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>
      <h3 className="text-base font-medium text-muted-foreground mb-3">
        {title}
      </h3>
      <div className="text-4xl font-bold mb-4">{number}</div>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

interface AdvantageCardProps {
  title: string;
  description: string;
  spec: string;
  icon: React.ReactNode;
}

function AdvantageCard({ title, description, spec, icon }: AdvantageCardProps) {
  return (
    <div className="group p-8 border border-border rounded-2xl bg-card transition-all duration-300 hover:border-avax-red hover:-translate-y-1 hover:shadow-xl hover:shadow-avax-red/40 hover:bg-avax-red/10">
      <div className="w-14 h-14 bg-foreground/5 rounded-xl flex items-center justify-center text-xl mb-6 transition-all duration-300 group-hover:bg-avax-red/10 group-hover:text-avax-red group-hover:scale-110">
        {icon}
      </div>
      <h3 className="text-base font-semibold mb-3">{title}</h3>
      <p className="text-muted-foreground text-sm mb-5">{description}</p>
      <div className="text-avax-red font-semibold text-xs uppercase tracking-widest opacity-90">
        {spec}
      </div>
    </div>
  );
}

export default function AvalancheForBuildersPage() {
  return (
    <>
      <HeroBackground />
      <main className="min-h-screen bg-background">
        <div className="container relative max-w-7xl mx-auto px-6 py-8 lg:py-20">
          {/* Hero Section */}
          <section className="text-center space-y-8 pt-16 pb-32 lg:pt-24 lg:pb-40">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-avax-red/10 border border-avax-red/20 text-sm font-medium mb-6 text-avax-red">
              <span className="w-2 h-2 rounded-full bg-avax-red animate-pulse" />
              Avalanche For Builders
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.1] text-balance max-w-5xl mx-auto">
              Get Funded to{" "}
              <span className="text-avax-red">Build the Future</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground font-medium leading-relaxed max-w-3xl mx-auto text-balance">
              $250M+ in Grants Available for Visionary Builders
            </p>

            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto text-pretty">
              Stop waiting for the perfect moment. Join the most successful
              builders who are already funded and shipping. From breakthrough
              infrastructure to viral consumer apps - we're backing the teams
              that will define Web3's next chapter.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link
                href="https://4h8ew.share.hsforms.com/2DhyJTNzhRXmMMDebQMY1QQ"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  className="bg-avax-red hover:bg-avax-red/90 text-white px-8 h-12 rounded-xl font-medium text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-avax-red/25"
                >
                  Submit Your Project
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link
                href="https://build.avax.network/grants"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="border-border hover:bg-muted hover:border-avax-red/40 px-8 h-12 rounded-xl font-medium text-sm transition-all duration-200 bg-transparent"
                >
                  View All Programs
                </Button>
              </Link>
            </div>
          </section>

          {/* Network Activity Section */}
          <section className="py-20 lg:py-28">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">
                Momentum is Everything
              </h2>
              <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed text-pretty">
                September 2025 proves it: builders who choose Avalanche see
                explosive growth and real adoption
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <MetricCard
                title="DEX Volume Growth"
                number="+340%"
                description="Month-over-month increase in decentralized exchange trading volume"
                icon={<TrendingUp />}
                featured
              />
              <MetricCard
                title="Stablecoin Transfers"
                number="$2.8B"
                description="Monthly stablecoin transfer volume across Avalanche ecosystem"
                icon={<DollarSign />}
                gradientIndex={1}
              />
              <MetricCard
                title="Active L1 Chains"
                number="127"
                description="Custom Layer 1 blockchains actively running on Avalanche"
                icon={<LinkIcon />}
                gradientIndex={2}
              />
              <MetricCard
                title="BTC Volume"
                number="$420M"
                description="Bitcoin trading volume on Avalanche DEXs in September"
                icon={<Bitcoin />}
                gradientIndex={3}
              />
            </div>

            <div className="text-center max-w-4xl mx-auto p-8 bg-gradient-to-br from-violet-50/60 to-purple-100/60 border border-violet-200/40 rounded-2xl dark:from-violet-950/20 dark:to-purple-950/30 dark:border-violet-800/30">
              <p className="text-foreground/90 text-sm md:text-base leading-relaxed text-pretty">
                Smart builders recognize momentum when they see it. Avalanche
                isn't just growing - it's becoming the platform where serious
                projects get built, funded, and adopted at scale.
              </p>
            </div>

            <p className="text-xs text-muted-foreground/60 font-normal italic mt-8 text-center">
              Source: Blockworks Research, September 2025
            </p>
          </section>

          {/* Use Cases Section */}
          <section className="py-20 lg:py-28">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">
                Your Peers Are Shipping
              </h2>
              <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed text-pretty">
                While others talk, these funded teams are building applications
                that governments, institutions, and millions of users actually
                adopt
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <CaseCard
                title="Anti-Rug DeFi Innovation"
                company="BlackHole DEX"
                description="Revolutionary DEX with team tokens permanently burned, Genesis Pools for sustainable launches, and $145M+ TVL proving DeFi can be built without rug risk."
                icon="⚫"
              />
              <CaseCard
                title="Web3 Gaming Evolution"
                company="Undead Blocks"
                description="Zombie-themed Web3 FPS relaunching on Avalanche with new maps, tournaments, and token migration, partnering with BlackHole for seamless DeFi integration."
                icon="🧟"
              />
              <CaseCard
                title="Enterprise Real Estate SaaS"
                company="Balcony Technology"
                description="$240B in real estate tokenized across New Jersey municipalities. Custom Avalanche L1 reduces deed settlement from 90 days to 1 day, recovering millions in lost revenue."
                icon="🏢"
              />
              <CaseCard
                title="K-Pop Fan Engagement"
                company="Titan Content"
                description="2GATHR app on custom Avalanche L1 connecting K-pop fans with artists through missions, content, and digital collectibles, reaching millions of users."
                icon="🎵"
              />
              <CaseCard
                title="Multi-Asset DeFi Innovation"
                company="Multiswap by CavalRe"
                description="Revolutionary AMM enabling swaps of 300+ assets in a single transaction, supporting both on-chain and tokenized off-chain assets in unified pools."
                icon="💱"
              />
              <CaseCard
                title="Institutional Investment"
                company="Grove Finance"
                description="$250M+ target investment launching onchain credit solutions with institutional asset managers like Janus Henderson, accelerating institutional adoption."
                icon="🏦"
              />
            </div>
          </section>

          {/* Tech Advantages Section */}
          <section className="py-20 lg:py-28">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">
                Why Top Builders Choose Avalanche
              </h2>
              <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed text-pretty">
                The only blockchain that doesn't force you to compromise between
                performance, decentralization, and customization
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AdvantageCard
                title="Instant Finality"
                description="Transactions finalize in under 1 second with absolute certainty. No waiting, no rollback risk, no probabilistic finality."
                spec="<1 Second Final Settlement"
                icon={<Zap />}
              />
              <AdvantageCard
                title="Truly Decentralized"
                description="Thousands of validators across the globe secure the network. No centralized sequencers, no single points of failure."
                spec="1,300+ Active Validators"
                icon={<Shield />}
              />
              <AdvantageCard
                title="Custom Blockchain Creation"
                description="Deploy your own Layer 1 blockchain with custom rules, tokens, and governance. Full sovereignty over your application."
                spec="Unlimited Customization"
                icon={<Wrench />}
              />
              <AdvantageCard
                title="Predictable Low Fees"
                description="Stable, low-cost transactions that don't spike during network congestion. Build sustainable economics for your users."
                spec="$0.01 Average Transaction"
                icon={<Coins />}
              />
              <AdvantageCard
                title="Multi-Chain by Design"
                description="Native interoperability between chains. Move assets and data seamlessly across your entire ecosystem."
                spec="Cross-Chain Native"
                icon={<Globe />}
              />
              <AdvantageCard
                title="Infinite Scalability"
                description="Launch unlimited parallel chains that all benefit from the same security model. Scale without trade-offs."
                spec="Unlimited Throughput"
                icon={<Flame />}
              />
            </div>
          </section>

          {/* Final CTA Section */}
          <section id="grants" className="py-20 lg:py-28 text-center">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">
                Your Project Could Be Next
              </h2>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed text-pretty">
                The best builders in Web3 are already here and funded. Don't
                watch from the sidelines while your competitors get the
                resources, mentorship, and ecosystem access that could have been
                yours.
              </p>
              <div className="pt-4">
                <Link
                  href="https://4h8ew.share.hsforms.com/2DhyJTNzhRXmMMDebQMY1QQ"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    size="lg"
                    className="bg-avax-red hover:bg-avax-red/90 text-white px-10 h-14 rounded-xl font-medium text-base transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-avax-red/25"
                  >
                    Submit Your Project Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
