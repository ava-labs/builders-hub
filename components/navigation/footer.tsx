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
    <footer className="mt-auto border-t bg-card py-12 text-secondary-foreground">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 w-full max-w-6xl mx-auto">
          <FooterSection title="Avalanche" className="md:justify-self-start">
            <div className="flex flex-col space-y-3">
              <FooterLink href="https://subnets.avax.network/" external>Explorer</FooterLink>
              <FooterLink href="https://www.avax.network/get-started" external>Get Started</FooterLink>
              <FooterLink href="https://github.com/ava-labs" external>GitHub</FooterLink>
              <FooterLink href="https://avalabs.org/whitepapers" external>Whitepapers</FooterLink>
              <FooterLink href="https://stats.avax.network/dashboard/overview/" external>Statistics</FooterLink>
            </div>
          </FooterSection>
          
          <FooterSection title="Community" className="md:justify-self-center md:text-center">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <FooterLink href="https://www.facebook.com/avalancheavax" external>Facebook</FooterLink>
              <FooterLink href="https://forum.avax.network" external>Forum</FooterLink>
              <FooterLink href="https://chat.avax.network" external>Discord</FooterLink>
              <FooterLink href="https://support.avax.network/en/" external>Support</FooterLink>
              <FooterLink href="https://medium.com/@avaxdevelopers" external>Medium</FooterLink>
              <FooterLink href="https://www.youtube.com/@Avalancheavax" external>Youtube</FooterLink>
              <FooterLink href="https://t.me/+KDajA4iToKY2ZjBk" external>Telegram</FooterLink>
              <FooterLink href="https://twitter.com/AvaxDevelopers" external>Twitter</FooterLink>
              <FooterLink href="https://www.avax.network/blog" external>Blog</FooterLink>
              <FooterLink href="https://www.linkedin.com/company/avalancheavax" external>LinkedIn</FooterLink>
            </div>
          </FooterSection>
          
          <FooterSection title="More Links" className="md:justify-self-center md:text-center">
            <div className="flex flex-col space-y-3">
              <FooterLink href="https://avacloud.io/" external>Enterprise Solutions</FooterLink>
              <FooterLink href="https://github.com/ava-labs/audits" external>Audits</FooterLink>
              <FooterLink href="https://core.app/" external>Core Wallet</FooterLink>
              <FooterLink href="https://www.avax.network/legal" external>Legal</FooterLink>
              <FooterLink href="https://status.avax.network/" external>Network Status</FooterLink>
            </div>
          </FooterSection>

          <FooterSection title="Stay In Touch" className="md:justify-self-end">
            <p className="text-sm mb-4">Don't miss new grant opportunities, tools and resource launches, event announcements, and more.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex flex-col space-y-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background border-border"
                />
                <Button type="submit" disabled={isSubmitting} variant="default" className="dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90">
                  {isSubmitting ? "Subscribing..." : "Subscribe"}
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
                {isSuccess && (
                  <div className="mt-2 text-sm text-green-600 bg-green-50 p-2 rounded-md">
                    Pure signal, zero spam → straight to your inbox!
                  </div>
                )}
              </div>
            </form>
          </FooterSection>
        </div>
        <div className="mt-12 text-xs text-center text-secondary-foreground/70">
          Crafted with ❤️ by Ava Labs DevRel team.
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
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
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
      className="text-sm text-secondary-foreground hover:text-primary transition-colors duration-200 inline-flex items-center"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
      {external && <ExternalLink className="ml-1 h-3 w-3" />}
    </Link>
  )
}