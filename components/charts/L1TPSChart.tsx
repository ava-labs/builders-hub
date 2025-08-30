"use client";

import { ChartContainer } from '@/components/ui/chart';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from "recharts";

export default function L1TPSChart({ data }: { data: any[] }) {
  return (
    <ChartContainer
      config={{ tps: { color: '#FF4747', label: 'TPS' } }}
      className="h-32 w-full"
    >
      <div className="w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="#888" />
            <YAxis axisLine={false} tickLine={false} stroke="#888" />
            <RechartsTooltip />
            <Line type="monotone" dataKey="tps" stroke="#FF4747" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
} 