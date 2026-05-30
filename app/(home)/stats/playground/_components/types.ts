import type { DataSeries } from "@/components/stats/ConfigurableChart";

export interface ChartConfig {
  id: string;
  title: string;
  colSpan: 6 | 12;
  dataSeries?: DataSeries[];
  stackSameMetrics?: boolean;
  abbreviateNumbers?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  brushStartIndex?: number | null;
  brushEndIndex?: number | null;
}

export interface PlaygroundCreator {
  id: string;
  name: string | null;
  user_name: string | null;
  image: string | null;
  profile_privacy: string | null;
}

export interface PlaygroundLoadResponse {
  id: string;
  name: string;
  is_public: boolean;
  is_owner?: boolean;
  is_favorited?: boolean;
  favorite_count?: number;
  view_count?: number;
  creator?: PlaygroundCreator | null;
  created_at?: string | null;
  updated_at?: string | null;
  globalStartTime?: string | null;
  globalEndTime?: string | null;
  charts?: Partial<ChartConfig>[];
}
