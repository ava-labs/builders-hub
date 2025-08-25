"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Zap,
  Cpu,
  Code,
  Coins,
  Bot,
  Gamepad2,
  CreditCard,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { HeroBackground } from "@/components/landing/hero";

interface ProgramCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

function ProgramCard({ title, description, icon }: ProgramCardProps) {
  return (
    <div className="p-6 space-y-4 bg-card border border-border rounded-lg hover:shadow-sm transition-shadow duration-200">
      <div className="flex justify-between items-start">
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
          {icon}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <HeroBackground />
      <main className="container relative max-w-[1100px] px-2 py-4 lg:py-16">
        {/* Hero Section */}
        <section className="text-center space-y-6 pt-12">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo-black.png"
              alt="Avalanche Logo"
              width={200}
              height={50}
              className="dark:hidden"
            />
            <Image
              src="/logo-white.png"
              alt="Avalanche Logo"
              width={200}
              height={50}
              className="hidden dark:block"
            />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Grants & Programs
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Empowering innovators to build the future of blockchain technology
            with scalable and sustainable solutions.
          </p>
          <Link href="#programs">
            <Button className="mt-8 rounded-lg px-6 py-3">
              View Programs <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </section>

        {/* Prize Pool Section */}
        <section className="mt-24">
          <div className="px-6 py-16 text-center space-y-6 rounded-lg border border-border bg-card">
            <div className="flex justify-center">
              <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium text-foreground">
                💰 Total Funding Available
              </div>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold">$250M+ in Grants</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Funding innovation across all programs based on project impact and
              potential.
            </p>
          </div>
        </section>

        {/* Programs Grid */}
        <section id="programs" className="space-y-12 mt-24">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Our Programs</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose the program that best fits your project and goals.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <a
              href="https://retro9000.avax.network"
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:no-underline"
            >
              <ProgramCard
                title="Retro9000"
                description="Build innovative projects on Avalanche and get rewarded for your creativity and impact."
                icon={<Zap className="w-6 h-6 text-foreground" />}
              />
            </a>
            <a href="/grants/infrabuidl" className="block hover:no-underline">
              <ProgramCard
                title="InfraBUIDL()"
                description="Strengthen Avalanche's infrastructure by building the foundation for next-generation applications."
                icon={<Cpu className="w-6 h-6 text-foreground" />}
              />
            </a>
            <a href="/codebase" className="block hover:no-underline">
              <ProgramCard
                title="Codebase by Avalanche™"
                description="Empower developers to create innovative blockchain solutions and turn visions into reality."
                icon={<Code className="w-6 h-6 text-foreground" />}
              />
            </a>
            <a
              href="https://www.blizzard.fund/"
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:no-underline"
            >
              <ProgramCard
                title="Blizzard Fund"
                description="A $200M+ fund investing in promising Avalanche projects with institutional support."
                icon={<Coins className="w-6 h-6 text-foreground" />}
              />
            </a>
            <a href="/grants/infrabuidlai" className="block hover:no-underline">
              <ProgramCard
                title="InfraBUIDL (AI)"
                description="Support projects that combine artificial intelligence with decentralized infrastructure."
                icon={<Bot className="w-6 h-6 text-foreground" />}
              />
            </a>
          </div>
        </section>

        {/* Partner Programs Section */}
        <section className="space-y-12 mt-24">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Partner Programs</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Exclusive programs in partnership with leading organizations in
              the Avalanche ecosystem.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <a
              href="https://www.helika.io/helika-avalanche-accelerator"
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:no-underline"
            >
              <ProgramCard
                title="Game Accelerator Program"
                description="Support and fast-track for promising gaming studios and projects building on Avalanche, in partnership with Helika."
                icon={<Gamepad2 className="w-6 h-6 text-foreground" />}
              />
            </a>
            <a
              href="https://spaceandtimedb.notion.site/Space-and-Time-x-Avalanche-Builder-Credit-Grant-Program-239af37755f580b4929ff9328584f347?pvs=74"
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:no-underline"
            >
              <ProgramCard
                title="Developer Credits Program"
                description="Access credits to build data-suites and vibe-code new projects on the Avalanche C-Chain, in partnership with Space & Time."
                icon={<CreditCard className="w-6 h-6 text-foreground" />}
              />
            </a>
            <a
              href="https://hexagate.typeform.com/HexagateForAva?typeform-source=t.co"
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:no-underline"
            >
              <ProgramCard
                title="Hexagate Security Program"
                description="Onchain security for Avalanche builders, delivering real-time threat detection for smart contracts and protocols."
                icon={<Shield className="w-6 h-6 text-foreground" />}
              />
            </a>
          </div>
        </section>

        {/* CTA Section */}
        <section className="mt-24">
          <div className="px-6 py-16 text-center space-y-6 rounded-lg border border-border bg-card">
            <h2 className="text-2xl md:text-3xl font-bold">
              Security Bug Bounty
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              Help secure the Avalanche network. Security researchers who
              identify critical vulnerabilities can earn bounties up to{" "}
              <strong>$100,000 USD</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="https://immunefi.com/bug-bounty/avalanche/information/">
                <Button className="rounded-lg px-6 py-3">
                  Submit a Bug Report <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="https://immunefi.com/bug-bounty/avalanche/scope/#top">
                <Button variant="outline" className="rounded-lg px-6 py-3">
                  View Scope
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
