"use client";

import { lazy } from "react";

const ChangeWeight = lazy(() =>
  import("../../../../toolbox/src/toolbox/ValidatorManager/ChangeWeight/ChangeWeight").then(
    (module) => ({ default: module.default })
  )
);


export default function Page() {
  return (
    <ChangeWeight />
  );
}