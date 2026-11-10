import { readFileSync } from 'node:fs';
import path from 'node:path';
import postcss, { type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { LIGHT_FILL_LABEL, isLightFill, renderWithLightFillLabels, withDarkLabelsOnLightFills } from '@/components/content-design/mermaid-light-fills';

// Every author fill set in content/academy charts; content/docs sets none.
const AUTHOR_FILLS = ['#FFB6C6', '#fef3c7', '#f0f9ff', '#d1fae5', '#90EE90', '#fee2e2', '#FFE4B5', '#FFD700'];
// A label colour, the value of the --ac-ink-on-light token (academy-tokens.css).
const INK = '#1f1f1f';

describe('isLightFill', () => {
  it('treats every author fill used in content/academy as light', () => {
    AUTHOR_FILLS.forEach((fill) => expect(isLightFill(fill)).toBe(true));
  });

  it.each(['#1e3a8a', '#333', '#888888', 'lightgreen', 'rgb(255, 255, 255)'])('does not treat %s as light', (fill) => {
    expect(isLightFill(fill)).toBe(false);
  });

  it('reads three- and eight-digit hex', () => {
    expect(isLightFill('#9f6')).toBe(true);
    expect(isLightFill('#123')).toBe(false);
    expect(isLightFill('#d1fae580')).toBe(true);
  });
});

describe('withDarkLabelsOnLightFills', () => {
  it('adds the label colour to style lines with a light fill (access-restriction/03-precompile-flow/02-automatic-enforcement.mdx:58-63)', () => {
    const chart = ['    D -->|HasRole?| J[Execute]', '', '    style Z1 fill:#FFB6C6', '    style J fill:#90EE90'].join('\n');
    expect(withDarkLabelsOnLightFills(chart, INK)).toBe(
      ['    D -->|HasRole?| J[Execute]', '', '    style Z1 fill:#FFB6C6,color:#1f1f1f', '    style J fill:#90EE90,color:#1f1f1f'].join('\n'),
    );
  });

  it('keeps the other properties of the line (permissioned-l1s/06-multisig-setup/01-poa-manager.mdx:52)', () => {
    expect(withDarkLabelsOnLightFills('    style MS fill:#f0f9ff,stroke:#0369a1', INK)).toBe('    style MS fill:#f0f9ff,stroke:#0369a1,color:#1f1f1f');
  });

  it('adds it to classDef lines too', () => {
    expect(withDarkLabelsOnLightFills('  classDef done fill:#d1fae5,stroke:#059669', INK)).toBe('  classDef done fill:#d1fae5,stroke:#059669,color:#1f1f1f');
  });

  it('keeps a line that sets its own colour, a dark fill and every other line', () => {
    const chart = '  style A fill:#f9f,color:#333\n  style B fill:#1e3a8a\ngraph TD\n  A --> B';
    expect(withDarkLabelsOnLightFills(chart, INK)).toBe(chart);
  });

  it('keeps a trailing semicolon and a carriage return', () => {
    expect(withDarkLabelsOnLightFills('  style A fill:#fff;\r', INK)).toBe('  style A fill:#fff,color:#1f1f1f;\r');
  });
});

describe('renderWithLightFillLabels: the fix runs only inside the Academy root', () => {
  const CHART = '    style MS fill:#f0f9ff,stroke:#0369a1';
  const inside = { closest: (selectors: string) => (selectors === '[data-academy]' ? ({} as Element) : null) } as unknown as Element;
  const outside = { closest: () => null } as unknown as Element;
  // A stand-in for mermaid.render: it records each source and draws it inside an svg.
  const fakeRender = () => {
    const sources: string[] = [];
    const render = async (source: string) => {
      sources.push(source);
      return `<svg>${source}</svg>`;
    };
    return { sources, render };
  };

  it('renders the chart as written outside the Academy, in both themes, and returns its svg as it is', async () => {
    for (const theme of ['dark', 'light'] as const) {
      const { sources, render } = fakeRender();
      expect(await renderWithLightFillLabels(render, CHART, theme, outside)).toBe(`<svg>${CHART}</svg>`);
      expect(sources).toEqual([CHART]);
    }
  });

  it('renders the chart as written in the light theme inside the Academy', async () => {
    const { sources, render } = fakeRender();
    expect(await renderWithLightFillLabels(render, CHART, 'light', inside)).toBe(`<svg>${CHART}</svg>`);
    expect(sources).toEqual([CHART]);
  });

  it('gives light fills the token as their label colour in the dark theme inside the Academy, through a word the style grammar reads', async () => {
    const { sources, render } = fakeRender();
    const svg = await renderWithLightFillLabels(render, CHART, 'dark', inside);
    expect(sources).toEqual(['    style MS fill:#f0f9ff,stroke:#0369a1,color:acInkOnLight']);
    expect(svg).toBe('<svg>    style MS fill:#f0f9ff,stroke:#0369a1,color:var(--ac-ink-on-light)</svg>');
  });

  it('returns the svg as it is for an Academy chart without light fills, even one that shows the placeholder word', async () => {
    const chart = '  style B fill:#1e3a8a\n  A[acInkOnLight] --> B';
    const { sources, render } = fakeRender();
    expect(await renderWithLightFillLabels(render, chart, 'dark', inside)).toBe(`<svg>${chart}</svg>`);
    expect(sources).toEqual([chart]);
  });
});

describe('the label token', () => {
  it('is var(--ac-ink-on-light), #1f1f1f on the Academy root and defined nowhere else, so dark keeps it', () => {
    const TOKEN = '--ac-ink-on-light';
    const css = postcss.parse(readFileSync(path.join(process.cwd(), 'components/academy/theme/academy-tokens.css'), 'utf8'));
    const found: string[] = [];
    css.walkDecls(TOKEN, (decl) => {
      found.push(`${(decl.parent as Rule | undefined)?.selector ?? '?'} ${decl.value}`);
    });
    expect(LIGHT_FILL_LABEL).toBe(`var(${TOKEN})`);
    expect(found).toEqual(['[data-academy] #1f1f1f']);
  });
});
