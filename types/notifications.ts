export type Notification = 
  {
    audience: {
      all: boolean;
      hackathons: string[];
      users: string[];
    };
    type: string;
    title: string;
    short_description: string;
    content: string;
    content_type: string;
  }
