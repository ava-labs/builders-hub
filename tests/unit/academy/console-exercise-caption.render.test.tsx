import { describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The wallet, login and console header modules pull in the toolbox runtime; this file tests the
// caption and the frame, so those render as plain stand-ins.
vi.mock('@/components/toolbox/providers/WalletProvider', () => ({
  WalletProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/toolbox/components/console-header/EmbeddedConsoleHeader', () => ({
  EmbeddedConsoleHeader: () => 'Builder Console',
}));
vi.mock('@/components/login/LoginModal', () => ({ LoginModal: () => null }));
vi.mock('@/components/toolbox/academy/wrapper/ErrorFallback', () => ({ ErrorFallback: () => null }));

import ToolboxMdxWrapper from '@/components/toolbox/academy/wrapper/ToolboxMdxWrapper';
import { ConsoleExerciseCaption } from '@/components/toolbox/academy/wrapper/ConsoleExerciseCaption';

const caption = () => renderToStaticMarkup(createElement(ConsoleExerciseCaption));
const wrapper = () =>
  renderToStaticMarkup(createElement(ToolboxMdxWrapper, { children: createElement('p', null, 'tool body') }));
const frameTag = (html: string) => {
  const start = html.indexOf('<div data-console-frame');
  return html.slice(start, html.indexOf('>', start) + 1);
};

describe('ConsoleExerciseCaption (spec 4.3)', () => {
  it('reads "Interactive exercise" and leaves the console name to the frame header', () => {
    expect(caption()).toContain('>Interactive exercise<');
    expect(caption()).not.toContain('Builder Console');
  });

  it('draws the terminal glyph in an ink tile hidden from assistive technology', () => {
    expect(caption()).toMatch(/<span aria-hidden="true" class="[^"]*bg-ac-tile[^"]*text-ac-ink/);
    expect(caption()).toContain('lucide-square-terminal');
  });
});

describe('ToolboxMdxWrapper', () => {
  it('puts the caption directly above the console frame', () => {
    const html = wrapper();
    const label = html.indexOf('Interactive exercise');
    expect(label).toBeGreaterThan(-1);
    expect(html.slice(label, html.indexOf('data-console-frame'))).toBe('Interactive exercise</span></div><div ');
  });

  it('frames the console on the rule token and keeps its header and body inside the frame', () => {
    const html = wrapper();
    expect(frameTag(html)).toContain('rounded-xl border border-ac-rule');
    expect(frameTag(html)).not.toContain('border-gray-200');
    expect(html.indexOf('Builder Console')).toBeGreaterThan(html.indexOf('data-console-frame'));
    expect(html).toContain('<p>tool body</p>');
  });
});
