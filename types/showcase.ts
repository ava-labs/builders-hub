export type Project = {
  name: string;
  isWinner: boolean;
  bannerUrl: string;
  shortDescription: string;
  event: {
    name: string;
    location: string;
    year: number;
  };
  tracks: string[]; 
};
