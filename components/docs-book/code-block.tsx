'use client';

import { CodeBlock, Pre, type CodeBlockProps } from 'fumadocs-ui/components/codeblock';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { Check, Clipboard } from 'lucide-react';
import { useCopiedFlash } from '@/hooks/use-copied-flash';
import { cn } from '@/utils/cn';

/* docs-code-copy: fumadocs' copy button renders one icon at a time, so the clipboard turned into a check in one frame.
   This button keeps both icons stacked in one cell and cross-fades them: the leaving icon goes to opacity 0, scale 0.8
   and a 2px blur while the other comes back, 150ms on the strong ease-out. The check holds 1500ms after the last copy,
   then the morph runs backwards. A press scales the button to 0.97. Under Reduce Motion the icons cross-fade in 120ms
   (!important wins over the site policy's 150ms) with no scale, no blur and no press. */
const ICON = 'col-start-1 row-start-1 transition-[opacity,scale,filter] duration-150 ease-out motion-reduce:duration-120!';
const ICON_HIDDEN = 'opacity-0 motion-safe:scale-80 motion-safe:blur-[2px]';

/** A code block in the docs MDX: the fumadocs block (app/docs/book/code.css), with the copy button below. */
export function DocsCodeBlock({ children, allowCopy = true, ...props }: CodeBlockProps) {
  return (
    <CodeBlock
      {...props}
      allowCopy={false}
      Actions={({ className }) => (
        <div className={cn('empty:hidden', className)}>{allowCopy && <CopyCodeButton />}</div>
      )}
    >
      <Pre>{children}</Pre>
    </CodeBlock>
  );
}

/** The text that fumadocs' button copies: the block's pre, each .nd-copy-ignore mark read as a line break. */
function codeText(button: HTMLElement): string | null {
  const pre = button.closest('figure')?.querySelector('[role="region"] pre');
  if (!pre) return null;
  const clone = pre.cloneNode(true) as Element;
  clone.querySelectorAll('.nd-copy-ignore').forEach((node) => node.replaceWith('\n'));
  return clone.textContent ?? '';
}

function CopyCodeButton() {
  const [copied, showCopied] = useCopiedFlash(1500);

  const copy = async (button: HTMLElement) => {
    const text = codeText(button);
    if (text === null) return;
    await navigator.clipboard.writeText(text);
    showCopied();
  };

  return (
    <button
      type="button"
      data-checked={copied || undefined}
      aria-label={copied ? 'Copied Text' : 'Copy Text'}
      onClick={(event) => {
        copy(event.currentTarget).catch((error: unknown) => console.error('Failed to copy code:', error));
      }}
      className={cn(
        buttonVariants({
          size: 'icon-xs',
          className: 'hover:text-fd-accent-foreground data-checked:text-fd-accent-foreground',
        }),
        'transition-[color,background-color,scale] duration-120 ease-out active:scale-[0.97] motion-reduce:active:scale-100',
      )}
    >
      <span className="grid">
        <Clipboard className={cn(ICON, copied && ICON_HIDDEN)} />
        <Check className={cn(ICON, !copied && ICON_HIDDEN)} />
      </span>
    </button>
  );
}
