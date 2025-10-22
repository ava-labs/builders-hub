export interface IUpdateSponsorProfileBody {
  first_name: string;
  last_name: string;
  username: string;
  profile_image: string;
  location: string;
  company_name: string;
  company_user_name: string;
  website: string;
  logo: string;
  twitter_url: string;
  short_bio: string;
  industry: string;
}

export interface IUpdateTalentProfileBody {
  first_name: string;
  last_name: string;
  username: string;
  profile_image: string;
  location: string;
  job_title: string;
  skill_ids: string[];
  social_links: string[];
  wallet_address: string;
  years_of_experience: string;
  bio: string;
  telegram_user: string;
  profile_privacy: string;
  notifications: boolean;
}

export interface ISkillsResponse {
  id: string;
  name: string;
}
