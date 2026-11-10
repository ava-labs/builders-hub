/**
 * Builds the far ranges' heights for the 3D city's ?peaks=1 look (components/explorer-v2/network/city3d/Backdrop.tsx):
 * real Himalayan and Karakoram massifs from AWS Terrain Tiles (Terrarium PNGs, SRTM-derived, public domain), one massif to
 * a cell of public/images/city3d/peaks-dem.webp (lossless).
 *
 * Each cell is 368 x 276 samples, 30 m apart (SRTM's own grid; 11 km along by 8.3 km across), centred on the massif and turned so that its
 * chosen face looks toward the city: a cell's first rows are the far side, its last rows the near side, and its columns run
 * left to right as the city sees them. A sample keeps its height in metres as R * 256 + G (B is 0), and lossless WebP keeps it exact.
 * The tiles come at zoom 13 (about 17 m a pixel), bicubic between them, at most one request a second, and are kept under the
 * system's temp folder for a re-run.
 *
 * Run: npx tsx scripts/city3d-peaks.mts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import sharp from "sharp";

const Z = 13;
const W = 368;
const H = 276;
const STEP_M = 30;
const OUT = path.join(process.cwd(), "public/images/city3d/peaks-dem.webp");
const CACHE = path.join(os.tmpdir(), "city3d-terrain", String(Z));

/** each massif: its centre, and the compass bearing from it toward the one who looks at it (the city) */
const MASSIFS = [
  { name: "K2", lat: 35.8825, lon: 76.5133, face: 180 },
  { name: "Everest and Lhotse", lat: 27.975, lon: 86.935, face: 250 },
  { name: "Makalu", lat: 27.8897, lon: 87.0888, face: 220 },
  { name: "Cho Oyu", lat: 28.0942, lon: 86.6608, face: 170 },
  { name: "Ama Dablam", lat: 27.8617, lon: 86.8614, face: 250 },
  { name: "Kangchenjunga", lat: 27.7025, lon: 88.1475, face: 190 },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastFetch = 0;
const tiles = new Map<string, Float32Array>();

/* a tile's heights in metres, from the cache or from S3, paced at one request a second */
async function tile(x: number, y: number): Promise<Float32Array> {
  const key = `${x}/${y}`;
  const have = tiles.get(key);
  if (have) return have;
  const file = path.join(CACHE, `${x}-${y}.png`);
  let buf: Buffer;
  if (fs.existsSync(file)) buf = fs.readFileSync(file);
  else {
    const wait = lastFetch + 1000 - Date.now();
    if (wait > 0) await sleep(wait);
    lastFetch = Date.now();
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, buf);
    console.log("fetched", url);
  }
  const png = PNG.sync.read(buf);
  const h = new Float32Array(256 * 256);
  for (let i = 0; i < 256 * 256; i++) h[i] = png.data[i * 4] * 256 + png.data[i * 4 + 1] + png.data[i * 4 + 2] / 256 - 32768;
  tiles.set(key, h);
  return h;
}

/* the height at a place, bicubic (Catmull-Rom) across the tiles at zoom Z */
const cubic = (a: number, b: number, c: number, d: number, t: number) => b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
async function heightAt(lat: number, lon: number): Promise<number> {
  const n = 256 * 2 ** Z;
  const px = ((lon + 180) / 360) * n - 0.5;
  const r = (lat * Math.PI) / 180;
  const py = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n - 0.5;
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const fx = px - x0;
  const fy = py - y0;
  const at = async (x: number, y: number) => (await tile(Math.floor(x / 256), Math.floor(y / 256)))[(y & 255) * 256 + (x & 255)];
  const rows: number[] = [];
  for (let j = -1; j <= 2; j++) rows.push(cubic(await at(x0 - 1, y0 + j), await at(x0, y0 + j), await at(x0 + 1, y0 + j), await at(x0 + 2, y0 + j), fx));
  return cubic(rows[0], rows[1], rows[2], rows[3], fy);
}

const out = new PNG({ width: W, height: H * MASSIFS.length });
for (const [k, m] of MASSIFS.entries()) {
  const f = (m.face * Math.PI) / 180;
  // toward the viewer, and the viewer's right as they look at the massif, in (east, north)
  const toward = [Math.sin(f), Math.cos(f)];
  const right = [-Math.cos(f), Math.sin(f)];
  let lo = Infinity;
  let hi = -Infinity;
  let top = { i: 0, j: 0 };
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const a = (i - (W - 1) / 2) * STEP_M;
      const c = (j - (H - 1) / 2) * STEP_M;
      const east = a * right[0] + c * toward[0];
      const north = a * right[1] + c * toward[1];
      const lat = m.lat + north / 110574;
      const lon = m.lon + east / (111320 * Math.cos((m.lat * Math.PI) / 180));
      const h = Math.max(0, Math.min(65535, Math.round(await heightAt(lat, lon))));
      if (h < lo) lo = h;
      if (h > hi) {
        hi = h;
        top = { i, j };
      }
      const o = ((k * H + j) * W + i) * 4;
      out.data[o] = h >> 8;
      out.data[o + 1] = h & 255;
      out.data[o + 2] = 0;
      out.data[o + 3] = 255;
    }
  console.log(`${m.name}: ${lo} to ${hi} m, highest at column ${top.i}, row ${top.j}`);
}
await sharp(out.data, { raw: { width: out.width, height: out.height, channels: 4 } }).removeAlpha().webp({ lossless: true, effort: 6 }).toFile(OUT);
console.log("wrote", OUT, fs.statSync(OUT).size, "bytes");
