'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type ImageStagesSubmitFormField } from '@/types/hackathon-stage'

type ImageStagesSubmitFormFieldProps = {
  field: ImageStagesSubmitFormField
  onChange: (updatedField: ImageStagesSubmitFormField) => void
}

export default function ImageStagesSubmitFormField({
  field,
  onChange,
}: ImageStagesSubmitFormFieldProps): React.JSX.Element {
  return (
    <div className="space-y-4 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Image upload field</h3>

      <div className="space-y-2">
        <Label htmlFor={`image-label-${field.id}`}>Label</Label>
        <Input
          id={`image-label-${field.id}`}
          value={field.label}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ ...field, label: event.target.value })
          }
          placeholder="Field label"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`image-description-${field.id}`}>Description</Label>
        <Input
          id={`image-description-${field.id}`}
          value={field.description}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ ...field, description: event.target.value })
          }
          placeholder="Field description"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`image-max-images-${field.id}`}>Max images</Label>
        <Input
          id={`image-max-images-${field.id}`}
          type="number"
          value={field.maxImages ?? ''}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({
              ...field,
              maxImages:
                event.target.value === '' ? undefined : Number(event.target.value),
            })
          }
          placeholder="E.g. 5"
        />
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Each image must be 2&nbsp;MB or smaller (platform limit).
      </p>

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
