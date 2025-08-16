"use client";

import { lazy } from "react";

const L1NodeSetup = lazy(() => 
  import("../../../../toolbox/src/toolbox/Nodes/AvalancheGoDockerL1").then(module => ({
    default: module.default
  }))
);


export default function Page() {
  return (
    <L1NodeSetup />
  );
}