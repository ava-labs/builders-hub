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
  "Algeria",
  "Angola",
  "Argentina",
  "Australia",
  "Austria",
  "Belgium",
  "Benin",
  "Bolivia",
  "Botswana",
  "Brazil",
  "Burkina Faso",
  "Burundi",
  "Cameroon",
  "Canada",
  "Cape Verde",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Costa Rica",
  "Cuba",
  "Czech Republic",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Eswatini",
  "Ethiopia",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Germany",
  "Ghana",
  "Greece",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Honduras",
  "Hungary",
  "India",
  "Indonesia",
  "Ireland",
  "Israel",
  "Italy",
  "Ivory Coast",
  "Japan",
  "Kenya",
  "Lesotho",
  "Liberia",
  "Libya",
  "Madagascar",
  "Malawi",
  "Mali",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Morocco",
  "Mozambique",
  "Namibia",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "Norway",
  "Pakistan",
  "Panama",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Republic of the Congo",
  "Romania",
  "Russia",
  "Rwanda",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sudan",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Tanzania",
  "Thailand",
  "Togo",
  "Tunisia",
  "Turkey",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Venezuela",
  "Vietnam",
  "Zambia",
  "Zimbabwe",
];

