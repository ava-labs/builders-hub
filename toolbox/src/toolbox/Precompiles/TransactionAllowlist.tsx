"use client";

import { useWalletStore } from "../../lib/walletStore";
import { Container } from "../components/Container";
import { AllowlistComponent } from "../components/AllowListComponents";

// Default Transaction AllowList address
const DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS =
  "0x0200000000000000000000000000000000000002";

export default function TransactionAllowlist() {
  return (
    <div className="space-y-6">
      <div className="w-full">
        <AllowlistComponent
          precompileAddress={DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS}
          precompileType="Transaction"
        />
      </div>
    </div>
  );
}
