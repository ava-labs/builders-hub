"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, SphereGeometry } from "three";
import type { City } from "@/components/explorer-v2/network/city";
import type { CityModel } from "./model";
import type { Theme } from "./palette";
import { instanced } from "./instancing";
import { standingBox } from "./geometry";
import { lampGlowMaterial, massMaterial, RISE_S, TIME } from "./shaders";

/* The city's street lights: a lamp post every so often down both sides of
   each ring road, clear of the boulevards that cross it. By day they are
   the model's fine steel posts; at night their heads glow a restrained warm
   white and each throws a faint pool of light on the road under it. A post
   is its street's: it rises with the tower nearest it, on the city's clock,
   so no lamp stands on the plate before the city does; its head rides up on
   it, its glow with it, and its pool comes up as it rises. */

const POLE = 5.2;

export function Streetlights({
  city,
  theme,
  glow = false,
  model,
  rise = [],
}: {
  city: City;
  theme: Theme;
  glow?: boolean;
  /** the towers, and when each rises on the city's clock: a post rises with the tower nearest it */
  model?: CityModel;
  rise?: ArrayLike<number>;
}) {
  const dark = theme === "dark";
  // each post's place in the plan: down both sides of every ring road, a lot's pitch apart, clear of the boulevards; and the tower nearest it
  const posts = useMemo(() => {
    const out: { x: number; z: number; pool: number; b: number }[] = [];
    const seams = city.wards.map((w) => w.a0);
    city.rings.forEach((r, ri) => {
      for (const side of [-1, 1]) {
        const rr = r + side * city.lot * 0.29;
        if (rr <= 4) continue;
        const step = (city.lot * 1.05) / rr;
        const start = (ri % 2 ? 0.5 : 0) * step + (side > 0 ? step / 2 : 0);
        for (let a = start; a < Math.PI * 2; a += step) {
          // a boulevard crosses here: its paving stays clear
          const clear = (city.avenue * 0.62 + 3) / rr;
          if (seams.length > 1 && seams.some((s) => Math.abs(Math.atan2(Math.sin(a - s), Math.cos(a - s))) < clear)) continue;
          const x = rr * Math.cos(a);
          const z = rr * Math.sin(a);
          let b = -1;
          let d = Infinity;
          model?.buildings.forEach((bd, i) => {
            const e = (bd.x - x) ** 2 + (bd.z - z) ** 2;
            if (e < d) {
              d = e;
              b = i;
            }
          });
          out.push({ x, z, pool: (r + side * city.lot * 0.12) / rr, b });
        }
      }
    });
    return out;
  }, [city, model]);

  // when a post rises: with its tower, or at the clock's start when it has none
  const riseOf = (i: number) => {
    const b = posts[i]?.b ?? -1;
    return b >= 0 ? (rise[b] ?? 0) : 0;
  };
  const mats = useMemo(
    () => ({
      pole: massMaterial({ key: "post", foot: 1 }),
      head: new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      pool: new ShaderMaterial({
        uniforms: { uColor: { value: new Color("#FFE9C8") }, uTime: TIME },
        // a pool comes up as its post rises (aRise: when, on the city's clock), in the brand's motion
        vertexShader: `attribute float aRise; uniform float uTime; varying vec2 vUv; varying float vUp; void main() { vUv = uv; float t = clamp( ( uTime - aRise ) / ${RISE_S.toFixed(2)}, 0.0, 1.0 ); vUp = t >= 1.0 ? 1.0 : 1.0 - exp2( -10.0 * t ); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( position, 1.0 ); }`,
        // a pool of light, added to the road under it: bright at the post, fading to nothing at its edge, as strong as its post has risen
        fragmentShader: "uniform vec3 uColor; varying vec2 vUv; varying float vUp; void main() { float d = length( vUv - 0.5 ) * 2.0; float a = pow( max( 0.0, 1.0 - d ), 1.6 ) * 0.22 * vUp; gl_FragColor = vec4( uColor * a, a ); }",
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        premultipliedAlpha: true,
      }),
    }),
    [],
  );
  const meshes = useMemo(() => {
    // a post rises with its tower: instanced() reads its rise by the tower's index
    const poles = instanced(standingBox(), mats.pole, posts.map((p) => ({ b: p.b, x: p.x, y: 0, z: p.z, sx: 0.26, sy: POLE, sz: 0.26, yaw: 0 })), rise);
    const heads = new InstancedMesh(new SphereGeometry(0.5, 10, 6), mats.head, Math.max(1, posts.length));
    const pools = new InstancedMesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mats.pool, Math.max(1, posts.length));
    const M = new Matrix4();
    posts.forEach((p, i) => {
      heads.setMatrixAt(i, M.makeTranslation(p.x, POLE + 0.3, p.z));
      // the pool falls on the road, in from the post
      pools.setMatrixAt(i, M.makeScale(17, 1, 17).setPosition(p.x * p.pool, 0.08, p.z * p.pool));
    });
    for (const m of [heads, pools]) {
      m.count = posts.length;
      m.frustumCulled = false;
      m.instanceMatrix.needsUpdate = true;
    }
    pools.renderOrder = 1;
    pools.geometry.setAttribute("aRise", new InstancedBufferAttribute(Float32Array.from({ length: Math.max(1, posts.length) }, (_, i) => riseOf(i)), 1));
    // a soft disc round each lamp's head at night, reading the heads' places
    const halos = new InstancedMesh(new PlaneGeometry(1, 1), lampGlowMaterial(2.2, 0.24, "#FFEBD0"), Math.max(1, posts.length));
    halos.count = posts.length;
    halos.instanceMatrix = heads.instanceMatrix;
    halos.frustumCulled = false;
    halos.visible = false;
    return { poles, heads, pools, halos };
    // riseOf reads the rise, as its dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, mats, rise]);
  useEffect(
    () => () => {
      for (const m of Object.values(meshes)) {
        m.geometry.dispose();
        m.dispose();
      }
      (meshes.halos.material as ShaderMaterial).dispose();
    },
    [meshes],
  );
  /* the heads ride up with their posts on the city's clock (each post's own rise, in the brand's motion), grown from
     nothing, and the halos with them, as they read the heads' places. Written only while some post still rises */
  const done = useRef(false);
  const M = useMemo(() => new Matrix4(), []);
  useFrame(() => {
    if (done.current) return;
    const t = TIME.value;
    let all = true;
    posts.forEach((p, i) => {
      const u = (t - riseOf(i)) / RISE_S;
      const up = u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.pow(2, -10 * u);
      if (up < 1) all = false;
      meshes.heads.setMatrixAt(i, M.makeScale(up, up, up).setPosition(p.x, -0.6 + (POLE + 0.3 + 0.6) * up, p.z));
    });
    meshes.heads.instanceMatrix.needsUpdate = true;
    done.current = all;
  });
  // a new set of meshes starts its rise where the clock stands
  useEffect(() => {
    done.current = false;
  }, [meshes]);
  useEffect(() => {
    mats.pole.color.set(dark ? "#3B484B" : "#A2AFB2");
    mats.head.color.set(dark ? "#FFF1DC" : "#EBF0FA").multiplyScalar(dark ? 1.3 : 1);
    meshes.pools.visible = dark;
    meshes.halos.visible = dark && glow;
  }, [dark, mats, meshes, glow]);

  return (
    <group>
      <primitive object={meshes.poles} />
      <primitive object={meshes.heads} />
      <primitive object={meshes.pools} />
      <primitive object={meshes.halos} />
    </group>
  );
}
