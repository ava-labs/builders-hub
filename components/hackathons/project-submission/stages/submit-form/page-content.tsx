'use client'

import React from 'react'
import { useForm } from 'react-hook-form'
import Image from 'next/image'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MultiSelect } from '@/components/ui/multi-select'
import {
  ChipsStagesSubmitFormField,
  HackathonStage,
  LinkStagesSubmitFormField,
  MultiSelectStagesSubmitFormField,
  SubmitFormField,
  SubmitFormFieldType,
  TextStagesSubmitFormField,
} from '@/types/hackathon-stage'
import { HackathonHeader } from '@/types/hackathons'
import { X } from 'lucide-react'
import TeamMembersWrapper from './team-members-wrapper'
import { useProjectByHackaUser } from '@/hooks/use-get-project-hacka-user'
import { useProjectFormData } from '../../hooks/useGetFormDataFromProject'
import {
  validateTextInput,
  validateUrlInput,
  validateStringArray,
  detectDangerousUrl,
} from '@/utils/input-validator'
import { toast } from 'sonner'

type StageSubmitValues = Record<string, string | string[]>


type StageSubmitPageContentProps = {
  hackathon: HackathonHeader
  hackathonCreator?: any // Replace 'any' with the correct type for the hackathon creator
  stage: HackathonStage
  stageIndex: number
  projectId?: string
  user?: {
    email?: string
    id?: string
    user_name?: string
  }
  renderInPreview?: boolean
}

function buildProjectFallback(
  project: Record<string, unknown>,
  stageFields: SubmitFormField[]
): StageSubmitValues {
  const fallback: StageSubmitValues = {}

  for (const field of stageFields) {
    // 'explanation' in stage form corresponds to 'tech_stack' in the full project submission
    const projectKey = field.id === 'explanation' ? 'tech_stack' : field.id
    const value = project[projectKey] ?? project[field.id]
    if (value === undefined || value === null) continue

    const isArrayField =
      field.type === SubmitFormFieldType.Link ||
      field.type === SubmitFormFieldType.MultiSelect

    if (isArrayField) {
      if (Array.isArray(value)) {
        if (value.every((v) => typeof v === 'string')) {
          // plain string array (e.g. categories)
          fallback[field.id] = value as string[]
        } else {
          // array of objects — serialize each as JSON (e.g. deployed_addresses: {address, tag}[])
          const serialized = value
            .map((v) => {
              if (typeof v === 'string') return v
              if (v && typeof v === 'object') return JSON.stringify(v)
              return null
            })
            .filter((v): v is string => v !== null)
          if (serialized.length > 0) fallback[field.id] = serialized
        }
      } else if (typeof value === 'string' && value.trim()) {
        fallback[field.id] = [value]
      }
    } else {
      if (typeof value === 'string') {
        fallback[field.id] = value
      }
    }
  }

  return fallback
}

function buildDefaultValues(stage: HackathonStage): StageSubmitValues {
  const fields: SubmitFormField[] = stage.submitForm?.fields ?? []

  return fields.reduce(
    (acc: StageSubmitValues, field: SubmitFormField): StageSubmitValues => {
      if (
        field.type === SubmitFormFieldType.Link ||
        field.type === SubmitFormFieldType.MultiSelect
      ) {
        acc[field.id] = []
        return acc
      }

      acc[field.id] = ''
      return acc
    },
    {}
  )
}

function getRequiredMessage(label: string): string {
  return `${label || 'This field'} is required`
}

function validateRequiredString(
  value: string | string[] | undefined,
  field: SubmitFormField
): true | string {
  if (!field.required) {
    return true
  }

  return typeof value === 'string' && value.trim().length > 0
    ? true
    : getRequiredMessage(field.label)
}

function validateRequiredArray(
  value: string | string[] | undefined,
  field: SubmitFormField
): true | string {
  if (!field.required) {
    return true
  }

  return Array.isArray(value) &&
    value.some((item: string): boolean => item.trim().length > 0)
    ? true
    : getRequiredMessage(field.label)
}

function isRequiredFieldEmpty(
  field: SubmitFormField,
  value: string | string[] | undefined
): boolean {
  if (!field.required) {
    return false
  }

  if (
    field.type === SubmitFormFieldType.Link ||
    field.type === SubmitFormFieldType.MultiSelect
  ) {
    return !Array.isArray(value) ||
      !value.some((item: string): boolean => item.trim().length > 0)
  }

  return typeof value !== 'string' || value.trim().length === 0
}

export default function StageSubmitPageContent({
  hackathon,
  hackathonCreator,
  stage,
  stageIndex,
  renderInPreview,
  user
}: StageSubmitPageContentProps): React.JSX.Element | null {
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false)
  const [linkDrafts, setLinkDrafts] = React.useState<Record<string, string>>({})
  const [linkDraftErrors, setLinkDraftErrors] = React.useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = React.useState<string>('form')
  const { projectId, teamName, loading, project } = useProjectByHackaUser({
    hackathonId: hackathon.id,
    userId: user?.id ?? '',
  })
  const [resolvedProjectId, setResolvedProjectId] = React.useState<string>(projectId ?? '')
  const { formData, loading: loadingFormData } = useProjectFormData({
    projectId: projectId || '',
  })

  const form = useForm<StageSubmitValues>({
    defaultValues: buildDefaultValues(stage),
  })
  const watchedValues: StageSubmitValues = form.watch()
  const hasMissingRequiredFields: boolean = (stage.submitForm?.fields ?? []).some(
    (field: SubmitFormField): boolean =>
      isRequiredFieldEmpty(field, watchedValues[field.id])
  )
  const hasValidationErrors: boolean = Object.keys(form.formState.errors).length > 0
  const isSaveDisabled: boolean = isSubmitting || hasMissingRequiredFields || hasValidationErrors
  const fieldLabelClassName: string = 'font-medium text-zinc-800 dark:text-white'
  const fieldDescriptionClassName: string = 'text-sm text-zinc-600 dark:text-zinc-400'
  const inputClassName: string =
    'border-zinc-300 bg-zinc-50 text-zinc-900 placeholder:text-zinc-500 focus:border-[#d66666] dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-white dark:placeholder:text-zinc-500'
  const panelClassName: string =
    'rounded-2xl border border-[#d66666]/20 bg-white/90 p-6 text-zinc-900 sm:p-8 dark:bg-[#0b0b0f] dark:text-white'

  React.useEffect((): void => {
    setLinkDrafts({})
    setLinkDraftErrors({})

    if (!projectId) {
      form.reset(buildDefaultValues(stage))
      return
    }

    if (loading || loadingFormData) {
      return
    }

    const projectFallback: StageSubmitValues = project
      ? buildProjectFallback(
          project as Record<string, unknown>,
          stage.submitForm?.fields ?? []
        )
      : {}

    // Only apply formData values that are non-empty so that a previous empty
    // stage submission doesn't erase real project data (e.g. explanation).
    const nonEmptyFormData: StageSubmitValues = {}
    if (formData) {
      for (const [key, val] of Object.entries(formData)) {
        const hasValue = Array.isArray(val) ? val.length > 0 : typeof val === 'string' ? val.trim().length > 0 : val != null
        if (hasValue) nonEmptyFormData[key] = val
      }
    }

    form.reset({
      ...buildDefaultValues(stage),
      ...projectFallback,
      ...nonEmptyFormData,
    })
  }, [projectId, formData, loading, loadingFormData, stage, form, project])

  React.useEffect((): void => {
    setResolvedProjectId(projectId ?? '')
  }, [projectId])


  const validateDraftUrl = (url: string): string => {
    const trimmed = url.trim()
    if (!trimmed) return ''
    if (detectDangerousUrl(trimmed)) return 'URL contains a dangerous protocol'
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    try {
      new URL(normalized)
      return ''
    } catch {
      return 'Please enter a valid URL'
    }
  }

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
            rules={{
              validate: (value: string | string[] | undefined): true | string => {
                // First check if required
                const requiredCheck = validateRequiredString(value, textField)
                if (requiredCheck !== true) {
                  return requiredCheck
                }
                // Then check for dangerous content
                return validateTextInput(value, textField.label)
              },
            }}
            render={({ field: rhfField }) => (
              <FormItem>
                <FormLabel className={fieldLabelClassName}>
                  {textField.label}
                  {textField.required ? (
                    <span className="ml-1 text-[#d66666]">*</span>
                  ) : null}
                </FormLabel>
                <FormDescription className={fieldDescriptionClassName}>{textField.description}</FormDescription>
                <FormControl>
                  <Input
                    value={(rhfField.value as string) ?? ''}
                    onChange={rhfField.onChange}
                    placeholder={textField.placeholder}
                    maxLength={textField.maxCharacters ?? undefined}
                    className={inputClassName}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )
      }

      case SubmitFormFieldType.Link: {
        const linkField: LinkStagesSubmitFormField =
          field as LinkStagesSubmitFormField

        // Deployed addresses: special address+tag list UI
        if (linkField.id === 'deployed_addresses') {
          return (
            <FormField
              key={linkField.id}
              control={form.control}
              name={linkField.id}
              rules={{
                validate: (value: string | string[] | undefined): true | string => {
                  if (!linkField.required) return true
                  return validateRequiredArray(value, linkField)
                },
              }}
              render={({ field: rhfField }) => {
                const rawEntries: string[] = Array.isArray(rhfField.value)
                  ? (rhfField.value as string[])
                  : []

                const entries: Array<{ address: string; tag: string }> = rawEntries.map((raw) => {
                  try {
                    const p = JSON.parse(raw) as { address?: string; tag?: string }
                    return { address: p.address ?? raw, tag: p.tag ?? '' }
                  } catch {
                    return { address: raw, tag: '' }
                  }
                })

                const draftAddress: string = linkDrafts[`${linkField.id}_address`] ?? ''
                const draftTag: string = linkDrafts[`${linkField.id}_tag`] ?? ''

                const updateEntries = (next: Array<{ address: string; tag: string }>): void => {
                  form.setValue(
                    linkField.id,
                    next.map((e) => JSON.stringify({ address: e.address, tag: e.tag })),
                    { shouldDirty: true, shouldValidate: true }
                  )
                }

                const handleAddEntry = (): void => {
                  const addr = draftAddress.trim()
                  if (!addr) return
                  updateEntries([...entries, { address: addr, tag: draftTag.trim() }])
                  setLinkDrafts((prev) => ({
                    ...prev,
                    [`${linkField.id}_address`]: '',
                    [`${linkField.id}_tag`]: '',
                  }))
                }

                const handleRemoveEntry = (index: number): void => {
                  updateEntries(entries.filter((_, i) => i !== index))
                }

                const handleEntryChange = (
                  index: number,
                  key: 'address' | 'tag',
                  value: string
                ): void => {
                  const next = entries.map((e, i) =>
                    i === index ? { ...e, [key]: value } : e
                  )
                  updateEntries(next)
                }

                return (
                  <FormItem>
                    <FormLabel className={fieldLabelClassName}>
                      {linkField.label}
                      {linkField.required ? (
                        <span className="ml-1 text-[#d66666]">*</span>
                      ) : null}
                    </FormLabel>
                    <FormDescription className={fieldDescriptionClassName}>
                      {linkField.description}
                    </FormDescription>

                    {entries.length > 0 && (
                      <div className="space-y-2">
                        {entries.map((entry, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <Input
                              value={entry.tag}
                              onChange={(e) => handleEntryChange(index, 'tag', e.target.value)}
                              placeholder="Tag (optional)"
                              className={`w-28 shrink-0 ${inputClassName}`}
                            />
                            <Input
                              value={entry.address}
                              onChange={(e) => handleEntryChange(index, 'address', e.target.value)}
                              placeholder="Address or URL"
                              className={`flex-1 ${inputClassName}`}
                            />
                            <button
                              type="button"
                              className="cursor-pointer text-zinc-500 transition-colors hover:text-[#d66666] dark:text-zinc-400"
                              onClick={() => handleRemoveEntry(index)}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 items-center">
                      <Input
                        value={draftTag}
                        onChange={(e) =>
                          setLinkDrafts((prev) => ({ ...prev, [`${linkField.id}_tag`]: e.target.value }))
                        }
                        placeholder="Tag (optional)"
                        className={`w-28 shrink-0 ${inputClassName}`}
                      />
                      <Input
                        value={draftAddress}
                        onChange={(e) =>
                          setLinkDrafts((prev) => ({ ...prev, [`${linkField.id}_address`]: e.target.value }))
                        }
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEntry() } }}
                        placeholder={linkField.placeholder ?? 'Address or URL'}
                        className={`flex-1 ${inputClassName}`}
                      />
                      <Button
                        type="button"
                        onClick={handleAddEntry}
                        className="bg-[#d66666] text-zinc-900 hover:bg-[#e57f7f] shrink-0"
                      >
                        Add
                      </Button>
                    </div>

                    <FormMessage />
                  </FormItem>
                )
              }}
            />
          )
        }

        return (
          <FormField
            key={linkField.id}
            control={form.control}
            name={linkField.id}
            rules={{
              validate: (value: string | string[] | undefined): true | string => {
                const requiredCheck = validateRequiredArray(value, linkField)
                if (requiredCheck !== true) return requiredCheck
                const dangerCheck = validateUrlInput(value)
                if (dangerCheck !== true) return dangerCheck
                const urls = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
                for (const url of urls) {
                  const err = validateDraftUrl(url.trim())
                  if (err) return err
                }
                return true
              },
            }}
            render={({ field: rhfField }) => {
              const links: string[] = Array.isArray(rhfField.value)
                ? (rhfField.value as string[])
                : []

              const draftValue: string = linkDrafts[linkField.id] ?? ''
              const draftError: string = linkDraftErrors[linkField.id] ?? ''
              const maxLinks: number | null =
                typeof linkField.maxLinks === 'number' && linkField.maxLinks > 0
                  ? linkField.maxLinks
                  : null
              const isSingleLink: boolean = maxLinks === 1
              const canAddMoreLinks: boolean = !maxLinks || links.length < maxLinks

              const normalizeUrl = (url: string): string => {
                const trimmedUrl: string = url.trim()
                return trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
                  ? trimmedUrl
                  : `https://${trimmedUrl}`
              }

              const handleAddLink = (): void => {
                if (!canAddMoreLinks) return
                const trimmedValue: string = draftValue.trim()
                if (!trimmedValue) return
                const err = validateDraftUrl(trimmedValue)
                if (err) {
                  setLinkDraftErrors((prev) => ({ ...prev, [linkField.id]: err }))
                  return
                }
                const normalizedUrl: string = normalizeUrl(trimmedValue)
                if (!links.includes(normalizedUrl)) {
                  form.setValue(linkField.id, [...links, normalizedUrl], {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                setLinkDrafts((prev) => ({ ...prev, [linkField.id]: '' }))
                setLinkDraftErrors((prev) => ({ ...prev, [linkField.id]: '' }))
              }

              const handleSingleLinkChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
                const value: string = event.target.value
                const err = value.trim() ? validateDraftUrl(value) : ''
                setLinkDraftErrors((prev) => ({ ...prev, [linkField.id]: err }))
                form.setValue(linkField.id, value.trim() ? [value] : [], {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }

              const handleSingleLinkBlur = (): void => {
                const value: string = links[0]?.trim() ?? ''
                if (!value) return
                const normalizedUrl: string = normalizeUrl(value)
                form.setValue(linkField.id, [normalizedUrl], {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }

              const handleRemoveLink = (linkToRemove: string): void => {
                form.setValue(
                  linkField.id,
                  links.filter((link: string): boolean => link !== linkToRemove),
                  { shouldDirty: true, shouldValidate: true }
                )
              }

              return (
                <FormItem>
                  <FormLabel className={fieldLabelClassName}>
                    {linkField.label}
                    {linkField.required ? (
                      <span className="ml-1 text-[#d66666]">*</span>
                    ) : null}
                  </FormLabel>
                  <FormDescription className={fieldDescriptionClassName}>{linkField.description}</FormDescription>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        type="url"
                        value={isSingleLink ? (links[0] ?? '') : draftValue}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
                          if (isSingleLink) {
                            handleSingleLinkChange(event)
                            return
                          }
                          const val = event.target.value
                          setLinkDrafts((prev) => ({ ...prev, [linkField.id]: val }))
                          setLinkDraftErrors((prev) => ({
                            ...prev,
                            [linkField.id]: val.trim() ? validateDraftUrl(val) : '',
                          }))
                        }}
                        onBlur={isSingleLink ? handleSingleLinkBlur : undefined}
                        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>): void => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            if (isSingleLink) { handleSingleLinkBlur(); return }
                            handleAddLink()
                          }
                        }}
                        placeholder={linkField.placeholder}
                        disabled={!isSingleLink && !canAddMoreLinks}
                        className={inputClassName}
                      />
                    </FormControl>

                    {!isSingleLink && (
                      <Button
                        type="button"
                        onClick={handleAddLink}
                        disabled={!canAddMoreLinks}
                        className="bg-[#d66666] text-zinc-900 hover:bg-[#e57f7f]"
                      >
                        Add
                      </Button>
                    )}
                  </div>

                  {draftError && (
                    <p className="text-sm text-[#d66666]">{draftError}</p>
                  )}

                  {!!links.length && (
                    <div className="flex flex-wrap gap-2">
                      {links.map((link: string, index: number): React.JSX.Element => {
                        const maxLength: number = 40
                        const displayValue: string =
                          link.length > maxLength ? `${link.slice(0, maxLength)}...` : link

                        return (
                          <div
                            key={`${link}-${index}`}
                            className="flex items-center gap-2 rounded-md border border-[#d66666]/20 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-800 dark:bg-[rgba(255,255,255,0.03)] dark:text-white"
                          >
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#d66666] underline hover:text-[#ff8a8a]"
                              title={link}
                            >
                              {displayValue}
                            </a>
                            <button
                              type="button"
                              className="cursor-pointer text-zinc-500 transition-colors hover:text-[#d66666] dark:text-zinc-400"
                              onClick={(): void => handleRemoveLink(link)}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <FormMessage />
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
            rules={{
              validate: (value: string | string[] | undefined): true | string => {
                // First check if required
                const requiredCheck = validateRequiredString(value, chipsField)
                if (requiredCheck !== true) {
                  return requiredCheck
                }
                // Then check for dangerous content
                return validateTextInput(value, chipsField.label)
              },
            }}
            render={({ field: rhfField }) => {
              const chips: string[] = chipsField.chips ?? []

              return (
                <FormItem>
                  <FormLabel className={fieldLabelClassName}>
                    {chipsField.label}
                    {chipsField.required ? (
                      <span className="ml-1 text-[#d66666]">*</span>
                    ) : null}
                  </FormLabel>
                  <FormDescription className={fieldDescriptionClassName}>{chipsField.description}</FormDescription>

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
                              'rounded-lg border px-6 py-2 text-base font-medium transition-all duration-200 bg-zinc-100 dark:bg-[#0f1016]',
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
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        )
      }

      case SubmitFormFieldType.MultiSelect: {
        const multiSelectField: MultiSelectStagesSubmitFormField =
          field as MultiSelectStagesSubmitFormField

        return (
          <FormField
            key={multiSelectField.id}
            control={form.control}
            name={multiSelectField.id}
            rules={{
              validate: (value: string | string[] | undefined): true | string => {
                // First check if required
                const requiredCheck = validateRequiredArray(value, multiSelectField)
                if (requiredCheck !== true) {
                  return requiredCheck
                }
                // Then check for dangerous content
                return validateStringArray(value, multiSelectField.label)
              },
            }}
            render={({ field: rhfField }) => {
              const selectedValues: string[] = Array.isArray(rhfField.value)
                ? (rhfField.value as string[])
                : []

              const maxSelections: number | null =
                typeof multiSelectField.maxSelections === 'number' &&
                  multiSelectField.maxSelections > 0
                  ? multiSelectField.maxSelections
                  : null

              const options = (multiSelectField.options ?? [])
                .filter((option: string): boolean => option.trim().length > 0)
                .map((option: string) => ({
                  label: option,
                  value: option,
                }))

              const handleChange = (values: string[]): void => {
                const nextValues: string[] = maxSelections
                  ? values.slice(0, maxSelections)
                  : values

                form.setValue(multiSelectField.id, nextValues, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }

              return (
                <FormItem>
                  <FormLabel className={fieldLabelClassName}>
                    {multiSelectField.label}
                    {multiSelectField.required ? (
                      <span className="ml-1 text-[#d66666]">*</span>
                    ) : null}
                  </FormLabel>
                  <FormDescription className={fieldDescriptionClassName}>
                    {multiSelectField.description}
                  </FormDescription>
                  <FormControl>
                    <MultiSelect
                      options={options}
                      selected={selectedValues}
                      onChange={handleChange}
                      placeholder={multiSelectField.placeholder || 'Select options'}
                      searchPlaceholder="Search options"
                    />
                  </FormControl>
                  <FormMessage />
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
      // Values are already validated by form validation rules
      // No dangerous input can reach here because submit button is disabled if validation fails
      const valuesForSubmit: StageSubmitValues = { ...values }

      const response: Response = await fetch('/api/project/form-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          hackathonId: hackathon.id,
          projectId: resolvedProjectId,
          stageIndex,
          values: valuesForSubmit,
        }),
      })

      const data: {
        success?: boolean
        error?: string
        projectId?: string
        formDataId?: string
        currentStage?: number
      } = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to save stage submission')
      }

      if (data.projectId) {
        setResolvedProjectId(data.projectId)
      }

      toast.success(`${stage.label} saved successfully`)
    } catch (error: unknown) {
      const message: string =
        error instanceof Error ? error.message : 'Unknown error'

      console.error('Error saving stage submission:', message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function onlySubmitForm() {
    if (!stage.submitForm?.fields.length) {
      return null
    }
    return (
      <div className={panelClassName}>
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-[#d66666]">
            Form
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-white">
            {stage.label}
          </h2>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-5"
          >
            {stage.submitForm.fields.map(renderField)}

            {/* <div className="flex justify-center pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className=" bg-[#d66666] py-4 text-base font-semibold text-zinc-900 hover:bg-[#e57f7f]"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </div> */}
          </form>
        </Form>
      </div>
    )
  }
  if (!stage.submitForm?.fields.length) {
    return null
  }
  if (renderInPreview) {
    return onlySubmitForm()
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col gap-6 lg:flex-row"
      >
        <div className="w-full lg:w-[300px] lg:shrink-0">
          <div className="space-y-6 rounded-2xl border border-[#d66666]/20 bg-white/90 p-6 dark:bg-[#0b0b0f] lg:sticky lg:top-4 lg:self-start">
            <div>

              <div className="flex flex-col items-start gap-4">
                <p className="text-sm uppercase tracking-[0.2em] text-[#d66666]">
                  Submission
                </p>
                {hackathonCreator?.email?.includes('@team1.network') ? (
                  <Image
                    src="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/nav-banner/local_events_team1-UJLssyvek3G880Q013A94SdMKxiLRq.jpg"
                    alt="Hackathon background"
                    width={40}
                    height={40}
                  />
                ) : (
                  <Image
                    src="/images/avax.png"
                    alt="Hackathon background"
                    width={40}
                    height={40}
                  />
                )}

                <span className="text-sm font-bold sm:text-xl">
                  {hackathon.title}
                </span>
              </div>

              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {stage.label}
              </p>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800" />

            <TabsList className="flex h-auto w-full flex-col gap-2 bg-transparent p-0">
              <TabsTrigger
                value="form"
                className="w-full justify-start rounded-lg border border-transparent bg-zinc-200/80 text-zinc-800 data-[state=active]:border-[#d66666]/30 data-[state=active]:bg-[#f6dada] data-[state=active]:text-[#b45353] dark:bg-zinc-900/70 dark:text-white dark:data-[state=active]:bg-[#141419] dark:data-[state=active]:text-[#ff8a8a]"
              >
                Form
              </TabsTrigger>

              <TabsTrigger
                value="team"
                className="w-full justify-start rounded-lg border border-transparent bg-zinc-200/80 text-zinc-800 data-[state=active]:border-[#d66666]/30 data-[state=active]:bg-[#f6dada] data-[state=active]:text-[#b45353] dark:bg-zinc-900/70 dark:text-white dark:data-[state=active]:bg-[#141419] dark:data-[state=active]:text-[#ff8a8a]"
              >
                Team
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <TabsContent value="form" className="mt-0">
            <div className={panelClassName}>
              <div className="mb-8">
                <p className="text-sm uppercase tracking-[0.2em] text-[#d66666]">
                  Form
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-white">
                  {stage.label}
                </h2>
              </div>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSubmit)}
                  className="space-y-5"
                >
                  {stage.submitForm.fields.map(renderField)}

                  <div className="flex justify-center pt-4">
                    <Button
                      type="submit"
                      disabled={isSaveDisabled}
                      className=" bg-[#d66666] py-4 text-base font-semibold text-zinc-900 hover:bg-[#e57f7f]"
                    >
                      {isSubmitting ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </TabsContent>

          <TabsContent value="team" className="mt-0">
            {/* TEAM & COLLABORATION */}
            <section className='space-y-4'>
              <h3 className='font-medium  text-lg md:text-xl' id='team'>
                Team &amp; Collaboration
              </h3>
              <TeamMembersWrapper
                hackathonId={hackathon.id}
                projectId={projectId || ''}
                userId={user?.id || ''}
                stage={stageIndex}
                userEmail={user?.email || ''}
                userName={user?.user_name || ''}
                availableTracks={hackathon.content.tracks}
              />
            </section>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
