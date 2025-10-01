'use client';

import { cn } from '@/utils/cn';
import { Github, AlertCircle, MessageSquare, ChevronDown, ExternalLink } from 'lucide-react';
import newGithubIssueUrl from 'new-github-issue-url';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface SidebarActionsProps {
  editUrl: string;
  title: string;
  pagePath: string;
  pageType?: 'docs' | 'academy';
}

export function SidebarActions({ 
  editUrl, 
  title, 
  pagePath,
  pageType = 'docs' 
}: SidebarActionsProps) {
  const openInChatGPT = () => {
    const mdxUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://build.avax.network'}${pagePath}`;
    const prompt = `Read ${mdxUrl}, I want to ask questions about it.`;
    const chatGPTUrl = `https://chat.openai.com/?q=${encodeURIComponent(prompt)}`;
    window.open(chatGPTUrl, '_blank', 'noopener,noreferrer');
  };

  const openInClaude = () => {
    const mdxUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://build.avax.network'}${pagePath}`;
    const prompt = `Read ${mdxUrl}, I want to ask questions about it.`;
    const claudeUrl = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    window.open(claudeUrl, '_blank', 'noopener,noreferrer');
  };

  const reportIssueUrl = newGithubIssueUrl({
    user: 'ava-labs',
    repo: 'builders-hub',
    title: `Update ${title} information`,
    body: `It appears that the information on this page might be outdated. Please review and update as needed.

Page: [${pagePath}](https://build.avax.network${pagePath})

[Provide more details here...]`,
    labels: pageType === 'academy' ? ['outdated', 'Academy'] : ['outdated', 'Docs'],
  });

  return (
    <div className="flex flex-col gap-3 pb-4 border-t pt-4">
      <p className="text-sm font-medium text-muted-foreground mb-1">Page Actions</p>
      
      {/* Primary action: Edit on GitHub */}
      <Button 
        variant="default" 
        size="sm" 
        className="w-full justify-start gap-2"
        asChild
      >
        <a
          href={editUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          <Github className="size-4" />
          Edit on GitHub
          <ExternalLink className="size-3 ml-auto" />
        </a>
      </Button>

      {/* Secondary action: Report Issue */}
      <Button 
        variant="outline" 
        size="sm"
        className="w-full justify-start gap-2"
        asChild
      >
        <a
          href={reportIssueUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          <AlertCircle className="size-4" />
          Report Issue
          <ExternalLink className="size-3 ml-auto" />
        </a>
      </Button>

      {/* AI Assistant Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
          >
            <MessageSquare className="size-4" />
            Open in AI
            <ChevronDown className="size-3 ml-auto" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={openInChatGPT} className="flex items-center gap-2 cursor-pointer">
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
            </svg>
            ChatGPT
            <ExternalLink className="size-3 ml-auto" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openInClaude} className="flex items-center gap-2 cursor-pointer">
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.96 0L6.583 24h4.677L22.635 0h-4.676zM7.805 0L1.222 13.04v.002L0 15.548V24h4.11V15.548h.002L10.445 0H7.805z"/>
            </svg>
            Claude
            <ExternalLink className="size-3 ml-auto" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
