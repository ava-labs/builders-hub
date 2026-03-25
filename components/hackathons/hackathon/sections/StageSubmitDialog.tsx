'use client'

import React from 'react'
import { useForm } from 'react-hook-form'
import { ArrowRight, Upload, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  ChipsStagesSubmitFormField,
  HackathonStage,
  LinkStagesSubmitFormField,
  SubmitFormField,
  SubmitFormFieldType,
  TextStagesSubmitFormField,
} from '@/types/hackathon-stage'

type StageSubmitValues = Record<string, string | string[]>

type StageSubmitDialogProps = {
  stageIndex: number
  selectedStage: HackathonStage
  onSubmit: (payload: {
    stageIndex: number
    stage: HackathonStage
    values: StageSubmitValues
  }) => Promise<void> | void
  triggerLabel?: string
}

function buildDefaultValues(stage: HackathonStage): StageSubmitValues {
  const fields: SubmitFormField[] = stage.submitForm?.fields ?? []

  return fields.reduce(
    (acc: StageSubmitValues, field: SubmitFormField): StageSubmitValues => {
      if (field.type === SubmitFormFieldType.Chips) {
        acc[field.id] = (field as ChipsStagesSubmitFormField).chips ?? []
        return acc
      }

      acc[field.id] = ''
      return acc
    },
    {}
  )
}

export default function StageSubmitDialog({
  stageIndex,
  selectedStage,
  onSubmit,
  triggerLabel = 'Submit',
}: StageSubmitDialogProps): React.JSX.Element | null {
  const [open, setOpen] = React.useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false)
  const [chipDrafts, setChipDrafts] = React.useState<Record<string, string>>({})

  const form = useForm<StageSubmitValues>({
    defaultValues: buildDefaultValues(selectedStage),
  })

  React.useEffect((): void => {
    form.reset(buildDefaultValues(selectedStage))
    setChipDrafts({})
  }, [selectedStage, form])

  if (!selectedStage.submitForm?.fields.length) {
    return null
  }

  const handleAddChip = (field: ChipsStagesSubmitFormField): void => {
    const currentDraft: string = (chipDrafts[field.id] ?? '').trim()

    if (!currentDraft) {
      return
    }

    const currentValue: StageSubmitValues = form.getValues()
    const currentChips: string[] = Array.isArray(currentValue[field.id])
      ? (currentValue[field.id] as string[])
      : []

    form.setValue(field.id, [...currentChips, currentDraft], {
      shouldDirty: true,
      shouldValidate: true,
    })

    setChipDrafts((prev: Record<string, string>): Record<string, string> => {
      return {
        ...prev,
        [field.id]: '',
      }
    })
  }

  const handleRemoveChip = (
    field: ChipsStagesSubmitFormField,
    chipToRemove: string
  ): void => {
    const currentValue: StageSubmitValues = form.getValues()
    const currentChips: string[] = Array.isArray(currentValue[field.id])
      ? (currentValue[field.id] as string[])
      : []

    form.setValue(
      field.id,
      currentChips.filter((chip: string): boolean => chip !== chipToRemove),
      {
        shouldDirty: true,
        shouldValidate: true,
      }
    )
  }

  const renderField = (field: SubmitFormField): React.JSX.Element | null => {
    switch (field.type) {
      case SubmitFormFieldType.Text: {
        const textField: TextStagesSubmitFormField =
          field as TextStagesSubmitFormField

        const rows: number =
          typeof textField.rows === 'number' && textField.rows > 1
            ? textField.rows
            : 1

        return (
          <FormField
            key={textField.id}
            control={form.control}
            name={textField.id}
            render={({ field: rhfField }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-white font-medium">
                  {textField.label}
                  {textField.required ? (
                    <span className="ml-1 text-[#66acd6]">*</span>
                  ) : null}
                </FormLabel>

                <FormControl>
                  {rows > 1 ? (
                    <Textarea
                      value={(rhfField.value as string) ?? ''}
                      onChange={rhfField.onChange}
                      placeholder={textField.placeholder}
                      rows={rows}
                      maxLength={textField.maxCharacters ?? undefined}
                      className="min-h-[120px] resize-none border-zinc-700 bg-zinc-900/80 text-white placeholder:text-zinc-500 focus:border-[#66acd6]"
                    />
                  ) : (
                    <Input
                      value={(rhfField.value as string) ?? ''}
                      onChange={rhfField.onChange}
                      placeholder={textField.placeholder}
                      maxLength={textField.maxCharacters ?? undefined}
                      className="border-zinc-700 bg-zinc-900/80 text-white placeholder:text-zinc-500 focus:border-[#66acd6]"
                    />
                  )}
                </FormControl>
              </FormItem>
            )}
          />
        )
      }

      case SubmitFormFieldType.Link: {
        const linkField: LinkStagesSubmitFormField =
          field as LinkStagesSubmitFormField

        return (
          <FormField
            key={linkField.id}
            control={form.control}
            name={linkField.id}
            render={({ field: rhfField }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-white font-medium">
                  {linkField.label}
                  {linkField.required ? (
                    <span className="ml-1 text-[#66acd6]">*</span>
                  ) : null}
                </FormLabel>

                <FormControl>
                  <Input
                    type="url"
                    value={(rhfField.value as string) ?? ''}
                    onChange={rhfField.onChange}
                    placeholder={linkField.placeholder}
                    className="border-zinc-700 bg-zinc-900/80 text-white placeholder:text-zinc-500 focus:border-[#66acd6]"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )
      }

      case SubmitFormFieldType.Chips: {
        const chipsField: ChipsStagesSubmitFormField =
          field as ChipsStagesSubmitFormField

        return (
          <FormField
            key={chipsField.id}
            control={form.control}
            name={chipsField.id}
            render={({ field: rhfField }) => {
              const chips: string[] = Array.isArray(rhfField.value)
                ? (rhfField.value as string[])
                : chipsField.chips ?? []

              return (
                <FormItem className="space-y-3">
                  <FormLabel className="text-white font-medium">
                    {chipsField.label}
                    {chipsField.required ? (
                      <span className="ml-1 text-[#66acd6]">*</span>
                    ) : null}
                  </FormLabel>

                  <div className="flex gap-2">
                    <Input
                      value={chipDrafts[chipsField.id] ?? ''}
                      onChange={(
                        event: React.ChangeEvent<HTMLInputElement>
                      ): void => {
                        setChipDrafts(
                          (
                            prev: Record<string, string>
                          ): Record<string, string> => {
                            return {
                              ...prev,
                              [chipsField.id]: event.target.value,
                            }
                          }
                        )
                      }}
                      placeholder={chipsField.placeholder}
                      className="border-zinc-700 bg-zinc-900/80 text-white placeholder:text-zinc-500 focus:border-[#66acd6]"
                    />

                    <Button
                      type="button"
                      onClick={() => handleAddChip(chipsField)}
                      className="bg-[#66acd6] text-[#152d44] hover:bg-[#7fc0e5]"
                    >
                      Add
                    </Button>
                  </div>

                  {!!chips.length && (
                    <div className="flex flex-wrap gap-2">
                      {chips.map(
                        (chip: string, index: number): React.JSX.Element => (
                          <div
                            key={`${chip}-${index}`}
                            className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-sm text-white"
                          >
                            <span>{chip}</span>

                            <button
                              type="button"
                              className="cursor-pointer text-zinc-400 transition-colors hover:text-red-400"
                              onClick={() =>
                                handleRemoveChip(chipsField, chip)
                              }
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </FormItem>
              )
            }}
          />
        )
      }

      default:
        return null
    }
  }

  const handleSubmit = async (values: StageSubmitValues): Promise<void> => {
    try {
      setIsSubmitting(true)

      await onSubmit({
        stageIndex,
        stage: selectedStage,
        values,
      })

      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="group relative inline-flex">
          <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-[#66acd6] via-[#38bdf8] to-[#66acd6] blur-sm opacity-40 transition duration-500 group-hover:opacity-70" />
          <div className="relative flex items-center gap-3 rounded-xl bg-[#66acd6] px-10 py-5 font-['Aeonik:Medium',sans-serif] font-medium text-[#152d44] shadow-xl shadow-cyan-500/30 transition-all duration-200 group-hover:scale-105 group-hover:bg-[#7fc0e5] group-hover:shadow-cyan-500/50">
            <Upload className="h-5 w-5" />
            <span className="text-[17px]">{triggerLabel}</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto border-zinc-800 bg-[#0b0b0f] text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-white">
            {selectedStage.label}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-5 pt-2"
          >
            {selectedStage.submitForm.fields.map(renderField)}

            <div className="pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#66acd6] py-4 text-base font-semibold text-[#152d44] hover:bg-[#7fc0e5]"
              >
                {isSubmitting ? 'Saving...' : `Save ${selectedStage.label}`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}