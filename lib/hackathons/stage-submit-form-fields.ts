import {
  type ChipsStagesSubmitFormField,
  type LinkStagesSubmitFormField,
  type TextStagesSubmitFormField,
  SubmitFormFieldType,
} from '@/types/hackathon-stage'

export function createTextStagesSubmitFormField(
  id?: string
): TextStagesSubmitFormField {
  return {
    id: id ?? crypto.randomUUID(),
    type: SubmitFormFieldType.Text,
    label: '',
    placeholder: '',
    description: '',
    maxCharacters: null,
    required: false,
  }
}

export function createLinkStagesSubmitFormField(
  id?: string
): LinkStagesSubmitFormField {
  return {
    id: id ?? crypto.randomUUID(),
    type: SubmitFormFieldType.Link,
    label: '',
    placeholder: '',
    description: '',
    required: false,
  }
}

export function createChipsStagesSubmitFormField(
  id?: string
): ChipsStagesSubmitFormField {
  return {
    id: id ?? crypto.randomUUID(),
    type: SubmitFormFieldType.Chips,
    label: '',
    description: '',
    required: false,
    chips: [],
  }
}
