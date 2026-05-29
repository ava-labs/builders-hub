import {
  type ChipsStagesSubmitFormField,
  type LinkStagesSubmitFormField,
  type TextStagesSubmitFormField,
  type BooleanStagesSubmitFormField,
  type ImageStagesSubmitFormField,
  MultiSelectStagesSubmitFormField,
  SubmitFormFieldType,
} from '@/types/hackathon-stage';

export function createTextStagesSubmitFormField(id?: string): TextStagesSubmitFormField {
  return {
    id: id ?? crypto.randomUUID(),
    type: SubmitFormFieldType.Text,
    label: '',
    placeholder: 'Place your text',
    description: '',
    maxCharacters: 100,
    required: false,
  };
}

export function createLinkStagesSubmitFormField(id?: string): LinkStagesSubmitFormField {
  return {
    id: id ?? crypto.randomUUID(),
    type: SubmitFormFieldType.Link,
    label: '',
    placeholder: 'Enter a URL',
    description: '',
    maxLinks: 1,
    required: false,
  };
}

export function createChipsStagesSubmitFormField(id?: string): ChipsStagesSubmitFormField {
  return {
    id: id ?? crypto.randomUUID(),
    type: SubmitFormFieldType.Chips,
    label: '',
    description: 'Select options',
    required: false,
    chips: [],
  };
}
export function createMultiSelectStagesSubmitFormField(id?: string): MultiSelectStagesSubmitFormField {
  return {
    id: id ?? crypto.randomUUID(),
    type: SubmitFormFieldType.MultiSelect,
    label: '',
    description: '',
    placeholder: 'Select multiple options',
    required: false,
    options: [],
    maxSelections: null,
  };
}

export function createBooleanStagesSubmitFormField(id?: string): BooleanStagesSubmitFormField {
  return {
    id: id ?? crypto.randomUUID(),
    type: SubmitFormFieldType.Boolean,
    label: '',
    description: '',
    required: false,
  };
}

export function createImageStagesSubmitFormField(id?: string): ImageStagesSubmitFormField {
  return {
    id: id ?? crypto.randomUUID(),
    type: SubmitFormFieldType.Image,
    label: '',
    description: '',
    required: false,
    maxImages: 1,
    maxSizeMb: 2,
  };
}
