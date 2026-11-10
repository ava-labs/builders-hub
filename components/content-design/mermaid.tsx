"use client";
import React, { useEffect, useRef, type JSX } from "react";
import mermaid, { type MermaidConfig } from "mermaid";
import { useTheme } from "./theme-observer";
import { renderWithLightFillLabels } from "./mermaid-light-fills";

type MermaidProps = {
  readonly chart: string;
};

/*
 * The docs book look. Inside the docs layout ([data-route-layout="docs"]) a chart renders with Mermaid's base theme,
 * and the theme variables come from the book tokens (app/docs/book/tokens.css), read on the container when the chart
 * renders, so the light and the dark tokens both apply: hairline steel outlines on the panel color, ink labels in the
 * page's sans, steel lines and arrows, notes outlined in the Note blue, errors in the Warning red.
 * app/docs/book/mermaid.css sets what Mermaid has no variable for. Outside the docs layout (Academy, Blog) the
 * renderer takes the old path, and a chart renders exactly as before.
 */

const DOCS_ROOT = '[data-route-layout="docs"]';

/** WCAG AA for label text. */
const AA = 4.5;

type Rgba = readonly [number, number, number, number];

interface BookPalette {
  readonly ink: string;
  readonly ink2: string;
  readonly steel: string;
  readonly panel: string;
  readonly blue: string;
  readonly red: string;
  /** The color under the chart: the first opaque background of the container or an ancestor. */
  readonly paper: string;
  readonly sans: string;
}

let colorProbe: CanvasRenderingContext2D | null = null;

/** Any CSS color (hex, rgb, a name, oklch) as sRGB channels and alpha, or null when it is not a color. */
function toRgba(color: string): Rgba | null {
  if (!CSS.supports("color", color)) return null;
  colorProbe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (colorProbe === null) return null;
  colorProbe.clearRect(0, 0, 1, 1);
  colorProbe.fillStyle = color;
  colorProbe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = colorProbe.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

function toHex([r, g, b]: Rgba): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** `top` painted over the opaque color `bottom`. */
function over(top: Rgba, bottom: Rgba): Rgba {
  const [r, g, b, a] = top;
  const mix = (channel: number, under: number): number => Math.round(channel * a + under * (1 - a));
  return [mix(r, bottom[0]), mix(g, bottom[1]), mix(b, bottom[2]), 1];
}

function luminance([r, g, b]: Rgba): number {
  const linear = (channel: number): number => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function paperColor(container: Element): string {
  for (let node: Element | null = container; node !== null; node = node.parentElement) {
    const rgba = toRgba(getComputedStyle(node).backgroundColor);
    if (rgba !== null && rgba[3] === 1) return toHex(rgba);
  }
  return "#ffffff";
}

function readBookPalette(container: Element): BookPalette {
  const style = getComputedStyle(container);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  return {
    ink: token("--bk-ink"),
    ink2: token("--bk-ink-2"),
    steel: token("--bk-steel"),
    panel: token("--bk-panel"),
    blue: token("--bk-blue"),
    red: token("--bk-red-text"),
    paper: paperColor(container),
    sans: token("--bk-sans"),
  };
}

/** A state diagram: a line of the chart starts with its keyword. */
const STATE_DIAGRAM = /^\s*stateDiagram/m;

/** A state with a transition to itself: a line of the chart is `Processing --> Processing`, with or without a label. */
const SELF_LOOP = /^\s*(\w+)\s*-->\s*\1\s*(?::|$)/m;

/** The space between the nodes of a state diagram with a self-loop, in units. See layoutConfig. */
const SELF_LOOP_NODE_SPACING = 220;

/** A flowchart that runs from top to bottom: a line of the chart is `flowchart TB`, `graph TD` or the like. */
const TOP_DOWN_FLOWCHART = /^\s*(?:flowchart|graph)\s+(?:TB|TD)\b/m;

/**
 * The layout settings that a chart needs in the book column.
 * - `inheritDir`, for a flowchart from top to bottom (the renderer decides, see renderInBookNow): Mermaid lays out a
 *   group with no links to the outside from left to right. A group of stacked layers then becomes a row as wide as
 *   two columns. With inheritDir, such a group takes the direction of its chart. A chart from left to right keeps
 *   Mermaid's layout, because there the turn makes it narrower.
 * - A state diagram with a self-loop: with Mermaid's 50 units between nodes, the self-loop ends where the next edge
 *   starts, and the two labels read as one. At 220 units, dagre puts the self-loop on the side of its state. The dagre
 *   layout of mermaid 11.16 reads the flowchart spacing before the state spacing, so the spacing goes there, for
 *   these charts only. A state diagram without a self-loop keeps Mermaid's spacing, so it stays narrow on a phone.
 */
function layoutConfig(chart: string, inheritDir: boolean): MermaidConfig["flowchart"] {
  return {
    ...(inheritDir ? { inheritDir: true } : {}),
    ...(STATE_DIAGRAM.test(chart) && SELF_LOOP.test(chart) ? { nodeSpacing: SELF_LOOP_NODE_SPACING } : {}),
  };
}

/**
 * Mermaid's base theme in the book tokens. Every color that base would derive from another one is set, so no tint
 * appears.
 */
function bookConfig(p: BookPalette, dark: boolean, chart: string, inheritDir: boolean): MermaidConfig {
  return {
    startOnLoad: false,
    theme: "base",
    fontFamily: p.sans,
    // The sequence renderer copies this size over its actor, message and note sizes, whatever they are set to.
    fontSize: 14,
    flowchart: layoutConfig(chart, inheritDir),
    themeVariables: {
      darkMode: dark,
      fontFamily: p.sans,
      fontSize: "14px",
      background: p.paper,
      // Shapes: a steel hairline on the panel color, with ink labels. Every line that shows what goes with what
      // (a shape, a group, a lifeline, a loop frame) is steel, so it has 3:1 on the page (WCAG 1.4.11).
      primaryColor: p.panel,
      primaryBorderColor: p.steel,
      primaryTextColor: p.ink,
      secondaryColor: p.panel,
      secondaryBorderColor: p.steel,
      secondaryTextColor: p.ink,
      tertiaryColor: p.panel,
      tertiaryBorderColor: p.steel,
      tertiaryTextColor: p.ink,
      mainBkg: p.panel,
      nodeBkg: p.panel,
      nodeBorder: p.steel,
      nodeTextColor: p.ink,
      textColor: p.ink,
      border2: p.steel,
      // Groups: the page color (so no fill shows), a steel hairline, and the title in steel.
      clusterBkg: p.paper,
      clusterBorder: p.steel,
      titleColor: p.steel,
      // Lines and arrows in steel. A label on a line sits on the page color, which hides the line under it.
      lineColor: p.steel,
      arrowheadColor: p.steel,
      defaultLinkColor: p.steel,
      edgeLabelBackground: p.paper,
      // Sequence diagrams.
      actorBkg: p.panel,
      actorBorder: p.steel,
      actorTextColor: p.ink,
      actorLineColor: p.steel,
      signalColor: p.steel,
      signalTextColor: p.ink,
      labelBoxBkgColor: p.paper,
      labelBoxBorderColor: p.steel,
      labelTextColor: p.steel,
      loopTextColor: p.ink2,
      noteBkgColor: p.panel,
      noteBorderColor: p.blue,
      noteTextColor: p.ink,
      activationBkgColor: p.panel,
      activationBorderColor: p.steel,
      sequenceNumberColor: p.paper,
      // State diagrams.
      stateBkg: p.panel,
      stateLabelColor: p.ink,
      labelBackgroundColor: p.paper,
      transitionColor: p.steel,
      transitionLabelColor: p.ink2,
      specialStateColor: p.ink,
      innerEndBackground: p.ink,
      compositeBackground: p.paper,
      compositeTitleBackground: p.panel,
      compositeBorder: p.steel,
      altBackground: p.panel,
      // Class and relation diagrams.
      classText: p.ink,
      relationColor: p.steel,
      relationLabelBackground: p.paper,
      relationLabelColor: p.ink,
      // Errors and critical tasks in the Warning red.
      errorBkgColor: p.panel,
      errorTextColor: p.red,
      critBorderColor: p.red,
      critBkgColor: p.panel,
    },
  };
}

const STYLE_LINE = /^(\s*(?:style|classDef)\s+\S+\s+)(.*?)(\s*;?\s*)$/;

function styleValue(parts: readonly string[], name: string): string | undefined {
  const property = new RegExp(`^\\s*${name}\\s*:\\s*(.+?)\\s*$`, "i");
  return parts.map((part) => property.exec(part)?.[1]).find((value) => value !== undefined);
}

/**
 * A `style` or `classDef` line whose label would fail AA on its fill in the current theme, with a label color that
 * passes: the ink or the page color, whichever has more contrast, else black or white. The fill is the author's
 * fill painted on the page color, or the theme's panel color. The label color is the author's color, or the ink.
 * A line that passes, or that names a color Mermaid cannot resolve here, comes back as it is.
 */
function legibleStyleLine(line: string, p: BookPalette): string {
  const match = STYLE_LINE.exec(line);
  if (match === null) return line;
  const [, head, props, tail] = match;
  const parts = props.split(",");
  const fillValue = styleValue(parts, "fill");
  const colorValue = styleValue(parts, "color");
  if (fillValue === undefined && colorValue === undefined) return line;
  const paper = toRgba(p.paper);
  const authorFill = fillValue === undefined ? null : toRgba(fillValue);
  const fill = fillValue === undefined ? toRgba(p.panel) : authorFill && paper && over(authorFill, paper);
  const label = toRgba(colorValue ?? p.ink);
  if (!fill || !label || contrast(label, fill) >= AA) return line;
  const pick = (candidates: readonly string[]): string =>
    candidates
      .map((color) => ({ color, ratio: contrast(toRgba(color) ?? [0, 0, 0, 1], fill) }))
      .reduce((best, next) => (next.ratio > best.ratio ? next : best)).color;
  const book = pick([p.ink, p.paper]);
  const color = contrast(toRgba(book) ?? [0, 0, 0, 1], fill) >= AA ? book : pick(["#000000", "#ffffff"]);
  const kept = parts.filter((part) => !/^\s*color\s*:/i.test(part));
  return `${head}${[...kept, `color:${color}`].join(",")}${tail}`;
}

function withLegibleLabels(chart: string, p: BookPalette): string {
  return chart
    .split("\n")
    .map((line) => legibleStyleLine(line, p))
    .join("\n");
}

/**
 * Mermaid keeps one global config, and each chart in the book gets its own (the page color under it, its layout
 * settings). So each chart initializes and renders before the next one starts.
 */
let bookQueue: Promise<void> = Promise.resolve();

function renderInBook(
  container: HTMLDivElement,
  chart: string,
  theme: "light" | "dark",
  isDestroyed: () => boolean,
): Promise<void> {
  const run = bookQueue.then(() => (isDestroyed() ? undefined : renderInBookNow(container, chart, theme, isDestroyed)));
  bookQueue = run.catch(() => undefined);
  return run;
}

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Half a unit: boxes that only touch do not overlap. */
const TOUCH = 0.5;

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right - TOUCH && b.left < a.right - TOUCH && a.top < b.bottom - TOUCH && b.top < a.bottom - TOUCH;
}

function holds(outer: Box, inner: Box): boolean {
  return (
    outer.left <= inner.left + TOUCH &&
    outer.top <= inner.top + TOUCH &&
    outer.right >= inner.right - TOUCH &&
    outer.bottom >= inner.bottom - TOUCH
  );
}

/**
 * Two groups of one drawing layer that overlap, and neither holds the other. Mermaid makes a group as wide as its
 * title after the layout, so a title wider than its group pushes the group into its neighbor, and the two titles
 * cover each other. With inheritDir, the groups of a chart can get narrower than their titles (tmpnet runtimes).
 */
function groupsCollide(svg: string): boolean {
  const drawing = new DOMParser().parseFromString(svg, "text/html");
  for (const layer of drawing.querySelectorAll("g.clusters")) {
    const boxes = [...layer.querySelectorAll(":scope > g.cluster:not([transform]) > rect")].map((rect): Box => {
      const size = (name: string): number => Number(rect.getAttribute(name) ?? 0);
      return { left: size("x"), top: size("y"), right: size("x") + size("width"), bottom: size("y") + size("height") };
    });
    for (const [index, a] of boxes.entries()) {
      for (const b of boxes.slice(index + 1)) {
        if (overlaps(a, b) && !holds(a, b) && !holds(b, a)) return true;
      }
    }
  }
  return false;
}

/** The fill of a group's box as an opaque color: the box's fill painted on `paper`, or `paper` when it has none. */
function groupFill(group: Element, paper: string): string {
  const box = group.querySelector(":scope > rect");
  const under = toRgba(paper);
  if (box === null || under === null) return paper;
  const style = getComputedStyle(box);
  const fill = toRgba(style.fill);
  if (fill === null) return paper;
  const opacity = Number.parseFloat(style.fillOpacity);
  const alpha = fill[3] * (Number.isNaN(opacity) ? 1 : opacity);
  return toHex(over([fill[0], fill[1], fill[2], alpha], under));
}

/**
 * Group titles painted after the lines. Mermaid paints the groups first, so a line into a group can run through its
 * title. Each title moves to the end of its drawing layer, where it keeps its place, because neither the group nor the
 * group layer moves its children. mermaid.css gives each moved title the fill of its group (--bk-title-bg), so a line
 * stops at the title, and an author's fill on the group stays under the title, with the label color the guard chose
 * for that fill.
 */
function liftClusterTitles(drawing: SVGSVGElement, paper: string): void {
  for (const layer of drawing.querySelectorAll("g.clusters")) {
    const root = layer.parentElement;
    if (root === null || layer.hasAttribute("transform")) continue;
    const titles = document.createElementNS("http://www.w3.org/2000/svg", "g");
    titles.setAttribute("class", "bk-cluster-titles");
    for (const group of layer.querySelectorAll(":scope > g.cluster:not([transform])")) {
      const title = group.querySelector(":scope > g.cluster-label");
      if (!(title instanceof SVGGElement)) continue;
      title.style.setProperty("--bk-title-bg", groupFill(group, paper));
      titles.appendChild(title);
    }
    if (titles.childElementCount > 0) root.appendChild(titles);
  }
}

/**
 * Renders `chart` into `container` in the book look. Mermaid sizes every label in a scratch copy of the drawing. The
 * scratch copy sits in the container, so the book CSS also applies while Mermaid measures, and the old drawing stays
 * on screen until the new one is ready. The container gets the page color and the drawing's natural width for
 * mermaid.css.
 */
async function renderInBookNow(
  container: HTMLDivElement,
  chart: string,
  theme: "light" | "dark",
  isDestroyed: () => boolean,
): Promise<void> {
  const scratch = document.createElement("div");
  scratch.setAttribute("aria-hidden", "true");
  scratch.style.cssText = "position:absolute;top:0;left:-100000px;visibility:hidden;";
  container.appendChild(scratch);
  try {
    const palette = readBookPalette(container);
    const source = withLegibleLabels(chart, palette);
    const render = async (inheritDir: boolean): Promise<string> => {
      mermaid.initialize(bookConfig(palette, theme === "dark", chart, inheritDir));
      const renderId = `mmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return (await mermaid.render(renderId, source, scratch)).svg;
    };
    // A flowchart from top to bottom renders with inheritDir, unless its groups then collide.
    const topDown = TOP_DOWN_FLOWCHART.test(chart);
    let svg = await render(topDown);
    if (topDown && groupsCollide(svg)) svg = await render(false);
    if (isDestroyed()) return;
    container.innerHTML = svg;
    const drawing = container.querySelector("svg");
    if (drawing !== null) liftClusterTitles(drawing, palette.paper);
    container.style.setProperty("--bk-mermaid-paper", palette.paper);
    container.style.setProperty("--bk-mermaid-width", String(Math.ceil(drawing?.viewBox.baseVal?.width ?? 0)));
  } catch (_err) {
    if (!isDestroyed()) container.textContent = chart;
  } finally {
    scratch.remove();
  }
}

/**
 * Optimized Mermaid component with centralized theme observation.
 *
 * Previous implementation: Each diagram created its own MutationObserver (N observers for N diagrams)
 * Optimized implementation: All diagrams share a single theme observer via React context (1 observer for N diagrams)
 *
 * @see https://github.com/ava-labs/builders-hub/issues/2724
 */
const Mermaid = ({ chart }: MermaidProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme(); // Single shared theme observer

  useEffect(() => {
    let destroyed = false;

    const renderDiagram = async (): Promise<void> => {
      if (!containerRef.current) return;

      // Inside the docs layout the chart takes the book look; anywhere else it renders as before.
      if (containerRef.current.closest(DOCS_ROOT) !== null) {
        await renderInBook(containerRef.current, chart, theme, () => destroyed);
        return;
      }

      // Configure theme based on centralized theme state
      mermaid.initialize({
        startOnLoad: false,
        theme: theme === "dark" ? "dark" : "default"
      });

      // Render to SVG string and inject; avoid SSR/client mismatches
      try {
        // Unique ID only used internally by mermaid render
        const renderId = `mmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        // Inside the Academy, the dark theme keeps dark labels on nodes an author filled light.
        const render = async (source: string): Promise<string> => (await mermaid.render(renderId, source)).svg;
        const svg = await renderWithLightFillLabels(render, chart, theme, containerRef.current);
        if (!destroyed && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (_err) {
        // Fallback: show raw text if render fails
        if (!destroyed && containerRef.current) {
          containerRef.current.textContent = chart;
        }
      }
    };

    void renderDiagram();

    return () => {
      destroyed = true;
    };
  }, [chart, theme]); // Re-render when theme changes

  // Render an empty container on server; client fills it post-mount
  return <div ref={containerRef} data-mermaid="" />;
};

export default Mermaid;
