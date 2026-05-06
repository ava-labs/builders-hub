import { SubmitFormField, SubmitFormFieldType } from '@/types/hackathon-stage';

export const BASE_SUBMIT_FORM_FIELDS = {
  projectName: {
    label: 'Project Name',
    field: {
      id: 'projectName',
      type: SubmitFormFieldType.Text,
      label: 'Project Name',
      placeholder: 'Enter the project name',
      description: 'The name of the project being submitted.',
      maxCharacters: 40,
      predefinedField: true,
      required: true,
    },
  },
  shortDescription: {
    label: 'Short Description',
    field: {
      id: 'shortDescription',
      type: SubmitFormFieldType.Text,
      label: 'Short Description',
      placeholder: 'Enter a short description',
      description: 'A brief overview of the project.',
      maxCharacters: 100,
      predefinedField: true,
      required: true,
    },
  },
  fullDescription: {
    label: 'Full Description',
    field: {
      id: 'fullDescription',
      type: SubmitFormFieldType.Text,
      label: 'Full Description',
      placeholder: 'Enter a full description',
      description: 'A detailed overview of the project.',
      maxCharacters: 200,
      predefinedField: true,
      required: true,
    },
  },
  deployedAddress: {
    label: 'Deployed Address',
    field: {
      id: 'deployedAddress',
      type: SubmitFormFieldType.Text,
      label: 'Deployed Address',
      placeholder: 'Enter the deployed address',
      description: 'The address where the project is deployed.',
      maxCharacters: 200,
      predefinedField: true,
      required: true,
    },
  },
  categories: {
    label: 'Categories',
    field: {
      id: 'categories',
      type: SubmitFormFieldType.MultiSelect,
      label: 'Categories',
      description: 'Select the categories that best describe your project.',
      placeholder: 'Select categories',
      required: true,
      options: ['Consumer', 'Defi', 'Enterprise', 'Developer Tooling', 'RWA', 'Gaming', 'Social'],
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
