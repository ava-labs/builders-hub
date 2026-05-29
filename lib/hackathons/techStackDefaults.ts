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
];

export interface TechStackOption {
  name: string;
}

export function getTechStackOptions(
  hackathon: Pick<Hackathon, "tech_stack_options"> | null | undefined,
): TechStackOption[] {
  const customized = hackathon?.tech_stack_options;
  if (Array.isArray(customized) && customized.length > 0) {
    return customized.filter((opt) => opt?.name?.trim()).map((opt) => ({ name: opt.name.trim() }));
  }
  return DEFAULT_TECH_STACK_OPTIONS;
}
