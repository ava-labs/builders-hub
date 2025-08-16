"use client";

import { lazy } from "react";

const RewardManager = lazy(() => 
  import("../../../../toolbox/src/toolbox/Precompiles/RewardManager").then(module => ({
    default: module.default
  }))
);


export default function Page() {
  return (
    <RewardManager />
  );
}