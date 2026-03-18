export interface IPartner {
  name: string;
  logo: string;
}

export interface IDataMain {
    title: string;
    description: string;
    location: string;
    total_prizes: number;
    tags: string[];
    participants?: number;
    organizers?: string;
    is_public?: boolean;
  }
  
  export interface ITrack {
    icon: string;
    logo: string;
    name: string;
    partner: string;
    description: string;
    short_description: string;
  }
  
  export interface ISchedule {
    url: string | null;
    date: string;
    name: string;
    category: string;
    location: string;
    description: string;
    duration: number;
  }
  
  export interface ISpeaker {
    icon: string;
    name: string;
    category: string;
    picture: string;
  }
  
  export interface IResource {
    icon: string;
    link: string;
    title: string;
    description: string;
  }
  
  export interface IDataContent {
    tracks: ITrack[];
    address: string;
    partners: IPartner[];
    schedule: ISchedule[];
    speakers: ISpeaker[];
    resources: IResource[];
    tracks_text: string;
    speakers_text: string;
    speakers_banner: string;
    join_custom_link: string;
    join_custom_text: string | null;
    become_sponsor_link: string;
    submission_custom_link: string | null;
    judging_guidelines: string;
    submission_deadline: string;
    registration_deadline: string;
  }
  
  export interface IDataLatest {
    start_date: string;
    end_date: string;
    timezone: string;
    banner: string;
    icon: string;
    small_banner: string;
  }
  
  export const initialData = {
      main: {
          title: '',
          description: '',
          location: '',
          total_prizes: 0,
          tags: [''],
          participants: 0,
          organizers: '',
          is_public: false,
      },
      content: {
          tracks: [
            {
              icon: '',
              logo: '',
              name: '',
              partner: '',
              description: '',
              short_description: '',
            },
          ],
          address: '',
          partners: [{ name: '', logo: '' }],
          schedule: [
            {
              url: null,
              date: '',
              name: '',
              category: '',
              location: '',
              description: '',
              duration: 0,
            },
          ],
          speakers: [],
          resources: [
            {
              icon: '',
              link: '',
              title: '',
              description: '',
            },
          ],
          tracks_text: '',
          speakers_text: '',
          speakers_banner: '',
          join_custom_link: '',
          join_custom_text: "Join now",
          become_sponsor_link: '',
          submission_custom_link: null,
          judging_guidelines: '',
          submission_deadline: '',
          registration_deadline: '',
      },
      latest: {
          start_date: '',
          end_date: '',
          timezone: '',
          banner: '',
          icon: '',
          small_banner: '',
      }
  }