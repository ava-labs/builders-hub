import {
  Color,
  Euler,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  CylinderGeometry,
  type BufferGeometry,
  type Material,
} from "three";
import type { Inst, Tree } from "./model";
import { riseDepth } from "./shaders";

/* Instanced meshes from the model's lists: one draw for every box of the
   city, one for every ribbon of glass, and so on. Each instance carries
   its building's turn in the build-out (aRise), so the whole city rises
   from one clock without a matrix changing. */

const M = new Matrix4();
const Q = new Quaternion();
const E = new Euler(0, 0, 0, "YXZ");
const P = new Vector3();
const S = new Vector3();

/** the depth a rising instance casts its shadow with */
export const DEPTH_RISE = riseDepth(true);

export function placeAll(mesh: InstancedMesh, items: Inst[]) {
  items.forEach((it, i) => {
    E.set(it.pitch ?? 0, it.yaw, 0, "YXZ");
    Q.setFromEuler(E);
    M.compose(P.set(it.x, it.y, it.z), Q, S.set(it.sx, it.sy, it.sz));
    mesh.setMatrixAt(i, M);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

/** one instanced mesh for a list, its instances rising with their buildings */
export function instanced(
  geo: BufferGeometry,
  mat: Material,
  items: Inst[],
  rise: ArrayLike<number>,
  opts: { cast?: boolean; receive?: boolean; color?: boolean } = {},
): InstancedMesh {
  const g = geo.clone();
  const mesh = new InstancedMesh(g, mat, Math.max(1, items.length));
  mesh.count = items.length;
  placeAll(mesh, items);
  g.setAttribute("aRise", new InstancedBufferAttribute(Float32Array.from(items, (it) => (it.b >= 0 ? rise[it.b] ?? 0 : 0)), 1));
  if (opts.color) mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(Math.max(1, items.length) * 3).fill(1), 3);
  mesh.frustumCulled = false;
  mesh.castShadow = !!opts.cast;
  mesh.receiveShadow = opts.receive ?? true;
  if (opts.cast) mesh.customDepthMaterial = DEPTH_RISE;
  mesh.visible = items.length > 0;
  return mesh;
}

/** an instanced float attribute, one value per instance */
export function perInstance(mesh: InstancedMesh, name: string, size: number, fill = 0): InstancedBufferAttribute {
  const a = new InstancedBufferAttribute(new Float32Array(Math.max(1, mesh.count) * size).fill(fill), size);
  mesh.geometry.setAttribute(name, a);
  return a;
}

/** paint every instance of a list by a function of it */
export function paintAll<T>(mesh: InstancedMesh, items: T[], colorOf: (it: T, i: number) => Color) {
  if (!mesh.instanceColor) return;
  const a = mesh.instanceColor.array as Float32Array;
  items.forEach((it, i) => {
    const c = colorOf(it, i);
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  });
  mesh.instanceColor.needsUpdate = true;
}

/* a tree of the model: a round crown on a short trunk */
export const CROWN = new IcosahedronGeometry(1, 1);
export const TRUNK = new CylinderGeometry(0.16, 0.22, 1, 6).translate(0, 0.5, 0);

/** trees as two instanced meshes, their crowns and their trunks */
export function treesOf(trees: Tree[], rise: ArrayLike<number>, crown: Material, trunk: Material): [InstancedMesh, InstancedMesh] {
  // the crown's geometry is centred, so it stands a crown's height over its lot, the trunk under it
  const crowns: Inst[] = trees.map((t) => ({ b: t.b ?? -1, x: t.x, y: t.y + t.r * 1.45, z: t.z, sx: t.r, sy: t.r * 1.1, sz: t.r, yaw: (t.x * 13.1 + t.z * 7.7) % 6.28 }));
  const trunks: Inst[] = trees.map((t) => ({ b: t.b ?? -1, x: t.x, y: t.y, z: t.z, sx: t.r, sy: t.r * 0.8, sz: t.r, yaw: 0 }));
  const c = instanced(CROWN, crown, crowns, rise, { cast: true });
  const k = instanced(TRUNK, trunk, trunks, rise, { cast: false });
  return [c, k];
}
