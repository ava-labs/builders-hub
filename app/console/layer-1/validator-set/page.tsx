"use client";

import { lazy } from "react";

const QueryL1ValidatorSet = lazy(() => 
  import("../../../../toolbox/src/toolbox/ValidatorManager/QueryL1ValidatorSet").then(module => ({
    default: module.default
  }))
);


export default function Page() {
  return (
    <QueryL1ValidatorSet />
  );
}