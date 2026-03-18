export type HackathonStage = {
  label: string;
  date: string;
  deadline: string;
  component: StageComponent | undefined;
};

export type StageComponent = CardComponent | TagsComponent;

export type CardComponent = {
  type: "cards";
  cards: {
    icon: string;
    title: string;
    description: string;
  }[];
};

export type TagsComponent = {
  type: "tags";
  title: string;
  description: string;
  tags: TagItem[];
};

export type TagItem = {
    icon: string;
    title: string;
    description: string;
}
