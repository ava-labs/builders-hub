/* the plan's shared measures, read by the map and by downtown's crown:
   the plate's tilt (how much a circle on the ground squashes on screen)
   and the width of downtown's shaft */
export const TILT = 0.5;
export const HUB_W = 19;

/** an annular sector in plan, angles in radians clockwise on screen */
export function arcPath(a0: number, a1: number, r0: number, r1: number): string {
  const at = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${at(r1, a0)} A${r1},${r1} 0 ${large} 1 ${at(r1, a1)} L${at(r0, a1)} A${r0},${r0} 0 ${large} 0 ${at(r0, a0)} Z`;
}

/** seeded dice: the same key rolls the same numbers every render */
export function diceOf(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
