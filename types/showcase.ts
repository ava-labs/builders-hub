export type Project = {
  id: string
  name: string;
  isWinner: boolean;
  bannerUrl: string;
  logoUrl: string;
  shortDescription: string;
  description: string
  liveDemoUrl: string
  sourceCodeUrl: string
  event: ProjectEvent
  tracks: string[];
  gallery: string[]
};

export type ProjectEvent = {
  name: string;
  location: string;
  year: number;
}
