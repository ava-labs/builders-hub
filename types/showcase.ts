export type Project = {
  id: string
  name: string;
  isWinner: boolean;
  bannerUrl: string;
  logoUrl: string;
  videoUrl: string;
  shortDescription: string;
  description: string
  liveDemoUrl: string
  sourceCodeUrl: string
  event: ProjectEvent
  tracks: string[];
  gallery: string[]
  prices: ProjectPrice[]
};

export type ProjectEvent = {
  name: string;
  location: string;
  year: number;
}

export type ProjectPrice = {
  icon: string
  title: string
  description: string
}
