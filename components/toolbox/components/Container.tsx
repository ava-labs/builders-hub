'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ReportIssueButton } from '@/components/console/report-issue-button';
import { EditOnGitHubButton } from '@/components/console/edit-on-github-button';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 200, damping: 24 },
  },
};

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
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col gap-1.5 min-w-0">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-100">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl">{description}</p>
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
      <motion.div className="space-y-6 mt-6" variants={itemVariants}>
        {children}
      </motion.div>
    </motion.div>
  );
}
