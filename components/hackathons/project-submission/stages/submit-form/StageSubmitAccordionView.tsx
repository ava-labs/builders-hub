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

export default function StageSubmitAccordionView({
  hackathon,
  hackathonCreator,
  stages,
  initialStageIndex,
  user,
}: StageSubmitAccordionViewProps): React.JSX.Element {
  const [openStage, setOpenStage] = React.useState<string>(String(initialStageIndex))

  // Filter stages to only show those with a submitForm
  const stagesWithForm = stages.filter((stage: HackathonStage) => stage.submitForm?.fields && stage.submitForm.fields.length > 0)

  return (
    <div className="space-y-4">
      <Accordion
        type="single"
        value={openStage}
        onValueChange={setOpenStage}
        collapsible
      >
        {stagesWithForm.map((stage: HackathonStage, index: number) => {
          // Find the original index of the stage in the stages array
          const originalIndex = stages.indexOf(stage)
          return (
            <AccordionItem
              key={`stage-form-${originalIndex}`}
              value={String(originalIndex)}
              className="my-2 border rounded-lg px-4 bg-white dark:bg-zinc-800"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="font-semibold">{stage.label || `Stage ${originalIndex + 1}`}</span>
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
