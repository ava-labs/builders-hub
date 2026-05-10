import type { ProfileRole, SkillCategory } from "./types";

export type IconKind =
  | "graduation"
  | "rocket"
  | "code"
  | "briefcase"
  | "sparkle"
  | "trophy"
  | "block"
  | "gift"
  | "compass";

export interface RoleSpec {
  id: ProfileRole;
  name: string;
  description: string;
  icon: IconKind;
}

export const ROLES: ReadonlyArray<RoleSpec> = [
  { id: "university", name: "University", description: "Student or affiliate", icon: "graduation" },
  { id: "founder", name: "Founder", description: "Building a startup", icon: "rocket" },
  { id: "developer", name: "Developer", description: "Ship code on-chain", icon: "code" },
  { id: "employee", name: "Employee", description: "Working at web3 co.", icon: "briefcase" },
  { id: "enthusiast", name: "Enthusiast", description: "Curious & exploring", icon: "sparkle" },
];

export const SKILL_SUGGESTIONS: ReadonlyArray<{ name: string; category: SkillCategory }> = [
  { name: "Solidity", category: "lang" },
  { name: "Rust", category: "lang" },
  { name: "TypeScript", category: "lang" },
  { name: "Subnets", category: "chain" },
  { name: "Avalanche L1", category: "chain" },
  { name: "Foundry", category: "tool" },
  { name: "Hardhat", category: "tool" },
  { name: "Wagmi", category: "tool" },
  { name: "viem", category: "tool" },
  { name: "Go", category: "lang" },
  { name: "Move", category: "lang" },
  { name: "ZK", category: "chain" },
];

const KNOWN_LANGUAGES = new Set([
  "solidity",
  "rust",
  "typescript",
  "javascript",
  "go",
  "python",
  "move",
  "vyper",
  "java",
  "c++",
  "c#",
  "ruby",
  "swift",
  "kotlin",
  "elixir",
  "haskell",
  "ocaml",
]);

const KNOWN_CHAINS = new Set([
  "subnets",
  "avalanche l1",
  "avalanche",
  "ethereum",
  "polygon",
  "solana",
  "cosmos",
  "near",
  "polkadot",
  "evm",
  "zk",
  "starknet",
  "rollup",
  "rollups",
  "optimism",
  "arbitrum",
]);

export function categorizeSkill(name: string): SkillCategory {
  const key = name.trim().toLowerCase();
  if (KNOWN_LANGUAGES.has(key)) return "lang";
  if (KNOWN_CHAINS.has(key)) return "chain";
  return "tool";
}

export const COUNTRIES: ReadonlyArray<string> = [
  "Argentina",
  "Australia",
  "Austria",
  "Belgium",
  "Brazil",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Czech Republic",
  "Denmark",
  "Egypt",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "India",
  "Indonesia",
  "Ireland",
  "Israel",
  "Italy",
  "Japan",
  "Kenya",
  "Mexico",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Pakistan",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Romania",
  "Russia",
  "Saudi Arabia",
  "Singapore",
  "South Africa",
  "South Korea",
  "Spain",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Thailand",
  "Turkey",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Vietnam",
];

