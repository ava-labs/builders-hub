'use client';
import { cn } from '@/utils/cn';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { ThumbsDown, ThumbsUp, PencilIcon, AlertCircle, Copy, ChevronDown, ExternalLink, Check } from 'lucide-react';
import { type SyntheticEvent, useEffect, useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
} from 'fumadocs-ui/components/ui/collapsible';
import { cva } from 'class-variance-authority';
import { usePathname } from 'next/navigation';
import newGithubIssueUrl from 'new-github-issue-url';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const rateButtonVariants = cva(
  'inline-flex items-center gap-2 px-3 py-2 rounded-full font-medium border text-sm [&_svg]:size-4 disabled:cursor-not-allowed transition-colors hover:bg-fd-accent/80 hover:text-fd-accent-foreground',
  {
    variants: {
      active: {
        true: 'bg-fd-accent text-fd-accent-foreground [&_svg]:fill-current',
        false: 'text-fd-muted-foreground',
      },
    },
  },
);

export interface Feedback {
  opinion: 'yes' | 'no';
  message: string;
}

function get(url: string): Feedback | null {
  const item = localStorage.getItem(`document-feedback-${url}`);

  if (item === null) return null;
  return JSON.parse(item) as Feedback;
}

function set(url: string, feedback: Feedback | null) {
  const key = `document-feedback-${url}`;
  if (feedback) localStorage.setItem(key, JSON.stringify(feedback));
  else localStorage.removeItem(key);
}

export interface UnifiedFeedbackProps {
  onRateAction: (url: string, feedback: Feedback) => Promise<void>;
  path: string;
  title: string;
  pagePath: string;
  editUrl: string;
}

export function Feedback({
  onRateAction,
  path,
  title,
  pagePath,
  editUrl,
}: UnifiedFeedbackProps) {
  const pathname = usePathname();
  const [previous, setPrevious] = useState<Feedback | null>(null);
  const [opinion, setOpinion] = useState<'yes' | 'no' | null>(null);
  const [message, setMessage] = useState('');
  const [isCopyingMarkdown, setIsCopyingMarkdown] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    setPrevious(get(pathname));
  }, [pathname]);

  function submit(e?: SyntheticEvent) {
    e?.preventDefault();
    if (opinion == null) return;

    const feedback: Feedback = {
      opinion,
      message,
    };

    void onRateAction(pathname, feedback);

    set(pathname, feedback);
    setPrevious(feedback);
    setMessage('');
    setOpinion(null);
  }

  const handleCopyMarkdown = async () => {
    const markdownUrl = `${window.location.origin}${pagePath}`;
    setIsCopyingMarkdown(true);
    setIsCopied(false);
    try {
      // Fetch the markdown content
      const response = await fetch(markdownUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch markdown content');
      }
      const markdownContent = await response.text();
      
      // Copy the content to clipboard
      await navigator.clipboard.writeText(markdownContent);
      setIsCopied(true);
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy markdown:', err);
      // Fallback to copying just the URL if fetching fails
      try {
        await navigator.clipboard.writeText(markdownUrl);
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      } catch (clipboardErr) {
        console.error('Failed to copy URL:', clipboardErr);
      }
    } finally {
      setIsCopyingMarkdown(false);
    }
  };

  const openInChatGPT = () => {
    const mdxUrl = `${window.location.origin}${pagePath}`;
    const prompt = `Read ${mdxUrl}, I want to ask questions about it.`;
    const chatGPTUrl = `https://chat.openai.com/?q=${encodeURIComponent(prompt)}`;
    window.open(chatGPTUrl, '_blank', 'noopener,noreferrer');
  };

  const openInClaude = () => {
    const mdxUrl = `${window.location.origin}${pagePath}`;
    const prompt = `Read ${mdxUrl}, I want to ask questions about it.`;
    const claudeUrl = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    window.open(claudeUrl, '_blank', 'noopener,noreferrer');
  };



  return (
    <Collapsible
      open={opinion !== null || previous !== null}
      onOpenChange={(v) => {
        if (!v) setOpinion(null);
      }}
      className="border-y py-3"
    >
      <div className="flex flex-col flex-wrap sm:flex-row items-start  justify-between gap-3 gap-y-3 sm:gap-x-0 sm:items-center">
        <div className="flex flex-row items-center gap-1.5">
          <p className="text-sm font-medium pe-2">Is this guide helpful?</p>
          <button
            disabled={previous !== null}
            className={cn(
              rateButtonVariants({
                active: (previous?.opinion ?? opinion) === 'yes',
              }),
            )}
            onClick={() => {
              setOpinion('yes');
            }}
          >
            <ThumbsUp />
            Yes
          </button>
          <button
            disabled={previous !== null}
            className={cn(
              rateButtonVariants({
                active: (previous?.opinion ?? opinion) === 'no',
              }),
            )}
            onClick={() => {
              setOpinion('no');
            }}
          >
            <ThumbsDown />
            No
          </button>
        </div>

        <div className="flex flex-row items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={handleCopyMarkdown}
            disabled={isCopyingMarkdown}
            className={cn(rateButtonVariants(), "gap-2 no-underline text-sm")}
          >
            {isCopied ? (
              <>
                <Check className="size-4" />
                Copied
              </>
            ) : isCopyingMarkdown ? (
              <>
                <Copy className="size-4" />
                Copying...
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copy Markdown
              </>
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(rateButtonVariants(), "gap-2 no-underline text-sm")}
              >
                Open <ChevronDown className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <a
                  href={editUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  Open in GitHub
                  <ExternalLink className="size-3 ml-auto" />
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openInChatGPT} className="flex items-center gap-2 cursor-pointer">
                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
                </svg>
                Open in ChatGPT
                <ExternalLink className="size-3 ml-auto" />
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openInClaude} className="flex items-center gap-2 cursor-pointer">
                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.96 0L6.583 24h4.677L22.635 0h-4.676zM7.805 0L1.222 13.04v.002L0 15.548V24h4.11V15.548h.002L10.445 0H7.805z"/>
                </svg>
                Open in Claude
                <ExternalLink className="size-3 ml-auto" />
              </DropdownMenuItem>

            </DropdownMenuContent>
          </DropdownMenu>

          <a
            href={newGithubIssueUrl({
              user: 'ava-labs',
              repo: 'builders-hub',
              title: `Update ${title} information`,
              body: `It appears that the information on this page might be outdated. Please review and update as needed.

Page: [${pagePath}](https://build.avax.network${pagePath})

[Provide more details here...]`,
              labels: ['outdated', 'documentation'],
            })}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(rateButtonVariants(), "gap-2 no-underline text-sm")}
          >
            <AlertCircle className="size-4" /> Report Issue
          </a>
        </div>
      </div>

      <CollapsibleContent className="mt-3">
        {previous ? (
          <div className="px-3 py-6 flex flex-col items-center gap-3 bg-fd-card text-fd-card-foreground text-sm text-center rounded-xl text-fd-muted-foreground">
            <p>Thank you for your feedback!</p>
            <button
              className={cn(
                buttonVariants({
                  color: 'secondary',
                }),
                'text-xs',
              )}
              onClick={() => {
                setOpinion(previous?.opinion);
                set(pathname, null);
                setPrevious(null);
              }}
            >
              Submit Again?
            </button>
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="border rounded-lg bg-fd-secondary text-fd-secondary-foreground p-3 resize-none focus-visible:outline-none placeholder:text-fd-muted-foreground"
              placeholder="Leave your feedback..."
              onKeyDown={(e) => {
                if (!e.shiftKey && e.key === 'Enter') {
                  submit(e);
                }
              }}
            />
            <button
              type="submit"
              className={cn(buttonVariants({ color: 'outline' }), 'w-fit px-3')}
            >
              Submit
            </button>
          </form>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
