"use client";

import { lazy } from "react";

const FeeManager = lazy(() => 
  import("../../../../toolbox/src/toolbox/Precompiles/FeeManager").then(module => ({
    default: module.default
  }))
);


export default function Page() {
  return (
    <FeeManager />
  );
}