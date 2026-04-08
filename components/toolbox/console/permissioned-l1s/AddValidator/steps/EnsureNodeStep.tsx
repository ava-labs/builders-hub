"use client";

import React from "react";
import Link from "next/link";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { StepCodeViewer } from "@/components/console/step-code-viewer";
import { STEP_CONFIG } from "../code-config";

export default function EnsureNodeStep() {
  const { isTestnet } = useWalletStore();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Ensure L1 Node is Running</h2>
        <p className="text-sm text-gray-500 mb-4">
          Before adding a validator, you must have an L1 node set up and running. If you haven{"'"}t done this yet,
          visit the{" "}
          <Link
            href="/console/layer-1/l1-node-setup"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            L1 Node Setup Tool
          </Link>{" "}
          first.
          {isTestnet && (
            <>
              {" "}On testnet, you can also use our{" "}
              <Link
                href="/console/testnet-infra/nodes"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                free testnet infrastructure
              </Link>
              .
            </>
          )}
        </p>
      </div>
      <StepCodeViewer
        activeStep={0}
        steps={STEP_CONFIG}
        className="lg:sticky lg:top-4 lg:self-start"
      />
    </div>
  );
}
