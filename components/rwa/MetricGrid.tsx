import { ReactNode } from 'react'

interface MetricGridProps {
  children: ReactNode
  columns?: 2 | 3 | 4
}

export function MetricGrid({ children, columns = 4 }: MetricGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`grid gap-3 sm:gap-4 overflow-hidden ${gridCols[columns]}`}>
      {children}
    </div>
  )
}
