import { BufferGeometry, CircleGeometry, CylinderGeometry, Float32BufferAttribute } from "three";
import { standingBox } from "../geometry";
import { STAND_B, STAND_D, STAND_PROFILE } from "./culture";
import type { ShapeKey } from "./frame";

/* The districts' own unit shapes, each standing on its base, so an
   instance's position is its foot, as the city's others do (geometry.ts):
   the stone's trim, a column, a pediment's gable, a sawtooth roof's tooth,
   the stadium's stands, a louver's blades, and a cooling unit's fan. Each is
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

/** a stadium's stands: their section swept round the pitch's square-cornered edge, each corner turned in a fan, so
    the back's corners round on the stands' depth. A unit long along x from the middle, STAND_B wide along z */
function stands(fan = 10): BufferGeometry {
  const f = new Faces();
  const iu = 1 - STAND_D;
  const iv = STAND_B - STAND_D;
  // the pitch's edge, walked round, and the way out there
  const path: [V, V][] = [];
  const turn = (cu: number, cv: number, a0: number) => {
    for (let i = 0; i <= fan; i++) {
      const a = a0 + (i / fan) * (Math.PI / 2);
      path.push([[cu, 0, cv], [Math.cos(a), 0, Math.sin(a)]]);
    }
  };
  path.push([[iu, 0, -iv], [1, 0, 0]], [[iu, 0, iv], [1, 0, 0]]);
  turn(iu, iv, 0);
  path.push([[iu, 0, iv], [0, 0, 1]], [[-iu, 0, iv], [0, 0, 1]]);
  turn(-iu, iv, Math.PI / 2);
  path.push([[-iu, 0, iv], [-1, 0, 0]], [[-iu, 0, -iv], [-1, 0, 0]]);
  turn(-iu, -iv, Math.PI);
  path.push([[-iu, 0, -iv], [0, 0, -1]], [[iu, 0, -iv], [0, 0, -1]]);
  turn(iu, -iv, (3 * Math.PI) / 2);
  const at = ([p, n]: [V, V], d: number, z: number): V => [p[0] + n[0] * d, z, p[2] + n[2] * d];
  for (let j = 0; j < path.length; j++) {
    const a = path[j];
    const b = path[(j + 1) % path.length];
    for (let k = 0; k + 1 < STAND_PROFILE.length; k++) {
      const [d0, z0] = STAND_PROFILE[k];
      const [d1, z1] = STAND_PROFILE[k + 1];
      // the section's outward normal: it is walked up the front, out over the tiers and down the back
      const [nd, nz] = [-(z1 - z0), d1 - d0];
      const l = Math.hypot(nd, nz) || 1;
      const na: V = unit([a[1][0] * (nd / l), nz / l, a[1][2] * (nd / l)]);
      const nb: V = unit([b[1][0] * (nd / l), nz / l, b[1][2] * (nd / l)]);
      f.quad(at(a, d0, z0), at(a, d1, z1), at(b, d1, z1), at(b, d0, z0), na, na, nb, nb);
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
  bowl: { geo: stands(), mat: "steel", cast: true, tint: true },
  louver: { geo: louver(), mat: "mass", cast: false, tint: true },
  fan: { geo: new CircleGeometry(1, 18).rotateX(-Math.PI / 2), mat: "steel", cast: false, tint: false },
};
