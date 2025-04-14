"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import glossaryData from "@/content/glossary.json"
import { GlossaryTerm as GlossaryTermType } from "@/types/glossary"

interface GlossaryTermProps {
  children: React.ReactNode
  termKey?: string  // Optional term key if different from the children text
  className?: string
}

export function GlossaryTerm({ 
  children, 
  termKey, 
  className = "" 
}: GlossaryTermProps) {
  const [term, setTerm] = useState<GlossaryTermType | null>(null)
  
  useEffect(() => {
    // Get term from glossary data
    const searchTerm = termKey || (typeof children === 'string' ? children : null)
    
    if (searchTerm) {
      const foundTerm = glossaryData.terms.find(
        (t) => t.term.toLowerCase() === searchTerm.toLowerCase()
      )
      setTerm(foundTerm || null)
    }
  }, [children, termKey])

  if (!term) {
    // If term not found in glossary, just render the children without tooltip
    return <span className={className}>{children}</span>
  }

  return (
    <Tooltip>
      <TooltipTrigger className={`border-b border-dotted border-gray-400 ${className}`}>
        {children}
      </TooltipTrigger>
      <TooltipContent className="max-w-md p-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-lg rounded-lg text-sm">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h4 className="font-bold">{term.term}</h4>
            {term.abbreviation && (
              <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-md">
                {term.abbreviation}
              </span>
            )}
          </div>
          
          {term.previousTerm && (
            <div className="text-xs text-gray-500">
              Previously known as: <span className="font-medium">{term.previousTerm}</span>
            </div>
          )}
          
          <p className="text-sm">{term.description}</p>
          
          {term.learnMoreUrl && (
            <Link 
              href={term.learnMoreUrl}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
            >
              Learn more →
            </Link>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export default GlossaryTerm 