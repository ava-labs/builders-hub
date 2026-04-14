import {
  createChipsStagesSubmitFormField,
  createTextStagesSubmitFormField,
} from '@/lib/hackathons/stage-submit-form-fields'
import { SubmitFormField } from '@/types/hackathon-stage'

export type GoogleFormsGetResponse = {
  items?: GoogleFormItem[]
}

type GoogleFormItem = {
  title?: string
  description?: string
  questionItem?: {
    question?: GoogleFormQuestion
  }
  imageItem?: unknown
  videoItem?: unknown
  pageBreakItem?: unknown
  textItem?: unknown
  groupItem?: unknown
}

type GoogleFormQuestion = {
  required?: boolean
  textQuestion?: Record<string, unknown> | null
  paragraphQuestion?: Record<string, unknown> | null
  choiceQuestion?: {
    options?: Array<{ value?: string }>
  }
  scaleQuestion?: unknown
  dateQuestion?: unknown
  timeQuestion?: unknown
  fileUploadQuestion?: unknown
  rowQuestion?: unknown
}

export function parseGoogleFormIdFromInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  const fromUrl = trimmed.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/)
  if (fromUrl?.[1]) {
    return fromUrl[1]
  }
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return trimmed
  }
  return null
}

export function mapGoogleFormToSubmitFields(form: GoogleFormsGetResponse): {
  fields: SubmitFormField[]
  warnings: string[]
} {
  const fields: SubmitFormField[] = []
  const warnings: string[] = []
  const items = form.items ?? []

  for (const item of items) {
    const title = (item.title ?? '').trim() || 'Untitled question'

    if (item.imageItem) {
      warnings.push(`Skipped image block: "${title}"`)
      continue
    }
    if (item.videoItem) {
      warnings.push(`Skipped video block: "${title}"`)
      continue
    }
    if (item.pageBreakItem) {
      warnings.push('Skipped page break')
      continue
    }
    if (item.textItem) {
      warnings.push(`Skipped info text (not a question): "${title}"`)
      continue
    }
    if (item.groupItem) {
      warnings.push(`Skipped question group: "${title}"`)
      continue
    }

    const question = item.questionItem?.question
    if (!question) {
      continue
    }

    const description = (item.description ?? '').trim()
    const required = Boolean(question.required)

    if (question.paragraphQuestion != null) {
      const f = createTextStagesSubmitFormField()
      f.label = title
      f.description = description
      f.required = required
      f.rows = 4
      fields.push(f)
      continue
    }

    if (question.textQuestion != null) {
      const f = createTextStagesSubmitFormField()
      f.label = title
      f.description = description
      f.required = required
      fields.push(f)
      continue
    }

    if (question.choiceQuestion) {
      const chips = extractChoiceOptionValues(question.choiceQuestion)
      const f = createChipsStagesSubmitFormField()
      f.label = title
      f.description = description
      f.required = required
      f.chips = chips
      if (chips.length === 0) {
        warnings.push(
          `Choice question had no options, imported empty chips: "${title}"`
        )
      }
      fields.push(f)
      continue
    }

    if (question.scaleQuestion != null) {
      warnings.push(`Unsupported linear scale (skipped): "${title}"`)
      continue
    }
    if (question.dateQuestion != null) {
      warnings.push(`Unsupported date question (skipped): "${title}"`)
      continue
    }
    if (question.timeQuestion != null) {
      warnings.push(`Unsupported time question (skipped): "${title}"`)
      continue
    }
    if (question.fileUploadQuestion != null) {
      warnings.push(`Unsupported file upload (skipped): "${title}"`)
      continue
    }
    if (question.rowQuestion != null) {
      warnings.push(
        `Unsupported grid / multiple choice grid (skipped): "${title}"`
      )
      continue
    }

    warnings.push(`Unsupported or empty question (skipped): "${title}"`)
  }

  return { fields, warnings }
}

function extractChoiceOptionValues(choice: {
  options?: Array<{ value?: string }>
}): string[] {
  const out: string[] = []
  for (const opt of choice.options ?? []) {
    if (typeof opt.value === 'string' && opt.value.trim()) {
      out.push(opt.value.trim())
    }
  }
  return out
}
