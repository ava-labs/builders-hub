"use client";

import UnitConverter from "@/toolbox/src/toolbox/Conversion/UnitConverter";
import ToolboxConsoleWrapper from "@/toolbox/src/components/ToolboxConsoleWrapper";

export default function Page() {
  return (
    <ToolboxConsoleWrapper>
      <UnitConverter />
    </ToolboxConsoleWrapper>
  );
}