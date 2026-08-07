/**
 * Every word on the Besu connection page. SELF-CONTAINED BY DESIGN.
 *
 * The copy is APPROVED AND FINAL per the design handoff. Do not rewrite it,
 * tighten it, or "improve" it. If a claim here needs to change, that is a
 * decision for the office that owns the copy, not an editing pass.
 *
 * It lives in one file so a reviewer can read the whole page as prose without
 * opening any JSX, and so translation or a CMS migration has a single target.
 */

export const NAV_LINKS = [
  { label: "MECHANISM", href: "#mechanism" },
  { label: "CONTROL", href: "#control" },
  { label: "ALTERNATIVES", href: "#alternatives" },
] as const;

export const NAV_CTA = { label: "TALK TO ENGINEERING", href: "#next" } as const;

export const HERO = {
  eyebrow: "INTERCHAIN MESSAGING · EXTERNAL ATTESTORS",
  /** Rendered with a manual line break and a red full stop. */
  headingLine1: "Connect your Besu chain",
  headingLine2: "to a market",
  deck: "An isolated chain running a tokenized securities register works well as a system of record, but poorly as a market. What is missing is a venue where the instruments can circulate, and a connection to it that does not hand control to a third party.",
  primaryCta: { label: "CONTACT OUR TEAM", href: "#next" },
  secondaryCta: { label: "HOW IT WORKS", href: "#mechanism" },
  stats: [
    {
      label: "Institutional First",
      caption: "See what institutions choose Avalanche",
    },
    {
      label: "Instant\nSettlement",
      caption:
        "Instant finality on Avalanche's side, value keeps moving without waiting long for the infrastructure settlement.",
    },
    {
      label: "Operational\nEfficient",
      caption:
        "Each chain verifies messages against its own list of authorised signers",
    },
  ],
} as const;

export const SUMMARY = {
  rail: "IN SUMMARY",
  heading:
    "One connection, analysed end to end, with tokenized equities as the worked case",
  cards: [
    {
      eyebrow: "01 · THE DESTINATION",
      body: "The Avalanche C-Chain settles in under a second, runs an EVM environment so existing Besu work ports across, and connects onward to every other Avalanche network through a mechanism already in production.",
    },
    {
      eyebrow: "02 · THE CONNECTION",
      body: "Each chain verifies incoming messages against its own list of authorised signers. Nothing in between declares a message valid.",
    },
    {
      eyebrow: "03 · THE BRIDGE CONTROL",
      body: "Signing authority is separate from node operation. Delivery can be restricted to the institution's own infrastructure. Issuance on the destination side is permissioned at protocol level.",
    },
    {
      eyebrow: "04 · THE NEXT STEP",
      body: "A technical session between both architecture teams to confirm the requirement and scope the missing elements.",
    },
  ],
} as const;

export const MECHANISM = {
  rail: ["HOW THE", "CONNECTION", "WORKS"],
  heading: "No external entity declares a message valid",
  prose: [
    "Avalanche and a Besu network share no validators, no state, and no built-in means of confirming what occurred on the other side. Left alone, a message crossing between them is an unbacked assertion.",
    "The design closes that gap without an intermediary. Each chain maintains its own list of the parties authorised to sign messages from the other side, with the weight carried by each signature. On arrival, the receiving chain checks the signatures against its own list and confirms the combined weight clears the threshold.",
  ],
  subLabel: "THIS CONSTRAINS THE RELAYER ABSOLUTELY",
  limits: [
    { eyebrow: "CANNOT ALTER", body: "Any change invalidates the signatures" },
    { eyebrow: "CANNOT FABRICATE", body: "It holds no signing keys" },
    {
      eyebrow: "CANNOT SUBSTITUTE",
      body: "The signer set resides on the receiving chain, not inside the message",
    },
    {
      eyebrow: "ONLY FAILURE",
      body: "Non-delivery, which gets solved with retries",
    },
  ],
} as const;

export const CONTROL = {
  rail: "CONTROL",
  heading: "What the institution configures",
  deck: "Five points, all of them protocol-level rather than procedural.",
  /** `lead` renders semibold white, `rest` continues inline in grey. */
  rows: [
    {
      lead: "Signing authority is separate from node operation.",
      rest: "The parties authorised to sign outbound messages need not be the validators producing blocks, which answers a separation of duties requirement at protocol level rather than in written procedure.",
    },
    {
      lead: "Delivery can be restricted to named addresses or kept open.",
      rest: "The trade-off is availability, not security: open relaying means one honest participant anywhere suffices, while restricting delivery makes it depend on the institution's own uptime. Integrity is identical either way.",
    },
    {
      lead: "Transaction, deployment and issuance rights are permissioned by role,",
      rest: "with distinct levels for administrators, managers and permitted participants.",
    },
    {
      lead: "The trust model is readable rather than described.",
      rest: "Signers and weights reside on-chain, so an auditor establishes who can authorise what by reading it rather than by relying on an operator's account.",
    },
    {
      lead: "Message content and encryption are the sender's choice.",
      rest: "The payload is opaque to the protocol, so an ISO 20022 message or any other format fits, and it can be encrypted before it leaves.",
    },
  ],
} as const;

export const VISIBILITY = {
  rail: ["WHAT REMAINS", "VISIBLE"],
  heading: "Encryption hides amounts. It does not conceal the relationship.",
  /** The third cell inverts to the dark surface. */
  cells: [
    {
      eyebrow: "VISIBLE AND PERMANENT",
      body: "On the C-Chain: which address holds which instrument, who transferred to whom, and when.",
      inverted: false,
    },
    {
      eyebrow: "CONCEALABLE",
      body: "Amounts and balances, at roughly 947,000 gas per confidential transfer, about fifteen times a standard transfer.",
      inverted: false,
    },
    {
      eyebrow: "THE REMEDY",
      body: "Where the relationship graph matters, the remedy is architectural: the register, client identities and the mapping between client and position remain on Besu, with only what must be public crossing over.",
      inverted: true,
    },
  ],
} as const;

export const ALTERNATIVES = {
  rail: ["COMPARED WITH", "THE ALTERNATIVES"],
  heading: "The axis is not throughput or cost. It is what has to be trusted.",
  deck: "Institutions evaluating this connection have usually been offered one before, most often through an oracle network.",
  columns: [
    "CUSTODIAL BRIDGE",
    "CHAINLINK CCIP",
    "LAYERZERO V2",
    "EXTERNAL ICM ATTESTORS",
  ],
  /** `cells` are the three comparison columns; `ours` is the final column.
   *  `oursBold` renders semibold ahead of `ours` when present. */
  rows: [
    {
      label: "What secures a message",
      cells: [
        "A fixed group of key holders",
        "An oracle network reaching off-chain consensus",
        "Verifier networks selected by the application",
      ],
      ours: "The source chain's own signers, verified on-chain at both ends",
    },
    {
      label: "Choice of who verifies",
      cells: ["No", "No", "Yes"],
      ours: "Yes",
    },
    {
      label: "Ability to run a verifier",
      cells: ["No", "No", "Yes"],
      ours: "Yes, and it is the expected arrangement",
    },
    {
      label: "Is the verifier a new role",
      cells: ["Yes", "Yes", "Yes"],
      oursBold: "No.",
      ours: " These are the chain's own signers",
      highlight: true,
    },
    {
      label: "Choice of who delivers",
      cells: ["No", "No", "An executor, the protocol's own by default"],
      ours: "Yes, restricted to named addresses",
    },
    {
      label: "Chains available today",
      cells: ["Many", "Many", "Many"],
      ours: "One pair at a time",
    },
  ],
  pullNote:
    "Either oracle design adds a verification role that did not previously exist, and that role has to be operated, funded and answered for. Under the attestor design the parties attesting to messages are the parties already attesting to the chain, so an existing and already audited trust relationship is reused rather than a new one created.",
} as const;

export const CTA = {
  headingLines: ["A technical session", "between both", "architecture teams"],
  deck: "To confirm the requirement and scope the missing elements at application level.",
  /** Both destinations are placeholders in the reference prototype and remain
   *  unwired. Point them at the real form and report before publishing. */
  primaryCta: { label: "REQUEST THE SESSION", href: "#next" },
  secondaryCta: { label: "READ THE FULL ANALYSIS", href: "#next" },
} as const;

export const FOOTER = {
  left: "AVA LABS · INSTITUTIONAL RESEARCH · AUG 2026",
  right: "TECHNOLOGY BUILT FOR BUSINESS",
} as const;

export const PAGE_META = {
  title: "Connect your Besu chain to a market | Avalanche",
  description:
    "Connecting an institutional Hyperledger Besu network to the Avalanche C-Chain with Interchain Messaging and external attestors, without handing control to a third party.",
} as const;
