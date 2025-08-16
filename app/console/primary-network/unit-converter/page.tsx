"use client";

import { lazy } from "react";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";

const UnitConverter = lazy(() => 
  import("../../../../toolbox/src/toolbox/Conversion/UnitConverter").then(module => ({
    default: module.default
  }))
);


export default function Page() {
  return (
    <ToolboxConsoleWrapper>
      <UnitConverter />
    </ToolboxConsoleWrapper>
  );
}