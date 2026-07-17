/**
 * The four enterprise pillars — single source of truth for the homepage
 * "Why Avalanche" chapter, the /solutions splash pages, and the nav menu.
 *
 * Copy is a working draft: every claim must stay verifiable against shipped
 * protocol behavior (pending a story pass with comms/Mike before production).
 */

export interface PillarLink {
  text: string;
  href: string;
}

export interface Pillar {
  slug: string;
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
   * Optional: architecture models — the shapes this pillar's primitives
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
  /** Optional: representative use-cases, one row each. */
  useCases?: {
    title: string;
    /** the model name this maps to */
    model: string;
    problem: string;
    solution: string;
  }[];
}

export const PILLARS: Pillar[] = [
  {
    slug: "interoperability",
    display: { lead: ["Chain to chain,", "natively,"], punch: "no intermediaries" },
    label: "INTEROPERABILITY",
    title: "Every chain speaks natively",
    tagline:
      "Native messaging between Avalanche chains, public or private, verified against validator sets on the P-Chain.",
    metaDescription:
      "Interchain Messaging is built into Avalanche: authenticated messages and token transfers between public, permissioned, and private chains, verified against P-Chain validator sets.",
    intro:
      "An Interchain Messaging (ICM) message carries an aggregate signature from the source chain's validators, verified against the P-Chain's validator registry. No committee, no custodian.",
    proofs: [
      { label: "MESSAGING", value: "PROTOCOL-NATIVE" },
      { label: "ATTESTATION", value: "SOURCE VALIDATOR SET" },
      { label: "VERIFICATION", value: "P-CHAIN REGISTRY" },
    ],
    capabilities: [
      {
        title: "Authenticated messaging",
        body: "Messages carry aggregate BLS signatures from the source validator set, verified at the destination against the validator registry on the P-Chain.",
      },
      {
        title: "Native token transfer",
        body: "Interchain Token Transfer (ICTT) moves tokens between L1s over ICM, with contracts you deploy and control.",
      },
      {
        title: "Permissionless relay",
        body: "Messages are carried by relayers anyone can run. The destination chain verifies the source validators' signatures — never the messenger.",
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
    useCases: [
      {
        title: "Stablecoin Settlement",
        model: "ICM + C-Chain",
        problem:
          "The business runs on a permissioned L1, but the stablecoin liquidity it settles against lives on the public C-Chain.",
        solution:
          "The L1 messages the C-Chain directly over ICM, so settlement reaches public liquidity without a custodial bridge in the path.",
      },
      {
        title: "Cross-Chain Token Issuance",
        model: "ICTT",
        problem:
          "A token issued on one chain needs to circulate on others without wrapped versions minted by a third-party bridge operator.",
        solution:
          "ICTT puts a home contract you control on the issuing chain and remotes on each destination; every transfer is attested by the source chain's validators.",
      },
      {
        title: "Multi-Entity Consortium",
        model: "ICM",
        problem:
          "Each member or subsidiary runs its own chain for governance and jurisdictional reasons, but shared workflows span all of them.",
        solution:
          "Every entity keeps a sovereign L1 — its own validators, rules, and data — while ICM gives the group authenticated messaging between them.",
      },
      {
        title: "Public Proof of Private Activity",
        model: "ICM + C-Chain",
        problem:
          "Counterparties of a private chain want independent evidence that agreed state exists, without being given access to the chain itself.",
        solution:
          "The L1 sends state commitments to the C-Chain over ICM: a public, timestamped anchor attested by the private chain's own validator set.",
      },
    ],
  },
  {
    slug: "performance",
    display: { lead: ["Under a second,", "irreversible,"], punch: "every time" },
    label: "PERFORMANCE",
    title: "Finality in under a second",
    tagline:
      "Transactions settle irreversibly in under a second, on the shared C-Chain or on blockspace all your own.",
    metaDescription:
      "Avalanche finalizes transactions in under a second with no reorgs, on dedicated per-L1 blockspace that scales horizontally.",
    intro:
      "Avalanche consensus finalizes transactions in under a second, irreversibly, with no reorgs and no settlement window. Every L1 runs on dedicated blockspace, so throughput scales by adding chains, not by competing for one.",
    proofs: [
      { label: "TIME TO FINALITY", value: "<1s" },
      { label: "CHAIN REORGS", value: "NONE, BY DESIGN" },
      { label: "BLOCKSPACE", value: "DEDICATED PER L1" },
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
          { text: "Streaming async execution", href: "/docs/primary-network/streaming-async-execution" },
          { text: "The Primary Network", href: "/docs/primary-network" },
          { text: "Customize your EVM", href: "/docs/avalanche-l1s/evm-configuration/customize-avalanche-l1" },
        ],
      },
      {
        heading: "LEARN",
        links: [
          { text: "Avalanche fundamentals", href: "/academy/avalanche-l1/avalanche-fundamentals" },
          { text: "Customizing the EVM", href: "/academy/avalanche-l1/customizing-evm" },
          { text: "Blockchain fundamentals", href: "/academy?path=blockchain" },
        ],
      },
      {
        heading: "TOOLING",
        links: [
          { text: "Create an L1 in the Console", href: "/console/create-l1" },
          { text: "Live network stats", href: "/stats/overview" },
          { text: "Avalanche SDK", href: "/docs/tooling/avalanche-sdk" },
        ],
      },
    ],
  },
  {
    slug: "privacy",
    display: { lead: ["Visible to you,", "invisible to"], punch: "everyone else" },
    label: "PRIVACY",
    title: "Visible to participants. Invisible to everyone else",
    tagline:
      "EncryptedERC keeps balances confidential on public chains, and validator-only L1s disappear entirely: to anyone outside, the chain doesn't exist.",
    metaDescription:
      "Validator-only Avalanche L1s keep chain data inside the network's edge, with operator-controlled data residency and encrypted token standards.",
    intro:
      "Run a validator-only L1 and the chain's data stops at the network's edge. Only nodes you admit can sync, query, or even see it.",
    proofs: [
      { label: "NETWORK ACCESS", value: "VALIDATOR-ONLY" },
      { label: "DATA RESIDENCY", value: "OPERATOR-CONTROLLED" },
      { label: "OUTSIDE VISIBILITY", value: "NONE" },
    ],
    capabilities: [
      {
        title: "Validator-only networks",
        body: "One configuration flag closes the chain. Only validators and the nodes they admit can connect, sync, or serve its data.",
      },
      {
        title: "Data residency",
        body: "Validators are machines you place: keep every copy of the ledger in a jurisdiction, a data center, or your own racks.",
      },
      {
        title: "EncryptedERC (eERC)",
        body: "An encrypted token standard: balances and amounts are unreadable on-chain, decryptable only by the owner and designated auditors.",
      },
    ],
    resources: [
      {
        heading: "DOCUMENTATION",
        links: [
          { text: "Avalanche L1s", href: "/docs/avalanche-l1s" },
          { text: "Validator-only configuration", href: "/docs/nodes/configure/avalanche-l1-configs" },
          { text: "EncryptedERC (eERC)", href: "/integrations/encrypted-erc" },
        ],
      },
      {
        heading: "LEARN",
        links: [
          { text: "Permissioned L1s", href: "/academy/avalanche-l1/permissioned-l1s" },
          { text: "Avalanche fundamentals", href: "/academy/avalanche-l1/avalanche-fundamentals" },
        ],
      },
      {
        heading: "TOOLING",
        links: [
          { text: "Deploy eERC in the Console", href: "/console/encrypted-erc/overview" },
          { text: "Create an L1 in the Console", href: "/console/create-l1" },
          { text: "Avalanche SDK", href: "/docs/tooling/avalanche-sdk" },
        ],
      },
    ],
    models: [
      {
        label: "MODEL 01",
        name: "Walled Garden",
        tagline: "Full control over who enters the perimeter",
        description:
          "You decide who participates. The network sits behind a permissioned perimeter — no outsider can query it, read its transactions, or join without approval. Inside, everything is visible to participants; outside, the network is invisible.",
        bestFor: "Closed consortia, single-institution tokenization, regulated market infrastructure.",
        diagram: "walled-garden",
      },
      {
        label: "MODEL 02",
        name: "Partitioned Ledger",
        tagline: "Each party holds only their own ledger",
        description:
          "Every counterparty pair runs its own isolated ledger, exchanging settlement proofs directly rather than on a shared global one. Non-parties see nothing — no amounts, no identities, no timing.",
        bestFor: "DVP settlement, inter-bank clearing, FX netting, bilateral repo.",
        diagram: "partitioned-ledger",
      },
      {
        label: "MODEL 03",
        name: "Encrypted Settlement",
        tagline: "Amounts encrypted on shared infrastructure",
        description:
          "Transactions run on shared infrastructure, so everyone keeps shared liquidity and interoperability — but amounts, counterparties, and logic stay encrypted. Settlement is verified without anyone reading the underlying values.",
        bestFor: "Tokenized assets, cross-institution liquidity pools, digital bonds.",
        diagram: "encrypted-settlement",
      },
    ],
    useCases: [
      {
        title: "DVP Settlement",
        model: "Partitioned Ledger",
        problem:
          "Two banks exchange securities and cash. Neither wants the other to see their full position or book.",
        solution:
          "Each leg is visible only to its counterparties. Validators confirm settlement without ever reading the amounts.",
      },
      {
        title: "FX Netting",
        model: "Partitioned Ledger",
        problem:
          "Multiple institutions net bilateral exposures, but showing a full book to competitors is commercially unacceptable.",
        solution:
          "Each bilateral relationship runs on a separate ledger. Net positions are calculated without exposing gross flows to others.",
      },
      {
        title: "RWA Tokenization",
        model: "Encrypted Settlement",
        problem:
          "Holdings on a shared public chain are visible to anyone — competitors, counterparties, and the market.",
        solution:
          "Balances are encrypted on-chain. Regulators receive a dedicated auditor key. Settlement is verifiable without revealing amounts.",
      },
      {
        title: "Trade Finance",
        model: "Walled Garden",
        problem:
          "Letter-of-credit issuance, cargo data, and pricing terms are commercially sensitive — yet multiple banks must participate.",
        solution:
          "A permissioned network with role-based visibility. Cargo is visible to logistics parties; pricing stays between originator and buyer.",
      },
      {
        title: "Repo & Securities Lending",
        model: "Partitioned Ledger",
        problem:
          "Intraday repo positions signal trading strategy. Broadcasting them to a shared ledger is competitively damaging.",
        solution:
          "Bilateral repo ledgers, one per counterparty pair. Each relationship keeps an isolated, private view.",
      },
      {
        title: "Digital Bond Issuance",
        model: "Encrypted Settlement",
        problem:
          "KYC-verified investors need to transact, but investor identity and allocation sizes must stay confidential.",
        solution:
          "Investor eligibility is verified without exposing identity. Allocations are encrypted on-chain, with an auditor key for regulatory reporting.",
      },
    ],
  },
  {
    slug: "compliance",
    display: { lead: ["Your rules,", "enforced by"], punch: "the protocol" },
    label: "COMPLIANCE",
    title: "Policy enforced by the protocol",
    tagline:
      "Allowlist validators, deployers, and transactors at the chain level. The rules live in precompiles, not policy documents.",
    metaDescription:
      "Avalanche L1s enforce permissioning at the protocol level: allowlist precompiles for deployers and transactions, and permissioned validator sets.",
    intro:
      "On an Avalanche L1, permissioning is a protocol primitive: precompiles gate who deploys and who transacts, and the validator set itself can be permissioned. The rules are enforced by the chain and auditable on it, and the chain stays fully EVM-compatible.",
    proofs: [
      { label: "CONTRACT DEPLOYMENT", value: "ALLOWLIST PRECOMPILE" },
      { label: "TRANSACTION ACCESS", value: "ALLOWLIST PRECOMPILE" },
      { label: "VALIDATOR SET", value: "PERMISSIONED OPTION" },
    ],
    capabilities: [
      {
        title: "Deployer allowlists",
        body: "The ContractDeployerAllowList precompile restricts deployment to addresses you approve, enforced at execution rather than by convention.",
      },
      {
        title: "Transaction gating",
        body: "The TxAllowList precompile controls who can transact at all: approved wallets in, everyone else out.",
      },
      {
        title: "Permissioned validator set",
        body: "You decide which operators validate — your machines or named partners — and admit or remove them through the validator manager contract.",
      },
    ],
    resources: [
      {
        heading: "DOCUMENTATION",
        links: [
          { text: "Deployer allowlist", href: "/docs/avalanche-l1s/precompiles/deployer-allowlist" },
          { text: "Transaction allowlist", href: "/docs/avalanche-l1s/precompiles/transaction-allowlist" },
          { text: "AllowList interface", href: "/docs/avalanche-l1s/precompiles/allowlist-interface" },
          { text: "Native minter precompile", href: "/docs/avalanche-l1s/precompiles/native-minter" },
        ],
      },
      {
        heading: "LEARN",
        links: [
          { text: "Access restriction", href: "/academy/avalanche-l1/access-restriction" },
          { text: "Permissioned L1s", href: "/academy/avalanche-l1/permissioned-l1s" },
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
  },
];
