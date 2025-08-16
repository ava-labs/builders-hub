"use client";

import { lazy } from "react";

const TransactionAllowlist = lazy(() => 
  import("../../../../toolbox/src/toolbox/Precompiles/TransactionAllowlist").then(module => ({
    default: module.default
  }))
);


export default function Page() {
  return (
    <TransactionAllowlist />
  );
}