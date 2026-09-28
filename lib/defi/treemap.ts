/* Squarified treemap (Bruls, Huizing, van Wijk): tiles are laid in rows
   along the short side, and a tile joins the row while that keeps the
   row's worst aspect ratio down. Values must be sorted largest first. */

export interface Tile<T> {
  x: number;
  y: number;
  w: number;
  h: number;
  item: T;
}

export function squarify<T>(nodes: { value: number; item: T }[], W: number, H: number): Tile<T>[] {
  const total = nodes.reduce((s, n) => s + n.value, 0);
  if (!total || W <= 0 || H <= 0) return [];
  const areas = nodes.filter((n) => n.value > 0).map((n) => ({ a: (n.value / total) * W * H, item: n.item }));
  const out: Tile<T>[] = [];
  let x = 0;
  let y = 0;
  let w = W;
  let h = H;
  let i = 0;
  while (i < areas.length) {
    const side = Math.min(w, h);
    const worst = (row: typeof areas) => {
      const s = row.reduce((t, r) => t + r.a, 0);
      const mx = Math.max(...row.map((r) => r.a));
      const mn = Math.min(...row.map((r) => r.a));
      return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
    };
    const row = [areas[i]];
    let j = i + 1;
    while (j < areas.length && worst([...row, areas[j]]) <= worst(row)) row.push(areas[j++]);
    const s = row.reduce((t, r) => t + r.a, 0);
    if (w >= h) {
      const cw = s / h;
      let cy = y;
      for (const r of row) {
        const rh = r.a / cw;
        out.push({ x, y: cy, w: cw, h: rh, item: r.item });
        cy += rh;
      }
      x += cw;
      w -= cw;
    } else {
      const rh = s / w;
      let cx = x;
      for (const r of row) {
        const rw = r.a / rh;
        out.push({ x: cx, y, w: rw, h: rh, item: r.item });
        cx += rw;
      }
      y += rh;
      h -= rh;
    }
    i = j;
  }
  return out;
}
