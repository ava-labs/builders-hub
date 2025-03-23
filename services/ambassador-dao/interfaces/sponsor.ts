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
