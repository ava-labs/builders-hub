interface ScoreCriterion {
  key: string;
  label: string;
}

interface StageField {
  key: string;
  label: string;
}

interface StageConfig {
  label: string;
  fields: StageField[];
}

export interface EventConfig {
  scoreCriteria: ScoreCriterion[];
  stageFields?: Record<string, StageConfig>;
  formDataKey?: string;
  categoryField?: string;
  applicantFields?: {
    areaOfFocus?: string;
  };
  stageKeys?: Record<number, string[]>;
  applicationDetailSections?: {
    title: string;
    fields: { key: string; label: string; long?: boolean }[];
  }[];
}

export const EVENT_CONFIGS: Record<string, EventConfig> = {
  build_games: {
    scoreCriteria: [
      { key: "innovation", label: "Innovation" },
      { key: "feasibility", label: "Feasibility" },
      { key: "execution", label: "Execution" },
      { key: "impact", label: "Impact" },
    ],
    stageFields: {
      "Stage 1 - Idea": {
        label: "Stage 1 - Idea",
        fields: [
          { key: "game_type", label: "Game Type" },
          { key: "game_genre", label: "Game Genre" },
          { key: "game_loop", label: "Game Loop" },
          { key: "web3_gaming_integration", label: "Web3 Gaming Integration" },
          { key: "player_motivation", label: "Player Motivation" },
          { key: "game_economy", label: "Game Economy" },
          { key: "target_player", label: "Target Player" },
          { key: "problem_statement", label: "Problem Statement" },
          { key: "user_persona", label: "User Persona" },
          { key: "current_solutions", label: "Current Solutions" },
          { key: "proposed_solution", label: "Proposed Solution" },
          { key: "onchain_trigger", label: "On-Chain Trigger" },
          { key: "architecture_overview", label: "Architecture Overview" },
          { key: "user_journey", label: "User Journey" },
          { key: "moscow_framework", label: "MoSCoW Framework" },
          { key: "existing_project_plan", label: "Existing Project Plan" },
          { key: "existing_achievements", label: "Existing Achievements" },
        ],
      },
      "Stage 2 - MVP": {
        label: "Stage 2 - MVP",
        fields: [
          { key: "game_playable_state", label: "Playable State" },
          { key: "game_smart_contracts", label: "Smart Contracts" },
          { key: "game_onboarding", label: "Onboarding" },
          { key: "game_playtesting", label: "Playtesting" },
        ],
      },
      "Stage 3 - GTM & Vision": {
        label: "Stage 3 - GTM & Vision",
        fields: [
          { key: "game_acquisition", label: "Acquisition Strategy" },
          { key: "game_community", label: "Community Building" },
          { key: "game_monetization", label: "Monetization" },
          { key: "game_competitors", label: "Competitor Analysis" },
        ],
      },
      "Stage 4 - Finals": {
        label: "Stage 4 - Finals",
        fields: [
          { key: "game_metrics", label: "Metrics" },
          { key: "game_vision", label: "Long-term Vision" },
        ],
      },
    },
    formDataKey: "build_games",
    categoryField: "area_of_focus",
    applicantFields: {
      areaOfFocus: "area_of_focus",
    },
    stageKeys: {
      1: ["game_type", "problem_statement", "proposed_solution", "architecture_overview"],
      2: ["game_playable_state", "game_smart_contracts", "game_onboarding"],
      3: ["game_acquisition", "game_community", "game_monetization"],
      4: ["game_metrics", "game_vision"],
    },
    applicationDetailSections: [
      {
        title: "Personal Info",
        fields: [
          { key: "first_name", label: "First Name" },
          { key: "last_name", label: "Last Name" },
          { key: "email", label: "Email" },
          { key: "country", label: "Country" },
          { key: "telegram", label: "Telegram" },
          { key: "github", label: "GitHub" },
          { key: "employment_status", label: "Employment Status" },
          { key: "current_role", label: "Current Role" },
          { key: "university_affiliation", label: "University" },
          { key: "avalanche_ecosystem_member", label: "Ecosystem Member" },
        ],
      },
      {
        title: "Project Info",
        fields: [
          { key: "project_name", label: "Project Name" },
          { key: "area_of_focus", label: "Area of Focus" },
          { key: "project_description", label: "Description", long: true },
          { key: "why_you", label: "Why You", long: true },
          { key: "ready_to_win", label: "Ready to Win" },
        ],
      },
      {
        title: "Experience",
        fields: [
          { key: "previous_avalanche_grant", label: "Previous Avalanche Grant" },
          { key: "hackathon_experience", label: "Hackathon Experience" },
          { key: "hackathon_details", label: "Hackathon Details", long: true },
        ],
      },
      {
        title: "Referral & Discovery",
        fields: [
          { key: "how_did_you_hear", label: "How Did You Hear" },
          { key: "how_did_you_hear_specify", label: "Specify" },
          { key: "referrer_name", label: "Referrer Name" },
          { key: "referrer_handle", label: "Referrer Handle" },
        ],
      },
    ],
  },
  infrabuild: {
    scoreCriteria: [
      { key: "innovation", label: "Innovation" },
      { key: "feasibility", label: "Feasibility" },
      { key: "impact", label: "Ecosystem Impact" },
      { key: "team", label: "Team Strength" },
    ],
    categoryField: "category",
    applicationDetailSections: [
      {
        title: "Grant Application",
        fields: [
          { key: "grant_program", label: "Program" },
          { key: "project_name", label: "Project Name" },
          { key: "category", label: "Category" },
          { key: "funding_amount", label: "Funding Requested" },
          { key: "team_size", label: "Team Size" },
          { key: "previous_grants", label: "Previous Grants" },
        ],
      },
      {
        title: "Project Details",
        fields: [
          { key: "project_description", label: "Description", long: true },
          { key: "milestones", label: "Milestones", long: true },
          { key: "github_url", label: "GitHub" },
          { key: "website", label: "Website" },
        ],
      },
    ],
  },
  retro9000: {
    scoreCriteria: [
      { key: "impact", label: "Ecosystem Impact" },
      { key: "usage", label: "Usage & Adoption" },
      { key: "quality", label: "Code Quality" },
      { key: "sustainability", label: "Sustainability" },
    ],
    categoryField: "contribution_type",
    applicationDetailSections: [
      {
        title: "Project Info",
        fields: [
          { key: "project_name", label: "Project Name" },
          { key: "contribution_type", label: "Contribution Type" },
          { key: "deployed_chain", label: "Deployed On" },
          { key: "github_url", label: "GitHub" },
          { key: "metrics", label: "Metrics" },
        ],
      },
      {
        title: "Impact",
        fields: [
          { key: "project_description", label: "Description", long: true },
          { key: "impact_description", label: "Impact", long: true },
        ],
      },
    ],
  },
};

export function getEventConfig(origin: string): EventConfig | null {
  return EVENT_CONFIGS[origin] ?? null;
}

export const DEFAULT_SCORE_CRITERIA: ScoreCriterion[] = [
  { key: "quality", label: "Quality" },
  { key: "innovation", label: "Innovation" },
  { key: "impact", label: "Impact" },
];
