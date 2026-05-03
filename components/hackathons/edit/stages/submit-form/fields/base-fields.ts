import { SubmitFormField, SubmitFormFieldType } from '@/types/hackathon-stage';

export const BASE_SUBMIT_FORM_FIELDS = {
  projectName: {
    label: 'Project Name',
    field: {
      id: crypto.randomUUID(),
      type: SubmitFormFieldType.Text,
      label: 'Project Name',
      placeholder: 'Enter the project name',
      description: 'The name of the project being submitted.',
      maxCharacters: 40,
      required: true,
      projectColumnName: 'projectName',
    },
  },
  shortDescription: {
    label: 'Short Description',
    field: {
      id: crypto.randomUUID(),
      type: SubmitFormFieldType.Text,
      label: 'Short Description',
      placeholder: 'Enter a short description',
      description: 'A brief overview of the project.',
      maxCharacters: 100,
      required: true,
      projectColumnName: 'shortDescription',
    },
  },
  fullDescription: {
    label: 'Full Description',
    field: {
      id: crypto.randomUUID(),
      type: SubmitFormFieldType.Text,
      label: 'Full Description',
      placeholder: 'Enter a full description',
      description: 'A detailed overview of the project.',
      maxCharacters: 200,
      required: true,
      projectColumnName: 'fullDescription',
    },
  },
} satisfies Record<
  string,
  {
    label: string;
    field: SubmitFormField;
  }
>;

export type BaseSubmitFormFieldKey = keyof typeof BASE_SUBMIT_FORM_FIELDS;
