"use client";

import { lazy } from "react";

const DeployerAllowlist = lazy(() => 
  import("../../../../toolbox/src/toolbox/Precompiles/DeployerAllowlist").then(module => ({
    default: module.default
  }))
);


export default function Page() {
  return (
    <DeployerAllowlist />
  );
}