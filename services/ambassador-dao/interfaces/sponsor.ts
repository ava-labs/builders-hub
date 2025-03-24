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
  prize_distribution?: {
    position: number;
    endPosition?: number;
    amount: number;
  }[];
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
  status: "ALL" | "DRAFT" | "OPEN" | "IN_REVIEW" | "COMPLETED";
  start_date: string;
  end_date: string;
  created_at: string;
  total_budget: number;
  requirements: string;
  max_winners: number;
  updated_at: Date;
  skills: {
    id: string;
    name: string;
  }[];
  rewards: {
    id: string;
    position: number;
    amount: number;
    payment_status: "PENDING" | "PAYMENT_COMPLETED";
    payment_date: Date | null;
    transaction_id: string | null;
    user_id: string | null;
    submission_id: string | null;
    created_at: string;
    updated_at: string;
  }[];
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

export interface IOppotunityApplicationsResponse {
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
