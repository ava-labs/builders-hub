"use client";

import { AlertDashboard } from "@/components/validator-alerts/AlertDashboard";
import ToolboxConsoleWrapper from "@/components/toolbox/components/ToolboxConsoleWrapper";

export default function Page() {
  return (
    <ToolboxConsoleWrapper>
      <AlertDashboard />
    </ToolboxConsoleWrapper>
  );
}
