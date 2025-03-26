export interface IUserDetails {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  profile_image: string | null;
  role: string | null;
  created_at: Date | null;
  status: "VERIFIED" | "PENDING" | "REJECTED" | "SUSPENDED";
}

export interface IVerifiedDetails {
  user: IUserDetails;
  tokens: {
    access_token: string;
    refresh_token: string;
  };
  is_new_user: boolean;
}

export interface IUserStats {
  total_submissions: number;
  total_applications: number;
  total_bounties_won: number;
  total_earnings: number;
}

export interface ISponsorStats {
  total_listings: number;
  total_submissions: number;
  total_rewards: number;
}
