"use client"

import { ReactNode, useState } from 'react'

interface TooltipProps {
  children: ReactNode
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export function Tooltip({ 
  children, 
  content, 
  position = 'top', 
  delay = 400 
}: TooltipProps) {
  const [active, setActive] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  const showTip = () => {
    const id = setTimeout(() => {
      setActive(true)
    }, delay)
    setTimeoutId(id)
  }

  const hideTip = () => {
    if (timeoutId) clearTimeout(timeoutId)
    setActive(false)
  }

  const positionStyles = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 -translate-y-1 mb-1',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 translate-y-1 mt-1',
    left: 'right-full top-1/2 transform -translate-x-1 -translate-y-1/2 mr-1',
    right: 'left-full top-1/2 transform translate-x-1 -translate-y-1/2 ml-1'
  }

  const arrowStyles = {
    top: 'border-t-gray-800 dark:border-t-gray-700 border-l-transparent border-r-transparent border-b-transparent bottom-[-4px] left-1/2 transform -translate-x-1/2',
    bottom: 'border-b-gray-800 dark:border-b-gray-700 border-l-transparent border-r-transparent border-t-transparent top-[-4px] left-1/2 transform -translate-x-1/2',
    left: 'border-l-gray-800 dark:border-l-gray-700 border-t-transparent border-b-transparent border-r-transparent right-[-4px] top-1/2 transform -translate-y-1/2',
    right: 'border-r-gray-800 dark:border-r-gray-700 border-t-transparent border-b-transparent border-l-transparent left-[-4px] top-1/2 transform -translate-y-1/2'
  }

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
    >
      {children}
      {active && (
        <div className={`absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-800 dark:bg-gray-700 rounded shadow-md whitespace-nowrap transition-opacity duration-200 ${positionStyles[position]}`}>
          {content}
          <span className={`absolute w-0 h-0 border-4 ${arrowStyles[position]}`}></span>
        </div>
      )}
    </div>
  )
} 