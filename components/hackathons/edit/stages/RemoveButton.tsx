'use client'

import React from 'react'
import { X } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type RemoveButtonProps = {
  onRemove: () => void
  tooltipLabel?: string
  size?: number
  className?: string
}

/**
 * Minimal remove button component with tooltip
 * Displays an "X" icon that can be used in collapsible items
 * Prevents event propagation to avoid triggering parent click handlers
 */
export default function RemoveButton({
  onRemove,
  tooltipLabel = 'Delete',
  size = 18,
  className = '',
}: RemoveButtonProps): React.JSX.Element {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onRemove()
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            className={`inline-flex items-center justify-center p-1.5 rounded-md hover:bg-red-500/10 hover:text-red-500 text-zinc-500 dark:text-zinc-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/30 ${className}`}
            aria-label={tooltipLabel}
          >
            <X size={size} strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {tooltipLabel}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
