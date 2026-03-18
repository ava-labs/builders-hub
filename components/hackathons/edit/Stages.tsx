'use client'

import React, { useEffect, useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Divider } from '@/components/ui/divider'
import { t } from '@/app/hackathons/edit/translations'
import { IDataContent } from '@/app/hackathons/edit/initials'
import StageCardsForm from './stages-components/Card'
import { HackathonStage, StageComponent } from '@/types/hackathon-stage'
import StageTagsForm from './stages-components/Tags'

export enum StageComponentType {
  Cards = 'cards',
  Tags = 'tags',
}

export type CardItem = {
  icon: string
  title: string
  description: string
}


type HackathonsEditStagesProps = {
  formDataContent: IDataContent
  setFormDataContent: (data: IDataContent) => void
  language: 'en' | 'es'
}

type StageFormProps = {
  stage: HackathonStage
  index: number
  onStageFieldChange: (
    index: number,
    field: 'label' | 'date' | 'deadline',
    value: string
  ) => void
  onStageComponentTypeChange: (
    index: number,
    type: StageComponentType
  ) => void
  onStageComponentChange: (
    index: number,
    component: HackathonStage['component']
  ) => void
  onRemove: (index: number) => void
}

const createDefaultComponentByType = (
  type: StageComponentType
): StageComponent => {
  switch (type) {
    case StageComponentType.Cards:
      return {
        type: 'cards',
        cards: [],
      }

    case StageComponentType.Tags:
      return {
        type: 'tags',
        title: '',
        description: '',
        tags: [],
      }
  }
}

export default function HackathonsEditStages({
  formDataContent,
  setFormDataContent,
  language,
}: HackathonsEditStagesProps): React.JSX.Element {
  const [stages, setStages] = useState<HackathonStage[]>(() => {
    const initialStages: HackathonStage[] | undefined = (
      formDataContent as IDataContent & {
        stages?: HackathonStage[]
      }
    ).stages

    return initialStages ?? []
  })

  useEffect(() => {
    const externalStages: HackathonStage[] | undefined = (
      formDataContent as IDataContent & {
        stages?: HackathonStage[]
      }
    ).stages

    if (externalStages) {
      setStages(externalStages)
    }
  }, [formDataContent])

  const syncStagesToParent = (updatedStages: HackathonStage[]): void => {
    setStages(updatedStages)

    setFormDataContent({
      ...formDataContent,
      stages: updatedStages,
    } as IDataContent)
    console.log('Updated stages:', updatedStages)
  }

  const addStage = (): void => {
    const newStage: HackathonStage = {
      label: '',
      date: '',
      deadline: '',
      component: undefined,
    }

    const updatedStages: HackathonStage[] = [...stages, newStage]
    syncStagesToParent(updatedStages)
  }

  const removeStage = (index: number): void => {
    const updatedStages: HackathonStage[] = stages.filter(
      (_stage: HackathonStage, currentIndex: number) => currentIndex !== index
    )

    syncStagesToParent(updatedStages)
  }

  const updateStageField = (
    index: number,
    field: 'label' | 'date' | 'deadline',
    value: string
  ): void => {
    const updatedStages: HackathonStage[] = stages.map(
      (stage: HackathonStage, currentIndex: number) => {
        if (currentIndex !== index) {
          return stage
        }

        return {
          ...stage,
          [field]: value,
        }
      }
    )

    syncStagesToParent(updatedStages)
  }

  const updateStageComponentType = (
    index: number,
    type: StageComponentType
  ): void => {
    const updatedStages: HackathonStage[] = stages.map(
      (stage: HackathonStage, currentIndex: number) => {
        if (currentIndex !== index) {
          return stage
        }

        return {
          ...stage,
          component: createDefaultComponentByType(type),
        }
      }
    )

    syncStagesToParent(updatedStages)
  }

  const updateStageComponent = (
    index: number,
    component: HackathonStage['component']
  ): void => {
    const updatedStages: HackathonStage[] = stages.map(
      (stage: HackathonStage, currentIndex: number) => {
        if (currentIndex !== index) {
          return stage
        }

        return {
          ...stage,
          component,
        }
      }
    )

    syncStagesToParent(updatedStages)
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        className="bg-green-600 hover:bg-green-700 text-white"
        onClick={addStage}
      >
        {t[language].addStage}
      </Button>

      {stages.map((stage: HackathonStage, index: number) => (
        <Accordion
          key={`stage-${index}`}
          type="single"
          collapsible
          className="w-full rounded-md border px-4"
        >
          <AccordionItem value={`item-${index}`}>
            <AccordionTrigger>
              {stage.label?.trim() ? stage.label : `Stage ${index + 1}`}
            </AccordionTrigger>

            <AccordionContent>
              <StageForm
                stage={stage}
                index={index}
                onStageFieldChange={updateStageField}
                onStageComponentTypeChange={updateStageComponentType}
                onStageComponentChange={updateStageComponent}
                onRemove={removeStage}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ))}
    </div>
  )
}

function StageForm({
  stage,
  index,
  onStageFieldChange,
  onStageComponentTypeChange,
  onStageComponentChange,
  onRemove,
}: StageFormProps): React.JSX.Element {
  const tagsValue: string =
    stage.component?.type === 'tags' ? stage.component.tags.join(', ') : ''

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor={`stage-label-${index}`}>Stage label</Label>
        <Input
          id={`stage-label-${index}`}
          type="text"
          value={stage.label}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onStageFieldChange(index, 'label', event.target.value)
          }
          placeholder="E.g. MVP Ready"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`stage-date-${index}`}>Start date</Label>
        <Input
          id={`stage-date-${index}`}
          type="date"
          value={stage.date}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onStageFieldChange(index, 'date', event.target.value)
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`stage-deadline-${index}`}>End date</Label>
        <Input
          id={`stage-deadline-${index}`}
          type="date"
          value={stage.deadline}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onStageFieldChange(index, 'deadline', event.target.value)
          }
        />
      </div>

      <Divider />
      <h1 className="text-lg font-bold">Component</h1>

      <div className="space-y-2">
        <Label htmlFor={`stage-type-${index}`}>Type</Label>
        <select
          id={`stage-type-${index}`}
          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={stage.component?.type ?? ''}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
            onStageComponentTypeChange(
              index,
              event.target.value as StageComponentType
            )
          }
        >
          <option value="">Select type</option>
          <option value={StageComponentType.Cards}>Cards</option>
          <option value={StageComponentType.Tags}>Tags</option>
        </select>
      </div>

      {stage.component?.type === 'cards' && (
        <StageCardsForm
          index={index}
          component={stage.component}
          onChange={onStageComponentChange}
        />
      )}

      {stage.component?.type === 'tags' && (
        <StageTagsForm
          index={index}
          component={stage.component}
          onChange={onStageComponentChange}
        />
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="destructive"
          onClick={() => onRemove(index)}
        >
          Remove stage
        </Button>
      </div>
    </div>
  )
}