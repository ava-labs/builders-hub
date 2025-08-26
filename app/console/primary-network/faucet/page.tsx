"use client";

import { lazy } from "react";

const Faucet = lazy(() => 
  import("../../../../toolbox/src/toolbox/Wallet/Faucet").then(module => ({
    default: module.default
  }))
);


export default function Page() {
  return (
    <Faucet />
  );
}