import type { CalloutType } from 'fumadocs-ui/components/callout';
import { Info, Lightbulb, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import { isValidElement, type ComponentProps, type ReactNode } from 'react';
import { CalloutArt, type CalloutArtKind } from '@/components/docs-book/callout-art';
import { opensWithLabelWord, resolveCalloutKind } from '@/lib/academy/callout-label';

type Family = 'note' | 'warning' | 'danger';

interface Mark {
  family: Family;
  label: string;
  Icon: LucideIcon;
  /** The art that `art={true}` draws. */
  art: CalloutArtKind;
}

const NOTE: Mark = { family: 'note', label: 'Note', Icon: Info, art: 'peak' };
const TIP: Mark = { family: 'note', label: 'Tip', Icon: Lightbulb, art: 'peak' };
const WARNING: Mark = { family: 'warning', label: 'Warning', Icon: TriangleAlert, art: 'slide' };
const DANGER: Mark = { family: 'danger', label: 'Danger', Icon: OctagonAlert, art: 'slide' };

/** The family, label and icon of a callout type. */
function markOf(type: string | undefined): Mark {
  // resolveCalloutKind folds "tip" into "info", so read "tip" first.
  if (type === 'tip') return TIP;
  switch (resolveCalloutKind(type)) {
    case 'success':
      return TIP;
    case 'warning':
    case 'idea':
      return WARNING;
    case 'error':
      return DANGER;
    default:
      // info, quote, and types that fumadocs has no style for, such as "note".
      return NOTE;
  }
}

/**
 * The title as the label, when the title is one label word (Note, Caution, Important, Tip, Warning),
 * so that the word does not show twice. Any other title is the lead line.
 */
function titleLabel(title: ReactNode): string | null {
  if (typeof title !== 'string') return null;
  const word = title.trim().replace(/:$/, '');
  if (!/^[a-z]+$/i.test(word) || !opensWithLabelWord(word)) return null;
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

/** All the text in a tree of React nodes. */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((child) => textOf(child as ReactNode)).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

/** The text of the first block that has text, for example "Note: ..." or "**Info:** ..." in a blockquote. */
function openingText(node: ReactNode): string {
  const blocks = Array.isArray(node) ? node : [node];
  for (const block of blocks) {
    const text = textOf(block as ReactNode);
    if (text.trim() !== '') return text;
  }
  return '';
}

/** "Info:", "Deprecated:" or "WARNING:" at the start of the body: one word and a colon. */
const OPENING_LABEL = /^\s*([a-z]+)\s*:/i;

export type DocsCalloutProps = Omit<ComponentProps<'div'>, 'title'> & {
  type?: CalloutType | 'note' | 'tip';
  title?: ReactNode;
  icon?: ReactNode;
  /** A small engraving that floats left of the text. `true` picks the peak, or the slide for a warning. */
  art?: boolean | CalloutArtKind;
};

/**
 * Docs callout in the book style: a colored rule on the left, a label row (icon and word), an optional
 * lead line, then the body at the page's own text size and color. callout.css holds the look.
 */
export function DocsCallout({ type, title, icon, art, children, ...props }: DocsCalloutProps) {
  const labelFromTitle = titleLabel(title);
  // Five pages write <Callout title="Caution"> with no type. The word asks for the warning look.
  const warns = labelFromTitle === 'Caution' || labelFromTitle === 'Warning';
  const typed = markOf(type);
  const lead = labelFromTitle === null && title !== undefined && title !== null && title !== '' ? title : null;
  // A body that opens with its own label, as "> Note: ..." and "> **Info:** ..." do, already says what it is.
  const opening = openingText(children);
  const ownLabel = OPENING_LABEL.exec(opening)?.[1].toLowerCase() ?? null;
  const selfLabelled = opensWithLabelWord(opening) || ownLabel !== null;
  const showLabel = labelFromTitle !== null || lead !== null || !selfLabelled;
  // A title or an opening word that warns asks for the warning look, whatever the type says.
  const warnWord = ownLabel === 'warning' || ownLabel === 'caution' || ownLabel === 'danger';
  const mark = (warns || (!showLabel && warnWord)) && typed.family === 'note' ? WARNING : typed;
  const artKind = art === true ? mark.art : art || null;

  return (
    // The label row is text, but a name on the note lets a screen reader say "Warning, note" on entry.
    <div role="note" aria-label={labelFromTitle ?? mark.label} {...props} data-bk-callout={mark.family}>
      {showLabel && (
        <p data-bk-callout-label="">
          <span data-bk-callout-icon="" aria-hidden="true">
            {icon ?? <mark.Icon />}
          </span>
          {labelFromTitle ?? mark.label}
        </p>
      )}
      {artKind && <CalloutArt kind={artKind} data-bk-callout-art="" />}
      {lead !== null && <p data-bk-callout-lead="">{lead}</p>}
      <div data-bk-callout-body="">{children}</div>
    </div>
  );
}
