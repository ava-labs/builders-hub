import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { structure } from 'fumadocs-core/mdx-plugins';
import { remark } from 'remark';
import remarkMdx from 'remark-mdx';
import { describe, expect, it } from 'vitest';
import { indexedMdxAttribute, markCallouts, remarkCalloutLabels, type MdAttribute, type MdNode } from '@/lib/academy/remark-callout-labels';

const jsx = (name: string, attributes: MdAttribute[], children: MdNode[]): MdNode => ({ type: 'mdxJsxFlowElement', name, attributes, children });
const attr = (name: string, value: string): MdAttribute => ({ type: 'mdxJsxAttribute', name, value });
const paragraph = (...children: MdNode[]): MdNode => ({ type: 'paragraph', children });
const text = (value: string): MdNode => ({ type: 'text', value });
const root = (...children: MdNode[]): MdNode => ({ type: 'root', children });
const marksOf = (node: MdNode | undefined) => Object.fromEntries((node?.attributes ?? []).filter((a) => a.name?.startsWith('data-callout')).map((a) => [a.name, a.value]));

describe('markCallouts', () => {
  it('marks a plain info callout with its kind and the Note label', () => {
    const tree = markCallouts(root(jsx('Callout', [attr('type', 'info')], [paragraph(text('Save the Teleporter Registry address'))])));
    expect(marksOf(tree.children?.[0])).toEqual({ 'data-callout': 'info', 'data-callout-label': 'Note' });
  });

  it('takes the last type attribute, as React does, and resolves warn to warning', () => {
    const tree = markCallouts(root(jsx('Callout', [attr('type', 'warning'), attr('type', 'warn')], [paragraph(text("Don't hit create chain yet"))])));
    expect(marksOf(tree.children?.[0])).toEqual({ 'data-callout': 'warning', 'data-callout-label': 'Caution' });
  });

  it('reads the title attribute before the body', () => {
    const tree = markCallouts(root(jsx('Callout', [attr('title', 'Note'), attr('type', 'info')], [paragraph(text('Keep this address handy'))])));
    expect(marksOf(tree.children?.[0])).toEqual({ 'data-callout': 'info' });
  });

  it('reads a bold label word in the body (**Note**: ...)', () => {
    const body = paragraph({ type: 'strong', children: [text('Note')] }, text(': Hosted relayers are free and perfect for testing.'));
    const tree = markCallouts(root(jsx('Callout', [attr('type', 'info')], [body])));
    expect(marksOf(tree.children?.[0])).toEqual({ 'data-callout': 'info' });
  });

  it('marks a quote with its kind and no label', () => {
    const tree = markCallouts(root(jsx('Callout', [attr('type', 'quote')], [jsx('div', [], [paragraph(text('"The most effective ways..."'))])])));
    expect(marksOf(tree.children?.[0])).toEqual({ 'data-callout': 'quote' });
  });

  it('leaves unknown types and other elements unmarked, and never changes its input', () => {
    const input = root(jsx('Steps', [], [jsx('Callout', [attr('type', 'infor')], [paragraph(text('x'))]), jsx('Callout', [], [paragraph(text('Inside a step'))])]));
    const before = structuredClone(input);
    const tree = remarkCalloutLabels()(input);
    expect(input).toEqual(before);
    const [unknown, nested] = tree.children?.[0].children ?? [];
    expect(marksOf(tree.children?.[0])).toEqual({});
    expect(marksOf(unknown)).toEqual({});
    expect(marksOf(nested)).toEqual({ 'data-callout': 'info', 'data-callout-label': 'Note' });
  });
});

const ACADEMY = path.join(process.cwd(), 'content/academy');
const mdxFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return mdxFiles(full);
    return entry.name.endsWith('.mdx') ? [full] : [];
  });
const callouts = (node: MdNode): MdNode[] => {
  const own = (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name === 'Callout' ? [node] : [];
  return own.concat((node.children ?? []).flatMap(callouts));
};

// These tests parse each Academy MDX file that holds a Callout (100 files), so they get more than the 5 s default.
describe('remarkCalloutLabels on content/academy', { timeout: 30_000 }, () => {
  it('marks every Callout in the Academy MDX files and labels no quote', () => {
    const parser = remark().use(remarkMdx);
    const marked = mdxFiles(ACADEMY)
      .map((file) => readFileSync(file, 'utf8'))
      .filter((source) => source.includes('<Callout'))
      .flatMap((source) => callouts(markCallouts(parser.parse(source) as unknown as MdNode)));
    expect(marked.length).toBeGreaterThan(0);
    expect(marked.filter((node) => marksOf(node)['data-callout'] === undefined)).toEqual([]);
    expect(marked.filter((node) => marksOf(node)['data-callout'] === 'quote' && 'data-callout-label' in marksOf(node))).toEqual([]);
  });
});

// fumadocs' remarkStructure indexes every attribute of a Callout by default, and utils/update-index.ts
// syncs that index to the site search; the marks must not reach it.
describe('indexedMdxAttribute on content/academy', { timeout: 30_000 }, () => {
  it('keeps the marks out of the search index: every callout page indexes as it does without the plugin', () => {
    const changed = mdxFiles(ACADEMY).filter((file) => {
      const source = readFileSync(file, 'utf8');
      if (!source.includes('<Callout')) return false;
      const marked = structure(source, [remarkMdx, remarkCalloutLabels], { allowedMdxAttributes: indexedMdxAttribute });
      return JSON.stringify(marked) !== JSON.stringify(structure(source, [remarkMdx]));
    });
    expect(changed.map((file) => path.relative(ACADEMY, file))).toEqual([]);
  });
});
