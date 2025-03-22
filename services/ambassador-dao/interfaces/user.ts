export interface IUserDetails {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  profile_image: string | null;
  role: string | null;
}

export interface IVerifiedDetails {
  user: IUserDetails;
  token: {
    access_token: string;
    refresh_token: string;
  };
  is_new_user: boolean;
}
