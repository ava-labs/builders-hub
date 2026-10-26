'use client';
import { cn } from '@/utils/cn';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { type SyntheticEvent, useEffect, useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
} from 'fumadocs-ui/components/ui/collapsible';
import { cva } from 'class-variance-authority';
import { usePathname } from 'next/navigation';
import { CopyMarkdownLabels } from '@/components/ui/copy-markdown-labels';
import { useCopiedFlash } from '@/hooks/use-copied-flash';

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
}

export function Feedback({
  onRateAction,
  path,
  title,
  pagePath,
}: UnifiedFeedbackProps) {
  const pathname = usePathname();
  const [previous, setPrevious] = useState<Feedback | null>(null);
  const [opinion, setOpinion] = useState<'yes' | 'no' | null>(null);
  const [message, setMessage] = useState('');
  const [isCopyingMarkdown, setIsCopyingMarkdown] = useState(false);
  // docs-copy-markdown: Copied holds 2s after the last copy; a second copy restarts the wait, unmount cancels it.
  const [isCopied, showCopied, hideCopied] = useCopiedFlash(2000);

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
    setIsCopyingMarkdown(true);
    hideCopied();

    try {
      // Fetch the markdown content by appending .md to the page path
      const apiUrl = `${window.location.origin}${pagePath}.md`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch markdown content');
      }

      const markdownContent = await response.text();
      await navigator.clipboard.writeText(markdownContent);
      showCopied();
    } catch (err) {
      console.error('Failed to copy markdown:', err);
      // Fallback to copying the page URL
      try {
        await navigator.clipboard.writeText(`${window.location.origin}${pagePath}`);
        showCopied();
      } catch (clipboardErr) {
        console.error('Failed to copy URL:', clipboardErr);
      }
    } finally {
      setIsCopyingMarkdown(false);
    }
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

        <div className="flex flex-row items-center gap-1.5">
          <button
            onClick={handleCopyMarkdown}
            disabled={isCopyingMarkdown}
            className={cn(rateButtonVariants(), "gap-2 no-underline text-sm")}
          >
            <CopyMarkdownLabels
              state={isCopied ? 'done' : isCopyingMarkdown ? 'busy' : 'idle'}
              done="Copied"
            />
          </button>

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
