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

export function Container({ title, children, description, githubUrl }: ContainerProps) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <motion.div className="space-y-3 prose" variants={itemVariants}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl md:text-2xl mt-0 font-semibold leading-tight text-foreground">{title}</h3>
            {description && <div className="text-sm text-muted-foreground leading-relaxed">{description}</div>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <EditOnGitHubButton githubUrl={githubUrl} toolTitle={title} />
            <ReportIssueButton toolTitle={title} />
          </div>
        </div>
      </motion.div>
      <motion.div className="space-y-8 text-foreground prose mt-6" variants={itemVariants}>
        {children}
      </motion.div>
    </motion.div>
  );
}
