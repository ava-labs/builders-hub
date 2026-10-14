'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ReportIssueButton } from '@/components/console/report-issue-button';
import { EditOnGitHubButton } from '@/components/console/edit-on-github-button';
import { sectionContainer, sectionItem } from '@/components/console/motion';

interface ContainerProps {
  title: string;
  children: ReactNode;
  description?: ReactNode;
  githubUrl?: string;
}

/**
 * Shared tool chrome for every console tool. Intentionally quiet:
 *   - no `prose` (fumadocs docs-site typography) — this is a tool, not an article
 *   - title at a measured 2xl with tight leading
 *   - GitHub / Report buttons rendered as subtle ghost-style links, not prominent outlined buttons
 *   - 8-space gap between chrome and body for breathing room without feeling cavernous
 */
export function Container({ title, children, description, githubUrl }: ContainerProps) {
  return (
    <motion.div variants={sectionContainer} initial="hidden" animate="visible" data-console-tool={title}>
      <motion.div variants={sectionItem}>
        <div className="flex flex-col gap-3 border-b border-zinc-200 pb-6 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
              {title}
            </h1>
            {description && (
              <p className="max-w-2xl text-[14px] leading-relaxed text-zinc-500 dark:text-zinc-400 [&_a]:text-zinc-700 [&_a]:underline [&_a]:decoration-zinc-300 [&_a]:underline-offset-2 hover:[&_a]:text-zinc-900 dark:[&_a]:text-zinc-300 dark:[&_a]:decoration-zinc-600 dark:hover:[&_a]:text-zinc-100">
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <EditOnGitHubButton
              githubUrl={githubUrl}
              toolTitle={title}
              className="h-8 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800"
            />
            <ReportIssueButton
              toolTitle={title}
              className="h-8 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800"
            />
          </div>
        </div>
      </motion.div>
      <motion.div className="mt-8 space-y-6" variants={sectionItem}>
        {children}
      </motion.div>
    </motion.div>
  );
}
