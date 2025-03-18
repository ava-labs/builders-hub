'use client';
import { cn } from '@/utils/cn';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { ThumbsDown, ThumbsUp, PencilIcon, AlertCircle } from 'lucide-react';
import { type SyntheticEvent, useEffect, useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
} from 'fumadocs-ui/components/ui/collapsible';
import { cva } from 'class-variance-authority';
import { usePathname } from 'next/navigation';
import newGithubIssueUrl from 'new-github-issue-url';
 
const rateButtonVariants = cva(
  'inline-flex items-center gap-2 px-3 py-2 rounded-full font-medium border text-sm [&_svg]:size-4 disabled:cursor-not-allowed',
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
 
  return (
    <Collapsible
      open={opinion !== null || previous !== null}
      onOpenChange={(v) => {
        if (!v) setOpinion(null);
      }}
      className="border-y py-3"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
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
          <a
            href={`https://github.com/ava-labs/builders-hub/edit/master/${path}`}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(rateButtonVariants(), "gap-2 no-underline text-sm")}
          >
            <PencilIcon className="size-4" /> Edit on GitHub
          </a>
          
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
