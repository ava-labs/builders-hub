/**
 * Design Patterns — real-world institutional builds that compose several of
 * the four pillars (privacy, interoperability, performance, compliance) into
 * one shippable architecture. Single source of truth for the /solutions
 * Design Patterns catalog and the pattern splash pages.
 *
 * Copy is verifiable against shipped protocol behavior and sanitized for
 * public release (no confidential partner terms). A story pass with comms
 * precedes production, same bar as pillars.ts.
 */

export interface PatternLink {
  text: string;
  href: string;
}

export type PillarSlug = "privacy" | "interoperability" | "performance" | "compliance";

export interface DesignPattern {
  slug: string;
  /** mono eyebrow, e.g. "CLEARING & SETTLEMENT" */
  label: string;
  title: string;
  /** one-liner for the catalog card and hero */
  tagline: string;
  metaDescription: string;
  status: "live" | "coming-soon";
  /** hero hook — one or two short paragraphs */
  intro: string[];
  /** the concepts this build composes, linked to the pillars they rest on */
  concepts: { pillar?: PillarSlug; label: string; role: string }[];
  problem?: { body: string; points: string[] };
  /** end-to-end flow; diagram id renders the hero instrument */
  flow?: { diagram?: string; phases: { label: string; detail: string }[] };
  elements?: { title: string; body: string }[];
  whyAvalanche?: { title: string; body: string }[];
  inProduction?: { name: string; sub: string; body: string }[];
  comparison?: {
    title: string;
    subtitle?: string;
    /** first header is the row-label column; the LAST column is the Avalanche approach (highlighted) */
    headers: string[];
    rows: { metric: string; values: string[] }[];
    footnote?: string;
  };
  whenToUse?: { use: string[]; avoid: string[] };
  faqs?: { question: string; answer: string }[];
  /** alternative to flow/elements — a tiered taxonomy (used by provenance) */
  tiers?: { name: string; tagline: string; description: string; bestFor: string; diagram?: string }[];
  resources: { heading: string; links: PatternLink[] }[];
}

export const PATTERNS: DesignPattern[] = [
  {
    slug: "interbank-tokenized-deposit-clearing",
    label: "CLEARING & SETTLEMENT",
    title: "Interbank Tokenized-Deposit Clearing",
    tagline:
      "A sovereign chain per institution, native interoperability, and no shared bridge.",
    metaDescription:
      "Clear tokenized deposits between institutions as a coordinated burn-and-mint verified chain-to-chain over Interchain Messaging — sovereign L1 per bank, no shared bridge, a light clearing entity that never sees customer ledgers.",
    status: "live",
    intro: [
      "A deposit at Bank A is not a deposit at Bank B — it's a claim on a different balance sheet. So moving tokenized deposits between institutions is not a token transfer.",
      "It's clearing — and it can run without a shared bridge, a central sequencer, or anyone seeing anyone else's books.",
    ],
    concepts: [
      {
        pillar: "interoperability",
        label: "Interoperability",
        role: "The receiving chain verifies the sender's burn at the protocol layer via Interchain Messaging — no bridge, no external attestor in the settlement path.",
      },
      {
        pillar: "privacy",
        label: "Privacy",
        role: "Each institution runs its own sovereign L1; intra-bank activity never leaves the building, and the clearing entity sees obligation status, never customer ledgers.",
      },
      {
        pillar: "compliance",
        label: "Compliance",
        role: "Permissioned member chains, ISO 20022 / travel-rule-grade payloads, and a supervisory audit copy for regulators — built into the message, not bolted on.",
      },
      {
        pillar: "performance",
        label: "Performance",
        role: "Sub-second, irreversible finality — a settlement system can't be built on probabilistic confirmation.",
      },
    ],
    problem: {
      body: "Interbank value transfer still runs through chains of correspondents: capital parked in pre-funded nostro accounts on every corridor, days of settlement delay, and reconciliation by message. Each side must be certain its counterparty executed its half — without seeing the other's customer ledger — and the corresponding reserves must still settle.",
      points: [
        "Capital parked in nostro accounts across every corridor.",
        "No shared view of transaction state — reconciliation by message and phone.",
        "Each hop adds delay, cost, and counterparty exposure.",
      ],
    },
    flow: {
      diagram: "burn-mint",
      phases: [
        { label: "Lock", detail: "Bank A locks the customer's deposit tokens and runs its compliance checks." },
        { label: "Burn", detail: "Bank A burns the tokens on its own chain — the claim on Bank A is destroyed." },
        { label: "Verify", detail: "Bank B's chain verifies Bank A's burn directly via Interchain Messaging — no bridge, no intermediary." },
        { label: "Mint", detail: "Bank B mints equivalent deposit tokens to the recipient — the commit point: before it, only rollback; after it, only completion." },
        { label: "Net & Settle", detail: "The clearing chain records the obligation status; positions are netted and settled per cycle over existing rails." },
      ],
    },
    elements: [
      {
        title: "Sovereign L1 per institution",
        body: "Each institution runs and governs its own compliant Avalanche L1, holding its deposits as tokens on its own chain. Intra-bank activity never leaves the building.",
      },
      {
        title: "Transfer = coordinated burn-and-mint",
        body: "A deposit is a claim on its issuer, so it can't simply move chains. The sender burns, the receiver mints, and each verifies the other's action directly, chain to chain.",
      },
      {
        title: "Unsafe states are unconstructable",
        body: "One authorization object governs each transfer. Before the mint commits, the transaction can only roll back; after it, only complete. The failure mode everyone fears — payer refunded while payee got paid — cannot be expressed.",
      },
      {
        title: "Light clearing entity",
        body: "A supervising operator sets network rules, keeps the canonical settlement record, nets positions, and resolves exceptions. It never custodies member assets, never sequences individual payments, and never sees a customer ledger.",
      },
    ],
    whyAvalanche: [
      {
        title: "Native interoperability, no bridge",
        body: "Interchain Messaging lets the receiving chain verify the sender's burn at the protocol layer. No third-party bridge, no external attestor in the settlement path.",
      },
      {
        title: "Sovereignty without isolation",
        body: "Permissioned L1s give each member its own validators, gas rules, and access control — while staying natively connected to every other member chain.",
      },
      {
        title: "Compliance-grade payloads",
        body: "ICM messages carry ISO 20022 / travel-rule-grade data, and a supervisory copy can be emitted for the clearing entity. The audit trail is immutable by construction.",
      },
      {
        title: "Deterministic finality",
        body: "Sub-second, irreversible finality — a settlement system can't be built on probabilistic confirmation.",
      },
      {
        title: "Custody-agnostic",
        body: "No network-wide custody mandate. Each institution keeps its own provider and key-management model — Fireblocks, BitGo, Copper, or in-house HSM.",
      },
      {
        title: "Core-banking alignment",
        body: "Every on-chain action mirrors a core-ledger entry — lock places a hold, mint credits, burn debits. The token is a synchronized representation of a liability the bank already carries.",
      },
    ],
    inProduction: [
      {
        name: "Lynq",
        sub: "Live on a dedicated Avalanche L1",
        body: "Institutional settlement network by Tassat, Arca and tZERO — real-time settlement, treasury and collateral management under SEC/FINRA oversight, with Fireblocks, Galaxy, Wintermute, B2C2 and FalconX among onboarding participants. Migrated from an Ethereum-based stack to a dedicated Avalanche L1 in 2026 with full state preservation and zero downtime.",
      },
      {
        name: "Axiym",
        sub: "Live on Avalanche",
        body: "Dedicated institutional network for cross-border payment flows, applying the same sovereign-chain, native-interop architecture to correspondent-style corridors.",
      },
      {
        name: "Pattern lineage",
        sub: "$2.5T+ settled with this class of design",
        body: "The operating model — bank-issued tokenized deposits, netted settlement cycles, core-ledger binding — has processed trillions in cumulative volume across regulated B2B payment networks before arriving on Avalanche infrastructure.",
      },
    ],
    comparison: {
      title: "Clearing architectures compared",
      subtitle:
        "How the sovereign-chain pattern sits against the incumbent and consortium alternatives.",
      headers: ["", "Correspondent banking", "Shared consortium ledger", "Sovereign L1s + ICM"],
      rows: [
        { metric: "Settlement speed", values: ["T+2, banking hours", "Near real-time", "Payment in seconds, netted settlement"] },
        { metric: "Pre-funding", values: ["Nostro per corridor", "Reduced", "Netted cycles free trapped capital"] },
        { metric: "Ledger sovereignty", values: ["Own ledger, blind hops", "One ledger shared with competitors", "Own chain per institution"] },
        { metric: "Counterparty visibility", values: ["Trust the chain of banks", "High — shared state", "Status only, never ledgers"] },
        { metric: "Central operator", values: ["Correspondent chain", "Sequences every transaction", "Light — observes, nets, resolves"] },
        { metric: "Bridge dependency", values: ["n/a", "Embedded in platform", "None — native ICM verification"] },
      ],
      footnote:
        "Characterizations are of the general architecture classes, not any specific vendor deployment.",
    },
    whenToUse: {
      use: [
        "Multiple regulated institutions moving institution-specific claims (deposits, tokenized liabilities).",
        "Sovereignty and privacy between members are non-negotiable.",
        "No shared bridge or central sequencer is acceptable to risk teams.",
        "A supervisor or clearing entity needs audit visibility without operational control.",
      ],
      avoid: [
        "A single entity on a single ledger — there is nothing to clear.",
        "Genuinely fungible assets that can move chains — lock-and-mint token transfer (ICTT) is simpler.",
        "Retail-speed public DeFi flows — this pattern optimizes for governance and finality, not composability.",
      ],
    },
    faqs: [
      {
        question: "Why burn-and-mint instead of a token bridge?",
        answer:
          "A deposit issued by Institution A is a claim on A — distinct from one issued by B. Moving it isn't a token transfer; it's the destruction of one claim and the issuance of another, with reserves settling behind it. Burn-and-mint models that reality directly. Lock-and-mint (ICTT) is the right tool for fungible assets, not institution-specific liabilities.",
      },
      {
        question: "Does the clearing entity see our transactions?",
        answer:
          "It sees obligation status — amount, sending institution, receiving institution, an opaque reference — never the customer ledger, payer/payee identity, or transaction purpose. Supervisory visibility for regulators is preserved through dedicated audit payloads, so privacy is scoped against competitors, not against supervisors.",
      },
      {
        question: "How does the actual money settle?",
        answer:
          "Payment finality (the recipient is credited) happens at mint, in seconds. Settlement finality (central-bank money moving between institutions) is deferred and netted: positions accumulate on the clearing chain and settle per cycle over existing rails — RTGS today, an on-chain settlement asset such as a wholesale CBDC or regulated stablecoin when available. No rip-and-replace of existing infrastructure.",
      },
      {
        question: "What bounds the risk between payment and settlement?",
        answer:
          "Real-time exposure controls: network-wide, bilateral, and liquidity limits recomputed after every accepted payment, with pre-transfer checks rejecting anything that would breach them. A conservation invariant (all exposures sum to zero) alerts the operator the moment the books don't balance.",
      },
      {
        question: "Who holds the keys?",
        answer:
          "The pattern is custody-agnostic by design. Each institution keeps its own custody and key-management model — external providers like Fireblocks, BitGo, or Copper, or an in-house HSM setup. No network-wide custody mandate is imposed on members.",
      },
      {
        question: "How do new members join?",
        answer:
          "Through a common L1 template and an on-chain participant registry: the operator admits a member, the registry authorizes it, and transfers check membership at initiation. Incumbents are never forced to upgrade or re-integrate when a member joins or leaves.",
      },
    ],
    resources: [
      {
        heading: "DOCUMENTATION",
        links: [
          { text: "Interchain Messaging", href: "/docs/cross-chain" },
          { text: "ICM contracts", href: "/docs/cross-chain/icm-contracts" },
          { text: "Avalanche L1s", href: "/docs/avalanche-l1s" },
        ],
      },
      {
        heading: "COMPARE",
        links: [
          { text: "Interchain Token Transfer (ICTT)", href: "/docs/cross-chain/interchain-token-transfer/overview" },
        ],
      },
      {
        heading: "TOOLING",
        links: [
          { text: "Launch an L1 in the Console", href: "/console" },
          { text: "ICM setup", href: "/console/icm/setup" },
        ],
      },
    ],
  },
  {
    slug: "supply-chain-provenance",
    label: "PROVENANCE",
    title: "Supply-Chain Provenance",
    tagline:
      "A permissioned chain where every actor is role-gated and end customers verify authenticity in one scan.",
    metaDescription:
      "Anti-counterfeit and traceability infrastructure on Avalanche: role-gated permissioned L1s, sub-2s QR verification, and three composable models from walled-garden to public attestation.",
    status: "coming-soon",
    intro: [
      "Every product leaves a trace. Make yours tamper-proof — a permissioned Avalanche L1 that role-gates every actor, hides data from unauthorized eyes, and returns a verified result from a single QR scan in under two seconds.",
    ],
    concepts: [
      { pillar: "privacy", label: "Privacy", role: "Role-gated visibility — only approved actors read the data appropriate to their role; no public explorer." },
      { pillar: "interoperability", label: "Interoperability", role: "Interchain Messaging stitches regional L1s into one verifiable record across a multi-region supply chain." },
      { pillar: "compliance", label: "Compliance", role: "Permissions enforced at the validator and deployer-allowlist level, not by application logic alone." },
    ],
    resources: [
      {
        heading: "DOCUMENTATION",
        links: [{ text: "Avalanche L1s", href: "/docs/avalanche-l1s" }],
      },
    ],
  },
];
