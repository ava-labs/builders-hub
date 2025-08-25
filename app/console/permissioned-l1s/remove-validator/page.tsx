"use client";

import { lazy } from "react";

const RemoveValidator = lazy(() =>
  import("../../../../toolbox/src/toolbox/ValidatorManager/RemoveValidator/RemoveValidator").then(
    (module) => ({ default: module.default })
  )
);


export default function Page() {
  return (
    <RemoveValidator />
  );
}