import type { Hackathon } from "@/types/hackathons";

export const DEFAULT_TECH_STACK_OPTIONS: { name: string }[] = [
  { name: "Solidity" },
  { name: "TypeScript" },
  { name: "React" },
  { name: "Next.js" },
  { name: "Node.js" },
  { name: "Rust" },
  { name: "Go" },
  { name: "Python" },
  { name: "PostgreSQL" },
  { name: "Foundry" },
  { name: "Hardhat" },
  { name: "wagmi" },
  { name: "viem" },
  { name: "Avalanche L1" },
  { name: "Docker" },
  { name: "x402" },
  { name: "Account Abstraction" },
];

export interface TechStackOption {
  name: string;
}

export function cleanTechStackOptions(
  options: readonly TechStackOption[] | null | undefined,
): TechStackOption[] {
  if (Array.isArray(options) && options.length > 0) {
    const cleaned = options
      .filter((opt) => opt?.name?.trim())
      .map((opt) => ({ name: opt.name.trim() }));
    if (cleaned.length > 0) return cleaned;
  }
  return DEFAULT_TECH_STACK_OPTIONS;
}

export function getTechStackOptions(
  hackathon: Pick<Hackathon, "tech_stack_options"> | null | undefined,
): TechStackOption[] {
  return cleanTechStackOptions(hackathon?.tech_stack_options);
}
