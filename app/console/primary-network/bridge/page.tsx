"use client";

import { lazy } from "react";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";
const Bridge = lazy(() => 
  import("../../../../toolbox/src/components/CrossChainTransfer").then(module => ({
    default: module.default
  }))
);


export default function Page() {
  return (
    <ToolboxConsoleWrapper>
      <Bridge />
    </ToolboxConsoleWrapper>
  );
}