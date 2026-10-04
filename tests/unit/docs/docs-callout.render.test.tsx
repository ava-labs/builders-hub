import { describe, expect, it } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocsCallout, type DocsCalloutProps } from '@/components/docs-book/callout';

const callout = (props: Omit<DocsCalloutProps, 'children'>, children: ReactNode = 'Keep the key safe.') =>
  renderToStaticMarkup(createElement(DocsCallout, props, children));
/** The word in the label row, or null when the callout has no label row. */
const label = (html: string) => /<p data-bk-callout-label="">.*?<\/span>([^<]*)<\/p>/.exec(html)?.[1] ?? null;
/** The family (data-bk-callout) on the root element. */
const family = (html: string) => /^<div [^>]*data-bk-callout="([^"]*)"/.exec(html)?.[1];
/** The opening tag of the element that carries `marker`. */
const tagWith = (html: string, marker: string) =>
  html.slice(html.lastIndexOf('<', html.indexOf(marker)), html.indexOf('>', html.indexOf(marker)) + 1);

describe('DocsCallout markup', () => {
  it('is a note with an accessible name', () => {
    const root = tagWith(callout({}), 'role="note"');
    expect(root).toMatch(/^<div /);
    expect(root).toContain('aria-label="Note"');
  });

  it.each([
    ['info', 'Note', 'note'],
    [undefined, 'Note', 'note'],
    ['warn', 'Warning', 'warning'],
    ['warning', 'Warning', 'warning'],
    ['error', 'Danger', 'danger'],
  ] as const)('gives type %s the label %s and the %s family', (type, word, kind) => {
    const html = callout({ type });
    expect(label(html)).toBe(word);
    expect(family(html)).toBe(kind);
    expect(tagWith(html, 'role="note"')).toContain(`aria-label="${word}"`);
  });

  it.each(['Note', 'Caution', 'Caution:', 'caution'])('uses the title %s as the label and shows no lead', (title) => {
    const html = callout({ type: 'info', title });
    const word = title.replace(/:$/, '');
    expect(label(html)).toBe(word[0].toUpperCase() + word.slice(1));
    expect(html).not.toContain('data-bk-callout-lead');
  });

  it('gives the title Caution with no type the warning family', () => {
    const html = callout({ title: 'Caution' });
    expect(family(html)).toBe('warning');
    expect(label(html)).toBe('Caution');
    expect(tagWith(html, 'role="note"')).toContain('aria-label="Caution"');
  });

  it('shows any other title as the lead under the label', () => {
    const html = callout({ title: 'Save the registry address' });
    expect(label(html)).toBe('Note');
    expect(html).toContain('<p data-bk-callout-lead="">Save the registry address</p>');
    expect(html.indexOf('data-bk-callout-label')).toBeLessThan(html.indexOf('data-bk-callout-lead'));
    expect(html.indexOf('data-bk-callout-lead')).toBeLessThan(html.indexOf('data-bk-callout-body'));
  });

  it.each([
    ['"Note:"', createElement('p', null, 'Note: keep this key safe.')],
    ['"**Info:**"', createElement('p', null, createElement('strong', null, 'Info:'), ' run the node first.')],
  ])('shows no label row when the body opens with %s', (_, body) => {
    const html = callout({}, body);
    expect(label(html)).toBeNull();
    expect(html).not.toContain('data-bk-callout-label');
    expect(tagWith(html, 'role="note"')).toContain('aria-label="Note"');
  });

  it('draws the peak on a note and the slide on a warning, hidden from screen readers', () => {
    const note = tagWith(callout({ art: true }), 'data-bk-art=');
    expect(note).toContain('data-bk-art="peak"');
    expect(note).toContain('aria-hidden="true"');
    const warning = tagWith(callout({ type: 'warn', art: true }), 'data-bk-art=');
    expect(warning).toContain('data-bk-art="slide"');
    expect(warning).toContain('aria-hidden="true"');
  });

  it('draws no art when art is not set', () => {
    expect(callout({})).not.toContain('data-bk-art');
  });
});
