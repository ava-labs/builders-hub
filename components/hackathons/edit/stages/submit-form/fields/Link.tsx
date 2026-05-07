
'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type LinkStagesSubmitFormField } from '@/types/hackathon-stage'

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
      <h3 className="text-sm font-semibold">Link field</h3>

      <div className="space-y-2">
        <Label htmlFor={`link-label-${field.id}`}>Label</Label>
        <Input
          id={`link-label-${field.id}`}
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
        <Label htmlFor={`link-description-${field.id}`}>Description</Label>
        <Input
          id={`link-description-${field.id}`}
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
        <Label htmlFor={`link-placeholder-${field.id}`}>Placeholder</Label>
        <Input
          id={`link-placeholder-${field.id}`}
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

      <div className="space-y-2">
        <Label htmlFor={`link-max-links-${field.id}`}>Max links</Label>
        <Input
          id={`link-max-links-${field.id}`}
          type="number"
          min={1}
          value={field.maxLinks ?? ''}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            const value: string = event.target.value
            const parsedValue: number = Number(value)

            onChange({
              ...field,
              maxLinks:
                value === '' || !Number.isFinite(parsedValue)
                  ? undefined
                  : Math.max(1, Math.floor(parsedValue)),
            })
          }}
          placeholder="E.g. 3"
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
