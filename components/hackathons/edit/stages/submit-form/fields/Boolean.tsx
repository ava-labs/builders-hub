'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type BooleanStagesSubmitFormField } from '@/types/hackathon-stage'

type BooleanStagesSubmitFormFieldProps = {
  field: BooleanStagesSubmitFormField
  onChange: (updatedField: BooleanStagesSubmitFormField) => void
}

export default function BooleanStagesSubmitFormField({
  field,
  onChange,
}: BooleanStagesSubmitFormFieldProps): React.JSX.Element {
  return (
    <div className="space-y-4 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Yes / No field</h3>

      <div className="space-y-2">
        <Label htmlFor={`boolean-label-${field.id}`}>Label</Label>
        <Input
          id={`boolean-label-${field.id}`}
          value={field.label}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ ...field, label: event.target.value })
          }
          placeholder="Field label"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`boolean-description-${field.id}`}>Description</Label>
        <Input
          id={`boolean-description-${field.id}`}
          value={field.description}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ ...field, description: event.target.value })
          }
          placeholder="Field description"
        />
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
