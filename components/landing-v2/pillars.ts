/**
 * The three enterprise pillars: single source of truth for the homepage
 * "Why Avalanche" chapter, the /solutions splash pages, and the nav menu.
 *
 * The framing is Control · Reach · Performance: the institutional pitch Mike
 * gives regulated buyers: control without isolation, connection without
 * compromise, performance that scales with finance. Both halves of his tension
 * are here: job one is control (you answer to regulators and clients), job two
 * is reach (markets are networks; you cannot afford to be walled off from the
 * liquidity, developers, and customers outside your perimeter).
 *
 * "Control" carries what were previously the privacy and compliance pillars
 * (who validates, who transacts, who can see the chain), so the site's altitude
 * matches the presentation buyers hear before they land here.
 *
 * Naming note: the pillars are never presented as an initialism, and the second
 * pillar is "Reach" rather than "Connection" so the set does not abbreviate to
 * an unfortunate trigram. Mike's phrase "connection without compromise" is kept
 * in that pillar's prose.
 *
 * Copy is a working draft: every claim must stay verifiable against shipped
 * protocol behavior (pending a story pass with comms/Mike before production).
 */

export interface PillarLink {
  text: string;
  href: string;
}

export type PillarSlug =
  | "control"
  | "reach"
  | "performance";

export interface Pillar {
  slug: PillarSlug;
  /** mono eyebrow, e.g. "PERFORMANCE" */
  label: string;
  /** statement headline, stored without its trailing period */
  title: string;
  /** one-liner for the homepage row and nav card */
  tagline: string;
  /** panel headline in the brand pattern: steel lead lines, red punch line */
  display: { lead: string[]; punch: string };
  metaDescription: string;
  /** splash-page lead paragraph */
  intro: string;
  proofs: { label: string; value: string }[];
  capabilities: { title: string; body: string }[];
  resources: { heading: string; links: PillarLink[] }[];
  /**
   * Optional: architecture models, the shapes this pillar's primitives
   * compose into. Rendered as a section only when present.
   */
  models?: {
    /** mono index, e.g. "MODEL 01" */
    label: string;
    name: string;
    tagline: string;
    description: string;
    bestFor: string;
    /** id of the architecture diagram to render alongside this model */
    diagram?: string;
  }[];
}

/**
 * Institutional use cases: the spine of the /solutions story.
 *
 * These are architecture patterns, not marketing tiles: a business framing,
 * the Avalanche shape that implements it, and the guarantees that shape buys.
 * Each pattern belongs to exactly one pillar and appears only on that
 * pillar's subpage.
 *
 * Hard rule: no named institutions or private engagements. Patterns only.
 */
export interface UseCase {
  slug: string;
  /** mono eyebrow, e.g. "TOKENIZED DEPOSITS" */
  label: string;
  /** statement headline, stored without its trailing period */
  title: string;
  /** the business framing, one line */
  tagline: string;
  /** the problem, in the institution's own terms */
  summary: string;
  /** the architecture, as a primitives line: "Partitioned ledger · ICM · ..." */
  stack: string;
  /** the guarantees this shape buys, as label/value spec rows */
  guarantees: { label: string; value: string }[];
  /** the one pillar this pattern lives on */
  pillar: PillarSlug;
  /** id of the animated instrument in UseCaseDiagrams */
  diagram?: string;
}

export const PILLARS: Pillar[] = [
  {
    slug: "control",
    display: { lead: ["Your chain,", "your rules,"], punch: "your perimeter" },
    label: "CONTROL",
    title: "Control without isolation",
    tagline:
      "Sovereignty over who validates, who transacts, and who can see the chain at all. Permissioning and privacy enforced by the protocol, not by policy documents.",
    metaDescription:
      "Avalanche gives regulated institutions control at the protocol level: allowlist precompiles for deployers and transactors, permissioned validator sets, validator-only L1s, and operator-controlled data residency.",
    intro:
      "In regulated finance, job number one is control: you answer to your clients and your regulators before anyone else. On an Avalanche L1 that control is a protocol primitive: you set who validates, who deploys, who transacts, and where the ledger physically lives. The rules are enforced by the chain and auditable on it, and the chain stays fully EVM-compatible.",
    proofs: [
      { label: "NETWORK ACCESS", value: "VALIDATOR-ONLY" },
      { label: "TRANSACTION ACCESS", value: "ALLOWLIST PRECOMPILE" },
      { label: "DATA RESIDENCY", value: "OPERATOR-CONTROLLED" },
    ],
    capabilities: [
      {
        title: "Protocol-level permissioning",
        body: "Allowlist precompiles gate who can deploy contracts and who can transact at all: approved addresses in, everyone else out. Enforcement happens at execution rather than by convention.",
      },
      {
        title: "Permissioned validator set",
        body: "You decide which operators validate, your own machines or named partners, and admit or remove them through the validator manager contract. Permissioning a regulator node is straightforward.",
      },
      {
        title: "Closed networks, placed data",
        body: "One configuration flag closes an L1: only nodes you admit can sync, query, or even see it. Validators are machines you place, so every copy of the ledger stays in a jurisdiction, a data center, or your own racks.",
      },
    ],
    resources: [
      {
        heading: "DOCUMENTATION",
        links: [
          { text: "Avalanche L1s", href: "/docs/avalanche-l1s" },
          { text: "Deployer allowlist", href: "/docs/avalanche-l1s/precompiles/deployer-allowlist" },
          { text: "Transaction allowlist", href: "/docs/avalanche-l1s/precompiles/transaction-allowlist" },
          { text: "Validator-only configuration", href: "/docs/nodes/configure/avalanche-l1-configs" },
        ],
      },
      {
        heading: "LEARN",
        links: [
          { text: "Permissioned L1s", href: "/academy/avalanche-l1/permissioned-l1s" },
          { text: "Access restriction", href: "/academy/avalanche-l1/access-restriction" },
          { text: "Avalanche fundamentals", href: "/academy/avalanche-l1/avalanche-fundamentals" },
        ],
      },
      {
        heading: "TOOLING",
        links: [
          { text: "Deployer allowlist tool", href: "/console/l1-access-restrictions/deployer-allowlist" },
          { text: "Transactor allowlist tool", href: "/console/l1-access-restrictions/transactor-allowlist" },
          { text: "Create an L1 in the Console", href: "/console/create-l1" },
        ],
      },
    ],
    models: [
      {
        label: "MODEL 01",
        name: "Walled Garden",
        tagline: "Full control over who enters the perimeter",
        description:
          "You decide who participates. The network sits behind a permissioned perimeter: no outsider can query it, read its transactions, or join without approval. Inside, everything is visible to participants; outside, the network is invisible.",
        bestFor: "Closed consortia, single-institution tokenization, regulated market infrastructure.",
        diagram: "walled-garden",
      },
      {
        label: "MODEL 02",
        name: "Partitioned Ledger",
        tagline: "Each party holds only their own ledger",
        description:
          "Every counterparty pair runs its own isolated ledger, exchanging settlement proofs directly rather than on a shared global one. Non-parties see nothing: no amounts, no identities, no timing.",
        bestFor: "DVP settlement, inter-bank clearing, FX netting, bilateral repo.",
        diagram: "partitioned-ledger",
      },
      {
        label: "MODEL 03",
        name: "Encrypted Settlement",
        tagline: "Amounts encrypted on shared infrastructure",
        description:
          "Transactions run on shared infrastructure, so everyone keeps shared liquidity and interoperability, but amounts, counterparties, and logic stay encrypted. Settlement is verified without anyone reading the underlying values.",
        bestFor: "Tokenized assets, cross-institution liquidity pools, digital bonds.",
        diagram: "encrypted-settlement",
      },
    ],
  },
  {
    slug: "reach",
    display: { lead: ["Chain to chain,", "natively,"], punch: "no intermediaries" },
    label: "REACH",
    title: "Reach without compromise",
    tagline:
      "Native messaging and shared liquidity across every Avalanche chain, public or private, verified against validator sets on the P-Chain, with no third-party bridge in the settlement path.",
    metaDescription:
      "Interchain Messaging is built into Avalanche: authenticated messages, token transfers, and shared liquidity between public, permissioned, and private chains, verified against P-Chain validator sets with no third-party bridge.",
    intro:
      "Markets are networks. You need the liquidity, the developers, and the customers on the other side of your perimeter: connection without compromise. An Interchain Messaging (ICM) message carries an aggregate signature from the source chain's validators, verified against the P-Chain's validator registry. No committee, no custodian, no third-party bridge.",
    proofs: [
      { label: "MESSAGING", value: "PROTOCOL-NATIVE" },
      { label: "ATTESTATION", value: "SOURCE VALIDATOR SET" },
      { label: "VERIFICATION", value: "P-CHAIN REGISTRY" },
    ],
    capabilities: [
      {
        title: "Authenticated messaging",
        body: "Messages carry aggregate BLS signatures from the source validator set, verified at the destination against the validator registry on the P-Chain. The destination trusts the source chain, never a messenger in the middle.",
      },
      {
        title: "Native token transfer",
        body: "Interchain Token Transfer (ICTT) moves tokens between L1s over ICM, with contracts you deploy and control, so a permissioned chain can reach public liquidity without a custodial bridge.",
      },
      {
        title: "Shared tooling and liquidity",
        body: "Every chain shares the same SDK, Console, and messaging layer, and settles against the same public pools. Connection is common tooling and shared liquidity, not just a bridge.",
      },
    ],
    resources: [
      {
        heading: "DOCUMENTATION",
        links: [
          { text: "Interchain Messaging", href: "/docs/cross-chain" },
          { text: "ICM contracts", href: "/docs/cross-chain/icm-contracts" },
          { text: "Interchain Token Transfer", href: "/docs/cross-chain/interchain-token-transfer/overview" },
          { text: "Avalanche Warp Messaging", href: "/docs/cross-chain/avalanche-warp-messaging" },
        ],
      },
      {
        heading: "LEARN",
        links: [
          { text: "Interchain Messaging course", href: "/academy/avalanche-l1/interchain-messaging" },
          { text: "Build an ERC-20 bridge", href: "/academy/avalanche-l1/erc20-bridge" },
          { text: "Bridge a native token", href: "/academy/avalanche-l1/native-token-bridge" },
        ],
      },
      {
        heading: "TOOLING",
        links: [
          { text: "Set up ICM in the Console", href: "/console/icm/setup" },
          { text: "Set up a token bridge", href: "/console/ictt/setup" },
          { text: "Test a connection", href: "/console/icm/test-connection" },
          { text: "Avalanche SDK", href: "/docs/tooling/avalanche-sdk" },
        ],
      },
    ],
  },
  {
    slug: "performance",
    display: { lead: ["In milliseconds,", "irreversible,"], punch: "every time" },
    label: "PERFORMANCE",
    title: "Finality in milliseconds",
    tagline:
      "Sub-second finality on the shared C-Chain, and under 100 milliseconds on an L1 all your own.",
    metaDescription:
      "Avalanche finality is irreversible with no reorgs: under a second on the C-Chain, under 100 milliseconds on dedicated L1s.",
    intro:
      "Finality on Avalanche is irreversible: no reorgs, no settlement window. The shared C-Chain settles in under a second; a dedicated L1 can push it below 100 milliseconds.",
    proofs: [
      { label: "C-CHAIN FINALITY", value: "<1S" },
      { label: "DEDICATED L1 FINALITY", value: "<100MS" },
      { label: "CHAIN REORGS", value: "NONE, BY DESIGN" },
    ],
    capabilities: [
      {
        title: "Irreversible settlement",
        body: "Snowman consensus accepts each block exactly once. No confirmation counting, no reorg window, no clawback of settled value.",
      },
      {
        title: "Dedicated blockspace",
        body: "Each L1 has its own validators, gas token, and fee market. Someone else's busy application never touches your latency.",
      },
      {
        title: "Horizontal scale",
        body: "Capacity grows by adding L1s: each new chain brings its own validators and fee market instead of bidding for shared blockspace.",
      },
    ],
    resources: [
      {
        heading: "DOCUMENTATION",
        links: [
          { text: "Avalanche consensus", href: "/docs/primary-network/avalanche-consensus" },
          { text: "Continuous execution", href: "/docs/primary-network/continuous-execution" },
          { text: "The Primary Network", href: "/docs/primary-network" },
          { text: "Customize your EVM", href: "/docs/avalanche-l1s/evm-configuration/customize-avalanche-l1" },
        ],
      },
      {
        heading: "LEARN",
        links: [
          { text: "Avalanche fundamentals", href: "/academy/avalanche-l1/avalanche-fundamentals" },
          { text: "Customizing the EVM", href: "/academy/avalanche-l1/customizing-evm" },
          { text: "Blockchain fundamentals", href: "/academy/blockchain/blockchain-fundamentals" },
        ],
      },
      {
        heading: "TOOLING",
        links: [
          { text: "Create an L1 in the Console", href: "/console/create-l1" },
          { text: "Live network stats", href: "/explorer/mainnet" },
          { text: "Avalanche SDK", href: "/docs/tooling/avalanche-sdk" },
        ],
      },
    ],
  },
];

export const USE_CASES: UseCase[] = [
  /* ---- reach ---- */
  {
    slug: "public-liquidity",
    label: "LIQUIDITY ACCESS",
    title: "Public liquidity from a private chain",
    tagline:
      "A permissioned business chain reaches public stablecoin liquidity with no custodial bridge in the settlement path.",
    summary:
      "A regulated business runs on its own chain, but the stablecoin liquidity it settles against lives on the public C-Chain. Crossing that boundary usually means trusting a third-party bridge, which adds a new custodian and a new counterparty to every settlement.",
    stack: "Dedicated L1 · ICM · C-Chain liquidity",
    guarantees: [
      { label: "BRIDGING", value: "PROTOCOL-NATIVE" },
      { label: "CUSTODY RISK", value: "NONE IN PATH" },
      { label: "FINALITY", value: "SUB-SECOND" },
    ],
    pillar: "reach",
    diagram: "public-liquidity",
  },
  {
    slug: "token-issuance",
    label: "TOKEN ISSUANCE",
    title: "One token, issued once, native everywhere",
    tagline:
      "ICTT keeps the home contract with the issuer and deploys native remotes on every destination chain.",
    summary:
      "A token issued on one chain needs to circulate on others, and every third-party bridge that wraps it mints a liability the issuer does not control. Multiple wrapped versions fragment liquidity and put the issuer's name on assets it never approved.",
    stack: "ICTT · Home contract · Native remotes",
    guarantees: [
      { label: "WRAPPED VERSIONS", value: "NONE" },
      { label: "SUPPLY", value: "HOME-ANCHORED" },
      { label: "ATTESTATION", value: "SOURCE VALIDATORS" },
    ],
    pillar: "reach",
    diagram: "token-issuance",
  },

  /* ---- performance ---- */
  {
    slug: "cross-border-payments",
    label: "CROSS-BORDER PAYMENTS",
    title: "Across borders in under a second",
    tagline:
      "Stablecoin transfers on the C-Chain settle irreversibly in under a second, any hour of any day.",
    summary:
      "Correspondent banking moves money across borders through a chain of intermediaries, each adding hours or days, cutoff windows, and fees. The value arrives when the last bank in the chain says it does, and not before.",
    stack: "C-Chain · Stablecoin rails · Sub-second finality",
    guarantees: [
      { label: "SETTLEMENT", value: "<1S" },
      { label: "REVERSALS", value: "NONE" },
      { label: "OPERATING HOURS", value: "24/7" },
    ],
    pillar: "performance",
    diagram: "cross-border-payments",
  },
  {
    slug: "dvp-settlement",
    label: "DVP SETTLEMENT",
    title: "Delivery versus payment, atomically",
    tagline:
      "Securities and cash change hands in a single settlement, each leg visible only to its counterparties.",
    summary:
      "Two parties exchange an asset for payment and both need certainty that delivery and payment settle together or not at all. Off-chain that certainty costs settlement risk and reconciliation; on most chains it costs a reorg window. Irreversible finality closes both.",
    stack: "Dedicated L1 · Atomic settlement · Irreversible finality",
    guarantees: [
      { label: "SETTLEMENT", value: "ATOMIC DVP" },
      { label: "FINALITY", value: "IRREVERSIBLE" },
      { label: "REORG WINDOW", value: "NONE" },
    ],
    pillar: "performance",
    diagram: "dvp-settlement",
  },

  /* ---- control (privacy patterns) ---- */
  {
    slug: "tokenized-deposits",
    label: "TOKENIZED DEPOSITS",
    title: "Commercial bank money, on-chain",
    tagline:
      "Every issuer's deposit is a distinct asset, settled between counterparties without a shared global ledger.",
    summary:
      "Institutions want to move commercial bank money on-chain, but a deposit at one bank is not the same instrument as a deposit at another, and a shared public ledger would expose balances and flows to competitors. Moving value between issuers has to reconcile two different liabilities without either side broadcasting its book.",
    stack: "Partitioned ledger · ICM burn-and-mint · Permissioned validators",
    guarantees: [
      { label: "ASSET MODEL", value: "PER-ISSUER" },
      { label: "CROSS-ISSUER", value: "BURN-AND-MINT" },
      { label: "VISIBILITY", value: "COUNTERPARTY-ONLY" },
    ],
    pillar: "control",
    diagram: "tokenized-deposits",
  },
  {
    slug: "bilateral-repo",
    label: "REPO & SECURITIES LENDING",
    title: "Positions priced, never broadcast",
    tagline:
      "Each counterparty pair settles on its own ledger, invisible to the rest of the street.",
    summary:
      "Intraday repo and lending positions signal trading strategy, and broadcasting them to a shared ledger hands that signal to competitors. Desks need on-chain settlement without an on-chain book.",
    stack: "Partitioned ledger · Bilateral channels · Validator-only access",
    guarantees: [
      { label: "LEDGER", value: "PER-PAIR" },
      { label: "VISIBILITY", value: "PARTIES-ONLY" },
      { label: "STREET VIEW", value: "NONE" },
    ],
    pillar: "control",
    diagram: "bilateral-repo",
  },

  /* ---- control (compliance patterns) ---- */
  {
    slug: "structured-credit",
    label: "STRUCTURED CREDIT",
    title: "Securitization, end to end",
    tagline:
      "Origination, servicing, and tranching run as contracts on a permissioned chain, settling in stablecoins on the public network.",
    summary:
      "Asset-backed finance runs on per-loan terms, eligibility tests, and waterfall logic that today live across spreadsheets and servicer systems. Putting them on a shared public chain would expose borrower and portfolio data; keeping them off-chain forfeits the automation that makes the structure worth tokenizing.",
    stack: "Walled-garden L1 · On-chain waterfall · ICM settlement",
    guarantees: [
      { label: "WATERFALL", value: "ON-CHAIN" },
      { label: "ELIGIBILITY", value: "RULE-ENFORCED" },
      { label: "CASH SETTLEMENT", value: "STABLECOIN VIA ICM" },
    ],
    pillar: "control",
    diagram: "structured-credit",
  },
  {
    slug: "permissioned-venue",
    label: "PERMISSIONED VENUE",
    title: "Markets where every wallet is known",
    tagline:
      "The transaction allowlist is protocol code: a wallet that is not approved cannot transact at all.",
    summary:
      "A regulated venue must know every participant, but on a public chain any address can call any contract. Policy that lives in a compliance manual cannot stop a transaction; policy that lives in the protocol can.",
    stack: "TxAllowList precompile · Permissioned validators · EVM",
    guarantees: [
      { label: "ACCESS", value: "ALLOWLIST-GATED" },
      { label: "ENFORCEMENT", value: "AT EXECUTION" },
      { label: "AUDIT TRAIL", value: "ON-CHAIN" },
    ],
    pillar: "control",
    diagram: "permissioned-venue",
  },
];
