'use client'

import React, { useEffect, useState } from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDownIcon } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Divider } from '@/components/ui/divider'
import { t } from '@/app/events/edit/translations'
import { IDataContent } from '@/app/events/edit/initials'
import StageCardsForm from './Card'
import StageTagsForm from './Tags'
import StageSubmitForm from './submit-form/Form'
import {
  createChipsStagesSubmitFormField,
  createLinkStagesSubmitFormField,
  createTextStagesSubmitFormField,
} from '@/lib/hackathons/stage-submit-form-fields'
import {
  HackathonStage,
  StageComponent,
  SubmitFormField,
  SubmitFormFieldType,
} from '@/types/hackathon-stage'
import RemoveButton from './RemoveButton'
import { BASE_SUBMIT_FORM_FIELDS } from './submit-form/fields/base-fields'

export enum StageComponentType {
  Cards = 'cards',
  Tags = 'tags',
}

type HackathonsEditStagesProps = {
  formDataContent: IDataContent
  setFormDataContent: (data: IDataContent) => void
  setSelectedStageForm: (index: string) => void
  setActivePreviewTab: (tab: string) => void
  language: 'en' | 'es'
}

type StageFormProps = {
  stage: HackathonStage
  index: number
  language: 'en' | 'es'
  selectedPredefinedFields: string[]
  onStageFieldChange: (
    index: number,
    field: keyof Pick<HackathonStage, 'label' | 'date' | 'deadline'>,
    value: string
  ) => void
  onStageComponentTypeChange: (
    index: number,
    type: StageComponentType
  ) => void
  onStageComponentChange: (
    index: number,
    component: StageComponent | undefined
  ) => void
  onRemoveSubmitForm: (index: number) => void
  onAddSubmitFormField: (
    stageIndex: number,
    type: SubmitFormFieldType
  ) => void
  onUpdateSubmitFormField: (
    stageIndex: number,
    fieldIndex: number,
    updatedField: SubmitFormField
  ) => void
  onRemoveSubmitFormField: (
    stageIndex: number,
    fieldIndex: number
  ) => void
  onReplaceSubmitFormFields: (
    stageIndex: number,
    fields: SubmitFormField[]
  ) => void
  onRemove: (index: number) => void
  setSelectedStageForm: (index: string) => void
  setActivePreviewTab: (tab: string) => void
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

const createDefaultSubmitFormField = (
  type: SubmitFormFieldType
): SubmitFormField => {
  switch (type) {
    case SubmitFormFieldType.Text:
      return createTextStagesSubmitFormField()

    case SubmitFormFieldType.Link:
      return createLinkStagesSubmitFormField()

    case SubmitFormFieldType.Chips:
      return createChipsStagesSubmitFormField()
    case SubmitFormFieldType.Predefined:
      return createTextStagesSubmitFormField()
  }
}

export default function HackathonsEditStages({
  formDataContent,
  setFormDataContent,
  setSelectedStageForm,
  setActivePreviewTab,
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
  const [selectedPredefinedFields, setSelectedPredefinedFields] = useState<string[]>([])

  useEffect(() => {
    setSelectedPredefinedFields(
      stages.flatMap((stage) =>
        stage.submitForm?.fields
          .filter((field) => field.predefinedField)
          .map((field) => field.id) ?? []
      )
    )
  }, [stages])

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
  }

  const addStage = (): void => {
    const newStage: HackathonStage = {
      label: '',
      date: '',
      deadline: '',
      component: undefined,
      submitForm: undefined,
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

  const removeStageSubmitForm = (index: number): void => {
    const updatedStages: HackathonStage[] = stages.map(
      (stage: HackathonStage, currentIndex: number) => {
        if (currentIndex !== index) {
          return stage
        }

        return {
          ...stage,
          submitForm: undefined,
        }
      }
    )

    syncStagesToParent(updatedStages)
  }

  const addSubmitFormField = (
    stageIndex: number,
    type: SubmitFormFieldType
  ): void => {
    const updatedStages: HackathonStage[] = stages.map(
      (stage: HackathonStage, currentIndex: number) => {
        if (currentIndex !== stageIndex) {
          return stage
        }

        return {
          ...stage,
          submitForm: {
            fields: [
              ...(stage.submitForm?.fields ?? []),
              createDefaultSubmitFormField(type),
            ],
          },
        }
      }
    )

    syncStagesToParent(updatedStages)
  }

  const updateSubmitFormField = (
    stageIndex: number,
    fieldIndex: number,
    updatedField: SubmitFormField
  ): void => {
    const updatedStages: HackathonStage[] = stages.map(
      (stage: HackathonStage, currentIndex: number) => {
        if (currentIndex !== stageIndex) {
          return stage
        }

        const currentFields: SubmitFormField[] = stage.submitForm?.fields ?? []

        return {
          ...stage,
          submitForm: {
            fields: currentFields.map(
              (field: SubmitFormField, currentFieldIndex: number) => {
                if (currentFieldIndex !== fieldIndex) {
                  return field
                }

                return updatedField
              }
            ),
          },
        }
      }
    )

    syncStagesToParent(updatedStages)
  }

  const removeSubmitFormField = (
    stageIndex: number,
    fieldIndex: number
  ): void => {
    const updatedStages: HackathonStage[] = stages.map(
      (stage: HackathonStage, currentIndex: number) => {
        if (currentIndex !== stageIndex) {
          return stage
        }

        return {
          ...stage,
          submitForm: {
            fields: (stage.submitForm?.fields ?? []).filter(
              (_field: SubmitFormField, currentFieldIndex: number) =>
                currentFieldIndex !== fieldIndex
            ),
          },
        }
      }
    )

    syncStagesToParent(updatedStages)
  }

  const replaceSubmitFormFields = (
    stageIndex: number,
    fields: SubmitFormField[]
  ): void => {
    const updatedStages: HackathonStage[] = stages.map(
      (stage: HackathonStage, currentIndex: number) => {
        if (currentIndex !== stageIndex) {
          return stage
        }

        return {
          ...stage,
          submitForm: {
            fields,
          },
        }
      }
    )

    syncStagesToParent(updatedStages)
  }
  useEffect(() => {
    if (stages.length === 0) {
      setFormDataContent({
        ...formDataContent,
        stages: [
          {
            label: 'First stage',
            date: '',
            deadline: '',
            component: undefined,
            submitForm: {
              fields: [BASE_SUBMIT_FORM_FIELDS.projectName.field],
            },
          }
        ],
      } as IDataContent)
    }
    if (stages.length > 0 && !stages[0].submitForm?.fields.find((field) => field.id === 'projectName')) {
      setFormDataContent({
        ...formDataContent,
        stages: [{ ...stages[0], submitForm: { ...stages[0].submitForm, fields: [BASE_SUBMIT_FORM_FIELDS.projectName.field, ...(stages[0].submitForm?.fields ?? [])] } }, ...stages.slice(1)]
      })
    }
  }, [stages])

  return (
    <div className="space-y-4">
      <Button
        type="button"
        className="bg-green-600 text-white hover:bg-green-700"
        onClick={addStage}
      >
        {t[language].addStage}
      </Button>

      {stages.map((stage: HackathonStage, index: number) => (
        <Accordion
          key={`stage-${index}`}
          type="single"
          collapsible
          className="w-full rounded-md border px-4 py-0.5"
        >
          <AccordionItem value={`item-${index}`}>
            <AccordionPrimitive.Header className="flex">
              <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between gap-2 py-1 text-sm font-medium outline-none [&[data-state=open]_svg.chevron]:rotate-180">
                <span>{stage.label?.trim() ? stage.label : `Stage ${index + 1}`}</span>
                <div className="flex items-center gap-2">
                  <ChevronDownIcon className="chevron text-muted-foreground size-4 shrink-0 transition-transform duration-200" />
                  <RemoveButton
                    onRemove={() => removeStage(index)}
                    tooltipLabel="Delete stage"
                    size={18}
                  />
                </div>
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>

            <AccordionContent>
              <StageForm
                stage={stage}
                index={index}
                language={language}
                onStageFieldChange={updateStageField}
                onStageComponentTypeChange={updateStageComponentType}
                onStageComponentChange={updateStageComponent}
                onRemoveSubmitForm={removeStageSubmitForm}
                onAddSubmitFormField={addSubmitFormField}
                onUpdateSubmitFormField={updateSubmitFormField}
                onRemoveSubmitFormField={removeSubmitFormField}
                onReplaceSubmitFormFields={replaceSubmitFormFields}
                onRemove={removeStage}
                setSelectedStageForm={setSelectedStageForm}
                setActivePreviewTab={setActivePreviewTab}
                selectedPredefinedFields={selectedPredefinedFields}
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
  language,
  onStageFieldChange,
  onStageComponentTypeChange,
  onStageComponentChange,
  onRemoveSubmitForm,
  onAddSubmitFormField,
  onUpdateSubmitFormField,
  onRemoveSubmitFormField,
  onReplaceSubmitFormFields,
  setSelectedStageForm,
  setActivePreviewTab,
  selectedPredefinedFields,
}: StageFormProps): React.JSX.Element {
  const validateDates = (): { error: string | null } => {
    if (stage.date && stage.deadline) {
      const startDate = new Date(stage.date)
      const endDate = new Date(stage.deadline)
      if (endDate < startDate) {
        return { error: t[language].stageEndDateBeforeStartDate }
      }
    }
    return { error: null }
  }

  const dateValidation = validateDates()

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
        <Label htmlFor={`stage-date-${index}`}>{t[language].stageStartDateLabel}</Label>
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
        <Label htmlFor={`stage-deadline-${index}`}>{t[language].stageEndDateLabel}</Label>
        <Input
          id={`stage-deadline-${index}`}
          type="date"
          value={stage.deadline}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onStageFieldChange(index, 'deadline', event.target.value)
          }
        />
        {dateValidation.error && (
          <p className="text-sm text-red-500">{dateValidation.error}</p>
        )}
      </div>

      <Divider />
      <div>
        <h1 className="text-lg font-bold">{t[language].stageContentSection}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{t[language].stageContentSectionHelp}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`stage-type-${index}`}>{t[language].stageDisplayFormat}</Label>
        <select
          id={`stage-type-${index}`}
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={stage.component?.type ?? ''}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
            onStageComponentTypeChange(
              index,
              event.target.value as StageComponentType
            )
          }
        >
          <option value="">Select type</option>
          <option value={StageComponentType.Cards}>{t[language].stageCardsLabel}</option>
          <option value={StageComponentType.Tags}>{t[language].stageTagsLabel}</option>
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {stage.component?.type === StageComponentType.Cards
            ? t[language].stageCardsDescription
            : stage.component?.type === StageComponentType.Tags
              ? t[language].stageTagsDescription
              : ''}
        </p>
      </div>

      {stage.component?.type === StageComponentType.Cards && (
        <StageCardsForm
          index={index}
          component={stage.component}
          onChange={onStageComponentChange}
        />
      )}

      {stage.component?.type === StageComponentType.Tags && (
        <StageTagsForm
          index={index}
          component={stage.component}
          onChange={onStageComponentChange}
        />
      )}

      <Divider />

      <StageSubmitForm
        stageIndex={index}
        submitForm={stage.submitForm}
        onAddField={onAddSubmitFormField}
        onUpdateField={onUpdateSubmitFormField}
        onRemoveField={onRemoveSubmitFormField}
        onReplaceSubmitFormFields={onReplaceSubmitFormFields}
        onRemoveSubmitForm={onRemoveSubmitForm}
        setSelectedStageForm={setSelectedStageForm}
        setActivePreviewTab={setActivePreviewTab}
        selectedPredefinedFields={selectedPredefinedFields}
      />
    </div>
  )
}