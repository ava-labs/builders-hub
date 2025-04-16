export interface ICreateOpportunityBody {
  title: string;
  description: string;
  type: "JOB" | "BOUNTY";
  category: "PUBLIC" | "PRIVATE";
  start_date: Date | null;
  end_date: Date | null;
  requirements: string;
  max_winners: number;
  total_budget: number;
  skill_ids: string[];
  file_ids?: string[];
  custom_questions?: string[];
  point_of_contact: string;
  point_of_contact_email: string;
  prize_distribution?: {
    position: number;
    endPosition?: number;
    amount: number;
  }[];
  should_publish: boolean;
}

export interface IOppotunityListingResponse {
  data: IOpportunityListing[];
  metadata: {
    current_page: number;
    last_page: number;
    next_page: number;
    per_page: number;
    prev_page: number;
    total: number;
  };
}

export interface IOpportunityListing {
  id: string;
  title: string;
  description: string;
  type: "JOB" | "BOUNTY";
  category: string;
  status: "ALL" | "DRAFT" | "OPEN" | "IN_REVIEW" | "COMPLETED" | "PUBLISHED";
  start_date: string;
  end_date: string;
  created_at: string;
  total_budget: number;
  requirements: string;
  max_winners: number;
  updated_at: Date;
  point_of_contact: string;
  point_of_contact_email: string;
  skills: {
    id: string;
    name: string;
  }[];
  rewards: {
    id: string;
    position: number;
    amount: number;
    payment_status: "PENDING" | "COMPLETED" | "FAILED";
    payment_date: Date | null;
    transaction_id: string | null;
    user_id: string | null;
    submission_id: string | null;
    created_at: string;
    updated_at: string;
  }[];
  _count: {
    submissions: number;
    applications: number;
  };
  prize_distribution?: {
    position: number;
    endPosition?: number;
    amount: number;
  }[];
  custom_questions?: string[];
  files: string[];
  created_by: {
    id: string;
    first_name: string;
    last_name: string;
    username: string;
    profile_image: string;
    company_profile: {
      name: string;
      logo: string;
    };
  };
}

export enum OpportunityApplicationStatus {
  ALL = "ALL",
  APPLIED = "APPLIED",
  IN_REVIEW = "IN_REVIEW",
  REJECTED = "REJECTED",
  PUBLISHED = "PUBLISHED",
  APPROVED = "APPROVED",
  COMPLETED = "COMPLETED",
  WITHDRAWN = "WITHDRAWN",
}

export enum OpportunitySubmissionStatus {
  ALL = "ALL",
  SUBMITTED = "SUBMITTED",
  PUBLISHED = "PUBLISHED",
  IN_REVIEW = "IN_REVIEW",
  REJECTED = "REJECTED",
  ACCEPTED = "ACCEPTED",
  REWARDED = "REWARDED",
}

export interface IOppotunityApplicationsResponse {
  data: {
    id: string;
    cover_letter: string;
    status: OpportunityApplicationStatus;
    created_at: Date;
    updated_at: Date;
    custom_answers: {
      question: string;
      answer: string;
    }[];
    telegram_username: string;
    extra_data: null;
    applicant: {
      id: string;
      first_name: string;
      last_name: string;
      username: string;
      profile_image: string | null;
      email: string;
      role: string;
      status: "VERIFIED" | "PENDING" | "REJECTED" | "SUSPENDED";
      skills:
        | {
            id: string;
            name: string;
          }[]
        | undefined;
      years_of_experience: string;
      social_links: string[];
      job_title: string;
    };
    files: {
      id: string;
      filename: string;
      original_name: string;
      size: number;
      mime_type: string;
    }[];
  }[];
  metadata: {
    current_page: number;
    last_page: number;
    next_page: number;
    per_page: number;
    prev_page: number;
    total: number;
  };
}

export interface IOppotunitySubmissionsResponse {
  data: {
    id: string;
    content: string;
    status: OpportunitySubmissionStatus;
    feedback: string | null;
    created_at: Date;
    updated_at: Date;
    submitter: {
      id: string;
      first_name: string;
      last_name: string;
      username: string;
      profile_image: string | null;
      status: "VERIFIED" | "PENDING" | "REJECTED" | "SUSPENDED";
      role: string | null;
      skills:
        | {
            id: string;
            name: string;
          }[]
        | undefined;
      years_of_experience: string;
      job_title: string;
    };
    files: string[];
  }[];
  metadata: {
    current_page: number;
    last_page: number;
    next_page: number;
    per_page: number;
    prev_page: number;
    total: number;
  };
}

export interface ISingleOppotunityApplicationResponse {
  id: string;
  cover_letter: string;
  status: OpportunityApplicationStatus;
  created_at: Date;
  updated_at: Date;
  extra_data: string | null;
  custom_answers: {
    question: string;
    answer: string;
  }[];
  feedback: string | null;
  user_id: string;
  opportunity_id: string;
  opportunity: {
    id: string;
    user_id: string;
    type: "JOB" | "BOUNTY";
  };
  telegram_username: string;
  files: {
    id: string;
    filename: string;
    original_name: string;
  }[];
  applicant_number_of_completed_jobs: string;
  applicant: {
    id: string;
    first_name: string;
    last_name: string;
    username: string;
    profile_image: string | null;
    location: string;
    email: string;
    role: string;
    status: "VERIFIED" | "PENDING" | "REJECTED" | "SUSPENDED";
    skills: {
      id: string;
      name: string;
    }[];
    socials: string[];
    social_links: string[];
    years_of_experience: string;
    job_title: string;
  };
}

export interface ISingleOppotunitySubmissionResponse {
  id: string;
  cover_letter: string;
  content: string;
  status: OpportunitySubmissionStatus;
  created_at: Date;
  updated_at: Date;
  extra_data: string | null;
  custom_answers: {
    question: string;
    answer: string;
  }[];
  telegram_username: string;
  feedback: string | null;
  user_id: string;
  opportunity_id: string;
  opportunity: {
    id: string;
    user_id: string;
    type: "JOB" | "BOUNTY";
  };
  files: {
    id: string;
    filename: string;
    original_name: string;
  }[];
  link: string;
  tweet_link: string;
  submitter: {
    id: string;
    first_name: string;
    last_name: string;
    username: string;
    profile_image: string | null;
    location: string;
    email: string;
    role: string;
    status: "VERIFIED" | "PENDING" | "REJECTED" | "SUSPENDED";
    skills: {
      id: string;
      name: string;
    }[];
    years_of_experience: string;
    socials: string[];
    social_links: string[];
    job_title: string;
  };
}

export interface ILeaderboardResponse {
  metadata: {
    total: number;
    last_page: number;
    current_page: number;
    per_page: number;
  };
  data: {
    id: string;
    clientId: string;
    tag: string;
    nickname: string;
    points: number;
  }[];
}
