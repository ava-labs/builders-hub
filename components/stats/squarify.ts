// Generic squarify treemap layout algorithm
// Places items into a bounding box with approximately square aspect ratios

export interface SquarifyItem {
  key: string;
  value: number;
  [k: string]: unknown;
}

export interface SquarifyRect<T extends SquarifyItem> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function squarify<T extends SquarifyItem>(
  items: T[],
  x0: number,
  y0: number,
  containerW: number,
  containerH: number
): SquarifyRect<T>[] {
  if (items.length === 0) return [];

  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  if (totalValue === 0) return [];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rects: SquarifyRect<T>[] = [];
  const totalArea = containerW * containerH;

  function layoutRow(
    row: T[],
    x: number,
    y: number,
    w: number,
    h: number,
    isHorizontal: boolean
  ): { x: number; y: number; w: number; h: number } {
    const rowTotal = row.reduce((sum, item) => sum + item.value, 0);

    if (isHorizontal) {
      const rowH =
        h * (rowTotal / totalValue) * (totalArea / (w * h)) || 0;
      const clampedH = Math.min(rowH, h);
      let cx = x;

      for (const item of row) {
        const cellW = rowTotal > 0 ? (item.value / rowTotal) * w : 0;
        rects.push({ item, x: cx, y, w: cellW, h: clampedH });
        cx += cellW;
      }

      return { x, y: y + clampedH, w, h: h - clampedH };
    } else {
      const rowW =
        w * (rowTotal / totalValue) * (totalArea / (w * h)) || 0;
      const clampedW = Math.min(rowW, w);
      let cy = y;

      for (const item of row) {
        const cellH = rowTotal > 0 ? (item.value / rowTotal) * h : 0;
        rects.push({ item, x, y: cy, w: clampedW, h: cellH });
        cy += cellH;
      }

      return { x: x + clampedW, y, w: w - clampedW, h };
    }
  }

  let remaining = [...sorted];
  let bounds = { x: x0, y: y0, w: containerW, h: containerH };

  while (remaining.length > 0) {
    const isHorizontal = bounds.w >= bounds.h;
    let bestRow: T[] = [remaining[0]];
    let bestAspect = Infinity;

    for (let i = 1; i <= remaining.length; i++) {
      const row = remaining.slice(0, i);
      const rowTotal = row.reduce((sum, item) => sum + item.value, 0);
      const fraction = rowTotal / totalValue;

      let worstAspect = 0;
      for (const item of row) {
        const itemFraction = item.value / rowTotal;
        let cellW: number, cellH: number;
        if (isHorizontal) {
          cellW = itemFraction * bounds.w;
          cellH = fraction * (totalArea / bounds.w);
        } else {
          cellW = fraction * (totalArea / bounds.h);
          cellH = itemFraction * bounds.h;
        }
        const aspect =
          cellW > 0 && cellH > 0
            ? Math.max(cellW / cellH, cellH / cellW)
            : Infinity;
        worstAspect = Math.max(worstAspect, aspect);
      }

      if (worstAspect <= bestAspect) {
        bestAspect = worstAspect;
        bestRow = row;
      } else {
        break;
      }
    }

    bounds = layoutRow(
      bestRow,
      bounds.x,
      bounds.y,
      bounds.w,
      bounds.h,
      isHorizontal
    );
    remaining = remaining.slice(bestRow.length);
  }

  return rects;
}
