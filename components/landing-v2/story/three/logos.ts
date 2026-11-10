import { useEffect, useState } from "react";
import { CanvasTexture, Color, SRGBColorSpace, Vector3, type Camera } from "three";

/* Marks drawn on a canvas for the story scenes: each chain's logo, for the
   network drawing, and the P-Chain's name, for the plates. Each logo loads
   through Next's image proxy at 64 px, so every mark is same-origin and
   small, and WebGL may read it. It is drawn on a white square (the scene
   cuts the circle in its geometry, so the rim is antialiased like any
   edge), and its own dominant color (its most common saturated hue)
   becomes the block's color: the company's color comes from its mark, not
   from a palette guess. */

export interface ChainMark {
  /** SIZE px square: the logo, fit inside the circle, on white */
  canvas: HTMLCanvasElement;
  /** the mark's dominant color, or null for a gray or white mark */
  color: Color | null;
}

const SIZE = 64;
// three holds this to what the GPU allows; the marks and the name lie flat, seen at a slant
const ANISOTROPY = 8;
// a generic placeholder is no mark at all
const PLACEHOLDER = /AvaCloud-512x512|\/images\/avacloud\.svg$/;
// hosts the image proxy may fetch (next.config.mjs images.remotePatterns). The
// f005.backblazeb2.com logos are left out: that bucket answers 403, and each
// failed load would log an error
const PROXIED = /^https:\/\/images\.ctfassets\.net\//;
// the proxy refuses SVG; Contentful draws one to PNG on request
const CONTENTFUL_SVG = /^https:\/\/images\.ctfassets\.net\/[^?]+\.svg$/i;

// Next 16 allows only quality 75 unless images.qualities says otherwise
const proxied = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=${SIZE}&q=75`;

export function markUrl(logo: string | null | undefined): string | null {
  if (!logo || PLACEHOLDER.test(logo)) return null;
  if (logo.startsWith("/")) return /\.svg$/i.test(logo) ? logo : proxied(logo);
  if (CONTENTFUL_SVG.test(logo)) return proxied(`${logo}?fm=png&w=${SIZE * 2}`);
  if (PROXIED.test(logo)) return proxied(logo);
  return null;
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`mark failed: ${src}`));
    img.src = src;
  });
}

/** the mean of the pixels in the most common hue: grays, whites and near-blacks do not vote, and a two-color mark is not averaged to mud */
function dominant(data: Uint8ClampedArray): Color | null {
  const BINS = 24;
  const sum = Array.from({ length: BINS }, () => ({ r: 0, g: 0, b: 0, n: 0 }));
  const hsl = { h: 0, s: 0, l: 0 };
  const c = new Color();
  let voters = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const pr = data[i];
    const pg = data[i + 1];
    const pb = data[i + 2];
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    if (max < 40 || max - min < 48) continue;
    c.setRGB(pr / 255, pg / 255, pb / 255, SRGBColorSpace).getHSL(hsl, SRGBColorSpace);
    const bin = sum[Math.floor(hsl.h * BINS) % BINS];
    bin.r += pr;
    bin.g += pg;
    bin.b += pb;
    bin.n++;
    voters++;
  }
  // a mark with almost no color reads as steel
  if (voters < (SIZE * SIZE) / 40) return null;
  // the top bin with its two neighbours, so a hue on a bin border is not split
  let best = 0;
  let bestN = -1;
  for (let k = 0; k < BINS; k++) {
    const n = sum[(k + BINS - 1) % BINS].n + sum[k].n + sum[(k + 1) % BINS].n;
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  const pick = [sum[(best + BINS - 1) % BINS], sum[best], sum[(best + 1) % BINS]];
  const n = pick.reduce((a, s) => a + s.n, 0);
  const r = pick.reduce((a, s) => a + s.r, 0);
  const g = pick.reduce((a, s) => a + s.g, 0);
  const b = pick.reduce((a, s) => a + s.b, 0);
  return new Color().setRGB(r / n / 255, g / n / 255, b / n / 255, SRGBColorSpace);
}

const cache = new Map<string, Promise<ChainMark | null>>();

/** the mark canvas and dominant color of a chain's logo, once per URL; null for none or a failed load */
export function chainMark(logo: string | null | undefined): Promise<ChainMark | null> {
  const src = markUrl(logo);
  if (!src) return Promise.resolve(null);
  let hit = cache.get(src);
  if (!hit) {
    hit = load(src)
      .then((img) => {
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx || !img.naturalWidth || !img.naturalHeight) return null;
        // the mark sits on white, so a transparent or dark logo still reads on any block
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, SIZE, SIZE);
        const scale = Math.min(SIZE / img.naturalWidth, SIZE / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
        return { canvas, color: dominant(ctx.getImageData(0, 0, SIZE, SIZE).data) };
      })
      .catch(() => null);
    cache.set(src, hit);
  }
  return hit;
}

export interface MarkAtlas {
  texture: CanvasTexture;
  /** where mark i sits in the texture: left, bottom, width, height in UV */
  cells: [number, number, number, number][];
}

// white around each cell, so a mipmap of one mark never bleeds into the next
const PAD = 4;

/** every mark on one canvas, one texture: the scene draws all of them in one call. Chains that share a logo share its cell */
export function markAtlas(marks: ChainMark[]): MarkAtlas | null {
  if (!marks.length) return null;
  const unique = [...new Set(marks.map((m) => m.canvas))];
  const cols = Math.ceil(Math.sqrt(unique.length));
  const rows = Math.ceil(unique.length / cols);
  const cell = SIZE + PAD * 2;
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  // a canvas kept in memory, not on the GPU: it is only read, by the texture upload
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const at = new Map(
    unique.map((mark, i): [HTMLCanvasElement, [number, number, number, number]] => {
      const x = (i % cols) * cell + PAD;
      const y = Math.floor(i / cols) * cell + PAD;
      ctx.drawImage(mark, x, y);
      // the texture is flipped on upload: v runs up from the canvas bottom
      return [mark, [x / canvas.width, 1 - (y + SIZE) / canvas.height, SIZE / canvas.width, SIZE / canvas.height]];
    }),
  );
  const cells = marks.map((m) => at.get(m.canvas) as [number, number, number, number]);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = ANISOTROPY;
  return { texture, cells };
}

/* The P-Chain's name, for the plate it labels: white on black, so the
   scene uses it as an alpha map and tints it with its own ink. It is drawn
   once per page, in the page's mono face, once that face has loaded. */

export interface PlateName {
  /** width / height of the texture */
  aspect: number;
  /** the capital height as a share of the texture height; the text is centered both ways */
  cap: number;
}

const NAME = "P-CHAIN";
// px per em on the canvas: a 6 to 9 px capital on screen, drawn at 4x or more
const NAME_PX = 96;

let plateNameCanvas: Promise<(PlateName & { canvas: HTMLCanvasElement }) | null> | null = null;

function drawPlateName(): Promise<(PlateName & { canvas: HTMLCanvasElement }) | null> {
  // the face the page's MONO labels use (--font-mono, the Geist Mono family)
  const probe = document.createElement("span");
  probe.className = "font-mono";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily;
  probe.remove();
  const font = `500 ${NAME_PX}px ${family}`;
  return document.fonts
    .load(font, NAME)
    .catch(() => [])
    .then(() => document.fonts.ready)
    .then(() => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.font = font;
      // tracked 0.16em like the MONO labels, set by hand: canvas letterSpacing is not everywhere
      const track = NAME_PX * 0.16;
      const widths = [...NAME].map((ch) => ctx.measureText(ch).width);
      const textW = widths.reduce((a, w) => a + w, 0) + track * (NAME.length - 1);
      const cap = ctx.measureText("H").actualBoundingBoxAscent;
      const pad = Math.ceil(NAME_PX * 0.25);
      canvas.width = Math.ceil(textW + pad * 2);
      canvas.height = Math.ceil(cap + pad * 2);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // a resize clears the context's state
      ctx.font = font;
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "alphabetic";
      let x = pad;
      [...NAME].forEach((ch, i) => {
        ctx.fillText(ch, x, pad + cap);
        x += widths[i] + track;
      });
      return { canvas, aspect: canvas.width / canvas.height, cap: cap / canvas.height };
    })
    .catch(() => null);
}

/** the plate's name as an alpha texture, null until the page's mono face is ready; each scene owns its texture */
export function usePlateName(): (PlateName & { texture: CanvasTexture }) | null {
  const [made, setMade] = useState<(PlateName & { texture: CanvasTexture }) | null>(null);
  useEffect(() => {
    let live = true;
    let texture: CanvasTexture | null = null;
    plateNameCanvas ??= drawPlateName();
    plateNameCanvas.then((name) => {
      if (!live || !name) return;
      texture = new CanvasTexture(name.canvas);
      texture.anisotropy = ANISOTROPY;
      setMade({ texture, aspect: name.aspect, cap: name.cap });
    });
    return () => {
      live = false;
      texture?.dispose();
    };
  }, []);
  return made;
}

const along = new Vector3();
const into = new Vector3();

/**
 * The capital height, in units, that the name needs to show capPx tall on
 * screen, at most `max`. The name runs along +x with its letters' up on -z:
 * from a slanted camera its height on screen is the distance between those
 * two directions' screen images, per unit, times the zoom.
 */
export function plateNameCap(camera: Camera & { zoom?: number }, capPx: number, max: number): number {
  along.set(1, 0, 0).transformDirection(camera.matrixWorldInverse);
  into.set(0, 0, -1).transformDirection(camera.matrixWorldInverse);
  const tall = Math.abs(along.x * into.y - along.y * into.x) / Math.hypot(along.x, along.y);
  return Math.min(capPx / (tall * (camera.zoom ?? 1)), max);
}
