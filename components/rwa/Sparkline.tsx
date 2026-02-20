'use client'

import { AreaChart, Area, ResponsiveContainer } from 'recharts'

interface SparklineProps {
  data: Array<{ value: number }>
  color?: string
  width?: number
  height?: number
}

export function Sparkline({ data, color = '#6366f1', width = 80, height = 24 }: SparklineProps) {
  if (!data || data.length < 2) return null

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={color}
            fillOpacity={0.2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
