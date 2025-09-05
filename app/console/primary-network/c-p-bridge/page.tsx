"use client";

import Bridge from "@/toolbox/src/components/CrossChainTransfer";
import ToolboxConsoleWrapper from "@/toolbox/src/components/ToolboxConsoleWrapper";

export default function Page() {
  return (
    <ToolboxConsoleWrapper>
      <Bridge />
    </ToolboxConsoleWrapper>
  );
}