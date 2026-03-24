'use client'

import React from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import TextStagesSubmitFormField from './fields/Text'
import LinkStagesSubmitFormField from './fields/Link'
import ChipsStagesSubmitFormField from './fields/Chips'
import {
  ChipsStagesSubmitFormField as ChipsStagesSubmitFormFieldType,
  LinkStagesSubmitFormField as LinkStagesSubmitFormFieldType,
  type StageSubmitForm,
  SubmitFormField,
  SubmitFormFieldType,
  TextStagesSubmitFormField as TextStagesSubmitFormFieldType,
} from '@/types/hackathon-stage'

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
  onRemoveSubmitForm: (stageIndex: number) => void
}

function createTextStagesSubmitFormField(
  id: string
): TextStagesSubmitFormFieldType {
  return {
    id,
    type: SubmitFormFieldType.Text,
    label: '',
    placeholder: '',
    required: false,
  }
}

function createLinkStagesSubmitFormField(
  id: string
): LinkStagesSubmitFormFieldType {
  return {
    id,
    type: SubmitFormFieldType.Link,
    label: '',
    placeholder: '',
    required: false,
  }
}

function createChipsStagesSubmitFormField(
  id: string
): ChipsStagesSubmitFormFieldType {
  return {
    id,
    type: SubmitFormFieldType.Chips,
    label: '',
    placeholder: '',
    required: false,
  }
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
  }
}

export default function StageSubmitForm({
  stageIndex,
  submitForm,
  onAddField,
  onUpdateField,
  onRemoveField,
  onRemoveSubmitForm,
}: StageSubmitFormProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Submit form</h2>

        {!!submitForm?.fields.length && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => onRemoveSubmitForm(stageIndex)}
          >
            Remove submit form
          </Button>
        )}
      </div>

      <Button
        type="button"
        onClick={() => onAddField(stageIndex, SubmitFormFieldType.Text)}
      >
        Add field
      </Button>

      {submitForm?.fields.map(
        (field: SubmitFormField, fieldIndex: number): React.JSX.Element => (
          <Accordion
            key={field.id}
            type="single"
            collapsible
            className="w-full rounded-md border px-4"
          >
            <AccordionItem value={`submit-field-${field.id}`}>
              <AccordionTrigger>
                {field.label?.trim() ? field.label : `Field ${fieldIndex + 1}`}
              </AccordionTrigger>

              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor={`submit-field-type-${field.id}`}>Type</Label>
                    <select
                      id={`submit-field-type-${field.id}`}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={field.type}
                      onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                        onUpdateField(
                          stageIndex,
                          fieldIndex,
                          replaceSubmitFormFieldType(
                            field,
                            event.target.value as SubmitFormFieldType
                          )
                        )
                      }
                    >
                      <option value={SubmitFormFieldType.Text}>Text</option>
                      <option value={SubmitFormFieldType.Link}>Link</option>
                      <option value={SubmitFormFieldType.Chips}>Chips</option>
                    </select>
                  </div>

                  {field.type === SubmitFormFieldType.Text && (
                    <TextStagesSubmitFormField
                      field={field as TextStagesSubmitFormFieldType}
                      onChange={(
                        updatedField: TextStagesSubmitFormFieldType
                      ) => onUpdateField(stageIndex, fieldIndex, updatedField)}
                    />
                  )}

                  {field.type === SubmitFormFieldType.Link && (
                    <LinkStagesSubmitFormField
                      field={field as LinkStagesSubmitFormFieldType}
                      onChange={(
                        updatedField: LinkStagesSubmitFormFieldType
                      ) => onUpdateField(stageIndex, fieldIndex, updatedField)}
                    />
                  )}

                  {field.type === SubmitFormFieldType.Chips && (
                    <ChipsStagesSubmitFormField
                      field={field as ChipsStagesSubmitFormFieldType}
                      onChange={(
                        updatedField: ChipsStagesSubmitFormFieldType
                      ) => onUpdateField(stageIndex, fieldIndex, updatedField)}
                    />
                  )}

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => onRemoveField(stageIndex, fieldIndex)}
                    >
                      Remove field
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )
      )}
    </div>
  )
}