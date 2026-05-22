// View-model types for the profile shell UI.
// Decoupled from the backend Profile shape so the form components can stay simple.

export type ProfileRole =
  | "university"
  | "founder"
  | "developer"
  | "employee"
  | "enthusiast";

export type SkillCategory = "lang" | "chain" | "tool";

export interface ProfileSkill {
  name: string;
  category: SkillCategory;
}

export type ProfileLinkKind = "x" | "linkedin" | "website";

export interface ProfileLink {
  kind: ProfileLinkKind;
  url: string;
}

export interface ProfileWallet {
  address: string;
  tag?: string;
  label?: string;
  balance?: string;
  primary?: boolean;
}

export interface ReferralLinkVM {
  id: string;
  targetId: string;
  targetName: string;
  targetIcon: "rocket" | "trophy" | "code" | "gift";
  url: string;
  shareUrl: string;
  clicks: number;
  signups: number;
}

export interface ReferralTargetVM {
  id: string;
  name: string;
  description: string;
  icon: "rocket" | "trophy" | "code" | "gift";
}
