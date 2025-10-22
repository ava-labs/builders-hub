"use client";

import type { ReactNode } from "react";
import { ReportIssueButton } from "@/components/console/report-issue-button";
import { EditOnGitHubButton } from "@/components/console/edit-on-github-button";

interface ContainerProps {
  title: string;
  children: ReactNode;
  description?: ReactNode;
  githubUrl?: string;
}

// simplified container does not use color themes currently

export function Container({
  title,
  children,
  description,
  githubUrl,
}: ContainerProps) {
  return (
    <>
      <div className="space-y-3 prose">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0">
            <h3 className="text-xl md:text-2xl mt-0 font-semibold leading-tight text-foreground">
              {title}
            </h3>
            {description && (
              <div className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <EditOnGitHubButton githubUrl={githubUrl} toolTitle={title} />
            <ReportIssueButton toolTitle={title} />
          </div>
        </div>
      </div>
      <div className="space-y-8 text-foreground prose">{children}</div>
    </>
  );
}
