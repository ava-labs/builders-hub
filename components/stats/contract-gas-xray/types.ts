// Shared types for Contract Gas X-Ray components

export interface AddressInfo {
  address: string;
  name: string | null;
  protocol: string | null;
  category: string | null;
}

export interface FlowEntry extends AddressInfo {
  gas: number;
  avax: number;
  txCount: number;
  gasPercent: number;
}

export interface ContractGasFlowResponse {
  target: AddressInfo;
  classification: "entry_point" | "gas_burner" | "mixed";
  selfGasRatio: number;
  summary: {
    totalGasReceived: number;
    totalGasGiven: number;
    selfGas: number;
    totalAvaxReceived: number;
    totalAvaxGiven: number;
    selfAvax: number;
    totalTransactions: number;
    uniqueCallers: number;
  };
  callers: FlowEntry[];
  callees: FlowEntry[];
  timeRange: string;
}

export type XrayTimeRange = "1" | "7" | "30" | "90" | "custom";

export const TIME_OPTIONS: { value: Exclude<XrayTimeRange, "custom">; label: string }[] = [
  { value: "1", label: "1D" },
  { value: "7", label: "1W" },
  { value: "30", label: "1M" },
  { value: "90", label: "3M" },
];
