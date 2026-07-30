import type { MessageKind } from "./types";

/** Display labels for the message vocabulary. Shown in panel eyebrows. */
export const KIND_LABELS: Record<MessageKind, string> = {
  "evm-tx": "EVM TX",
  "pchain-tx": "P-CHAIN TX",
  "warp-l1-sourced": "WARP · L1 SOURCED",
  "warp-pchain-sourced": "WARP · P-CHAIN SOURCED",
  signatures: "SIGNATURES",
};
