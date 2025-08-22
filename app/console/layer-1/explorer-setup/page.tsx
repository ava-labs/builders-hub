"use client";

import { lazy } from "react";

const L1ExplorerSetup = lazy(() => 
  import("../../../../toolbox/src/toolbox/L1/SelfHostedExplorer").then(module => ({
    default: module.default
  }))
);


export default function Page() {
  return (
    <L1ExplorerSetup />
  );
}