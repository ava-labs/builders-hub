import type { NavCategory } from "@/hooks/use-section-navigation";
import { RWA_FACILITIES, type RWAFacility } from "@/lib/rwa/facilities";
import { LINE_EVENT_LABELS } from "@/lib/rwa/utils";

/* Each facility's page copy, keyed by slug, beside the data config in
   lib/rwa/facilities.ts: the switch's label and the page's URL, the title
   and the partners' marks, the section rail, the capital flow's nodes and
   verbs, the ledger's cut column, and the line under the dashboard. OatFi's
   is the copy its page has always carried; Rain's names its line of credit. */

export interface PartnerMark {
  name: string;
  src: string;
  /** overrides the mark's classes: its h-6, or its dark-mode invert */
  className?: string;
}

export interface FlowNodeCopy {
  name: string;
  role: string;
}

export interface FlowCopy {
  /** the forward flow's three nodes */
  source: FlowNodeCopy;
  hub: FlowNodeCopy;
  borrower: FlowNodeCopy;
  /** the forward flow's two verbs */
  invested: string;
  deployed: string;
  /** the return flow's two nodes; its verb stays "Repaid" */
  payer: FlowNodeCopy;
  payee: FlowNodeCopy;
  /** the status row's label, and its bar's accessible name */
  status: string;
  statusBar: string;
  /** what "are unavailable right now" when the figures failed */
  unavailable: string;
}

export interface LedgerCopy {
  /** the record field the table cuts on, and the route param that asks for a cut */
  field: "direction" | "kind";
  /** the head of the cut's column */
  heading: string;
  /** the cut's chips, All first; a row's cell shows its value's label */
  options: { key: string; label: string }[];
  /** what a row is */
  noun: { one: string; many: string };
}

export interface RwaView {
  facility: RWAFacility;
  /** the facility switch's label */
  label: string;
  /** the facility's page */
  href: string;
  title: string;
  subtitle: string;
  /** after the Avalanche mark, which every view shows first */
  partners: PartnerMark[];
  /** the section rail, in page order */
  sections: NavCategory[];
  flow: FlowCopy;
  ledger: LedgerCopy;
  /** the line under the dashboard */
  source: string;
}

/** every facility's view, in the facility switch's order */
export const RWA_VIEWS = {
  oatfi: {
    facility: RWA_FACILITIES.oatfi,
    label: "OatFi",
    href: "/explorer/mainnet/c-chain/defi/rwa",
    title: "Valinor × OatFi × Fence Pilot",
    subtitle: "SPV capital flow dashboard on Avalanche C-Chain",
    partners: [
      { name: "Valinor", src: "/rwa/logos/valinor-wordmark.svg" },
      { name: "OatFi", src: "/rwa/logos/oatfi-wordmark.svg" },
      { name: "Fence", src: "/rwa/logos/fence.png" },
    ],
    sections: [
      { id: "rwa-metrics", label: "Metrics" },
      { id: "rwa-oatfi", label: "OatFi" },
      { id: "rwa-fence", label: "Facility" },
      { id: "rwa-capital-flow", label: "Capital Flow" },
      { id: "rwa-historical", label: "Historical" },
      { id: "rwa-transactions", label: "Transactions" },
    ],
    flow: {
      source: { name: "Lenders", role: "Capital source" },
      hub: { name: "Tranche Pool", role: "SPV vehicle" },
      borrower: { name: "Borrower", role: "Asset originator" },
      invested: "Invested",
      deployed: "Deployed",
      payer: { name: "Borrower", role: "Repayments" },
      payee: { name: "Pool", role: "Redistribution" },
      status: "Pool Status",
      statusBar: "Invested capital out of the pool",
      unavailable: "Pool figures",
    },
    ledger: {
      field: "direction",
      heading: "Direction",
      options: [
        { key: "all", label: "All" },
        { key: "inbound", label: "Inbound" },
        { key: "outbound", label: "Outbound" },
        { key: "internal", label: "Internal" },
      ],
      noun: { one: "transfer", many: "transfers" },
    },
    source:
      "USDC transfers, native and bridged, of the tranche pool, the borrower's operating wallet and the two lenders, indexed from the C-Chain. The facility figures come from Fence and refresh every 30 minutes.",
  },
  rain: {
    facility: RWA_FACILITIES.rain,
    label: "Rain",
    href: "/explorer/mainnet/c-chain/defi/rwa/rain",
    title: "Valinor × Rain × Credit Coop",
    subtitle: "Line of credit capital flow dashboard on Avalanche C-Chain",
    partners: [
      { name: "Valinor", src: "/rwa/logos/valinor-wordmark.svg" },
      { name: "Rain", src: "/rwa/logos/rain-wordmark.svg" },
      // a mark and two lines of words with a padded box: at h-9 its drawing is as tall as the other marks.
      // In dark mode it inverts like them; the hue turn keeps its purple close to the original
      { name: "Credit Coop", src: "/rwa/logos/credit-coop.svg", className: "h-9" },
    ],
    sections: [
      { id: "rwa-metrics", label: "Metrics" },
      { id: "rwa-capital-flow", label: "Capital Flow" },
      { id: "rwa-historical", label: "Historical" },
      { id: "rwa-transactions", label: "Transactions" },
    ],
    flow: {
      source: { name: "Valinor Credit Vault", role: "Capital source" },
      hub: { name: "Line of credit", role: "Credit Coop" },
      borrower: { name: "Rain", role: "Borrower" },
      invested: "Invested",
      deployed: "Drawn",
      payer: { name: "Spigot", role: "Rain's revenue" },
      payee: { name: "Line of credit", role: "Credit Coop" },
      status: "Line Status",
      statusBar: "Committed capital drawn from the line",
      unavailable: "Line figures",
    },
    ledger: {
      field: "kind",
      heading: "Type",
      options: [{ key: "all", label: "All" }, ...Object.entries(LINE_EVENT_LABELS).map(([key, label]) => ({ key, label }))],
      noun: { one: "transaction", many: "transactions" },
    },
    source:
      "Draws, repayments (interest included), commitments and withdrawals of Valinor's position on the line of credit, indexed from the C-Chain. Committed and outstanding capital are read from the line of credit contract.",
  },
} satisfies Record<string, RwaView>;

export type RwaSlug = keyof typeof RWA_VIEWS;
