"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";

type NodeTypeL1 = "validator" | "public-rpc" | "validator-rpc";
type NodeTypePrimaryNetwork = "validator" | "public-rpc";

interface NetworkingGuideProps {
  /** Additional CSS classes */
  className?: string;
  /** Custom title */
  title?: string;
  /** Node type to determine which ports to show */
  nodeType?: NodeTypeL1 | NodeTypePrimaryNetwork;
  /** Network variant - L1 or Primary Network have different port requirements */
  variant?: "l1" | "primary-network";
}

/**
 * Get the required ports based on node type and variant
 *
 * L1 Nodes:
 * - Validator: 9651 only (P2P for block production)
 * - RPC: 9650 only (HTTP API for queries)
 * - Both: 9650 + 9651 (full functionality)
 *
 * Primary Network:
 * - Validator: No public ports (9650 bound to localhost)
 * - RPC: 9650 + 9651 (HTTP API + P2P for syncing)
 */
function getRequiredPorts(
  nodeType: NodeTypeL1 | NodeTypePrimaryNetwork = "validator",
  variant: "l1" | "primary-network" = "l1"
): { port: string; description: string }[] {
  if (variant === "primary-network") {
    if (nodeType === "validator") {
      return []; // No public ports needed
    } else {
      return [
        { port: "9650", description: "HTTP API (RPC) - inbound TCP" },
        { port: "9651", description: "P2P Syncing - bidirectional TCP" },
      ];
    }
  } else {
    // L1 nodes
    if (nodeType === "validator") {
      return [
        { port: "9651", description: "P2P Staking - bidirectional TCP" },
      ];
    } else if (nodeType === "public-rpc") {
      return [
        { port: "9650", description: "HTTP API (RPC) - inbound TCP" },
      ];
    } else {
      // validator-rpc (both)
      return [
        { port: "9650", description: "HTTP API (RPC) - inbound TCP" },
        { port: "9651", description: "P2P Staking - bidirectional TCP" },
      ];
    }
  }
}

function getFirewallCommands(
  nodeType: NodeTypeL1 | NodeTypePrimaryNetwork = "validator",
  variant: "l1" | "primary-network" = "l1"
): string {
  const ports = getRequiredPorts(nodeType, variant);

  if (ports.length === 0) {
    return `# No public ports needed for this node type
# 9650 is bound to localhost only`;
  }

  const portCommands = ports.map(p => `sudo ufw allow ${p.port}/tcp`).join("\n");
  return `# Allow required Avalanche ports
${portCommands}`;
}

/**
 * Simplified networking guide for node setup.
 * Shows required ports and firewall commands based on node type.
 */
export function NetworkingGuide({
  className,
  title = "Network Requirements",
  nodeType = "validator",
  variant = "l1",
}: NetworkingGuideProps) {
  const [showFirewall, setShowFirewall] = useState(false);
  const ports = getRequiredPorts(nodeType, variant);
  const firewallCommands = getFirewallCommands(nodeType, variant);

  return (
    <div className={cn("space-y-4", className)}>
      <h4 className="text-sm font-medium">{title}</h4>

      {/* Required Ports - Dynamic based on node type */}
      <div className="space-y-2">
        {ports.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No public ports required. Port 9650 is bound to localhost only for admin access.
          </p>
        ) : (
          ports.map(({ port, description }) => (
            <div key={port} className="flex items-center gap-3 text-sm">
              <code className="px-2 py-1 rounded bg-muted font-mono text-xs">{port}</code>
              <span className="text-muted-foreground">{description}</span>
            </div>
          ))
        )}
      </div>

      {/* Firewall Commands - Expandable */}
      <div className="border rounded-lg">
        <button
          type="button"
          onClick={() => setShowFirewall(!showFirewall)}
          className="w-full flex items-center justify-between p-3 text-sm text-left hover:bg-muted/50 transition-colors"
        >
          <span className="font-medium">Firewall Commands</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showFirewall && "rotate-180")} />
        </button>

        {showFirewall && (
          <div className="px-3 pb-3 space-y-3">
            {/* UFW */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Ubuntu/Debian (UFW)</p>
              <DynamicCodeBlock lang="bash" code={firewallCommands} />
            </div>

            {/* Cloud */}
            {ports.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cloud Security Groups (AWS/GCP/Azure)</p>
                <div className="text-xs text-muted-foreground">
                  Allow inbound TCP on {ports.length === 1 ? "port" : "ports"}{" "}
                  {ports.map((p, i) => (
                    <span key={p.port}>
                      <code className="px-1 bg-muted rounded">{p.port}</code>
                      {i < ports.length - 1 && " and "}
                    </span>
                  ))}{" "}
                  from <code className="px-1 bg-muted rounded">0.0.0.0/0</code>
                </div>
              </div>
            )}

            <a
              href="https://build.avax.network/docs/nodes/configure/configs-flags"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Full documentation
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* Quick Troubleshooting */}
      {ports.some(p => p.port === "9651") && (
        <p className="text-xs text-muted-foreground">
          <strong>Not syncing?</strong> Ensure port 9651 allows bidirectional traffic. Home networks may need router port forwarding.
        </p>
      )}
    </div>
  );
}

export default NetworkingGuide;
