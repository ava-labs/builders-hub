"use client";

import { lazy } from "react";

const AddValidator = lazy(() =>
  import("../../../../toolbox/src/toolbox/ValidatorManager/AddValidator/AddValidator").then(
    (module) => ({ default: module.default })
  )
);

export default function Page() {
  return (
    <AddValidator />
  );
}