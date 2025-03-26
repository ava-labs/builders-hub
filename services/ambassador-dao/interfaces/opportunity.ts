export interface IJobDataType {
  job: {
    id: number;
    title: string;
    company: string;
    duration: string;
    proposals: number;
    reward: number;
    currency: string;
    total_budget: string;
    end_date: string;
    created_by: {
      company_profile: {
        name: string;
        logo: string;
      };
    };
    skills: [
      {
        id: string;
        name: string;
      }
    ];
    _count:{
      applications: number;
    }
  };
}

export interface IBountyDataType {
  bounty: {
    id: number;
    title: string;
    company: string;
    duration: string;
    proposals: number;
    reward: number;
    currency: string;
    total_budget: string;
    end_date: string;
    created_by: {
      company_profile: {
        name: string;
        logo: string;
      };
    };
    skills: [
      {
        id: string;
        name: string;
      }
    ];
    _count:{
      submissions: number
    }
  };
}

export interface IJobApplicationBody {
  telegram_username: string;
  cover_letter: string;
  file_ids: string[];
  custom_question_answers: Array<{
    question: string;
    answer: string;
  }>;
}

export interface IBountySubmissionBody {
  submission_link: string;
  tweet_link: string | undefined;
  content: string | undefined;
}
