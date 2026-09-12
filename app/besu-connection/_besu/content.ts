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

/**
 * One ask, one label, everywhere. The page previously had three competing
 * labels ("TALK TO ENGINEERING", "CONTACT OUR TEAM", "REQUEST THE SESSION")
 * all pointing at the same anchor. Do not reintroduce a variant.
 */
export const ASK = "REQUEST A TECHNICAL SESSION";

export const NAV_CTA = { label: ASK, href: "#next" } as const;

export const HERO = {
  eyebrow: "INTERCHAIN MESSAGING · EXTERNAL ATTESTORS",
  /** Rendered with a manual line break and a red full stop. */
  headingLine1: "Connect your Besu chain",
  headingLine2: "to a market",
  deck: "A permissioned chain running a tokenized securities register works well as a system of record, but poorly as a market. What is missing is a venue where the instruments can circulate, and a connection to it that does not hand control to a third party.",
  primaryCta: { label: ASK, href: "#next" },
  secondaryCta: { label: "HOW IT WORKS", href: "#mechanism" },
  /**
   * "Instant Settlement" and "instant finality" were removed here and must not
   * return in any form. Avalanche finality is sub-second and probabilistic;
   * "instant finality" is a claim we cannot support, and this page goes to
   * institutional investors who will have it checked.
   */
  stats: [
    {
      label: "$631M",
      caption:
        "of BlackRock's tokenized treasury fund is issued on the Avalanche C-Chain, roughly a quarter of the fund.",
    },
    {
      label: "Under\nOne Second",
      caption:
        "Settlement completes without a reconciliation step, so positions spend almost no time in transit.",
    },
    {
      label: "Your Own\nSigners",
      caption:
        "Each chain verifies messages against its own list of authorised signers. No third party in the path.",
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
      body: "The Avalanche C-Chain settles in under a second, runs an Ethereum-equivalent environment so existing Besu work ports across, and connects onward to every other Avalanche network through a mechanism already in production.",
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
      body: "A technical session between both architecture teams to scope the connection against your existing estate.",
    },
  ],
} as const;

/* ---------------- What the destination gives you ---------------- */

/**
 * Sits between SUMMARY and MECHANISM. The audience for this page is investors,
 * CEOs and business leadership — this section sells the destination, and the
 * mechanism material after it summarises and hands off to the technical page.
 *
 * Present tense, no maturity hedging, by standing decision. The build status of
 * the connection is tracked internally, not in this copy.
 */
export const DESTINATION = {
  rail: ["WHAT THE", "DESTINATION", "GIVES YOU"],
  heading: "What the destination gives you",
  presence: {
    eyebrow: "INSTITUTIONAL PRESENCE",
    body: "BlackRock's tokenised treasury fund is issued across a small set of networks. The Avalanche C-Chain holds $631M of it, roughly a quarter of the fund.",
  },
  items: [
    {
      eyebrow: "SETTLEMENT SPEED, TRANSLATED",
      body: "Settlement completes in under a second. In operational terms that means positions spend almost no time in transit, in-transit balances stay small at end of day, the same collateral can be redeployed several times intraday, and the waiting period a confirmation policy would otherwise encode before a client is told a transfer is complete largely disappears.",
    },
    {
      // Not "compliance tools". Permissioning is not compliance, and that
      // phrase will not survive a risk review. Do not reword toward it.
      eyebrow: "CONTROLS AT PROTOCOL LEVEL",
      body: "Permissioning is enforced by the network itself, not by application code. Transaction, deployment and issuance rights are assigned by role, with distinct levels for administrators, managers and permitted participants.",
    },
    {
      eyebrow: "ONWARD REACH",
      body: "Reaching any other Avalanche network uses the same messaging layer, already running in production. A counterparty, fund administrator or settlement partner operating their own network is a configuration change rather than a new integration.",
    },
  ],
} as const;

/**
 * Market cap by network. THE NUMBER IS NOT CLEARED FOR PUBLICATION.
 *
 * The source chart is titled "Market Cap by Network" and does not say BUIDL.
 * Whether it measures BlackRock's fund specifically or all tokenised assets on
 * those networks is unconfirmed, and the two produce completely different
 * claims. `unverified` renders a visible marker on the chart; clear it only
 * when the owning office closes the question.
 *
 * Constraints carried in the rendering, not just here:
 *  - Ethereum stays at full size. Shrinking the largest value to flatter ours
 *    is the one thing that would destroy the chart's credibility.
 *  - Avalanche is never labelled "second". Solana leads it by $24.3M.
 *  - No growth, trend or momentum language. This is one day, no time series.
 *  - Source and as-of date render on the chart itself.
 */
export const MARKET_CAP = {
  title: "Market cap by network",
  unverified: {
    flag: "UNVERIFIED — NOT FOR PUBLICATION",
    note: "Pending confirmation of whether this series measures BlackRock's fund specifically or all tokenised assets on these networks.",
  },
  source: "Source: rwa.xyz, as of 6 August 2026",
  footnote:
    "Labelled total $2,623.8M. The source pie carries one or two unlabelled slivers, so the total is a floor and each share above is marginally overstated.",
  /** All five networks, descending. The table always shows every row.
   *  Which wedge takes the accent is a chart concern and lives in WEDGES in
   *  MarketCapChart, not here. */
  rows: [
    { network: "Ethereum", value: 1200.0, display: "$1,200.0M", share: "45.7%" },
    { network: "Solana", value: 655.5, display: "$655.5M", share: "25.0%" },
    { network: "Avalanche C-Chain", value: 631.2, display: "$631.2M", share: "24.1%" },
    { network: "BNB Chain", value: 110.8, display: "$110.8M", share: "4.2%" },
    { network: "Optimism", value: 26.3, display: "$26.3M", share: "1.0%" },
  ],
  /** Which network takes the accent, in the chart and in the table. */
  accentNetwork: "Avalanche C-Chain",
  totalLabel: "Labelled total",
  totalDisplay: "$2,623.8M",
  totalShare: "100%",
  /** The pie folds the tail into "Other" so it stays at four wedges. Stated on
   *  the chart as well as here, so the fold is recoverable where it happens. */
  otherLabel: "Other",
  otherDisplay: "$137.1M",
  otherShare: "5.2%",
  foldNote: "BNB Chain and Optimism, itemised below",
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
      // "which gets solved with retries" was cut deliberately. Retries do not
      // solve non-delivery when the institution runs the only relay and it is
      // down, and the phrase flattened three distinct failure modes into a
      // reassurance. Do not restore it.
      eyebrow: "ONLY FAILURE",
      body: "Non-delivery. It can delay a message, never change one.",
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
  /**
   * Three rows, not six. This is a business page; the full comparison lives on
   * the mechanism page at /solutions/patterns/external-evm-icm. The rows cut
   * were "What secures a message", "Choice of who delivers" and "Chains
   * available today" — the last of which carried our honest loss, which is why
   * `concession` below is mandatory rather than decorative.
   */
  rows: [
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
  ],
  /**
   * NOT OPTIONAL. A comparison a reader can see we won on every line is a
   * comparison they discount entirely. This sentence is what makes the other
   * three rows land. Do not delete it, and do not demote it below pullNote.
   */
  concession:
    "Oracle designs win on breadth. They connect to many chains today and ask nothing of the counterparty chain. This design covers one pair at a time and requires deliberate work on both sides.",
  pullNote:
    "Either oracle design adds a verification role that did not previously exist, and that role has to be operated, funded and answered for. Under the attestor design the parties attesting to messages are the parties already attesting to the chain, so an existing and already audited trust relationship is reused rather than a new one created.",
} as const;

export const CTA = {
  headingLines: ["A technical session", "between both", "architecture teams"],
  deck: "To confirm the requirement and scope the missing elements at application level.",
  /** The primary still needs a real form; it remains on the #next anchor.
   *  The secondary now goes somewhere real: the mechanism page. */
  primaryCta: { label: ASK, href: "#next" },
  secondaryCta: {
    label: "HOW THE CONNECTION WORKS",
    href: "/solutions/patterns/external-evm-icm",
  },
} as const;

export const FOOTER = {
  /** "Institutional research" is a regulated term of art in finance. It must
   *  not appear on marketing material aimed at banks and asset managers. */
  left: "AVA LABS · INSTITUTIONAL SOLUTIONS · AUGUST 2026",
  right: "TECHNOLOGY BUILT FOR BUSINESS",
} as const;

export const PAGE_META = {
  title: "Connect your Besu chain to a market | Avalanche",
  description:
    "Connecting an institutional Hyperledger Besu network to the Avalanche C-Chain with Interchain Messaging and external attestors, without handing control to a third party.",
} as const;
