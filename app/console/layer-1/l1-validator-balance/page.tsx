"use client";

import { lazy } from "react";

const L1ValidatorBalance = lazy(() =>
  import("../../../../toolbox/src/toolbox/Nodes/BalanceTopup").then(
    (module) => ({ default: module.default })
  )
);

export default function Page() {
  return (
    <L1ValidatorBalance />
  );
}