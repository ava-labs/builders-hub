// Wizard chip vocabularies, verbatim from the design package (Project
// Portal.dc.html artboards 1a/1b, verified against live Areta 07-29). One
// source for the wizard, the auditor-facing meta strips, and the admin
// services chips; do not fork these lists locally.

import type { DeploymentTarget, UrgencyOption } from "@/lib/audits/status";

export const AUDIT_PROJECT_TYPES = [
  "DeFi protocol",
  "Interoperability",
  "Yield / staking",
  "NFT platform",
  "Governance / DAO tools",
  "Basic token contract",
  "L1 / L2 protocol",
  "Wallet / key management",
  "Bridge / cross-chain",
  "Other",
] as const;
export type AuditProjectType = (typeof AUDIT_PROJECT_TYPES)[number];

export const AUDIT_SERVICES = [
  "Smart contract audit (Solidity / Vyper)",
  "Protocol audit (Go / Rust)",
  "Formal verification",
  "Invariant specification",
  "Cryptography / privacy",
  "Frontend audit",
  "Financial math review",
  "Bug bounty setup",
  "Audit contest",
  "Onchain monitoring",
  "OpSec",
  "Other",
] as const;
export type AuditService = (typeof AUDIT_SERVICES)[number];

export const AUDIT_LANGUAGES = ["Solidity", "Rust", "Go", "Vyper", "TypeScript"] as const;
export type AuditLanguage = (typeof AUDIT_LANGUAGES)[number];

export const AUDIT_FRAMEWORKS = ["Foundry", "Hardhat", "Ape"] as const;
export type AuditFramework = (typeof AUDIT_FRAMEWORKS)[number];

export const DEPLOYMENT_TARGET_LABELS: Record<DeploymentTarget, string> = {
  c_chain: "C-Chain",
  own_l1: "Own L1",
  fuji_only: "Fuji only",
};

export const URGENCY_LABELS: Record<UrgencyOption, string> = {
  within_3_weeks: "Must start within 3 weeks",
  within_6_weeks: "Within 6 weeks",
  flexible: "Flexible",
};

// Verbatim helper copy the designs repeat; kept here so screens cannot drift.
export const QUOTE_DEADLINE_DEFAULT_DAYS = 10;
/** A quote's duration ceiling: one year. Shared so the composer's message and
    the schema's cap can never drift apart. */
export const MAX_QUOTE_WEEKS = 52;
/** Approved teammate addresses per firm, on top of the quote email. Bounds the
    invite blast radius of one admin mistake; raise here if a firm needs more. */
export const AUDITOR_MEMBER_LIMIT = 10;
export const QUOTE_DEADLINE_HELPER_COPY =
  "Defaulted to +10 days · the recommended window for competitive quotes.";
