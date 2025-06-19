"use client";

import { AllowlistComponent } from "../../components/AllowListComponents";
import { CheckPrecompile } from "../../components/CheckPrecompile";

// Default Transaction AllowList address
const DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS =
  "0x0200000000000000000000000000000000000002";

export default function TransactionAllowlist() {
  return (
    <CheckPrecompile
      configKey="txAllowListConfig"
      precompileName="Transaction Allowlist"
    >
      <AllowlistComponent
        precompileAddress={DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS}
        precompileType="Transaction"
      />
    </CheckPrecompile>
  );
}
