"use client"

import Link from "next/link";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/app/layout.config";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from 'react';
import newGithubIssueUrl from "new-github-issue-url";
import { ArrowRight, Home, Search, BookOpen, Terminal, Github } from 'lucide-react';

function createGitHubIssueURL(path: string | null) {
  return newGithubIssueUrl({
    user: "ava-labs",
    repo: "builders-hub",
    title: `Missing Page${path ? `: ${path}` : ''}`,
    body: `# Missing Page Report

${path ? `The following page was not found: \`${path}\`

` : ''}## Expected Location
${path ? `I was trying to access: ${path}` : 'Please enter the URL you were trying to access'},`,
    labels: ["bug"],
  });
}

function findNearestAvailablePath(pathname: string): string | null {
  // All main sections of the site
  const sections = [
    "/console",
    "/docs", 
    "/academy",
    "/blog",
    "/grants",
    "/integrations",
  ];

  for (const section of sections) {
    if (pathname.startsWith(section)) {
      const slug = pathname.replace(`${section}/`, "").split("/").filter(Boolean);
      if (slug.length > 1) {
        return `${section}/${slug[0]}`;
      }
      return section;
    }
  }

  return null;
}

const quickLinks = [
  { href: "/docs", label: "Documentation", icon: BookOpen, description: "Guides & references" },
  { href: "/academy", label: "Academy", icon: Search, description: "Learn Avalanche" },
  { href: "/console", label: "Console", icon: Terminal, description: "Developer tools" },
];

export default function NotFound() {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [suggestedPath, setSuggestedPath] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const referrer = document.referrer;
      setCurrentPath(path);

      const nearest = findNearestAvailablePath(path);
      setSuggestedPath(nearest);

      // Track 404 with PostHog if available
      try {
        import('posthog-js').then((posthogModule) => {
          const posthog = posthogModule.default;
          if (posthog && typeof posthog.capture === 'function') {
            posthog.capture('404_page_not_found', {
              path: path,
              referrer: referrer || 'direct',
              url: window.location.href,
              suggested_path: nearest,
            });
          }
        }).catch(() => {
          // PostHog not available, silently ignore
        });
      } catch {
        // PostHog not available, silently ignore
      }
    }
  }, []);

  const issueURL = createGitHubIssueURL(currentPath);

  return (
    <HomeLayout {...baseOptions}>
      <div className="min-h-[calc(100vh-180px)] flex items-center justify-center px-4 sm:px-6 py-8 md:py-12">
        <div className="w-full max-w-5xl mx-auto">
          {/* Main Content */}
          <div className={`text-center transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            
            {/* Wolfie Image with 404 */}
            <div className="relative mb-6 md:mb-8">
              {/* Background 404 text */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-[140px] sm:text-[180px] md:text-[220px] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-muted-foreground/20 to-muted-foreground/5 dark:from-white/15 dark:to-white/5 select-none">
                  404
                </div>
              </div>
              {/* Glow effect */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-avax-red/10 dark:bg-avax-red/20 blur-3xl" />
              </div>
              {/* Wolfie image */}
              <div className="relative z-10 flex justify-center">
                <img
                  src="/images/intern-404.png"
                  alt="Wolfie looking confused"
                  className="w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 object-contain drop-shadow-xl dark:opacity-95"
                />
              </div>
            </div>
            
            {/* Heading */}
            <div className={`space-y-4 mb-8 transition-all duration-500 delay-150 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                Oops! This page doesn&apos;t exist
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                The page you&apos;re looking for might have been moved, deleted, or never existed. 
                Let&apos;s get you back on track.
              </p>
            </div>
            
            {/* Current Path Display */}
            {currentPath && (
              <div className={`mb-8 transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                <code className="inline-block px-4 py-2 bg-muted/50 rounded-lg text-sm font-mono text-muted-foreground border border-border/50">
                  {currentPath}
                </code>
              </div>
            )}
            
            {/* Suggested Path */}
            {suggestedPath && suggestedPath !== currentPath && (
              <div className={`mb-8 transition-all duration-500 delay-250 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                <Link 
                  href={suggestedPath}
                  className="group inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/15 transition-all duration-300"
                >
                  <span className="text-sm text-muted-foreground">Did you mean</span>
                  <code className="px-2 py-1 bg-background rounded text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {suggestedPath}
                  </code>
                  <ArrowRight className="w-4 h-4 text-blue-500 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            )}
            
            {/* Primary Actions */}
            <div className={`flex flex-col sm:flex-row items-center justify-center gap-3 mb-12 transition-all duration-500 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
              <Link href="/">
                <Button
                  size="lg"
                  className="w-full sm:w-auto gap-2 bg-avax-red hover:bg-avax-red/90 text-white px-6"
                >
                  <Home className="w-4 h-4" />
                  Back to Home
                </Button>
              </Link>
              
              <Link href={issueURL} target="_blank">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto gap-2 px-6"
                >
                  <Github className="w-4 h-4" />
                  Report Issue
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
    </HomeLayout>
  );
}
