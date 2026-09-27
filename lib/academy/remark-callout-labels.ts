/**
 * Remark plugin for the Academy collection (source.config.ts): gives every MDX <Callout> a
 * data-callout attribute with its kind and, unless it labels itself or is a quote, a
 * data-callout-label attribute with its label (spec 4.3). It works on the MDX tree, so it reaches
 * callouts whether the file imports Callout or takes it from the components map; fumadocs-ui passes
 * both attributes to the callout's root element (node_modules/fumadocs-ui/dist/components/callout.js:5-6,
 * :15-20). It returns a new tree and never changes the one it is given.
 */
import { calloutMarks } from './callout-label';

export interface MdAttribute {
  type: string;
  name?: string;
  value?: unknown;
}

export interface MdNode {
  type: string;
  name?: string | null;
  value?: unknown;
  attributes?: MdAttribute[];
  children?: MdNode[];
}

const JSX_ELEMENTS: ReadonlySet<string> = new Set(['mdxJsxFlowElement', 'mdxJsxTextElement']);

/** The last string value of a JSX attribute, as React receives it; undefined when absent or an expression. */
function stringAttribute(node: MdNode, name: string): string | undefined {
  const match = (node.attributes ?? []).filter((a) => a.type === 'mdxJsxAttribute' && a.name === name).at(-1);
  return match !== undefined && typeof match.value === 'string' ? match.value : undefined;
}

function plainText(node: MdNode): string {
  if (node.type === 'text' || node.type === 'inlineCode') return typeof node.value === 'string' ? node.value : '';
  return (node.children ?? []).map(plainText).join('');
}

/** The title attribute, then the first child of the body that has text. */
function openingText(node: MdNode): string {
  const title = stringAttribute(node, 'title') ?? '';
  const body = (node.children ?? []).map(plainText).find((text) => text.trim() !== '') ?? '';
  return [title, body].filter((part) => part !== '').join(' ');
}

function withMarks(node: MdNode): MdNode {
  const marks = calloutMarks(stringAttribute(node, 'type'), openingText(node));
  if (marks === null) return node;
  const kind: MdAttribute = { type: 'mdxJsxAttribute', name: 'data-callout', value: marks.kind };
  const label: MdAttribute[] = marks.label === null ? [] : [{ type: 'mdxJsxAttribute', name: 'data-callout-label', value: marks.label }];
  return { ...node, attributes: [...(node.attributes ?? []), kind, ...label] };
}

/** A copy of the tree with every Callout element marked. */
export function markCallouts(node: MdNode): MdNode {
  const children = node.children?.map(markCallouts);
  const next = children === undefined ? node : { ...node, children };
  return JSX_ELEMENTS.has(next.type) && next.name === 'Callout' ? withMarks(next) : next;
}

export function remarkCalloutLabels() {
  return (tree: MdNode): MdNode => markCallouts(tree);
}

const MARKS: ReadonlySet<string> = new Set(['data-callout', 'data-callout-label']);

/**
 * The Academy's remarkStructure attribute filter: fumadocs' default (every attribute of a TypeTable
 * or Callout, fumadocs-core 16.0.15, dist/chunk-SLIKY7GW.js:19-22) without the two marks, so the
 * search index built from structuredData (utils/update-index.ts) stays as it was.
 */
export function indexedMdxAttribute(node: Pick<MdNode, 'name'>, attribute: MdAttribute): boolean {
  if (attribute.type === 'mdxJsxAttribute' && MARKS.has(attribute.name ?? '')) return false;
  return node.name === 'TypeTable' || node.name === 'Callout';
}
