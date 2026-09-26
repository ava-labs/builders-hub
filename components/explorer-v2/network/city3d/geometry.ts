import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Vector3 } from "three";
import { PLATE } from "@/components/explorer-v2/network/icm-map";
import type { Arc } from "@/components/explorer-v2/network/city";

/* The city's own shapes, built once: slabs on annular sectors (the blocks,
   the bridges, the ledger's tiles), downtown's chamfered tower, the band
   the rim's words run on, and unit shapes that stand on their base, so an
   instance's position is its foot. The plan's (x, y) is the world's
   (x, z); every slab's top reads the ground's paint at its own place. */

type Pt = [number, number];

/** a plan point's place on the ground's paint */
export const plateUv = (x: number, z: number): Pt => [(x + PLATE) / (2 * PLATE), (z + PLATE) / (2 * PLATE)];

/* a mesh under construction: triangles, each turned to face its normal */
class Builder {
  pos: number[] = [];
  nrm: number[] = [];
  uv: number[] = [];
  groups: { start: number; count: number; index: number }[] = [];
  private tri(a: Vector3, b: Vector3, c: Vector3, na: Vector3, nb: Vector3, nc: Vector3, want: Vector3) {
    const face = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
    const [p, q, r, np, nq, nr] = face.dot(want) >= 0 ? [a, b, c, na, nb, nc] : [a, c, b, na, nc, nb];
    for (const [v, n] of [
      [p, np],
      [q, nq],
      [r, nr],
    ] as const) {
      this.pos.push(v.x, v.y, v.z);
      this.nrm.push(n.x, n.y, n.z);
      const [u, w] = plateUv(v.x, v.z);
      this.uv.push(u, w);
    }
  }
  /** a quad a, b, c, d in turn round its edge, facing its normals' way */
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, na: Vector3, nb = na, nc = na, nd = na) {
    const want = new Vector3().add(na).add(nb).add(nc).add(nd);
    this.tri(a, b, c, na, nb, nc, want);
    this.tri(a, c, d, na, nc, nd, want);
  }
  triangle(a: Vector3, b: Vector3, c: Vector3, n: Vector3) {
    this.tri(a, b, c, n, n, n, n);
  }
  /** close a group of the triangles added since the last */
  group(index: number) {
    const start = this.groups.reduce((t, g) => t + g.count, 0);
    const count = this.pos.length / 3 - start;
    if (count > 0) this.groups.push({ start, count, index });
  }
  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new Float32BufferAttribute(this.nrm, 3));
    g.setAttribute("uv", new Float32BufferAttribute(this.uv, 2));
    for (const gr of this.groups) g.addGroup(gr.start, gr.count, gr.index);
    g.computeBoundingSphere();
    return g;
  }
}

const UP = new Vector3(0, 1, 0);
const DOWN = new Vector3(0, -1, 0);
const polar = (r: number, a: number, y: number) => new Vector3(r * Math.cos(a), y, r * Math.sin(a));

/** slabs on annular sectors, merged: their tops (group 0), which read the ground's paint, and their walls (group 1) */
export function slabsOf(arcs: Arc[], h: number, y0 = 0): BufferGeometry {
  const g = new Builder();
  const y1 = y0 + h;
  const steps = (a: Arc) => Math.max(2, Math.ceil(((a.a1 - a.a0) * a.r1) / 5));
  for (const a of arcs) {
    const n = steps(a);
    for (let i = 0; i < n; i++) {
      const t0 = a.a0 + ((a.a1 - a.a0) * i) / n;
      const t1 = a.a0 + ((a.a1 - a.a0) * (i + 1)) / n;
      g.quad(polar(a.r0, t0, y1), polar(a.r1, t0, y1), polar(a.r1, t1, y1), polar(a.r0, t1, y1), UP);
    }
  }
  g.group(0);
  for (const a of arcs) {
    const n = steps(a);
    for (let i = 0; i < n; i++) {
      const t0 = a.a0 + ((a.a1 - a.a0) * i) / n;
      const t1 = a.a0 + ((a.a1 - a.a0) * (i + 1)) / n;
      const o0 = polar(1, t0, 0);
      const o1 = polar(1, t1, 0);
      g.quad(polar(a.r1, t0, y0), polar(a.r1, t1, y0), polar(a.r1, t1, y1), polar(a.r1, t0, y1), o0, o1, o1, o0);
      if (a.r0 > 0.5) g.quad(polar(a.r0, t0, y0), polar(a.r0, t1, y0), polar(a.r0, t1, y1), polar(a.r0, t0, y1), o0.clone().negate(), o1.clone().negate(), o1.clone().negate(), o0.clone().negate());
    }
    // the ends, square to the sector's edges
    const e0 = new Vector3(Math.sin(a.a0), 0, -Math.cos(a.a0));
    const e1 = new Vector3(-Math.sin(a.a1), 0, Math.cos(a.a1));
    g.quad(polar(a.r0, a.a0, y0), polar(a.r1, a.a0, y0), polar(a.r1, a.a0, y1), polar(a.r0, a.a0, y1), e0);
    g.quad(polar(a.r0, a.a1, y0), polar(a.r1, a.a1, y0), polar(a.r1, a.a1, y1), polar(a.r0, a.a1, y1), e1);
  }
  g.group(1);
  return g.build();
}

/** the arcs in a string of the map's arcPath sectors, in the plan */
export function arcsOfPath(d: string): Arc[] {
  const out: Arc[] = [];
  for (const piece of d.split("M").filter((s) => s.trim())) {
    const n = piece.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi)?.map(Number) ?? [];
    if (n.length < 18) continue;
    const [x1, y1] = [n[0], n[1]];
    const [x2, y2] = [n[7], n[8]];
    const [x3, y3] = [n[9], n[10]];
    let a0 = Math.atan2(y1, x1);
    let a1 = Math.atan2(y2, x2);
    while (a1 <= a0) a1 += 2 * Math.PI;
    if (a1 - a0 > 2 * Math.PI) a0 += 2 * Math.PI;
    out.push({ a0, a1, r0: Math.hypot(x3, y3), r1: Math.hypot(x1, y1) });
  }
  return out;
}

/** the closed polygons of an M/L path, in the plan */
export function polygonsOfPath(d: string): Pt[][] {
  return d
    .split("M")
    .filter((s) => s.trim())
    .map((piece) => {
      const n = piece.replace(/[LZ]/g, " ").trim().split(/[\s,]+/).map(Number);
      const out: Pt[] = [];
      for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]);
      return out;
    })
    .filter((p) => p.length > 2);
}

/** a prism from one plan at z0 to another of as many corners at z1, with its top and its underside: a run of downtown's shaft */
export function prismBetween(A: Pt[], B: Pt[], z0: number, z1: number): BufferGeometry {
  const g = new Builder();
  const k = A.length;
  const at = (p: Pt, y: number) => new Vector3(p[0], y, p[1]);
  for (let i = 0; i < k; i++) {
    const a0 = at(A[i], z0);
    const b0 = at(A[(i + 1) % k], z0);
    const b1 = at(B[(i + 1) % k], z1);
    const a1 = at(B[i], z1);
    const n = new Vector3().subVectors(b0, a0).cross(new Vector3().subVectors(a1, a0)).normalize();
    const mid = new Vector3().addVectors(a0, b0).multiplyScalar(0.5);
    if (n.x * mid.x + n.z * mid.z < 0) n.negate();
    g.quad(a0, b0, b1, a1, n);
  }
  const top = new Vector3(0, z1, 0);
  const bottom = new Vector3(0, z0, 0);
  for (let i = 0; i < k; i++) {
    g.triangle(top, at(B[i], z1), at(B[(i + 1) % k], z1), UP);
    g.triangle(bottom, at(A[i], z0), at(A[(i + 1) % k], z0), DOWN);
  }
  g.group(0);
  return g.build();
}

/** the band round the plate's rim that carries its words, left to right as seen from outside */
export function rimBand(r: number, a0: number, a1: number, y0: number, y1: number): BufferGeometry {
  const n = Math.max(8, Math.ceil(((a1 - a0) * r) / 6));
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    // the viewer's left is the larger angle
    const a = a1 - ((a1 - a0) * i) / n;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pos.push(r * c, y0, r * s, r * c, y1, r * s);
    nrm.push(c, 0, s, c, 0, s);
    uv.push(i / n, 0, i / n, 1);
    if (i < n) {
      const j = i * 2;
      idx.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // wind every triangle to face out
  const p = g.getAttribute("position");
  const A = new Vector3();
  const B = new Vector3();
  const C = new Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    A.fromBufferAttribute(p, idx[t]);
    B.fromBufferAttribute(p, idx[t + 1]);
    C.fromBufferAttribute(p, idx[t + 2]);
    const f = new Vector3().subVectors(B, A).cross(new Vector3().subVectors(C, A));
    if (f.x * A.x + f.z * A.z < 0) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  }
  g.setIndex(idx);
  return g;
}

/** a unit box that stands on its base */
export function standingBox(): BufferGeometry {
  return new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
}
/** a unit drum that stands on its base, closed or open */
export function standingDrum(segments = 40, open = false): BufferGeometry {
  return new CylinderGeometry(1, 1, 1, segments, 1, open).translate(0, 0.5, 0);
}
