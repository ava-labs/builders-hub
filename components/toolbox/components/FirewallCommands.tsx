"use client";

import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

export type NodeTypeL1 = "validator" | "public-rpc" | "validator-rpc";
export type NodeTypePrimaryNetwork = "validator" | "public-rpc";

interface FirewallCommandsProps {
    nodeType: NodeTypeL1 | NodeTypePrimaryNetwork;
    /**
     * For L1 nodes: validator=9651, rpc=9650, both=9650+9651
     * For Primary Network: validator=localhost only, rpc=9650+9651
     */
    variant?: "l1" | "primary-network";
    className?: string;
}

/**
 * Generates firewall commands based on node type and network variant.
 *
 * Port semantics:
 * - 9650: HTTP RPC API (user queries, admin access)
 * - 9651: P2P/Staking (validator communication, network sync)
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
export function generateFirewallCommands(
    nodeType: NodeTypeL1 | NodeTypePrimaryNetwork,
    variant: "l1" | "primary-network" = "l1"
): string {
    const sshRule = `# Allow SSH (adjust if using different port)
sudo ufw allow 22/tcp`;

    const enableFirewall = `# Enable firewall
sudo ufw enable`;

    if (variant === "primary-network") {
        // Primary Network firewall rules
        if (nodeType === "validator") {
            return `# Validator: No public ports needed (9650 is localhost-only)
${sshRule}

${enableFirewall}`;
        } else {
            // public-rpc
            return `# RPC Node: Open ports 9650 (HTTP API) and 9651 (P2P)
${sshRule}

# Allow HTTP RPC
sudo ufw allow 9650/tcp

# Allow P2P for syncing
sudo ufw allow 9651/tcp

${enableFirewall}`;
        }
    } else {
        // L1 firewall rules
        if (nodeType === "validator") {
            return `# Validator: Open port 9651 (P2P for block production)
${sshRule}

# Allow P2P/Staking
sudo ufw allow 9651/tcp

${enableFirewall}`;
        } else if (nodeType === "public-rpc") {
            return `# RPC Node: Open port 9650 (HTTP API)
${sshRule}

# Allow HTTP RPC
sudo ufw allow 9650/tcp

${enableFirewall}`;
        } else {
            // validator-rpc (both)
            return `# Validator + RPC: Open ports 9650 (HTTP API) and 9651 (P2P)
${sshRule}

# Allow HTTP RPC
sudo ufw allow 9650/tcp

# Allow P2P/Staking
sudo ufw allow 9651/tcp

${enableFirewall}`;
        }
    }
}

/**
 * Get a description of the firewall configuration based on node type
 */
export function getFirewallDescription(
    nodeType: NodeTypeL1 | NodeTypePrimaryNetwork,
    variant: "l1" | "primary-network" = "l1"
): string {
    if (variant === "primary-network") {
        if (nodeType === "validator") {
            return "Validator nodes don't need public ports - 9650 is bound to localhost only.";
        } else {
            return "RPC nodes need port 9650 (HTTP API) and 9651 (P2P) open for public access.";
        }
    } else {
        if (nodeType === "validator") {
            return "Validator nodes need port 9651 (P2P) open for block production and validator communication.";
        } else if (nodeType === "public-rpc") {
            return "RPC nodes need port 9650 (HTTP API) open for serving user queries.";
        } else {
            return "Combined validator + RPC nodes need both port 9650 (HTTP API) and 9651 (P2P) open.";
        }
    }
}

export function FirewallCommands({ nodeType, variant = "l1", className = "" }: FirewallCommandsProps) {
    const commands = generateFirewallCommands(nodeType, variant);
    const description = getFirewallDescription(nodeType, variant);

    return (
        <div className={className}>
            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Configure Firewall</h4>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                {description}
            </p>
            <DynamicCodeBlock lang="bash" code={commands} />
        </div>
    );
}
