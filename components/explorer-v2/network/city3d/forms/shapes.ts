import { BufferGeometry, CircleGeometry, CylinderGeometry, Float32BufferAttribute } from "three";
import { standingBox } from "../geometry";
import { STADIUM_PROFILE } from "./culture";
import type { ShapeKey } from "./frame";

/* The districts' own unit shapes, each standing on its base, so an
   instance's position is its foot, as the city's others do (geometry.ts):
   the stone's trim, a column, a pediment's gable, a sawtooth roof's tooth,
   the stadium's bowl, a louver's blades, and a cooling unit's fan. Each is
   drawn as one instanced mesh for the whole city (Buildings.tsx). */

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V): V => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/* flat-faced triangles, each wound to face its normals' way */
class Faces {
  pos: number[] = [];
  nrm: number[] = [];
  tri(a: V, b: V, c: V, na: V, nb: V = na, nc: V = na) {
    const want: V = [na[0] + nb[0] + nc[0], na[1] + nb[1] + nc[1], na[2] + nb[2] + nc[2]];
    const f = cross(sub(b, a), sub(c, a));
    if (Math.hypot(...f) < 1e-9) return;
    const [p, q, r, np, nq, nr] = dot(f, want) >= 0 ? [a, b, c, na, nb, nc] : [a, c, b, na, nc, nb];
    this.pos.push(...p, ...q, ...r);
    this.nrm.push(...np, ...nq, ...nr);
  }
  quad(a: V, b: V, c: V, d: V, na: V, nb: V = na, nc: V = na, nd: V = na) {
    this.tri(a, b, c, na, nb, nc);
    this.tri(a, c, d, na, nc, nd);
  }
  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new Float32BufferAttribute(this.nrm, 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** a gable: a triangle a unit wide and high, its faces front (+z) and back, a unit deep */
function gable(): BufferGeometry {
  const f = new Faces();
  for (const z of [0.5, -0.5]) f.tri([-0.5, 0, z], [0.5, 0, z], [0, 1, z], [0, 0, Math.sign(z)]);
  f.quad([-0.5, 0, 0.5], [0, 1, 0.5], [0, 1, -0.5], [-0.5, 0, -0.5], unit([-1, 0.5, 0]));
  f.quad([0.5, 0, 0.5], [0, 1, 0.5], [0, 1, -0.5], [0.5, 0, -0.5], unit([1, 0.5, 0]));
  f.quad([-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 0, -0.5], [-0.5, 0, -0.5], [0, -1, 0]);
  return f.build();
}

/** a sawtooth roof's tooth: its upright face (+x), where its glass goes, and its slope falling away from it */
function saw(): BufferGeometry {
  const f = new Faces();
  for (const z of [0.5, -0.5]) f.tri([-0.5, 0, z], [0.5, 0, z], [0.5, 1, z], [0, 0, Math.sign(z)]);
  f.quad([0.5, 0, 0.5], [0.5, 1, 0.5], [0.5, 1, -0.5], [0.5, 0, -0.5], [1, 0, 0]);
  f.quad([-0.5, 0, 0.5], [0.5, 1, 0.5], [0.5, 1, -0.5], [-0.5, 0, -0.5], unit([-1, 1, 0]));
  f.quad([-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 0, -0.5], [-0.5, 0, -0.5], [0, -1, 0]);
  return f.build();
}

/** a section turned round the upright axis: flat along the section, round the other way; each run of it faces to its right as the section is walked */
function lathe(profile: [number, number][], segments: number): BufferGeometry {
  const f = new Faces();
  for (let i = 0; i + 1 < profile.length; i++) {
    const [r0, y0] = profile[i];
    const [r1, y1] = profile[i + 1];
    const [nr, ny] = unit([y1 - y0, -(r1 - r0), 0]);
    for (let j = 0; j < segments; j++) {
      const t0 = (2 * Math.PI * j) / segments;
      const t1 = (2 * Math.PI * (j + 1)) / segments;
      const at = (r: number, y: number, t: number): V => [r * Math.cos(t), y, r * Math.sin(t)];
      const n0: V = [nr * Math.cos(t0), ny, nr * Math.sin(t0)];
      const n1: V = [nr * Math.cos(t1), ny, nr * Math.sin(t1)];
      f.quad(at(r0, y0, t0), at(r1, y1, t0), at(r1, y1, t1), at(r0, y0, t1), n0, n0, n1, n1);
    }
  }
  return f.build();
}

/** a louver: three blades across a unit panel, each falling from the wall (z 0) to its nose (z 1), its top to the sky and its underside to the street */
function louver(blades = 3): BufferGeometry {
  const f = new Faces();
  for (let i = 0; i < blades; i++) {
    const top = (i + 1) / blades;
    const nose = (i + 0.32) / blades;
    const up = unit([0, 1, (top - nose) / 1]);
    const down: V = [-up[0], -up[1], -up[2]];
    f.quad([-0.5, top, 0], [0.5, top, 0], [0.5, nose, 1], [-0.5, nose, 1], up);
    const k = 0.035 / blades;
    f.quad([-0.5, top - k, 0], [0.5, top - k, 0], [0.5, nose - k, 1], [-0.5, nose - k, 1], down);
    f.quad([-0.5, nose, 1], [0.5, nose, 1], [0.5, nose - k, 1], [-0.5, nose - k, 1], [0, 0, 1]);
  }
  return f.build();
}

export interface Shape {
  geo: BufferGeometry;
  /** the Buildings material it wears */
  mat: "mass" | "steel";
  /** it casts a shadow */
  cast: boolean;
  /** it takes the cursor's tint, as the massing does */
  tint: boolean;
}

export const SHAPES: Record<ShapeKey, Shape> = {
  trim: { geo: standingBox(), mat: "mass", cast: false, tint: true },
  column: { geo: new CylinderGeometry(1, 1, 1, 14, 1).translate(0, 0.5, 0), mat: "mass", cast: true, tint: true },
  gable: { geo: gable(), mat: "mass", cast: true, tint: true },
  saw: { geo: saw(), mat: "mass", cast: true, tint: true },
  bowl: { geo: lathe(STADIUM_PROFILE, 64), mat: "mass", cast: true, tint: true },
  louver: { geo: louver(), mat: "mass", cast: false, tint: true },
  fan: { geo: new CircleGeometry(1, 18).rotateX(-Math.PI / 2), mat: "steel", cast: false, tint: false },
};
