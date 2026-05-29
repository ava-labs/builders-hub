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

      <div className="space-y-2">
        <Label htmlFor={`image-max-size-${field.id}`}>Max size per image (MB)</Label>
        <Input
          id={`image-max-size-${field.id}`}
          type="number"
          value={field.maxSizeMb ?? ''}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onChange({
              ...field,
              maxSizeMb:
                event.target.value === '' ? undefined : Number(event.target.value),
            })
          }
          placeholder="E.g. 2"
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
