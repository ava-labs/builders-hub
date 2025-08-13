"use client";

import { lazy, Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";

const AddValidator = lazy(() =>
  import("../../../../toolbox/src/toolbox/ValidatorManager/AddValidator/AddValidator").then(
    (module) => ({ default: module.default })
  )
);

const RemoveValidator = lazy(() =>
  import("../../../../toolbox/src/toolbox/ValidatorManager/RemoveValidator/RemoveValidator").then(
    (module) => ({ default: module.default })
  )
);

const ChangeWeight = lazy(() =>
  import("../../../../toolbox/src/toolbox/ValidatorManager/ChangeWeight/ChangeWeight").then(
    (module) => ({ default: module.default })
  )
);

export default function Page() {
  return (
    <ToolboxConsoleWrapper>
      <Tabs defaultValue="add" className="w-full gap-6">
        <TabsList className="self-center">
          <TabsTrigger value="add">Add Validator</TabsTrigger>
          <TabsTrigger value="weight">Change Weight</TabsTrigger>
          <TabsTrigger value="remove">Remove Validator</TabsTrigger>
        </TabsList>

        <TabsContent value="add">
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading Add Validator...</div>}>
            <AddValidator />
          </Suspense>
        </TabsContent>

        <TabsContent value="weight">
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading Change Weight...</div>}>
            <ChangeWeight />
          </Suspense>
        </TabsContent>

        <TabsContent value="remove">
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading Remove Validator...</div>}>
            <RemoveValidator />
          </Suspense>
        </TabsContent>

      </Tabs>
    </ToolboxConsoleWrapper>
  );
}


