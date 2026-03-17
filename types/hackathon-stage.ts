export type HackathonStage = {
  label: string
  date: Date
  deadline: Date
  component: CardComponent | TagsComponent
};

type CardComponent = {
  icon: string
  title: string
  description: string
}
type TagsComponent = {
  icon: string
  title: string
  description: string
}