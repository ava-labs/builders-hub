"use client"
import { useState } from "react"
import Link from 'next/link'
import { ArrowUpRight, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
    <footer className="mt-auto border-t border-border/40 bg-slate-50/50 dark:bg-zinc-950/50 backdrop-blur-xl py-12 lg:py-16 text-secondary-foreground">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 w-full max-w-7xl mx-auto">
          <FooterSection title="Avalanche">
            <ul className="flex flex-col space-y-3">
              <FooterLink href="https://github.com/ava-labs/audits" external>Audits</FooterLink>
              <FooterLink href="https://subnets.avax.network/" external>Explorer</FooterLink>
              <FooterLink href="https://github.com/ava-labs" external>GitHub</FooterLink>
              <FooterLink href="https://status.avax.network/" external>Network Status</FooterLink>
              <FooterLink href="https://avalabs.org/whitepapers" external>Whitepapers</FooterLink>
            </ul>
          </FooterSection>
          
          <FooterSection title="Community">
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
          
          <FooterSection title="More Links">
            <ul className="flex flex-col space-y-3">
              <FooterLink href="https://www.avax.network/legal" external>Legal</FooterLink>
              <FooterLink href="/llms-full.txt" external>LLMs</FooterLink>
            </ul>
          </FooterSection>

          <FooterSection title="Stay In Touch">
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">Don't miss new grant opportunities, tools and resource launches, event announcements, and more.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex flex-col space-y-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background/50 border-border/50 focus:bg-background transition-colors h-10"
                />
                <Button type="submit" disabled={isSubmitting} variant="default" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-10 shadow-sm">
                  {isSubmitting ? "Subscribing..." : "Subscribe"}
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
                {isSuccess && (
                  <div className="mt-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-900/50">
                    Pure signal, zero spam → straight to your inbox!
                  </div>
                )}
              </div>
            </form>
          </FooterSection>
        </div>
        
        <div className="mt-16 pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>Crafted with ❤️ by Ava Labs DevRel team.</p>
          <p>© {new Date().getFullYear()} Ava Labs, Inc.</p>
        </div>
      </div>
    </footer>
  )
}

interface FooterSectionProps {
  title: string
  children: React.ReactNode
  className?: string
}

function FooterSection({ title, children, className = "" }: FooterSectionProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      <h3 className="text-lg font-semibold mb-4 text-foreground tracking-tight">{title}</h3>
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
      className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200 inline-flex items-center w-fit group"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span className="border-b border-transparent group-hover:border-primary/30">{children}</span>
      {external && <ExternalLink className="ml-1 h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />}
    </Link>
  )
}
