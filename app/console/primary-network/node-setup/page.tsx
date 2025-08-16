"use client";

import { lazy } from "react";

const PrimaryNetworkNodeSetup = lazy(() => 
  import("../../../../toolbox/src/toolbox/Nodes/AvalancheGoDockerPrimaryNetwork").then(module => ({
    default: module.default
  }))
);


export default function Page() {
  return (
    <PrimaryNetworkNodeSetup />
  );
}