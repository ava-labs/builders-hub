'use client'

import { Card } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { InfoIcon, ShieldCheck } from 'lucide-react'
import { useCountUp } from '@/lib/rwa/hooks/useCountUp'
import type { FenceCL01Value } from '@/lib/rwa/types'

interface ConcentrationGaugeProps {
  cl01: FenceCL01Value | null
  isLoading?: boolean
}

function AnimatedPercentage({ value }: { value: number }) {
  const animated = useCountUp(value)
  return <>{animated.toFixed(1)}%</>
}

export function ConcentrationGauge({ cl01, isLoading = false }: ConcentrationGaugeProps) {
  if (isLoading) {
    return (
      <Card className="text-center p-4 sm:p-6 rounded-md bg-card border border-gray-200 dark:border-gray-700">
        <Skeleton className="h-4 w-32 mx-auto mb-3" />
        <Skeleton className="h-8 w-20 mx-auto" />
      </Card>
    )
  }

  const percentage = cl01 !== null ? cl01.value * 100 : null
  const thresholdPct = cl01 !== null ? (cl01.threshold * 100).toFixed(0) : '35'

  return (
    <Card
      className="text-center p-4 sm:p-6 rounded-md bg-card border border-gray-200 dark:border-gray-700"
      aria-label={`CL01 Concentration: ${percentage !== null ? `${percentage.toFixed(1)}%` : 'unavailable'}`}
    >
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-3">
        <span style={{ color: 'var(--rwa-accent-600)' }}>
          <ShieldCheck className="h-4 w-4 shrink-0" />
        </span>
        <span>Industry Concentration</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon className="h-3 w-3 cursor-help shrink-0 text-muted-foreground/60" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px]">
              <p className="text-sm">
                Top 1 industry concentration (CL01). Limit: {thresholdPct}%.
                Currently {cl01?.withinLimit ? 'within' : 'exceeding'} threshold.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="text-xl sm:text-2xl font-mono font-semibold text-foreground">
        {percentage !== null ? <AnimatedPercentage value={percentage} /> : '-'}
      </div>
    </Card>
  )
}
