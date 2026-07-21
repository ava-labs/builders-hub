"use client"
import { useState } from "react"
import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { AvalancheLogo } from "@/components/navigation/avalanche-logo"

export function Footer() {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (result.success) {
        setIsSuccess(true);
        setEmail('');
      } else {
        console.error('Newsletter signup failed:', result);
      }
    } catch (error) {
      console.error('Error during newsletter signup:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="relative mt-auto border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl">
        {/* Brand rule */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-6 dark:border-zinc-800 md:px-6">
          <div className="flex items-center gap-3">
            <AvalancheLogo className="size-6 text-zinc-900 dark:text-zinc-50" fill="currentColor" />
            <span className="font-mono text-[11px] tracking-[0.22em] text-zinc-900 dark:text-zinc-50">
              BUILDER HUB
            </span>
          </div>
          <a
            href="https://status.avax.network/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            NETWORK STATUS
          </a>
        </div>

        {/* Link ledger */}
        <div className="grid grid-cols-1 divide-y divide-zinc-200 dark:divide-zinc-800 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          <FooterSection title="AVALANCHE">
            <ul className="flex flex-col gap-2.5">
              <FooterLink href="https://github.com/ava-labs/audits" external>Audits</FooterLink>
              <FooterLink href="https://subnets.avax.network/" external>Explorer</FooterLink>
              <FooterLink href="https://github.com/ava-labs" external>GitHub</FooterLink>
              <FooterLink href="https://status.avax.network/" external>Network Status</FooterLink>
              <FooterLink href="https://avalabs.org/whitepapers" external>Whitepapers</FooterLink>
            </ul>
          </FooterSection>

          <FooterSection title="COMMUNITY">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <FooterLink href="https://www.avax.network/blog" external>Blog</FooterLink>
              <FooterLink href="https://discord.gg/avax" external>Discord</FooterLink>
              <FooterLink href="https://www.facebook.com/avalancheavax" external>Facebook</FooterLink>
              <FooterLink href="https://forum.avax.network" external>Forum</FooterLink>
              <FooterLink href="https://www.linkedin.com/company/avalancheavax" external>LinkedIn</FooterLink>
              <FooterLink href="https://medium.com/@avaxdevelopers" external>Medium</FooterLink>
              <FooterLink href="https://t.me/+KDajA4iToKY2ZjBk" external>Telegram</FooterLink>
              <FooterLink href="https://x.com/AvaxDevelopers" external>X</FooterLink>
              <FooterLink href="https://www.youtube.com/@Avalancheavax" external>Youtube</FooterLink>
            </div>
          </FooterSection>

          <FooterSection title="MORE">
            <ul className="flex flex-col gap-2.5">
              <FooterLink href="https://www.avax.network/legal" external>Legal</FooterLink>
              <FooterLink href="/llms-full.txt" external>LLMs</FooterLink>
            </ul>
          </FooterSection>

          <FooterSection title="STAY IN TOUCH">
            <p className="mb-4 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Don't miss new grant opportunities, tools and resource launches, event announcements, and more.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 w-full border border-zinc-300 bg-transparent px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:text-zinc-50 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="group inline-flex h-10 w-full items-center justify-center gap-2 bg-zinc-900 px-4 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300 sm:w-auto"
              >
                {isSubmitting ? "Subscribing..." : "Subscribe"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              {isSuccess && (
                <p className="font-mono text-[10px] tracking-[0.18em] text-zinc-600 dark:text-zinc-300">
                  SIGNED UP · PURE SIGNAL, ZERO SPAM
                </p>
              )}
            </form>
          </FooterSection>
        </div>

        {/* Colophon */}
        <div className="flex flex-col items-start justify-between gap-3 border-t border-zinc-200 px-5 py-6 font-mono text-[10px] tracking-[0.18em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 sm:flex-row sm:items-center md:px-6">
          <p>CRAFTED WITH <span className="text-[#E6212F]">❤</span> BY THE AVA LABS DEVREL TEAM</p>
          <p>© {new Date().getFullYear()} AVA LABS, INC.</p>
        </div>
      </div>
    </footer>
  )
}

interface FooterSectionProps {
  title: string
  children: React.ReactNode
}

function FooterSection({ title, children }: FooterSectionProps) {
  return (
    <div className="flex flex-col px-5 py-10 md:px-6">
      <h3 className="mb-5 font-mono text-[10px] tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {title}
      </h3>
      {children}
    </div>
  )
}

interface FooterLinkProps {
  href: string
  children: React.ReactNode
  external?: boolean
}

function FooterLink({ href, children, external = false }: FooterLinkProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group inline-flex w-fit items-center gap-1 text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
      {external && (
        <ArrowUpRight className="h-3 w-3 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-500" />
      )}
    </Link>
  )
}
