"use client";
import React, { type JSX } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Label,
} from "recharts";

const data = [
  { time: "t0", totalState: 50, activeState: 0, prunedTotal: null },
  { time: "t1", totalState: 250, activeState: 75, prunedTotal: null },
  { time: "t2", totalState: 450, activeState: 150, prunedTotal: null },
  { time: "t3", totalState: 650, activeState: 225, prunedTotal: 225 },
  { time: "t4", totalState: 850, activeState: 300, prunedTotal: 425 },
  { time: "t5", totalState: 1050, activeState: 375, prunedTotal: 625 },
  { time: "t6", totalState: 1250, activeState: 450, prunedTotal: 825 },
];

const StateGrowthChart = (): JSX.Element => {
  const renderLegend = (props: any) => {
    const { payload } = props;
    // Add custom legend entry for the arrow
    const customPayload = [
      ...payload,
      { value: "Resync/Offline Pruning", color: "#666", type: "arrow" }
    ];

    return (
      <div style={{ display: "flex", justifyContent: "center", gap: "20px", paddingBottom: "20px" }}>
        {customPayload.map((entry: any, index: number) => (
          <div key={`legend-${index}`} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="20" height="2" style={{ overflow: "visible" }}>
              <line
                x1="0"
                y1="1"
                x2="20"
                y2="1"
                stroke={entry.color}
                strokeWidth="2"
                strokeDasharray={entry.value === "Total State After Pruning / Resync" || entry.type === "arrow" ? "3 3" : "0"}
              />
            </svg>
            <span style={{ fontSize: "14px", color: "#666" }}>{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full my-6 p-4 border rounded-lg bg-white dark:bg-gray-900">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="time"
            label={{ value: "Time →", position: "insideBottom", offset: -10 }}
            tick={false}
          />
          <YAxis
            label={{ value: "State Size (GB)", angle: -90, position: "insideLeft", offset: 10 }}
            tick={false}
          />
          <Legend
            verticalAlign="top"
            height={36}
            content={renderLegend}
          />
          <Line
            type="monotone"
            dataKey="totalState"
            stroke="#ff0000"
            strokeWidth={3}
            name="Total State"
            dot={false}
            legendType="line"
          />
          <Line
            type="monotone"
            dataKey="activeState"
            stroke="#0066cc"
            strokeWidth={3}
            name="Active State"
            dot={false}
            legendType="line"
          />
          <Line
            type="monotone"
            dataKey="prunedTotal"
            stroke="#ff0000"
            strokeWidth={3}
            strokeDasharray="5 5"
            name="Total State After Pruning / Resync"
            dot={false}
            connectNulls={false}
            legendType="line"
          />
          {/* Vertical arrow at t3 */}
          <ReferenceLine
            segment={[
              { x: "t3", y: 650 },
              { x: "t3", y: 275 },
            ]}
            stroke="#666"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
        <strong>Note:</strong> The dotted line shows how resync or offline pruning reduces total state back to active state level.
      </div>
    </div>
  );
};

export default StateGrowthChart;
