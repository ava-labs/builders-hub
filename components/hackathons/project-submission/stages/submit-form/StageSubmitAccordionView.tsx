'use client'

import React from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { HackathonStage } from '@/types/hackathon-stage'
import { HackathonHeader } from '@/types/hackathons'
import StageSubmitPageContent from './page-content'

type StageSubmitAccordionViewProps = {
  hackathon: HackathonHeader
  hackathonCreator?: any
  stages: HackathonStage[]
  initialStageIndex: number
  user?: {
    email?: string
    id?: string
    user_name?: string
  }
}

type StageStatus = 'active' | 'upcoming' | 'ended'

function getStageStatus(stage: HackathonStage): StageStatus {
  const now = new Date()
  const start = stage.date ? new Date(stage.date) : null
  const end = stage.deadline ? new Date(stage.deadline) : null
  if (start && now < start) return 'upcoming'
  if (end && now > end) return 'ended'
  return 'active'
}

function formatStageDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const STATUS_CONFIG: Record<StageStatus, { label: string; className: string; itemBorder: string }> = {
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    itemBorder: 'border-l-2 border-l-green-500',
  },
  upcoming: {
    label: 'Upcoming',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    itemBorder: 'border-l-2 border-l-sky-400',
  },
  ended: {
    label: 'Ended',
    className: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
    itemBorder: 'border-l-2 border-l-zinc-400 dark:border-l-zinc-600',
  },
}

function StageBadge({ status }: { status: StageStatus }): React.JSX.Element {
  const { label, className } = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

export default function StageSubmitAccordionView({
  hackathon,
  hackathonCreator,
  stages,
  initialStageIndex,
  user,
}: StageSubmitAccordionViewProps): React.JSX.Element {
  const [openStage, setOpenStage] = React.useState<string>(String(initialStageIndex))

  const stagesWithForm = stages.filter(
    (stage: HackathonStage) => stage.submitForm?.fields && stage.submitForm.fields.length > 0
  )

  return (
    <div className="space-y-3">
      <Accordion
        type="single"
        value={openStage}
        onValueChange={setOpenStage}
        collapsible
      >
        {stagesWithForm.map((stage: HackathonStage, index: number) => {
          const originalIndex = stages.indexOf(stage)
          const status = getStageStatus(stage)
          const { itemBorder } = STATUS_CONFIG[status]
          const hasDate = stage.date || stage.deadline

          return (
            <AccordionItem
              key={`stage-form-${originalIndex}`}
              value={String(originalIndex)}
              className={`my-2 overflow-hidden rounded-lg border bg-white px-4 dark:bg-zinc-900 ${itemBorder}`}
            >
              <AccordionTrigger className="py-4 hover:no-underline">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-4 pr-2">
                  <span className="truncate font-semibold text-zinc-900 dark:text-white">
                    {stage.label || `Stage ${originalIndex + 1}`}
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
                    {hasDate && (
                      <span className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:inline">
                        {stage.date ? formatStageDate(stage.date) : ''}
                        {stage.date && stage.deadline ? ' – ' : ''}
                        {stage.deadline ? formatStageDate(stage.deadline) : ''}
                      </span>
                    )}
                    <StageBadge status={status} />
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <StageSubmitPageContent
                  hackathon={hackathon}
                  hackathonCreator={hackathonCreator}
                  stage={stage}
                  stageIndex={originalIndex}
                  user={user}
                />
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
