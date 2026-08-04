'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RotateCw, Home, BookOpen, Terminal, Github } from 'lucide-react'

const quickLinks = [
  { href: '/docs', label: 'Documentation', icon: BookOpen, description: 'Guides & references' },
  { href: '/console', label: 'Console', icon: Terminal, description: 'Developer tools' },
  { href: '/', label: 'Home', icon: Home, description: 'Back to start' },
]

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    console.error('Application Error:', error)
    posthog.captureException(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8 md:py-12">
      <div className="w-full max-w-5xl mx-auto">
        {/* Main Content */}
        <div className={`text-center transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

          {/* Wolfie Image with Error Icon */}
          <div className="relative mb-6 md:mb-8">
            {/* Background error text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-[140px] sm:text-[180px] md:text-[220px] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-muted-foreground/20 to-muted-foreground/5 dark:from-white/15 dark:to-white/5 select-none">
                ⚠️
              </div>
            </div>
            {/* Glow effect */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-orange-500/10 dark:bg-orange-500/20 blur-3xl" />
            </div>
            {/* Wolfie image */}
            <div className="relative z-10 flex justify-center">
              <img
                src="/images/intern-404.png"
                alt="Wolfie encountered an error"
                className="w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 object-contain drop-shadow-xl dark:opacity-95"
              />
            </div>
          </div>

          {/* Heading */}
          <div className={`space-y-4 mb-8 transition-all duration-500 delay-150 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Oops! Something went wrong
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              We encountered an unexpected error. Please try reloading the page.
            </p>
          </div>

          {/* Primary Action */}
          <div className={`flex flex-col sm:flex-row items-center justify-center gap-3 mb-12 transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            <Button
              onClick={() => window.location.reload()}
              size="lg"
              className="w-full sm:w-auto gap-2 bg-avax-red hover:bg-avax-red/90 text-white px-6"
            >
              <RotateCw className="w-4 h-4" />
              Reload
            </Button>

            <Link href="/">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto gap-2 px-6"
              >
                <Home className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>
          </div>

          {/* Quick Links */}
          <div className={`transition-all duration-500 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            <p className="text-sm text-muted-foreground mb-4">Or explore these sections:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-card/50 hover:bg-accent hover:border-border transition-all duration-200"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <link.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-foreground text-sm">{link.label}</div>
                    <div className="text-xs text-muted-foreground">{link.description}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
