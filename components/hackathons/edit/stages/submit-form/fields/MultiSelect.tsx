'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type MultiSelectStagesSubmitFormField } from '@/types/hackathon-stage'

type MultiSelectStagesSubmitFormFieldProps = {
  field: MultiSelectStagesSubmitFormField
  onChange: (updatedField: MultiSelectStagesSubmitFormField) => void
}

export default function MultiSelectStagesSubmitFormField({
  field,
  onChange,
}: MultiSelectStagesSubmitFormFieldProps): React.JSX.Element {
  function updateOption(optionIndex: number, value: string): void {
    const nextOptions: string[] = field.options.map(
      (option: string, index: number): string =>
        index === optionIndex ? value : option
    )

    onChange({
      ...field,
      options: nextOptions,
    })
  }

  function removeOption(optionIndex: number): void {
    const nextOptions: string[] = field.options.filter(
      (_: string, index: number): boolean => index !== optionIndex
    )

    onChange({
      ...field,
      options: nextOptions,
    })
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Multiselect field</h3>

      <div className="space-y-2">
        <Label htmlFor={`multiselect-label-${field.id}`}>Label</Label>
        <Input
          id={`multiselect-label-${field.id}`}
          value={field.label}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ ...field, label: event.target.value })
          }
          placeholder="Field label"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`multiselect-description-${field.id}`}>
          Description
        </Label>
        <Input
          id={`multiselect-description-${field.id}`}
          value={field.description ?? ''}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ ...field, description: event.target.value })
          }
          placeholder="Field description"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`multiselect-placeholder-${field.id}`}>
          Placeholder
        </Label>
        <Input
          id={`multiselect-placeholder-${field.id}`}
          value={field.placeholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ ...field, placeholder: event.target.value })
          }
          placeholder="Field placeholder"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`multiselect-max-selections-${field.id}`}>
          Max selections
        </Label>
        <Input
          id={`multiselect-max-selections-${field.id}`}
          type="number"
          value={field.maxSelections ?? ''}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({
              ...field,
              maxSelections:
                event.target.value === '' ? null : Number(event.target.value),
            })
          }
          placeholder="E.g. 3"
        />
      </div>

      <div className="space-y-2">
        <Label>Options</Label>

        <div className="space-y-2">
          {field.options.map(
            (option: string, optionIndex: number): React.JSX.Element => (
              <div key={optionIndex} className="flex gap-2">
                <Input
                  value={option}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    updateOption(optionIndex, event.target.value)
                  }
                  placeholder={`Option ${optionIndex + 1}`}
                />

                <button
                  type="button"
                  className="rounded-md border px-3 text-sm"
                  onClick={() => removeOption(optionIndex)}
                >
                  Remove
                </button>
              </div>
            )
          )}
        </div>

        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() =>
            onChange({
              ...field,
              options: [...field.options, ''],
            })
          }
        >
          Add option
        </button>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ ...field, required: event.target.checked })
          }
        />
        Required
      </label>
    </div>
  )
}