'use client'

import { useTheme } from 'next-themes';
import { AnimatedBackground } from '@/components/builderkit/animated-background';
import { AnimatedWords } from '@/components/builderkit/animated-words';
import { InstallCommand } from '@/components/builderkit/install-command';
import Link from 'next/link';
import { ComponentShowcase } from '@/components/builderkit/sections/component-showcase';
import { PainPoints } from '@/components/builderkit/sections/pain-points';
import { useState, useEffect } from 'react';

export default function Page() {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const logo = isMounted ? (resolvedTheme === "dark" ? "/logo-white.png" : "/logo-black.png") : null;

  return (
    <div className="min-h-screen text-foreground overflow-hidden">
      <AnimatedBackground />
      <section className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-4xl">
          <h1 className="text-7xl font-bold mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              Build <AnimatedWords words={['Better', 'Faster', 'Simpler', 'Modern', 'Secure']} />
            </div>
            <div>User Interfaces</div>
          </h1>
          <p className="text-lg text-foreground mb-12 max-w-3xl mx-auto">
            A comprehensive suite of React components designed for modern web applications. 
            Build beautiful, accessible, and performant user interfaces with our type-safe and customizable components.
          </p>
          <InstallCommand className="mb-8" />
          <div className="flex gap-4 justify-center mb-16">
          <Link
            href="/docs/builderkit"
            className="bg-black hover:bg-black/75 dark:bg-white dark:hover:bg-white/75 text-white dark:text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors dark:bg-opacity-90"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/ava-labs/builderkit"
            className="bg-white dark:bg-black border border-[0.5] border-black/25 dark:border-white/25 dark:hover:border-white/50 hover:border-black/50 dark:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
          <div className="flex justify-center">
            {logo && (
              <img 
                src={logo}
                alt="Avalanche Logo"
                className="h-10 opacity-80 hover:opacity-100 transition-opacity"
              />
            )}
          </div>
        </div>
      </section>
      <ComponentShowcase />
      <PainPoints />
    </div>
  )
}