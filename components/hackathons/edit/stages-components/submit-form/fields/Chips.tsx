'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type ChipsStagesSubmitFormField } from '@/types/hackathon-stage'
import { X } from 'lucide-react'

type ChipsStagesSubmitFormFieldProps = {
  field: ChipsStagesSubmitFormField
  onChange: (updatedField: ChipsStagesSubmitFormField) => void
}

export default function ChipsStagesSubmitFormField({
  field,
  onChange,
}: ChipsStagesSubmitFormFieldProps): React.JSX.Element {
  const [newChip, setNewChip] = React.useState<string>('')

  const handleAddChip = (): void => {
    const trimmedChip: string = newChip.trim()

    if (!trimmedChip) {
      return
    }

    onChange({
      ...field,
      chips: [...field.chips, trimmedChip],
    })

    setNewChip('')
  }

  const handleRemoveChip = (chipToRemove: string): void => {
    onChange({
      ...field,
      chips: field.chips.filter((chip: string) => chip !== chipToRemove),
    })
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Chips field</h3>

      <div className="space-y-2">
        <Label htmlFor={`chips-label-${field.id}`}>Label</Label>
        <Input
          id={`chips-label-${field.id}`}
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
        <Label htmlFor={`chips-placeholder-${field.id}`}>Placeholder</Label>
        <Input
          id={`chips-placeholder-${field.id}`}
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
        <Label htmlFor={`chips-new-chip-${field.id}`}>Add chip</Label>

        <div className="flex gap-2">
          <Input
            id={`chips-new-chip-${field.id}`}
            value={newChip}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setNewChip(event.target.value)
            }
            placeholder="E.g. Infrastructure"
          />

          <Button type="button" onClick={handleAddChip}>
            Add chip
          </Button>
        </div>
      </div>

      {!!field.chips?.length && (
        <div className="flex flex-wrap gap-2">
          {field.chips.map((chip: string, index: number): React.JSX.Element => (
            <div
              key={`${chip}-${index}`}
              className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <span>{chip}</span>

              <button
                type="button"
                className="cursor-pointer text-muted-foreground hover:text-destructive"
                onClick={() => handleRemoveChip(chip)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

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