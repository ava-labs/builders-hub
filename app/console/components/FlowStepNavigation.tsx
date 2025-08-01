"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface FlowStep {
  id: string;
  title: string;
  path: string;
}

interface Flow {
  id: string;
  steps: FlowStep[];
}

// Same flows as in FlowNavigation
const flows: Flow[] = [
  {
    id: "layer-1s",
    steps: [
      { id: "create-chain", title: "Create Chain", path: "/console/layer-1s/create-chain" },
      { id: "node-setup-docker", title: "Self-Hosted Nodes", path: "/console/layer-1s/node-setup-docker" },
      { id: "node-setup-managed", title: "Managed Nodes", path: "/console/layer-1s/node-setup-managed" },
      { id: "convert-to-l1", title: "Convert to L1", path: "/console/layer-1s/convert-to-l1" },
      { id: "explorer-setup", title: "Explorer Setup", path: "/console/layer-1s/explorer-setup" }
    ]
  },
  {
    id: "interoperability",
    steps: [
      { id: "interchain-messaging", title: "Interchain Messaging", path: "/console/interoperability/interchain-messaging" },
      { id: "interchain-token-transfer", title: "Token Transfer", path: "/console/interoperability/interchain-token-transfer" }
    ]
  },
  {
    id: "primary-network",
    steps: [
      { id: "cross-chain-transfer", title: "Cross-Chain Transfer", path: "/console/primary-network/cross-chain-transfer" },
      { id: "node-setup", title: "Node Setup", path: "/console/primary-network/node-setup" }
    ]
  }
];

interface FlowStepNavigationProps {
  currentPath: string;
}

export default function FlowStepNavigation({ currentPath }: FlowStepNavigationProps) {
  const router = useRouter();
  
  // Extract category and tool from current path
  const pathParts = currentPath.split('/').filter(Boolean);
  const category = pathParts[1];
  
  // Find the current flow
  const currentFlow = flows.find(flow => flow.id === category);
  
  if (!currentFlow) {
    return null;
  }
  
  // Find current step index
  const currentStepIndex = currentFlow.steps.findIndex(step => 
    currentPath.includes(step.id)
  );
  
  if (currentStepIndex === -1) {
    return null;
  }
  
  const previousStep = currentStepIndex > 0 ? currentFlow.steps[currentStepIndex - 1] : null;
  const nextStep = currentStepIndex < currentFlow.steps.length - 1 ? currentFlow.steps[currentStepIndex + 1] : null;
  
  return (
    <div className="flex items-center justify-between pt-6 border-t">
      <div className="flex-1">
        {previousStep && (
          <Button
            variant="outline"
            onClick={() => router.push(previousStep.path)}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous: {previousStep.title}</span>
          </Button>
        )}
      </div>
      
      <div className="flex-1 flex justify-end">
        {nextStep && (
          <Button
            onClick={() => router.push(nextStep.path)}
            className="gap-2"
          >
            <span>Next: {nextStep.title}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}