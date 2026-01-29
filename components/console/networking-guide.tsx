"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";

interface NetworkingGuideProps {
  /** Additional CSS classes */
  className?: string;
  /** Custom title */
  title?: string;
}

const UFW_COMMANDS = `# Allow Avalanche ports
sudo ufw allow 9650/tcp
sudo ufw allow 9651/tcp`;

/**
 * Simplified networking guide for L1 node setup.
 * Shows required ports and firewall commands in a clean, minimal format.
 */
export function NetworkingGuide({
  className,
  title = "Network Requirements",
}: NetworkingGuideProps) {
  const [showFirewall, setShowFirewall] = useState(false);

  return (
    <div className={cn("space-y-4", className)}>
      <h4 className="text-sm font-medium">{title}</h4>

      {/* Required Ports - Simple list */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 text-sm">
          <code className="px-2 py-1 rounded bg-muted font-mono text-xs">9650</code>
          <span className="text-muted-foreground">HTTP API (RPC) - inbound TCP</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <code className="px-2 py-1 rounded bg-muted font-mono text-xs">9651</code>
          <span className="text-muted-foreground">P2P Staking - bidirectional TCP</span>
        </div>
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
              <DynamicCodeBlock lang="bash" code={UFW_COMMANDS} />
            </div>

            {/* Cloud */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cloud Security Groups (AWS/GCP/Azure)</p>
              <div className="text-xs text-muted-foreground">
                Allow inbound TCP on ports <code className="px-1 bg-muted rounded">9650</code> and <code className="px-1 bg-muted rounded">9651</code> from <code className="px-1 bg-muted rounded">0.0.0.0/0</code>
              </div>
            </div>

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
      <p className="text-xs text-muted-foreground">
        <strong>Not syncing?</strong> Ensure port 9651 allows bidirectional traffic. Home networks may need router port forwarding.
      </p>
    </div>
  );
}

export default NetworkingGuide;
