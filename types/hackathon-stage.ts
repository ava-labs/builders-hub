export type HackathonStage = {
  label: string;
  date: string;
  deadline: string;
  component?: StageComponent;
  submitForm?: StageSubmitForm;
};

export type StageComponent = CardComponent | TagsComponent;

export type CardComponent = {
  type: 'cards';
  cards: {
    icon: string;
    title: string;
    description: string;
  }[];
};

export type TagsComponent = {
  type: 'tags';
  title: string;
  description: string;
  tags: TagItem[];
};

export type TagItem = {
  icon: string;
  title: string;
  description: string;
};

export enum SubmitFormFieldType {
  Predefined = 'predefined',
  Text = 'text',
  Link = 'link',
  Chips = 'chips',
  MultiSelect = 'multiSelect',
}

export type TextStagesSubmitFormField = {
  id: string;
  type: SubmitFormFieldType.Text;
  label: string;
  placeholder: string;
  description: string;
  required: boolean;
  maxCharacters: number | null;
};

export type LinkStagesSubmitFormField = {
  id: string;
  type: SubmitFormFieldType.Link;
  label: string;
  placeholder: string;
  description: string;
  required: boolean;
};

export type ChipsStagesSubmitFormField = {
  id: string;
  type: SubmitFormFieldType.Chips;
  label: string;
  description: string;
  required: boolean;
  chips: string[];
};

export type MultiSelectStagesSubmitFormField = {
  id: string;
  type: SubmitFormFieldType.MultiSelect;
  label: string;
  description?: string | null;
  placeholder: string;
  required: boolean;
  options: string[];
  maxSelections?: number | null;
};

export type SubmitFormField = (
  | TextStagesSubmitFormField
  | LinkStagesSubmitFormField
  | ChipsStagesSubmitFormField
  | MultiSelectStagesSubmitFormField
) & {
  predefinedField?: boolean;
};

export type StageSubmitForm = {
  fields: SubmitFormField[];
};
