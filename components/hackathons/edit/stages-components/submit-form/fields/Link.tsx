
'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type LinkStagesSubmitFormField, type TextStagesSubmitFormField } from '@/types/hackathon-stage'

type LinkStagesSubmitFormFieldProps = {
  field: LinkStagesSubmitFormField 
  onChange: (updatedField: LinkStagesSubmitFormField) => void
}

export default function LinkStagesSubmitFormField({
  field,
  onChange,
}: LinkStagesSubmitFormFieldProps): React.JSX.Element {
  return (
    <div className="space-y-4 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Text field</h3>

      <div className="space-y-2">
        <Label htmlFor={`text-label-${field.id}`}>Label</Label>
        <Input
          id={`text-label-${field.id}`}
          value={field.label}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({
              ...field,
              label: event.target.value,
            })
          }
          placeholder="Field label"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`text-label-${field.id}`}>Description</Label>
        <Input
          id={`text-label-${field.id}`}
          value={field.description}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({
              ...field,
              description: event.target.value,
            })
          }
          placeholder="Field description"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`text-placeholder-${field.id}`}>Placeholder</Label>
        <Input
          id={`text-placeholder-${field.id}`}
          value={field.placeholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({
              ...field,
              placeholder: event.target.value,
            })
          }
          placeholder="Field placeholder"
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({
              ...field,
              required: event.target.checked,
            })
          }
        />
        Required
      </label>
    </div>
  )
}