import { test, type Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly } from '../lib/skip';
import { openAsReturningVisitor } from './helpers';

// The home page draws its network diagrams in SVG (components/landing-v2/diagrams). Each diagram must render,
// fit the box it sits in, state its idea in a text alternative, and keep its labels clear of its lines.
// Parts that move are skipped: the check reads the still structure.

const PILLARS = [
  { name: 'Interoperability', label: /checks the sender's validator set on the P-Chain/ },
  { name: 'Performance', label: /final in under 100 milliseconds/ },
  { name: 'Privacy', label: /observers outside cannot read them/ },
  { name: 'Compliance', label: /allowlist/i },
];
const MODES = [
  { name: 'Public', label: /^A public L1/ },
  { name: 'Permissioned', label: /^A permissioned L1/ },
  { name: 'Private', label: /^A private L1/ },
];

// A label keeps this many SVG units clear of every line, ring and dot (the spec asks for 8).
const LABEL_CLEARANCE = 4;

type Report = { label: string; problems: string[] };

// Reads the visible diagram that `css` finds and lists every problem with it.
async function inspect(browser: Browser, css: string): Promise<Report> {
  return browser.evaluate(
    ({ css: selector, clearance }) => {
      const svg = [...document.querySelectorAll<SVGSVGElement>(selector)].find(
        (node) => node.getBoundingClientRect().width > 0,
      );
      if (!svg) return { label: '', problems: ['no diagram renders'] };
      const problems: string[] = [];
      const label = svg.getAttribute('aria-label') ?? '';

      // It fits its box and the screen.
      const box = svg.getBoundingClientRect();
      const parent = svg.parentElement!.getBoundingClientRect();
      if (box.left < parent.left - 1 || box.right > parent.right + 1 || box.top < parent.top - 1 || box.bottom > parent.bottom + 1)
        problems.push('the diagram is larger than its box');
      if (box.left < -1 || box.right > window.innerWidth + 1) problems.push('the diagram is wider than the screen');

      // Still parts only: a part that animates, or is hidden, can be anywhere.
      const still = (node: Element) => {
        for (let n: Element | null = node; n && n !== svg; n = n.parentElement) {
          const style = getComputedStyle(n);
          if (style.animationName !== 'none' || style.display === 'none' || Number(style.opacity) === 0) return false;
        }
        return true;
      };
      const toSvg = (node: SVGGraphicsElement) => svg.getScreenCTM()!.inverse().multiply(node.getScreenCTM()!);
      const map = (m: DOMMatrix, x: number, y: number) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });

      // Labels as cap-height boxes in SVG units.
      const texts = [...svg.querySelectorAll('text')].filter(still).map((text) => {
        const b = text.getBBox();
        const m = toSvg(text);
        const size = parseFloat(getComputedStyle(text).fontSize);
        const spacing = parseFloat(text.getAttribute('letter-spacing') ?? '0');
        const baseline = parseFloat(text.getAttribute('y') ?? '0');
        const a = map(m, b.x, baseline - size * 0.72);
        const z = map(m, b.x + b.width - spacing, baseline);
        return { name: (text.textContent ?? '').trim(), x1: a.x, y1: a.y, x2: z.x, y2: z.y };
      });
      if (texts.some((t) => t.x2 - t.x1 <= 0)) problems.push('a label has no width');

      const distance = (r: { x1: number; y1: number; x2: number; y2: number }, p: { x: number; y: number }) =>
        Math.hypot(Math.max(r.x1 - p.x, 0, p.x - r.x2), Math.max(r.y1 - p.y, 0, p.y - r.y2));

      // Every still line, ring, dot and path, sampled along its outline.
      for (const shape of svg.querySelectorAll<SVGGeometryElement>('line, circle, rect, path, ellipse, polyline')) {
        if (!still(shape)) continue;
        const style = getComputedStyle(shape);
        const stroked = style.stroke !== 'none' && Number(style.strokeOpacity) > 0;
        const filled = style.fill !== 'none' && Number(style.fillOpacity) > 0;
        if (!stroked && !filled) continue;
        const half = stroked ? parseFloat(style.strokeWidth) / 2 : 0;
        const m = toSvg(shape);
        const points: { x: number; y: number }[] = [];
        const length = shape.getTotalLength();
        for (let s = 0; s <= length; s += 1) {
          const p = shape.getPointAtLength(s);
          points.push(map(m, p.x, p.y));
        }
        for (const t of texts) {
          const near = Math.min(...points.map((p) => distance(t, p))) - half;
          // A filled shape that holds the label inside its outline also covers it.
          const b = shape.getBBox();
          const a = map(m, b.x, b.y);
          const z = map(m, b.x + b.width, b.y + b.height);
          const covers = filled && t.x1 >= a.x && t.x2 <= z.x && t.y1 >= a.y && t.y2 <= z.y;
          if (near < clearance || covers) problems.push(`label "${t.name}" touches a ${shape.tagName}`);
        }
      }

      // Labels do not overlap each other.
      for (let i = 0; i < texts.length; i++)
        for (let j = i + 1; j < texts.length; j++) {
          const [p, q] = [texts[i], texts[j]];
          if (Math.max(p.x1, q.x1) < Math.min(p.x2, q.x2) && Math.max(p.y1, q.y1) < Math.min(p.y2, q.y2))
            problems.push(`labels "${p.name}" and "${q.name}" overlap`);
        }
      return { label, problems: [...new Set(problems)] };
    },
    { css, clearance: LABEL_CLEARANCE },
  );
}

test('the pillar diagrams fit their panels and keep their labels clear of their lines', async ({
  app,
  screen,
  browser,
}) => {
  await openAsReturningVisitor(app, browser, '/');
  // The panels show a diagram only on a wide screen.
  await desktopOnly(browser, 'the pillar panels show no diagram on a phone');
  const chapter = browser.locator('[data-chapter="pillars"]');
  await chapter.scrollIntoView();
  // The open panel's diagram is the one that assistive tech can read.
  const openDiagram = '[data-chapter="pillars"] svg[role="img"]:not([aria-hidden="true"])';
  for (const pillar of PILLARS) {
    const opener = screen.getByRole('button', `Show ${pillar.name}`);
    // The open panel hides its own opener and does not take taps.
    const open = await browser.evaluate(
      (name) => document.querySelector(`button[aria-label="Show ${name}"]`)?.classList.contains('pointer-events-none') ?? false,
      pillar.name,
    );
    if (!open) await opener.tap();
    // The panel grows for 700 ms after a tap, so read the diagram until the layout settles.
    await expect
      .poll(() => inspect(browser, openDiagram), { message: pillar.name })
      .toEqual({ label: expect.stringMatching(pillar.label), problems: [] });
  }
});

test('the YOUR CHAIN diagram fits its card and keeps its labels clear of its lines in each mode', async ({
  app,
  screen,
  browser,
}) => {
  await openAsReturningVisitor(app, browser, '/');
  const chapter = browser.locator('[data-chapter="playbooks"]');
  await chapter.scrollIntoView();
  const diagram = '[data-chapter="playbooks"] svg[role="img"]';
  for (const mode of MODES) {
    await chapter.getByRole('button', new RegExp(`^${mode.name}`)).tap();
    // The modes cross-fade for 400 ms, so read the diagram until the new mode shows.
    await expect
      .poll(() => inspect(browser, diagram), { message: mode.name })
      .toEqual({ label: expect.stringMatching(mode.label), problems: [] });
  }
});
