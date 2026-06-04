'use client'

import React from 'react'
import { useForm } from 'react-hook-form'
import Image from 'next/image'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MultiSelect } from '@/components/ui/multi-select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  BooleanStagesSubmitFormField,
  ChipsStagesSubmitFormField,
  HackathonStage,
  ImageStagesSubmitFormField,
  LinkStagesSubmitFormField,
  MultiSelectStagesSubmitFormField,
  SubmitFormField,
  SubmitFormFieldType,
  TextStagesSubmitFormField,
} from '@/types/hackathon-stage'
import { HackathonHeader } from '@/types/hackathons'
import { getTechStackOptions } from '@/lib/hackathons/techStackDefaults'
import { normalizeEventsLang, t } from '@/lib/events/i18n'
import { ImageIcon, Loader2, X } from 'lucide-react'
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

type StageSubmitValues = Record<string, string | string[] | boolean>


type StageSubmitPageContentProps = {
  hackathon: HackathonHeader
  hackathonCreator?: any
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
    const projectKey = field.id
    const value = project[projectKey] ?? project[field.id]
    if (value === undefined || value === null) continue

    if (field.type === SubmitFormFieldType.Boolean) {
      if (typeof value === 'boolean') {
        fallback[field.id] = value
      } else if (typeof value === 'string') {
        fallback[field.id] = value === 'true'
      }
      continue
    }

    if (field.type === SubmitFormFieldType.Image) {
      const allowsMultiple = (field.maxImages ?? 1) > 1
      if (allowsMultiple) {
        if (Array.isArray(value)) {
          const urls = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
          if (urls.length > 0) fallback[field.id] = urls
        } else if (typeof value === 'string' && value.trim()) {
          fallback[field.id] = [value]
        }
      } else if (typeof value === 'string' && value.trim()) {
        fallback[field.id] = value
      } else if (Array.isArray(value)) {
        const first = value.find((v): v is string => typeof v === 'string' && v.trim().length > 0)
        if (first) fallback[field.id] = first
      }
      continue
    }

    const isArrayField =
      field.type === SubmitFormFieldType.Link ||
      field.type === SubmitFormFieldType.MultiSelect

    if (isArrayField) {
      if (Array.isArray(value) && value.length > 0) {
        if (value.every((v) => typeof v === 'string')) {
          // plain string array (e.g. categories) — deduplicate case-insensitively
          // for MultiSelect fields so stale variants (e.g. "Defi" vs "DeFi") don't
          // both appear. Last occurrence wins to preserve the most canonical casing.
          const stringValues = value as string[]
          const deduped =
            field.type === SubmitFormFieldType.MultiSelect
              ? Array.from(new Map(stringValues.map((v) => [v.toLowerCase(), v])).values())
              : stringValues
          fallback[field.id] = deduped
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

      if (field.type === SubmitFormFieldType.Boolean) {
        acc[field.id] = false
        return acc
      }

      if (field.type === SubmitFormFieldType.Image) {
        acc[field.id] = (field.maxImages ?? 1) > 1 ? [] : ''
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

function toTextValue(
  value: string | string[] | boolean | undefined
): string | string[] | undefined {
  return typeof value === 'boolean' ? undefined : value
}

function validateRequiredString(
  value: string | string[] | boolean | undefined,
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
  value: string | string[] | boolean | undefined,
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

function validateRequiredBoolean(
  value: string | string[] | boolean | undefined,
  field: SubmitFormField
): true | string {
  if (!field.required) {
    return true
  }

  return value === true ? true : getRequiredMessage(field.label)
}

function isRequiredFieldEmpty(
  field: SubmitFormField,
  value: string | string[] | boolean | undefined
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

  if (field.type === SubmitFormFieldType.Boolean) {
    return value !== true
  }

  if (field.type === SubmitFormFieldType.Image) {
    if (Array.isArray(value)) {
      return !value.some((item: string): boolean => item.trim().length > 0)
    }
    return typeof value !== 'string' || value.trim().length === 0
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
  const [imageUploading, setImageUploading] = React.useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = React.useState<string>('form')
  const { projectId, teamName, loading, project, refetch: refetchProject } = useProjectByHackaUser({
    hackathonId: hackathon.id,
    userId: user?.id ?? '',
  })
  const [resolvedProjectId, setResolvedProjectId] = React.useState<string>(projectId ?? '')
  const { formData, formDataTimestamp, loading: loadingFormData } = useProjectFormData({
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

    // If the project was updated after the last stage form save, project data
    // takes priority so that edits made from the profile page are reflected here.
    const projectUpdatedAt = (project as Record<string, unknown> | null)?.updated_at as string | undefined
    const projectIsNewer =
      !!projectUpdatedAt && !!formDataTimestamp &&
      new Date(projectUpdatedAt) > new Date(formDataTimestamp)

    form.reset(
      projectIsNewer
        ? { ...buildDefaultValues(stage), ...nonEmptyFormData, ...projectFallback }
        : { ...buildDefaultValues(stage), ...projectFallback, ...nonEmptyFormData }
    )
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

  const uploadStageImage = async (file: File): Promise<string> => {
    const body = new FormData()
    body.append('file', file)
    if (hackathon.id) {
      body.append('hackaton_id', hackathon.id)
    }
    body.append('user_id', user?.id ?? '')

    const response: Response = await fetch('/api/file', {
      method: 'POST',
      credentials: 'include',
      body,
    })

    const data: { url?: string; error?: string } = await response.json()
    if (!response.ok || !data.url) {
      throw new Error(data.error ?? 'Failed to upload image')
    }

    return data.url
  }

  const lang = normalizeEventsLang(hackathon.content?.language)

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
              validate: (value: string | string[] | boolean | undefined): true | string => {
                const requiredCheck = validateRequiredString(value, textField)
                if (requiredCheck !== true) {
                  return requiredCheck
                }
                return validateTextInput(toTextValue(value), textField.label)
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
                validate: (value: string | string[] | boolean | undefined): true | string => {
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
              validate: (value: string | string[] | boolean | undefined): true | string => {
                const requiredCheck = validateRequiredArray(value, linkField)
                if (requiredCheck !== true) return requiredCheck
                const dangerCheck = validateUrlInput(toTextValue(value))
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
              validate: (value: string | string[] | boolean | undefined): true | string => {
                const requiredCheck = validateRequiredString(value, chipsField)
                if (requiredCheck !== true) {
                  return requiredCheck
                }
                return validateTextInput(toTextValue(value), chipsField.label)
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
              validate: (value: string | string[] | boolean | undefined): true | string => {
                const requiredCheck = validateRequiredArray(value, multiSelectField)
                if (requiredCheck !== true) {
                  return requiredCheck
                }
                return validateStringArray(toTextValue(value), multiSelectField.label)
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

              const rawOptions: string[] =
                multiSelectField.id === 'tracks'
                  ? hackathon.content.tracks.map((track) => track.name)
                  : multiSelectField.id === 'tech_stack'
                    ? getTechStackOptions(hackathon.content).map((option) => option.name)
                    : (multiSelectField.options ?? [])

              const options = rawOptions
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
                      allowCreate={multiSelectField.id === 'tech_stack'}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        )
      }

      case SubmitFormFieldType.Boolean: {
        const booleanField: BooleanStagesSubmitFormField =
          field as BooleanStagesSubmitFormField

        return (
          <FormField
            key={booleanField.id}
            control={form.control}
            name={booleanField.id}
            rules={{
              validate: (
                value: string | string[] | boolean | undefined
              ): true | string => validateRequiredBoolean(value, booleanField),
            }}
            render={({ field: rhfField }) => {
              const checked: boolean = rhfField.value === true

              // The Team1 sharing consent is a system-wide concept (also asked
              // at registration and in the non-staged submission). Render it
              // with the shared, translated copy instead of the stored label so
              // the wording (and ES/EN) stays consistent across every flow.
              const isConsentField: boolean = booleanField.id === 'consent_sharing'
              const displayLabel: string = isConsentField
                ? t(lang, 'submission.step1.consentSharing.label')
                : booleanField.label
              const displayDescription: string = isConsentField
                ? t(lang, 'submission.step1.consentSharing.hint')
                : booleanField.description

              return (
                <FormItem>
                  <div className="flex items-start gap-3">
                    <FormControl>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next): void => {
                          form.setValue(booleanField.id, next === true, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }}
                        className="mt-0.5 border-zinc-300 data-[state=checked]:bg-[#d66666] data-[state=checked]:border-[#d66666] dark:border-zinc-600"
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className={`${fieldLabelClassName} cursor-pointer`}>
                        {displayLabel}
                        {booleanField.required ? (
                          <span className="ml-1 text-[#d66666]">*</span>
                        ) : null}
                      </FormLabel>
                      {displayDescription ? (
                        <FormDescription className={fieldDescriptionClassName}>
                          {displayDescription}
                        </FormDescription>
                      ) : null}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        )
      }

      case SubmitFormFieldType.Image: {
        const imageField: ImageStagesSubmitFormField =
          field as ImageStagesSubmitFormField

        const maxImages: number =
          typeof imageField.maxImages === 'number' && imageField.maxImages > 0
            ? imageField.maxImages
            : 1
        // 2 MB is the platform-wide upload ceiling; it is not organizer-configurable.
        const maxSizeMb: number = 2
        const isSingleImage: boolean = maxImages === 1

        return (
          <FormField
            key={imageField.id}
            control={form.control}
            name={imageField.id}
            rules={{
              validate: (
                value: string | string[] | boolean | undefined
              ): true | string => {
                if (!imageField.required) return true
                const hasImage = Array.isArray(value)
                  ? value.some((url: string): boolean => url.trim().length > 0)
                  : typeof value === 'string' && value.trim().length > 0
                return hasImage ? true : getRequiredMessage(imageField.label)
              },
            }}
            render={({ field: rhfField }) => {
              const urls: string[] = Array.isArray(rhfField.value)
                ? (rhfField.value as string[])
                : typeof rhfField.value === 'string' && rhfField.value.trim()
                  ? [rhfField.value as string]
                  : []

              const isUploading: boolean = imageUploading[imageField.id] ?? false
              const canAddMore: boolean = urls.length < maxImages
              const fieldError: string =
                (form.formState.errors[imageField.id]?.message as string) ?? ''

              const storeUrls = (next: string[]): void => {
                form.setValue(
                  imageField.id,
                  isSingleImage ? (next[0] ?? '') : next,
                  { shouldDirty: true, shouldValidate: true }
                )
              }

              const handleRemove = (urlToRemove: string): void => {
                storeUrls(urls.filter((url: string): boolean => url !== urlToRemove))
              }

              const handleFiles = async (
                event: React.ChangeEvent<HTMLInputElement>
              ): Promise<void> => {
                const fileList = event.target.files
                if (!fileList || fileList.length === 0) return

                const selected: File[] = Array.from(fileList).slice(
                  0,
                  Math.max(0, maxImages - urls.length)
                )
                event.target.value = ''
                if (selected.length === 0) return

                const maxBytes: number = maxSizeMb * 1024 * 1024
                const oversized = selected.find((file) => file.size > maxBytes)
                if (oversized) {
                  form.setError(imageField.id, {
                    type: 'manual',
                    message: `Each image must be ${maxSizeMb}MB or smaller`,
                  })
                  return
                }

                form.clearErrors(imageField.id)
                setImageUploading((prev) => ({ ...prev, [imageField.id]: true }))
                try {
                  const uploaded: string[] = []
                  for (const file of selected) {
                    uploaded.push(await uploadStageImage(file))
                  }
                  storeUrls([...urls, ...uploaded].slice(0, maxImages))
                } catch (error: unknown) {
                  const message: string =
                    error instanceof Error ? error.message : 'Failed to upload image'
                  form.setError(imageField.id, { type: 'manual', message })
                  toast.error(message)
                } finally {
                  setImageUploading((prev) => ({ ...prev, [imageField.id]: false }))
                }
              }

              return (
                <FormItem>
                  <FormLabel className={fieldLabelClassName}>
                    {imageField.label}
                    {imageField.required ? (
                      <span className="ml-1 text-[#d66666]">*</span>
                    ) : null}
                  </FormLabel>
                  <FormDescription className={fieldDescriptionClassName}>
                    {imageField.description}
                  </FormDescription>

                  {urls.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {urls.map((url: string, index: number): React.JSX.Element => (
                        <div
                          key={`${url}-${index}`}
                          className="relative h-24 w-24 overflow-hidden rounded-md border border-[#d66666]/20 bg-zinc-100 dark:bg-[rgba(255,255,255,0.03)]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`${imageField.label} ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(): void => handleRemove(url)}
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-[#d66666]"
                            aria-label="Remove image"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <FormControl>
                      <label
                        className={[
                          'inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-[#d66666]/40 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-[#d66666] hover:text-[#d66666] dark:text-zinc-300',
                          !canAddMore || isUploading
                            ? 'pointer-events-none opacity-50'
                            : '',
                        ].join(' ')}
                      >
                        {isUploading ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <ImageIcon size={16} />
                        )}
                        {isUploading
                          ? 'Uploading...'
                          : isSingleImage
                            ? urls.length > 0
                              ? 'Replace image'
                              : 'Upload image'
                            : 'Add image'}
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/svg+xml"
                          multiple={!isSingleImage}
                          className="hidden"
                          disabled={!canAddMore || isUploading}
                          onChange={handleFiles}
                        />
                      </label>
                    </FormControl>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {isSingleImage
                        ? `PNG, JPG or SVG · up to ${maxSizeMb}MB`
                        : `Up to ${maxImages} images · ${maxSizeMb}MB each`}
                    </span>
                  </div>

                  {fieldError ? (
                    <p className="text-sm text-[#d66666]">{fieldError}</p>
                  ) : null}
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

      let effectiveProjectId: string = resolvedProjectId

      if (!effectiveProjectId) {
        // Server-side check first: the hook may have stale/error state (e.g. network
        // blip on load). Ask the server authoritatively before creating anything —
        // this prevents duplicate projects if one already exists but the hook missed it.
        const checkRes: Response = await fetch(
          `/api/project?hackathon_id=${encodeURIComponent(hackathon.id)}&user_id=${encodeURIComponent(user?.id ?? '')}`,
          { method: 'GET', credentials: 'include' }
        )
        if (checkRes.ok) {
          const checkData: { project?: { id?: string } | null } = await checkRes.json()
          if (checkData.project?.id) {
            effectiveProjectId = checkData.project.id
            setResolvedProjectId(effectiveProjectId)
          }
        }
      }

      if (!effectiveProjectId) {
        const projectName =
          typeof values['project_name'] === 'string' && values['project_name'].trim()
            ? values['project_name'].trim()
            : 'Untitled Project'
        const shortDesc =
          typeof values['short_description'] === 'string'
            ? values['short_description'].trim()
            : ''

        const createRes: Response = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            project_name: projectName,
            short_description: shortDesc,
            hackaton_id: hackathon.id,
            origin: 'stage-form',
          }),
        })

        const createData: { project?: { id?: string }; error?: string } = await createRes.json()
        if (!createRes.ok) {
          throw new Error(createData.error ?? 'Failed to create project')
        }
        effectiveProjectId = createData.project?.id ?? ''
        if (effectiveProjectId) {
          setResolvedProjectId(effectiveProjectId)
          void refetchProject()
        }
      }

      const response: Response = await fetch('/api/project/form-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          hackathonId: hackathon.id,
          projectId: effectiveProjectId,
          stageIndex,
          values,
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
