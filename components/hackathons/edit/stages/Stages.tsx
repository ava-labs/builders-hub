'use client'

import React, { useEffect, useState } from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDownIcon, TriangleAlert as TriangleAlertIcon, CircleX } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Divider } from '@/components/ui/divider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { t } from '@/app/events/edit/translations'
import { IDataContent } from '@/app/events/edit/initials'
import StageCardsForm from './Card'
import StageTagsForm from './Tags'
import StageSubmitForm from './submit-form/Form'
import {
  createChipsStagesSubmitFormField,
  createLinkStagesSubmitFormField,
  createMultiSelectStagesSubmitFormField,
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
  startDate: string
  endDate: string
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
  eventStartDate: string
  eventEndDate: string
  selectedPredefinedFields: string[]
  overlappingStageLabels: string[]
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
  onFormLockedChange: (index: number, locked: boolean) => void
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
    case SubmitFormFieldType.MultiSelect:
      return createMultiSelectStagesSubmitFormField()
    case SubmitFormFieldType.Predefined:
      return createTextStagesSubmitFormField()
  }
}

const toStageDateInputValue = (value: string): string => {
  if (!value) {
    return ''
  }

  const dateOnlyMatch = value.match(/^(\d{4}-\d{2}-\d{2})/)
  if (dateOnlyMatch) {
    return dateOnlyMatch[1]
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const pad = (part: number): string => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const getStageLabel = (stage: HackathonStage, index: number): string =>
  stage.label?.trim() ? stage.label : `Stage ${index + 1}`

const parseStageDate = (value: string): number | null => {
  if (!value) {
    return null
  }

  const timestamp = new Date(`${value}T00:00:00`).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

const doStageDatesOverlap = (
  stage: HackathonStage,
  otherStage: HackathonStage
): boolean => {
  const stageStart = parseStageDate(stage.date)
  const stageEnd = parseStageDate(stage.deadline)
  const otherStart = parseStageDate(otherStage.date)
  const otherEnd = parseStageDate(otherStage.deadline)

  if (
    stageStart === null ||
    stageEnd === null ||
    otherStart === null ||
    otherEnd === null ||
    stageEnd <= stageStart ||
    otherEnd <= otherStart
  ) {
    return false
  }

  return stageStart < otherEnd && otherStart < stageEnd
}

const getOverlappingStageLabels = (
  stages: HackathonStage[],
  stageIndex: number
): string[] =>
  stages.flatMap((otherStage: HackathonStage, otherIndex: number): string[] => {
    if (
      otherIndex === stageIndex ||
      !doStageDatesOverlap(stages[stageIndex], otherStage)
    ) {
      return []
    }

    return [getStageLabel(otherStage, otherIndex)]
  })

export default function HackathonsEditStages({
  startDate,
  endDate,
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

  const eventStartDate = toStageDateInputValue(startDate)
  const eventEndDate = toStageDateInputValue(endDate)

  const syncStagesToParent = (updatedStages: HackathonStage[]): void => {
    setStages(updatedStages)

    setFormDataContent({
      ...formDataContent,
      stages: updatedStages,
    } as IDataContent)
  }

  const addStage = (): void => {
    const latestStage: HackathonStage | undefined = stages[stages.length - 1]
    const newStage: HackathonStage = {
      label: '',
      date: latestStage?.deadline || eventStartDate,
      deadline: eventEndDate,
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

  const updateFormLocked = (index: number, locked: boolean): void => {
    const updatedStages: HackathonStage[] = stages.map(
      (stage: HackathonStage, currentIndex: number) => {
        if (currentIndex !== index) {
          return stage
        }

        return {
          ...stage,
          formLocked: locked,
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
      return
    }

    if (stages.length > 0 && !stages[0].submitForm?.fields.find((field) => field.id === 'project_name' || field.id === 'projectName')) {
      setFormDataContent({
        ...formDataContent,
        stages: [{ ...stages[0], submitForm: { ...stages[0].submitForm, fields: [BASE_SUBMIT_FORM_FIELDS.project_name.field, ...(stages[0].submitForm?.fields ?? [])] } }, ...stages.slice(1)]
      })
      return
    }

    const shouldFillFirstStageDates =
      stages.length === 1 &&
      ((eventStartDate && !stages[0].date) ||
        (eventEndDate && !stages[0].deadline))

    if (shouldFillFirstStageDates) {
      setFormDataContent({
        ...formDataContent,
        stages: [
          {
            ...stages[0],
            date: stages[0].date || eventStartDate,
            deadline: stages[0].deadline || eventEndDate,
          },
        ],
      } as IDataContent)
    }
  }, [eventEndDate, eventStartDate, formDataContent, setFormDataContent, stages])

  return (
    <div className="space-y-4">
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
                    language={language}
                  />
                </div>
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>

            <AccordionContent>
              <StageForm
                stage={stage}
                index={index}
                language={language}
                eventStartDate={eventStartDate}
                eventEndDate={eventEndDate}
                overlappingStageLabels={getOverlappingStageLabels(
                  stages,
                  index
                )}
                onStageFieldChange={updateStageField}
                onStageComponentTypeChange={updateStageComponentType}
                onStageComponentChange={updateStageComponent}
                onRemoveSubmitForm={removeStageSubmitForm}
                onAddSubmitFormField={addSubmitFormField}
                onUpdateSubmitFormField={updateSubmitFormField}
                onRemoveSubmitFormField={removeSubmitFormField}
                onReplaceSubmitFormFields={replaceSubmitFormFields}
                onFormLockedChange={updateFormLocked}
                onRemove={removeStage}
                setSelectedStageForm={setSelectedStageForm}
                setActivePreviewTab={setActivePreviewTab}
                selectedPredefinedFields={selectedPredefinedFields}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ))}
      <Button
        type="button"
        className="bg-green-600 text-white hover:bg-green-700"
        onClick={addStage}
      >
        {t[language].addStage}
      </Button>
    </div>
  )
}

function StageForm({
  stage,
  index,
  language,
  eventStartDate,
  eventEndDate,
  overlappingStageLabels,
  onStageFieldChange,
  onStageComponentTypeChange,
  onStageComponentChange,
  onRemoveSubmitForm,
  onAddSubmitFormField,
  onUpdateSubmitFormField,
  onRemoveSubmitFormField,
  onReplaceSubmitFormFields,
  onFormLockedChange,
  setSelectedStageForm,
  setActivePreviewTab,
  selectedPredefinedFields,
}: StageFormProps): React.JSX.Element {
  const validateDates = (): { error: string | null; warning: string | null } => {
    if (stage.date && stage.deadline) {
      const stageStart = new Date(stage.date)
      const stageEnd = new Date(stage.deadline)
      const eventStart = new Date(eventStartDate)
      const eventEnd = new Date(eventEndDate)

      // Validar que la fecha de fin sea mayor que la de inicio del stage (error)
      if (stageEnd < stageStart) {
        return { error: t[language].stageEndDateBeforeStartDate, warning: null }
      }

      // Validar que la fecha de inicio del stage no sea antes de la del hackathon (error)
      if (eventStartDate && stageStart < eventStart) {
        const warnMsg = language === 'es'
          ? 'La fecha de inicio del stage no debería ser antes de la fecha de inicio del hackathon'
          : 'Stage start date should not be before the hackathon start date'
        return { error: null, warning: warnMsg }
      }

      // Validar que la fecha de fin del stage no sea después de la del hackathon (warning — permitimos extender)
      if (eventEndDate && stageEnd > eventEnd) {
        const warnMsg = t[language].stageEndDateAfterHackathonWarning ?? (language === 'es'
          ? 'La fecha de fin del stage no debería ser después de la fecha de fin del Hackathon'
          : 'Stage end date should not be after the hackathon end date')
        return { error: null, warning: warnMsg }
      }
    }
    return { error: null, warning: null }
  }

  const dateValidation = validateDates()

  return (
    <Tabs defaultValue="stage" className="pt-2">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="stage">Stage Info</TabsTrigger>
        <TabsTrigger value="submit">Submit Form</TabsTrigger>
      </TabsList>

      <TabsContent value="stage" className="mt-4 space-y-4">
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
            <div className="mt-1 flex items-center gap-2 text-red-500">
              <CircleX className="w-4 h-4 inline-block" />
              <p className="text-sm text-red-500">{dateValidation.error}</p>
            </div>
          )}
          {dateValidation.warning && (
            <div className="mt-1 flex items-center gap-2 text-yellow-500">
              <TriangleAlertIcon className="w-4 h-4 shrink-0 text-yellow-500" />
              <p className="text-sm text-yellow-500">{dateValidation.warning}</p>
            </div>
          )}
        </div>

        {overlappingStageLabels.length > 0 && (
          <div className="text-yellow-800">
            This stage occurs at the same time than{' '}
            {overlappingStageLabels
              .map((label: string) => `"${label}"`)
              .join(', ')}{' '}
            stage
          </div>
        )}

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
            language={language}
          />
        )}

        {stage.component?.type === StageComponentType.Tags && (
          <StageTagsForm
            index={index}
            component={stage.component}
            onChange={onStageComponentChange}
            language={language}
          />
        )}
      </TabsContent>

      <TabsContent value="submit" className="mt-4 space-y-4">
        <div className="flex items-center justify-between rounded-md border p-4 bg-slate-50 dark:bg-slate-900">
          <div className="space-y-0.5">
            <Label htmlFor={`form-locked-${index}`} className="font-medium cursor-pointer">
              Block Form Editing
            </Label>
            <p className="text-xs text-muted-foreground">
              Prevent changes to this stage's form configuration
            </p>
          </div>
          <Switch
            id={`form-locked-${index}`}
            checked={stage.formLocked ?? false}
            onCheckedChange={(checked) => onFormLockedChange(index, checked)}
          />
        </div>
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
          language={language}
        />
      </TabsContent>
    </Tabs>
  )
}
