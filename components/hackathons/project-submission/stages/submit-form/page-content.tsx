'use client'

import React from 'react'
import { useForm } from 'react-hook-form'
import Image from 'next/image'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form'
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
import { HackathonHeader } from '@/types/hackathons'
import { X } from 'lucide-react'
import TeamMembersWrapper from './team-members-wrapper'
import { getAuthSession } from '@/lib/auth/authSession'
import { useProjectByHackaUser } from '@/hooks/use-get-project-hacka-user'
import { useProjectFormData } from '../../hooks/useGetFormDataFromProject'

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

function buildDefaultValues(stage: HackathonStage): StageSubmitValues {
  const fields: SubmitFormField[] = stage.submitForm?.fields ?? []

  return fields.reduce(
    (acc: StageSubmitValues, field: SubmitFormField): StageSubmitValues => {
      if (field.type === SubmitFormFieldType.Link) {
        acc[field.id] = []
        return acc
      }

      acc[field.id] = ''
      return acc
    },
    {}
  )
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
  const [activeTab, setActiveTab] = React.useState<string>('form')
  const { projectId, teamName, loading } = useProjectByHackaUser({
    hackathonId: hackathon.id,
    userId: user?.id ?? '',
  })
  const [resolvedProjectId, setResolvedProjectId] = React.useState<string>(projectId ?? '')
  const { formData, loading: loadingFormData } = useProjectFormData({
    projectId: projectId || '',
  })

  const form = useForm<StageSubmitValues>({
    defaultValues: buildDefaultValues(stage),
    shouldUnregister: true,
  })

  React.useEffect((): void => {
    setLinkDrafts({})

    if (!projectId) {
      form.reset(buildDefaultValues(stage))
      return
    }

    if (loading) {
      return
    }

    form.reset({
      ...buildDefaultValues(stage),
      ...(formData ?? {}),
    })
  }, [projectId, formData, loading, stage, form])

  React.useEffect((): void => {
    setResolvedProjectId(projectId ?? '')
  }, [projectId])


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
              <FormItem>
                <FormLabel className="font-medium text-white">
                  {textField.label}
                  {textField.required ? (
                    <span className="ml-1 text-[#d66666]">*</span>
                  ) : null}
                </FormLabel>
                <FormDescription className="text-sm text-zinc-400">{textField.description}</FormDescription>
                <FormControl>
                  {rows > 1 ? (
                    <Textarea
                      value={(rhfField.value as string) ?? ''}
                      onChange={rhfField.onChange}
                      placeholder={textField.placeholder}
                      rows={rows}
                      maxLength={textField.maxCharacters ?? undefined}
                      className="min-h-[120px] resize-none border-zinc-700 bg-zinc-900/80 text-white placeholder:text-zinc-500 focus:border-[#d66666]"
                    />
                  ) : (
                    <Input
                      value={(rhfField.value as string) ?? ''}
                      onChange={rhfField.onChange}
                      placeholder={textField.placeholder}
                      maxLength={textField.maxCharacters ?? undefined}
                      className="border-zinc-700 bg-zinc-900/80 text-white placeholder:text-zinc-500 focus:border-[#d66666]"
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
            render={({ field: rhfField }) => {
              const links: string[] = Array.isArray(rhfField.value)
                ? (rhfField.value as string[])
                : []

              const draftValue: string = linkDrafts[linkField.id] ?? ''

              const normalizeUrl = (url: string): string => {
                const trimmedUrl: string = url.trim()

                if (
                  trimmedUrl.startsWith('http://') ||
                  trimmedUrl.startsWith('https://')
                ) {
                  return trimmedUrl
                }

                return `https://${trimmedUrl}`
              }

              const handleAddLink = (): void => {
                const trimmedValue: string = draftValue.trim()

                if (!trimmedValue) {
                  return
                }

                const normalizedUrl: string = normalizeUrl(trimmedValue)

                if (links.includes(normalizedUrl)) {
                  setLinkDrafts((prev: Record<string, string>): Record<string, string> => ({
                    ...prev,
                    [linkField.id]: '',
                  }))
                  return
                }

                form.setValue(linkField.id, [...links, normalizedUrl], {
                  shouldDirty: true,
                  shouldValidate: true,
                })

                setLinkDrafts((prev: Record<string, string>): Record<string, string> => ({
                  ...prev,
                  [linkField.id]: '',
                }))
              }

              const handleRemoveLink = (linkToRemove: string): void => {
                form.setValue(
                  linkField.id,
                  links.filter((link: string): boolean => link !== linkToRemove),
                  {
                    shouldDirty: true,
                    shouldValidate: true,
                  }
                )
              }

              return (
                <FormItem >
                  <FormLabel className="font-medium text-white">
                    {linkField.label}
                    {linkField.required ? (
                      <span className="ml-1 text-[#d66666]">*</span>
                    ) : null}
                  </FormLabel>
                  <FormDescription className="text-sm text-zinc-400">{linkField.description}</FormDescription>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        type="url"
                        value={draftValue}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
                          setLinkDrafts(
                            (prev: Record<string, string>): Record<string, string> => ({
                              ...prev,
                              [linkField.id]: event.target.value,
                            })
                          )
                        }}
                        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>): void => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            handleAddLink()
                          }
                        }}
                        placeholder={linkField.placeholder}
                        className="border-zinc-700 bg-zinc-900/80 text-white placeholder:text-zinc-500 focus:border-[#d66666]"
                      />
                    </FormControl>

                    <Button
                      type="button"
                      onClick={handleAddLink}
                      className="bg-[#d66666] text-zinc-900 hover:bg-[#e57f7f]"
                    >
                      Add
                    </Button>
                  </div>

                  {!!links.length && (
                    <div className="flex flex-wrap gap-2">
                      {links.map((link: string, index: number): React.JSX.Element => {
                        const maxLength: number = 40
                        const displayValue: string =
                          link.length > maxLength
                            ? `${link.slice(0, maxLength)}...`
                            : link

                        return (
                          <div
                            key={`${link}-${index}`}
                            className="flex items-center gap-2 rounded-md border border-[#d66666]/20 bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm text-white"
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
                              className="cursor-pointer text-zinc-400 transition-colors hover:text-[#d66666]"
                              onClick={(): void => handleRemoveLink(link)}
                            >
                              <X size={14} />
                            </button>
                          </div>
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
                <FormItem>
                  <FormLabel className="font-medium text-white">
                    {chipsField.label}
                    {chipsField.required ? (
                      <span className="ml-1 text-[#d66666]">*</span>
                    ) : null}
                  </FormLabel>
                  <FormDescription className="text-sm text-zinc-400">{chipsField.description}</FormDescription>

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
                              'rounded-lg border px-6 py-2 text-base font-medium transition-all duration-200',
                              'bg-[#0f1016]',
                              isSelected
                                ? 'border-[#d66666] text-[#ff8a8a] shadow-[0_0_0_1px_rgba(214,102,102,0.35),0_0_18px_rgba(214,102,102,0.22)]'
                                : 'border-white/10 text-white/85 hover:border-[#d66666]/45 hover:text-white',
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
    } catch (error: unknown) {
      const message: string =
        error instanceof Error ? error.message : 'Unknown error'

      console.error('Error saving stage submission:', message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function onlySubmitForm() {
    if (!stage.submitForm?.fields.length) {
      return null
    }
    return (
      <div className="rounded-2xl border border-[#d66666]/20 bg-[#0b0b0f] p-6 text-white sm:p-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-[#d66666]">
            Form
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-white">
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
                disabled={isSubmitting}
                className=" bg-[#d66666] py-4 text-base font-semibold text-zinc-900 hover:bg-[#e57f7f]"
              >
                {isSubmitting ? 'Saving...' : `Save ${stage.label}`}
              </Button>
            </div>
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
          <div className="space-y-6 rounded-2xl border border-[#d66666]/20 bg-[#0b0b0f] p-6 lg:sticky lg:top-4 lg:self-start">
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

              <p className="mt-2 text-sm text-zinc-400">
                {stage.label}
              </p>
            </div>

            <div className="border-t border-zinc-800" />

            <TabsList className="flex h-auto w-full flex-col gap-2 bg-transparent p-0">
              <TabsTrigger
                value="form"
                className="w-full justify-start rounded-lg border border-transparent bg-zinc-900/70 text-white data-[state=active]:border-[#d66666]/30 data-[state=active]:bg-[#141419] data-[state=active]:text-[#ff8a8a]"
              >
                Form
              </TabsTrigger>

              <TabsTrigger
                value="team"
                className="w-full justify-start rounded-lg border border-transparent bg-zinc-900/70 text-white data-[state=active]:border-[#d66666]/30 data-[state=active]:bg-[#141419] data-[state=active]:text-[#ff8a8a]"
              >
                Team
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <TabsContent value="form" className="mt-0">
            <div className="rounded-2xl border border-[#d66666]/20 bg-[#0b0b0f] p-6 text-white sm:p-8">
              <div className="mb-8">
                <p className="text-sm uppercase tracking-[0.2em] text-[#d66666]">
                  Form
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-white">
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
                      disabled={isSubmitting}
                      className=" bg-[#d66666] py-4 text-base font-semibold text-zinc-900 hover:bg-[#e57f7f]"
                    >
                      {isSubmitting ? 'Saving...' : `Save ${stage.label}`}
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
