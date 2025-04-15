"use client"

import Link from "next/link";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/app/layout.config";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from 'react';

function createGitHubIssueURL(path: string | null) {
  const title = encodeURIComponent(`Missing Page${path ? `: ${path}` : ''}`);
  const body = encodeURIComponent(
    `# Missing Page Report\n\n` +
    `${path ? `The following page was not found: \`${path}\`\n\n` : ''}` +
    `## Expected Location\n` +
    `${path ? `I was trying to access: ${path}` : 'Please enter the URL you were trying to access'}\n\n` +
    `## Additional Context\n` +
    `Please provide any additional context about what you were looking for.`
  );
  
  return `https://github.com/ava-labs/builders-hub/issues/new?title=${title}&body=${body}&labels=bug`;
}

export default function NotFound() {
  const [currentPath, setCurrentPath] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      setCurrentPath(path);
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
            <div className="flex flex-wrap gap-4">
              <Link href="https://x.com/AvalancheIntern" target="_blank">
                <Button
                  variant="outline"
                  className="dark:border-border dark:hover:bg-accent"
                >
                  Scold Intern on Twitter
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