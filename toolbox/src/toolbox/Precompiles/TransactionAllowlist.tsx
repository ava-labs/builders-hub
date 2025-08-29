"use client";

import { AllowlistComponent } from "../../components/AllowListComponents";
import { CheckPrecompile } from "../../components/CheckPrecompile";
import { WalletRequirementsConfigKey } from "../../hooks/useWalletRequirements";
import { CheckWalletRequirements } from "../../components/CheckWalletRequirements";

// Default Transaction AllowList address
const DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS =
  "0x0200000000000000000000000000000000000002";

export default function TransactionAllowlist() {
  return (
    <CheckWalletRequirements configKey={[
        WalletRequirementsConfigKey.EVMChainBalance,
    ]}>
      <CheckPrecompile
        configKey="txAllowListConfig"
        precompileName="Transaction Allowlist"
      >
        <AllowlistComponent
          precompileAddress={DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS}
          precompileType="Transaction"
        />
      </CheckPrecompile>
    </CheckWalletRequirements>
  );
}
