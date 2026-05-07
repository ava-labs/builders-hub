'use client'

import React from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from '@/components/ui/accordion'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import ImportGoogleFormsDialog from './ImportGoogleFormsDialog'
import TextStagesSubmitFormField from './fields/Text'
import LinkStagesSubmitFormField from './fields/Link'
import ChipsStagesSubmitFormField from './fields/Chips'
import {
  createChipsStagesSubmitFormField,
  createLinkStagesSubmitFormField,
  createMultiSelectStagesSubmitFormField,
  createTextStagesSubmitFormField,
} from '@/lib/hackathons/stage-submit-form-fields'
import {
  ChipsStagesSubmitFormField as ChipsStagesSubmitFormFieldType,
  LinkStagesSubmitFormField as LinkStagesSubmitFormFieldType,
  type StageSubmitForm,
  SubmitFormField,
  SubmitFormFieldType,
  TextStagesSubmitFormField as TextStagesSubmitFormFieldType,
  MultiSelectStagesSubmitFormField as MultiSelectStagesSubmitFormFieldType
} from '@/types/hackathon-stage'
import { BASE_SUBMIT_FORM_FIELDS, BaseSubmitFormFieldKey } from './fields/base-fields'
import { ChevronDownIcon } from 'lucide-react'
import RemoveButton from '../RemoveButton'
import MultiSelectStagesSubmitFormField from './fields/MultiSelect'

type StageSubmitFormProps = {
  stageIndex: number
  submitForm?: StageSubmitForm
  onAddField: (stageIndex: number, type: SubmitFormFieldType) => void
  onUpdateField: (
    stageIndex: number,
    fieldIndex: number,
    updatedField: SubmitFormField
  ) => void
  onRemoveField: (stageIndex: number, fieldIndex: number) => void
  onReplaceSubmitFormFields: (
    stageIndex: number,
    fields: SubmitFormField[]
  ) => void
  onRemoveSubmitForm: (stageIndex: number) => void
  setSelectedStageForm: (index: string) => void
  setActivePreviewTab: (tab: string) => void
  selectedPredefinedFields: string[]
}

function replaceSubmitFormFieldType(
  currentField: SubmitFormField,
  nextType: SubmitFormFieldType
): SubmitFormField {
  switch (nextType) {
    case SubmitFormFieldType.Text:
      return createTextStagesSubmitFormField(currentField.id)
    case SubmitFormFieldType.Link:
      return createLinkStagesSubmitFormField(currentField.id)
    case SubmitFormFieldType.Chips:
      return createChipsStagesSubmitFormField(currentField.id)
    case SubmitFormFieldType.MultiSelect:
      return createMultiSelectStagesSubmitFormField(currentField.id)
    case SubmitFormFieldType.Predefined:
      return { ...createTextStagesSubmitFormField(currentField.id), predefinedField: true }
  }
}

function replaceSubmitFormFieldWithBaseField(
  baseFieldKey: BaseSubmitFormFieldKey
): SubmitFormField {
  const baseField: SubmitFormField = BASE_SUBMIT_FORM_FIELDS[baseFieldKey].field

  return {
    ...baseField,
    predefinedField: true,
  }
}

export default function StageSubmitForm({
  stageIndex,
  submitForm,
  onAddField,
  onUpdateField,
  onRemoveField,
  onReplaceSubmitFormFields,
  onRemoveSubmitForm,
  setSelectedStageForm,
  setActivePreviewTab,
  selectedPredefinedFields
}: StageSubmitFormProps): React.JSX.Element {
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)

  console.log('Selected predefined fields:', selectedPredefinedFields)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Submit form</h2>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => {
              setActivePreviewTab('stages-submit-form')
              setSelectedStageForm(String(stageIndex))
            }}
          >
            Show preview
          </Button>

          {!!submitForm?.fields.length && (
            <Button
              type="button"
              className='text-white bg-red-600 border border-red-500 hover:bg-red-700'
              onClick={() => onRemoveSubmitForm(stageIndex)}
            >
              Remove all fields
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => onAddField(stageIndex, SubmitFormFieldType.Text)}
        >
          Add field
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setImportDialogOpen(true)}
        >
          Import from Google Forms
        </Button>
      </div>

      <ImportGoogleFormsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        existingFieldsCount={submitForm?.fields.length ?? 0}
        onImported={(fields: SubmitFormField[]) =>
          onReplaceSubmitFormFields(stageIndex, fields)
        }
      />

      {submitForm?.fields.map(
        (field: SubmitFormField, fieldIndex: number): React.JSX.Element => (
          <Accordion
            key={fieldIndex}
            type="single"
            collapsible
            className="w-full rounded-md border px-4"
          >
            <AccordionItem value={`submit-field-${fieldIndex}`}>
              <AccordionPrimitive.Header className="flex">
                <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between gap-2 py-1 text-sm font-medium outline-none [&[data-state=open]_svg.chevron]:rotate-180">
                  <span>{field.label?.trim() ? field.label : `Field ${fieldIndex + 1}`}</span>
                  <div className="flex items-center gap-2">
                    <ChevronDownIcon className="chevron text-muted-foreground size-4 shrink-0 transition-transform duration-200" />
                    <RemoveButton
                      onRemove={() => onRemoveField(stageIndex, fieldIndex)}
                      tooltipLabel="Delete field"
                      size={18}
                    />
                  </div>
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>

              <AccordionContent>
                <div className="space-y-4 pt-2">

                  {!field.predefinedField && (
                    <div className="space-y-2">
                      <Label htmlFor={`submit-base-field-${field.id}`}>Select field type</Label>
                      <select
                        id={`submit-base-field-${field.id}`}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={field.type}
                        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                          onUpdateField(
                            stageIndex,
                            fieldIndex,
                            replaceSubmitFormFieldType(
                              { ...field },
                              event.target.value as SubmitFormFieldType
                            )
                          )
                        }}
                      >
                        <option value="" disabled>
                          Select a type
                        </option>
                        <option value={SubmitFormFieldType.Predefined}>Predefined field</option>
                        <option value={SubmitFormFieldType.Text}>Text</option>
                        <option value={SubmitFormFieldType.Link}>Link</option>
                        <option value={SubmitFormFieldType.Chips}>Chips</option>
                        <option value={SubmitFormFieldType.MultiSelect}>Multi-select</option>
                      </select>
                    </div>
                  )}
                  {
                    field.predefinedField && (
                      <div className="space-y-2">
                        <Label htmlFor={`submit-field-type-${field.id}`}>Use predefined field</Label>
                        <select
                          id={`submit-base-field-${field.id}`}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={field.id ?? ''}
                          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                            const baseFieldKey: BaseSubmitFormFieldKey =
                              event.target.value as BaseSubmitFormFieldKey
                            onUpdateField(
                              stageIndex,
                              fieldIndex,
                              replaceSubmitFormFieldWithBaseField(baseFieldKey)
                            )
                          }}
                        >
                          <option value="" disabled>
                            Select a predefined field
                          </option>

                          {Object.entries(BASE_SUBMIT_FORM_FIELDS)
                            .filter(([key]) => key === field.id || !selectedPredefinedFields.includes(key))
                            .map(([key, config]) => (
                              <option key={key} value={key}>
                                {config.label}
                              </option>
                            ))}
                        </select>
                      </div>
                    )
                  }

                  {!field.predefinedField && field.type === SubmitFormFieldType.Text && (
                    <TextStagesSubmitFormField
                      field={field as TextStagesSubmitFormFieldType}
                      onChange={(updatedField: TextStagesSubmitFormFieldType) =>
                        onUpdateField(stageIndex, fieldIndex, updatedField)
                      }
                    />
                  )}

                  {!field.predefinedField && field.type === SubmitFormFieldType.Link && (
                    <LinkStagesSubmitFormField
                      field={field as LinkStagesSubmitFormFieldType}
                      onChange={(updatedField: LinkStagesSubmitFormFieldType) =>
                        onUpdateField(stageIndex, fieldIndex, updatedField)
                      }
                    />
                  )}

                  {!field.predefinedField && field.type === SubmitFormFieldType.Chips && (
                    <ChipsStagesSubmitFormField
                      field={field as ChipsStagesSubmitFormFieldType}
                      onChange={(updatedField: ChipsStagesSubmitFormFieldType) =>
                        onUpdateField(stageIndex, fieldIndex, updatedField)
                      }
                    />
                  )}
                  {
                    !field.predefinedField && field.type === SubmitFormFieldType.MultiSelect && (
                      <MultiSelectStagesSubmitFormField
                        field={field as MultiSelectStagesSubmitFormFieldType}
                        onChange={(updatedField: MultiSelectStagesSubmitFormFieldType) =>
                          onUpdateField(stageIndex, fieldIndex, updatedField)
                        }
                      />
                    )
                  }
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )
      )}
    </div>
  )
}
