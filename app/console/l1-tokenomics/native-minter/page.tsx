"use client";

import { lazy } from "react";

const NativeMinter = lazy(() => 
  import("../../../../toolbox/src/toolbox/Precompiles/NativeMinter").then(module => ({
    default: module.default
  }))
);


export default function Page() {
  return (
    <NativeMinter />
  );
}