/* The far ranges' bake (Backdrop.tsx, ?peaks=1): from the massifs' real heights (public/images/city3d/peaks-dem.webp, SRTM at
   30 m, built by scripts/city3d-peaks.mts), each range's mesh in the world and its light. The Backdrop runs this function's own
   source in workers, a few ranges to each, so none of it holds the main thread: it must not reach anything outside itself.

   Per range:
   - the survey cleaned: a sample far off its neighbours' median (its speckle, its void pits) takes the median, and an unsharp
     mask takes back some of the detail its radar blurred;
   - the heights over the cloud line, which climbs toward the window's edge over the highest ground near it, so each massif's
     shore follows its own contours and nothing stands at the edge; the relief over the line bent toward its summits (a power of
     its share of the top) and lifted, so the lower flanks fall away in concave skirts and the summit pyramids stand clear;
   - on the steep faces the smooth ground (a gaussian of 60 m) in place of the survey's own bumps there, which are its radar
     shadow and its void fills, not the face;
   - the key's shadow, marched toward it with a sharp penumbra, and the sky's reach (horizon-based occlusion), on the DEM's grid;
   - at twice the DEM's grid: the heights bicubic, cut by the erosion (gullies and ribs down the fall line: a noise carried
     along it both ways, so each streak turns with the slope, deep on the steep faces and gone on the gentle ground), their
     normal, and where snow lies, as a signed score the shader draws with a crisp edge: all the gentle ground, and on the steep
     faces the flutings between the ribs, more of it in the hollows and high up, less on the crests.
   Its textures: light (RGBA8: the normal's x and z, the shadow, the snow score) and sky (R8: the sky's reach), both at twice the
   DEM's grid. The mesh takes every stride-th DEM sample and leaves out what stays under the cloud tops */
export interface PeaksBakeRange {
  /** bearing from the city's middle in degrees (clockwise from the home view's forward, -z), and distance */
  at: number;
  r: number;
  /** the real height, in metres, the cloud sea stands at for this range */
  cloud: number;
}
/** how the bake shapes the ranges (Backdrop.tsx's PEAK_SHAPE) */
export interface PeaksBakeShape {
  /** world units to a metre, the DEM's spacing in metres, the bake's texels to a DEM sample, the mesh's stride in DEM samples */
  scale: number;
  step: number;
  up: number;
  stride: number;
  /** the unsharp mask: its amount, and its radius in DEM samples */
  sharpen: number;
  sigma: number;
  /** the power the relief's share of the top is raised to (over 1 sharpens the summits against the flanks), and its lift */
  relief: number;
  lift: number;
  /** how much of their own relief the steep faces give up for the smooth ground */
  smoothFaces: number;
  /** the shadow's penumbra: higher is sharper */
  hard: number;
  /** the snow score's offset: higher is more snow */
  snow: number;
}
export interface PeaksBakeInput extends PeaksBakeShape {
  rgba: Uint8ClampedArray;
  width: number;
  /** a cell's rows: the atlas stacks one cell per range */
  rows: number;
  /** the ranges this bake makes, by their index in ranges */
  cells: number[];
  ranges: PeaksBakeRange[];
  seaY: number;
  /** each range's own key light, low and from the side, so it rakes the relief */
  keys: [number, number, number][];
}
export interface PeaksBakeCell {
  k: number;
  position: Float32Array;
  uv: Float32Array;
  along: Float32Array;
  index: Uint16Array;
  light: Uint8Array;
  sky: Uint8Array;
  width: number;
  height: number;
  /** the share of the upper massif (over half its height above the clouds) under snow, for the checks */
  snow: number;
}
export interface PeaksBakeOutput {
  cells: PeaksBakeCell[];
  ms: number;
}

export function bakePeaks(input: PeaksBakeInput): PeaksBakeOutput {
  const t0 = performance.now();
  const { rgba, width: W, rows: H, cells, ranges, seaY, keys, scale, step, up, stride, sharpen, sigma, relief, lift, smoothFaces, hard, snow: snowBias } = input;
  const unit = step * scale;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const smooth = (x: number, a: number, b: number) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  // a value noise on a hashed lattice
  const hash = (i: number, j: number) => {
    let h = (i * 374761393 + j * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x: number, y: number) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = hash(i, j) + (hash(i + 1, j) - hash(i, j)) * u;
    const b = hash(i, j + 1) + (hash(i + 1, j + 1) - hash(i, j + 1)) * u;
    return a + (b - a) * v;
  };
  const cubic = (a: number, b: number, c: number, d: number, t: number) => b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
  // a separable gaussian of a w x h field, its radius in samples
  const gauss = (src: Float32Array, w: number, h: number, s: number) => {
    const R = Math.max(1, Math.ceil(s * 3));
    const wt = new Float32Array(2 * R + 1);
    let sum = 0;
    for (let d = -R; d <= R; d++) {
      wt[d + R] = Math.exp((-d * d) / (2 * s * s));
      sum += wt[d + R];
    }
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let a = 0;
        for (let d = -R; d <= R; d++) a += src[y * w + clamp(x + d, 0, w - 1)] * wt[d + R];
        tmp[y * w + x] = a / sum;
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let a = 0;
        for (let d = -R; d <= R; d++) a += tmp[clamp(y + d, 0, h - 1) * w + x] * wt[d + R];
        out[y * w + x] = a / sum;
      }
    return out;
  };
  const out: PeaksBakeCell[] = [];
  for (const k of cells) {
    const g = ranges[k];
    const kl = Math.hypot(keys[k][0], keys[k][1], keys[k][2]);
    const K = [keys[k][0] / kl, keys[k][1] / kl, keys[k][2] / kl];
    const b = (g.at * Math.PI) / 180;
    const right = [Math.cos(b), 0, Math.sin(b)];
    const toward = [-Math.sin(b), 0, Math.cos(b)];
    const cx = Math.sin(b) * g.r;
    const cz = -Math.cos(b) * g.r;
    const rOf = (i: number, j: number) => Math.hypot((i - (W - 1) / 2) / ((W - 1) / 2), (j - (H - 1) / 2) / ((H - 1) / 2));
    // the survey, cleaned: a sample far off its neighbours' median takes the median (twice, for pairs)
    const raw = new Float32Array(W * H);
    for (let q = 0; q < W * H; q++) raw[q] = rgba[(k * W * H + q) * 4] * 256 + rgba[(k * W * H + q) * 4 + 1];
    const nb = new Float32Array(9);
    for (let pass = 0; pass < 2; pass++) {
      const fix: number[] = [];
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
          let q = 0;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) nb[q++] = raw[clamp(j + dj, 0, H - 1) * W + clamp(i + di, 0, W - 1)];
          nb.sort();
          if (Math.abs(raw[j * W + i] - nb[4]) > 30) fix.push(j * W + i, nb[4]);
        }
      for (let f = 0; f < fix.length; f += 2) raw[fix[f]] = fix[f + 1];
    }
    const soft = gauss(raw, W, H, sigma);
    // the heights over the cloud line, which climbs toward the window's edge over the highest ground near it
    let rim = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (rOf(i, j) > 0.94) rim = Math.max(rim, raw[j * W + i]);
    const climb = Math.max(300, rim - g.cloud + 80);
    const h = new Float32Array(W * H);
    let peak = 1;
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const q = j * W + i;
        h[q] = raw[q] + sharpen * (raw[q] - soft[q]) - g.cloud - climb * smooth(rOf(i, j), 0.4, 0.97);
        peak = Math.max(peak, h[q]);
      }
    // the relief over the line, bent toward its summits and lifted, in world units
    for (let q = 0; q < W * H; q++) h[q] = (h[q] > 0 ? peak * Math.pow(h[q] / peak, relief) * lift : h[q]) * scale;
    // the steep faces: the smooth ground
    const hg = gauss(h, W, H, 2);
    let top = 0;
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const q = j * W + i;
        const gx = (hg[j * W + clamp(i + 1, 0, W - 1)] - hg[j * W + clamp(i - 1, 0, W - 1)]) / (2 * unit);
        const gz = (hg[clamp(j + 1, 0, H - 1) * W + i] - hg[clamp(j - 1, 0, H - 1) * W + i]) / (2 * unit);
        h[q] += (hg[q] - h[q]) * smooth(Math.hypot(gx, gz), 0.55, 1.1) * smoothFaces;
        top = Math.max(top, h[q]);
      }
    const at = (x: number, y: number) => {
      const xi = clamp(x, 0, W - 1);
      const yi = clamp(y, 0, H - 1);
      const x0 = Math.floor(xi);
      const y0 = Math.floor(yi);
      const x1 = Math.min(W - 1, x0 + 1);
      const y1 = Math.min(H - 1, y0 + 1);
      const fx = xi - x0;
      const fy = yi - y0;
      return (h[y0 * W + x0] * (1 - fx) + h[y0 * W + x1] * fx) * (1 - fy) + (h[y1 * W + x0] * (1 - fx) + h[y1 * W + x1] * fx) * fy;
    };
    const px = (x: number, y: number) => h[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)];
    // the key in the range's frame, for the shadow
    const kr = K[0] * right[0] + K[2] * right[2];
    const kt = K[0] * toward[0] + K[2] * toward[2];
    const kh = Math.hypot(kr, kt);
    const sx = kr / kh;
    const sy = kt / kh;
    const rise = (K[1] / kh) * unit;
    // the shadow and the sky's reach, on the DEM's grid
    const shadow = new Float32Array(W * H);
    const reach = new Float32Array(W * H);
    const DIRS = 10;
    const FAR = [1, 2, 3, 5, 8, 12, 18, 27, 40, 60];
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const h0 = h[j * W + i];
        if (h0 < -80) {
          shadow[j * W + i] = 1;
          reach[j * W + i] = 1;
          continue;
        }
        let sh = 1;
        for (let s = 1; s < 400; s++) {
          const x = i + sx * s;
          const y = j + sy * s;
          if (x < 0 || y < 0 || x > W - 1 || y > H - 1) break;
          const ray = h0 + 0.5 + rise * s;
          if (ray > top) break;
          const d = ray - at(x, y);
          if (d < 0) {
            sh = 0;
            break;
          }
          sh = Math.min(sh, (hard * d) / (s * unit));
        }
        shadow[j * W + i] = sh;
        let sky = 0;
        for (let q = 0; q < DIRS; q++) {
          const a = (q / DIRS) * Math.PI * 2 + 0.3;
          const ux = Math.cos(a);
          const uy = Math.sin(a);
          let t = 0;
          for (const r of FAR) {
            const x = i + ux * r;
            const y = j + uy * r;
            if (x < 0 || y < 0 || x > W - 1 || y > H - 1) break;
            t = Math.max(t, (at(x, y) - h0) / (r * unit));
          }
          sky += 1 - t / Math.sqrt(1 + t * t);
        }
        reach[j * W + i] = sky / DIRS;
      }
    // the bake's grid: bicubic heights at twice the DEM's
    const BW = W * up;
    const BH = H * up;
    const ub = unit / up;
    const hb = new Float32Array(BW * BH);
    for (let y = 0; y < BH; y++) {
      const fy = (y + 0.5) / up - 0.5;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      for (let x = 0; x < BW; x++) {
        const fx = (x + 0.5) / up - 0.5;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const row = (dy: number) => cubic(px(x0 - 1, y0 + dy), px(x0, y0 + dy), px(x0 + 1, y0 + dy), px(x0 + 2, y0 + dy), tx);
        hb[y * BW + x] = cubic(row(-1), row(0), row(1), row(2), ty);
      }
    }
    const HB = (x: number, y: number) => hb[clamp(y, 0, BH - 1) * BW + clamp(x, 0, BW - 1)];
    // the fall line: the ground's downhill heading at each texel, and its slope
    const flowX = new Float32Array(BW * BH);
    const flowY = new Float32Array(BW * BH);
    const slope = new Float32Array(BW * BH);
    for (let y = 0; y < BH; y++)
      for (let x = 0; x < BW; x++) {
        const gx = (HB(x + 2, y) - HB(x - 2, y)) / (4 * ub);
        const gy = (HB(x, y + 2) - HB(x, y - 2)) / (4 * ub);
        const l = Math.hypot(gx, gy);
        slope[y * BW + x] = l;
        flowX[y * BW + x] = l > 1e-6 ? -gx / l : 0;
        flowY[y * BW + x] = l > 1e-6 ? -gy / l : 0;
      }
    // the gullies and ribs, on the steep ground over the cloud tops: a noise about a gully across (48 m), carried down the fall
    // line both ways over about 650 m, so each streak follows the slope as it turns; then stretched back to its range and
    // ridged, so each rib's crest is sharp and the gullies between are broad
    const CROSS = 48;
    const STEPS = 22;
    const grain = new Float32Array(BW * BH);
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) grain[y * BW + x] = noise(((x / up) * step) / CROSS, ((y / up) * step) / CROSS);
    const hann = new Float32Array(STEPS + 1);
    for (let s = 0; s <= STEPS; s++) hann[s] = 0.5 + 0.5 * Math.cos((Math.PI * s) / (STEPS + 1));
    const lic = new Float32Array(BW * BH);
    const cut: number[] = [];
    let sum = 0;
    let sum2 = 0;
    for (let y = 0; y < BH; y++)
      for (let x = 0; x < BW; x++) {
        const o = y * BW + x;
        if (slope[o] < 0.5 || hb[o] < -60) continue;
        let acc = 0;
        let wsum = 0;
        for (let dir = 1; dir >= -1; dir -= 2) {
          let lx = x;
          let ly = y;
          for (let s = dir === 1 ? 0 : 1; s <= STEPS; s++) {
            const w = hann[s];
            const q = clamp(Math.round(ly), 0, BH - 1) * BW + clamp(Math.round(lx), 0, BW - 1);
            acc += grain[q] * w;
            wsum += w;
            lx += flowX[q] * dir;
            ly += flowY[q] * dir;
          }
        }
        const v = acc / wsum;
        lic[o] = v;
        cut.push(o);
        sum += v;
        sum2 += v * v;
      }
    const mean = cut.length ? sum / cut.length : 0.5;
    const sd = cut.length ? Math.sqrt(Math.max(1e-6, sum2 / cut.length - mean * mean)) : 0.1;
    const eroded = hb.slice();
    const rib = new Float32Array(BW * BH);
    for (const o of cut) {
      const n = 1 - Math.pow(1 - smooth((lic[o] - mean) / sd, -1.6, 1.6), 1.6);
      const strength = smooth(slope[o], 0.5, 1.15);
      rib[o] = n * strength;
      eroded[o] += (n - 0.5) * 12 * strength;
    }
    const E = (x: number, y: number) => eroded[clamp(y, 0, BH - 1) * BW + clamp(x, 0, BW - 1)];
    // the textures, and the snow's share over the upper massif
    const light = new Uint8Array(BW * BH * 4);
    const sky = new Uint8Array(BW * BH).fill(255);
    for (let o = 0; o < BW * BH; o++) light.set([128, 128, 255, 255], o * 4);
    let upper = 0;
    let snowy = 0;
    for (let y = 0; y < BH; y++)
      for (let x = 0; x < BW; x++) {
        const o = y * BW + x;
        // what stays under the cloud tops keeps the defaults (snow, the normal up, lit, open sky): the shader never draws it
        if (hb[o] < -80) continue;
        const dx = (E(x + 1, y) - E(x - 1, y)) / (2 * ub);
        const dz = (E(x, y + 1) - E(x, y - 1)) / (2 * ub);
        let nx = -dx * right[0] - dz * toward[0];
        let nz = -dx * right[2] - dz * toward[2];
        const l = Math.hypot(nx, 1, nz);
        nx /= l;
        nz /= l;
        // the ground's bend at two sizes (hollows hold snow, crests shed it), and its own slope a little wider than a texel, so
        // the snow line does not take the erosion's speckle
        const lap = (s: number) => (HB(x + s, y) + HB(x - s, y) + HB(x, y + s) + HB(x, y - s) - 4 * HB(x, y)) / (s * ub * s * ub);
        const bend = lap(9) * 70 + lap(27) * 260;
        const sgx = (HB(x + 3, y) - HB(x - 3, y)) / (6 * ub);
        const sgy = (HB(x, y + 3) - HB(x, y - 3)) / (6 * ub);
        const steep = smooth(1 - 1 / Math.sqrt(1 + sgx * sgx + sgy * sgy), 0.22, 0.5);
        const high = smooth(hb[o] / Math.max(1, top), 0.3, 0.85);
        // the score: all the gentle ground, and on the steep faces the flutings between the ribs, more of it in the hollows and
        // high up; the faces' rule takes over only as the ground steepens, so the rock never stands in spots on the gentler
        const gentle = 0.9 + clamp(bend, -1, 1.5) * 0.6 + high * 0.4;
        const face = (0.55 - rib[o]) * 4 + (0.5 - steep) * 1.4 + high * 1.1 + clamp(bend, -1, 1) * 0.6 + 0.55;
        const w = steep * steep;
        const score = gentle * (1 - w) + face * w + snowBias;
        // the DEM's shadow and reach, read between its samples
        const fx = (x + 0.5) / up - 0.5;
        const fy = (y + 0.5) / up - 0.5;
        const x0 = clamp(Math.floor(fx), 0, W - 1);
        const y0 = clamp(Math.floor(fy), 0, H - 1);
        const x1 = Math.min(W - 1, x0 + 1);
        const y1 = Math.min(H - 1, y0 + 1);
        const tx = clamp(fx - x0, 0, 1);
        const ty = clamp(fy - y0, 0, 1);
        const bil = (a: Float32Array) => (a[y0 * W + x0] * (1 - tx) + a[y0 * W + x1] * tx) * (1 - ty) + (a[y1 * W + x0] * (1 - tx) + a[y1 * W + x1] * tx) * ty;
        light[o * 4] = Math.round((nx * 0.5 + 0.5) * 255);
        light[o * 4 + 1] = Math.round((nz * 0.5 + 0.5) * 255);
        light[o * 4 + 2] = Math.round(clamp(bil(shadow), 0, 1) * 255);
        light[o * 4 + 3] = Math.round(clamp(0.5 + score * 0.25, 0, 1) * 255);
        sky[o] = Math.round(clamp(bil(reach), 0, 1) * 255);
        if (hb[o] > top * 0.5) {
          upper++;
          if (score > 0) snowy++;
        }
      }
    // the mesh: every stride-th DEM sample, placed in the world, of the quads that stand over the cloud tops
    const MW = Math.floor((W - 1) / stride) + 1;
    const MH = Math.floor((H - 1) / stride) + 1;
    const yOf = (v: number) => h[Math.floor(v / MW) * stride * W + (v % MW) * stride];
    const quads: number[] = [];
    for (let mj = 0; mj < MH - 1; mj++)
      for (let mi = 0; mi < MW - 1; mi++) {
        const p = mj * MW + mi;
        if (Math.max(yOf(p), yOf(p + 1), yOf(p + MW), yOf(p + MW + 1)) >= -20) quads.push(p);
      }
    const used = new Int32Array(MW * MH).fill(-1);
    let count = 0;
    for (const p of quads) for (const v of [p, p + 1, p + MW, p + MW + 1]) if (used[v] < 0) used[v] = count++;
    const position = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const along = new Float32Array(count);
    for (let v = 0; v < MW * MH; v++) {
      const o = used[v];
      if (o < 0) continue;
      const i = (v % MW) * stride;
      const j = Math.floor(v / MW) * stride;
      const a = (i - (W - 1) / 2) * unit;
      const c = (j - (H - 1) / 2) * unit;
      position[o * 3] = cx + a * right[0] + c * toward[0];
      position[o * 3 + 1] = seaY + h[j * W + i];
      position[o * 3 + 2] = cz + a * right[2] + c * toward[2];
      uv[o * 2] = (i + 0.5) / W;
      uv[o * 2 + 1] = (j + 0.5) / H;
      along[o] = a;
    }
    const index = new Uint16Array(quads.length * 6);
    for (let q = 0; q < quads.length; q++) {
      const p = quads[q];
      index.set([used[p], used[p + MW], used[p + 1], used[p + 1], used[p + MW], used[p + MW + 1]], q * 6);
    }
    out.push({ k, position, uv, along, index, light, sky, width: BW, height: BH, snow: upper ? snowy / upper : 0 });
  }
  return { cells: out, ms: performance.now() - t0 };
}
