import { SubmitFormField, SubmitFormFieldType } from '@/types/hackathon-stage';

export const BASE_SUBMIT_FORM_FIELDS = {
  project_name: {
    label: 'Project Name',
    field: {
      id: 'project_name',
      type: SubmitFormFieldType.Text,
      label: 'Project Name',
      placeholder: 'Enter the project name',
      description: 'The name of the project being submitted.',
      maxCharacters: 40,
      predefinedField: true,
      required: true,
    },
  },
  short_description: {
    label: 'Short Description',
    field: {
      id: 'short_description',
      type: SubmitFormFieldType.Text,
      label: 'Short Description',
      placeholder: 'Enter a short description',
      description: 'A brief overview of the project.',
      maxCharacters: 100,
      predefinedField: true,
      required: true,
    },
  },
  full_description: {
    label: 'Full Description',
    field: {
      id: 'full_description',
      type: SubmitFormFieldType.Text,
      label: 'Full Description',
      placeholder: 'Enter a full description',
      description: 'A detailed overview of the project.',
      maxCharacters: 200,
      predefinedField: true,
      required: true,
    },
  },
  deployed_addresses: {
    label: 'Deployed Address',
    field: {
      id: 'deployed_addresses',
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
      predefinedField: true,
      required: true,
      options: ['Consumer', 'Defi', 'Enterprise', 'Developer Tooling', 'RWA', 'Gaming', 'Social'],
    },
  },
  github_repository: {
    label: 'GitHub Repository',
    field: {
      id: 'github_repository',
      type: SubmitFormFieldType.Link,
      label: 'GitHub Repository',
      description: 'Must be a valid GitHub repository URL (e.g., https://github.com/username/repo)',
      placeholder: 'Enter the GitHub repository URL',
      maxLinks: 1,
      predefinedField: true,
      required: true,
    },
  },
  demo_link: {
    label: 'Demo and Other Links',
    field: {
      id: 'demo_link',
      type: SubmitFormFieldType.Link,
      label: 'Demo and Other Links',
      description: 'Paste any project links (e.g., https://github.com/username/repo)',
      placeholder: 'Provide live demo, presentation, or any other relevant links',
      maxLinks: 10,
      predefinedField: true,
      required: true,
    },
  },
  explanation: {
    label: 'How It’s Made',
    field: {
      id: 'explanation',
      type: SubmitFormFieldType.Text,
      label: 'How It’s Made',
      description: 'Explain how your project works under the hood. Tech stack integrations, architecture decisions, etc.',
      placeholder: ' Describe the tech stack, architecture, and any unique technical aspects of your project.',
      predefinedField: true,
      maxCharacters: 1000,
      required: true,
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
