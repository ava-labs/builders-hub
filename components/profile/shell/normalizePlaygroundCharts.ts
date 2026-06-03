import type { ChartConfig } from "@/app/(home)/stats/playground/_components/types";

export interface NormalizedPlayground {
  charts: ChartConfig[];
  globalStartTime: string | null;
  globalEndTime: string | null;
}

/**
 * The playground persists its charts as JSON. Newer dashboards store
 * `{ globalStartTime, globalEndTime, charts: [...] }`; legacy ones stored a
 * bare `charts` array. This mirrors the server's read logic
 * (app/api/playground/route.ts) so the profile preview handles both shapes.
 */
export function normalizePlaygroundCharts(raw: unknown): NormalizedPlayground {
  if (Array.isArray(raw)) {
    return { charts: raw as ChartConfig[], globalStartTime: null, globalEndTime: null };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as {
      charts?: unknown;
      globalStartTime?: string | null;
      globalEndTime?: string | null;
    };
    return {
      charts: Array.isArray(obj.charts) ? (obj.charts as ChartConfig[]) : [],
      globalStartTime: obj.globalStartTime ?? null,
      globalEndTime: obj.globalEndTime ?? null,
    };
  }
  return { charts: [], globalStartTime: null, globalEndTime: null };
}
