"use client"

import Link from "next/link";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/app/layout.config";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from 'react';
import newGithubIssueUrl from "new-github-issue-url";
import posthog from 'posthog-js';

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
  // Known sections that have landing pages
  const sections = ["/console", "/docs", "/academy"];

  for (const section of sections) {
    if (pathname.startsWith(section)) {
      const slug = pathname.replace(`${section}/`, "").split("/").filter(Boolean);
      if (slug.length > 1) {
        // Suggest the first-level section (e.g., /docs/tooling, /console/layer-1)
        return `${section}/${slug[0]}`;
      }
      return section;
    }
  }

  return null;
}

export default function NotFound() {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [suggestedPath, setSuggestedPath] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const referrer = document.referrer;
      setCurrentPath(path);

      const nearest = findNearestAvailablePath(path);
      setSuggestedPath(nearest);

      // Track 404 page view in PostHog
      posthog.capture('404_page_not_found', {
        path: path,
        referrer: referrer || 'direct',
        url: window.location.href,
        suggested_path: nearest,
      });
    }
  }, []);

  const issueURL = createGitHubIssueURL(currentPath);

  return (
    <HomeLayout {...baseOptions}>
      <div className="relative z-10 container p-10 mx-auto">
        <div className="flex flex-wrap items-center -mx-4">
          <div className="column w-full md:w-1/2 px-4 mb-16 md:mb-0">
            <img
              className="object-scale-down mx-auto dark:opacity-90"
              src="/images/intern-404.png"
              alt="404"
            />
          </div>
          <div className="column w-full md:w-1/2 px-4 mb-16 md:mb-0">
            <div className="flex flex-wrap">
              <div className="md:max-w-xl text-center md:text-left">
                <span className="inline-block py-px px-2 mb-4 text-s leading font-medium rounded-full bg-red-600 text-white dark:text-white">
                  Error 404
                </span>
                <h2 className="mb-4 text-4xl md:text-5xl leading-tight font-bold tracking-tighter text-foreground">
                  Seriously?
                </h2>
                <p className="mb-6 text-lg md:text-xl text-muted-foreground">
                  We told the intern to find this page for you, but he couldn't.
                  We've warned him about this countless times, and honestly,
                  we're not sure how much longer we can keep him around.
                </p>
              </div>
            </div>
            {suggestedPath && suggestedPath !== currentPath && (
              <div className="mb-6 p-4 rounded-lg border bg-muted/50">
                <p className="text-sm text-muted-foreground mb-3">Did you mean?</p>
                <Link href={suggestedPath}>
                  <Button variant="secondary" size="lg">
                    Go to {suggestedPath}
                  </Button>
                </Link>
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              <Link href="https://x.com/AvalancheIntern" target="_blank">
                <Button
                  variant="outline"
                  className="dark:border-border dark:hover:bg-accent"
                >
                  Scold Intern on X
                </Button>
              </Link>
              <Link href={issueURL} target="_blank">
                <Button
                  variant="default"
                  className="dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                  Report Missing Page
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
}
