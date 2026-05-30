'use client'

import React from 'react'
import { useForm } from 'react-hook-form'
import { Upload } from 'lucide-react'
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

type StageSubmitValues = Record<string, string>

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
        acc[field.id] = ''
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

  const form = useForm<StageSubmitValues>({
    defaultValues: buildDefaultValues(selectedStage),
  })

  React.useEffect((): void => {
    form.reset(buildDefaultValues(selectedStage))
  }, [selectedStage, form])

  if (!selectedStage.submitForm?.fields.length) {
    return null
  }

  const fieldLabelClassName: string = 'font-medium text-zinc-800 dark:text-white'
  const inputClassName: string =
    'border-zinc-300 bg-zinc-50 text-zinc-900 placeholder:text-zinc-500 focus:border-[#d66666] dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-white dark:placeholder:text-zinc-500'
  const chipBaseClassName: string =
    'rounded-lg border px-6 py-2 text-base font-medium transition-all duration-200 bg-zinc-100 dark:bg-[#0f1016]'

  const renderField = (field: SubmitFormField): React.JSX.Element | null => {
    switch (field.type) {
      case SubmitFormFieldType.Text: {
        const textField: TextStagesSubmitFormField =
          field as TextStagesSubmitFormField

        return (
          <FormField
            key={textField.id}
            control={form.control}
            name={textField.id}
            render={({ field: rhfField }) => (
              <FormItem className="space-y-2">
                <FormLabel className={fieldLabelClassName}>
                  {textField.label}
                  {textField.required ? (
                    <span className="ml-1 text-[#d66666]">*</span>
                  ) : null}
                </FormLabel>

                <FormControl>
                  <Input
                    value={(rhfField.value as string) ?? ''}
                    onChange={rhfField.onChange}
                    placeholder={textField.placeholder}
                    maxLength={textField.maxCharacters ?? undefined}
                    className={inputClassName}
                  />
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
            render={({ field: rhfField }) => {
              const value: string = (rhfField.value as string) ?? ''

              // Basic normalization to avoid broken links
              const normalizedUrl: string =
                value && !value.startsWith('http://') && !value.startsWith('https://')
                  ? `https://${value}`
                  : value

              return (
                <FormItem className="space-y-2">
                  <FormLabel className={fieldLabelClassName}>
                    {linkField.label}
                    {linkField.required ? (
                      <span className="ml-1 text-[#d66666]">*</span>
                    ) : null}
                  </FormLabel>

                  <FormControl>
                    <Input
                      type="url"
                      value={value}
                      onChange={rhfField.onChange}
                      placeholder={linkField.placeholder}
                      className={inputClassName}
                    />
                  </FormControl>

                  {/* Preview */}
                  {!!value && (() => {
                    const maxLength: number = 40

                    const displayValue: string =
                      value.length > maxLength
                        ? `${value.slice(0, maxLength)}...`
                        : value

                    return (
                      <div className="pt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        Visit your link:{' '}
                        <a
                          href={normalizedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#d66666] underline hover:text-[#ff8a8a]"
                          title={value} // full value on hover
                        >
                          {displayValue}
                        </a>
                      </div>
                    )
                  })()}
                </FormItem>
              )
            }}
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
              const chips: string[] = chipsField.chips ?? []

              return (
                <FormItem className="space-y-3">
                  <FormLabel className={fieldLabelClassName}>
                    {chipsField.label}
                    {chipsField.required ? (
                      <span className="ml-1 text-[#d66666]">*</span>
                    ) : null}
                  </FormLabel>

                  {!!chips.length && (
                    <div className="flex flex-wrap gap-3">
                      {chips.map((chip: string, index: number): React.JSX.Element => {
                        const isSelected: boolean = rhfField.value === chip

                        return (
                          <button
                            key={`${chip}-${index}`}
                            type="button"
                            onClick={(): void => {
                              form.setValue(chipsField.id, chip, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }}
                            className={[
                              chipBaseClassName,
                              isSelected
                                ? 'border-[#d66666] text-[#ff8a8a] shadow-[0_0_0_1px_rgba(214,102,102,0.35),0_0_18px_rgba(214,102,102,0.22)]'
                                : 'border-zinc-300 text-zinc-700 hover:border-[#d66666]/45 hover:text-zinc-900 dark:border-white/10 dark:text-white/85 dark:hover:text-white',
                            ].join(' ')}
                          >
                            {chip}
                          </button>
                        )
                      })}
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
      <DialogTrigger asChild className="">
        <button type="button" className="group relative inline-flex">
          <div className="relative flex items-center gap-3 rounded-xl bg-[#d66666] px-10 py-5 font-['Aeonik:Medium',sans-serif] font-medium text-[#152d44] shadow-xl shadow-[#d66666]/30 transition-all duration-200 group-hover:scale-105 group-hover:bg-[#e57f7f] group-hover:shadow-[#d66666]/50">
            <div className="absolute -inset-1 cursor-pointer rounded-xl bg-gradient-to-r from-[#d66666] via-[#f83838] to-[#d66666] blur-sm opacity-40 transition duration-500 group-hover:opacity-70" />
            <Upload className="h-5 w-5 text-zinc-900" />
            <span className="text-[17px] font-semibold text-zinc-900">
              {triggerLabel}
            </span>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto border-[#d66666]/20 bg-zinc-50 text-zinc-900 dark:bg-[#0b0b0f] dark:text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-zinc-900 dark:text-white">
            {selectedStage.label}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-5 pt-2"
          >
            {selectedStage.submitForm.fields.map(renderField)}

            <div className="flex w-full justify-center pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-[40%] bg-[#d66666] py-4 text-base font-semibold text-zinc-900 hover:bg-[#e57f7f]"
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