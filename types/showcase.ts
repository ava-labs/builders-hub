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
  members: ProjectMember[]
  resources: ProjectResource[]
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

export type ProjectMember = {
  imgUrl: string
  name: string
  role: string
}

export type ProjectResource = {
  icon: string
  title: string
  link: string
}
