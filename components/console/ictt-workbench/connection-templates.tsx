"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  Coins,
  Layers,
  Network,
  ArrowRight,
  Check,
} from "lucide-react";
import { TokenType } from "@/hooks/useICTTWorkbench";

export interface ConnectionTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  tokenType: TokenType;
  features: string[];
  recommended?: boolean;
  // Pre-filled configuration
  config?: {
    tokenName?: string;
    tokenSymbol?: string;
    targetChainName?: string;
  };
}

export const CONNECTION_TEMPLATES: ConnectionTemplate[] = [
  {
    id: "usdc-bridge",
    name: "USDC Bridge",
    description: "Bridge USDC to your L1 from C-Chain or another Avalanche L1.",
    icon: <Coins className="w-5 h-5" />,
    iconBg: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    tokenType: "erc20-to-erc20",
    features: [
      "ERC20 to ERC20 transfer",
      "Maintain token decimals",
      "Standard collateral model",
    ],
    recommended: true,
    config: {
      tokenName: "USDC",
      tokenSymbol: "USDC",
    },
  },
  {
    id: "native-wrapper",
    name: "Native Token Wrapper",
    description: "Create a wrapped version of your native gas token on another chain.",
    icon: <Layers className="w-5 h-5" />,
    iconBg: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    tokenType: "native-to-erc20",
    features: [
      "Native to ERC20 conversion",
      "Wrapped token representation",
      "Gas token bridging",
    ],
  },
  {
    id: "hub-spoke",
    name: "Hub & Spoke",
    description: "Create a central home with multiple remote destinations for multi-chain bridging.",
    icon: <Network className="w-5 h-5" />,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    tokenType: "erc20-to-erc20",
    features: [
      "One home, multiple remotes",
      "Centralized collateral",
      "Multi-chain distribution",
    ],
  },
];

interface ConnectionTemplateCardProps {
  template: ConnectionTemplate;
  onSelect: (template: ConnectionTemplate) => void;
  selected?: boolean;
}

function ConnectionTemplateCard({
  template,
  onSelect,
  selected,
}: ConnectionTemplateCardProps) {
  return (
    <button
      onClick={() => onSelect(template)}
      className={cn(
        "relative p-4 rounded-xl border-2 text-left transition-all",
        selected
          ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
      )}
    >
      {/* Recommended badge */}
      {template.recommended && (
        <div className="absolute -top-2.5 right-3 px-2 py-0.5 text-xs font-medium bg-violet-500 text-white rounded-full">
          Recommended
        </div>
      )}

      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", template.iconBg)}>
          {template.icon}
        </div>
        <div>
          <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
            {template.name}
          </h4>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {template.description}
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-1.5 mt-4">
        {template.features.map((feature, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400"
          >
            <div className="w-1 h-1 rounded-full bg-zinc-400" />
            {feature}
          </div>
        ))}
      </div>
    </button>
  );
}

interface ConnectionTemplatesProps {
  onSelectTemplate: (template: ConnectionTemplate) => void;
  onCustomConnection: () => void;
  selectedTemplateId?: string;
}

export function ConnectionTemplates({
  onSelectTemplate,
  onCustomConnection,
  selectedTemplateId,
}: ConnectionTemplatesProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Start with a Template
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Choose a pre-configured bridge setup for common use cases
        </p>
      </div>

      {/* Template Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONNECTION_TEMPLATES.map((template) => (
          <ConnectionTemplateCard
            key={template.id}
            template={template}
            onSelect={onSelectTemplate}
            selected={selectedTemplateId === template.id}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 pt-4">
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        <span className="text-xs text-zinc-400 uppercase tracking-wide">or</span>
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Custom Connection Button */}
      <button
        onClick={onCustomConnection}
        className="w-full p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors flex items-center justify-center gap-2"
      >
        Create Custom Connection
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// Compact version for inline display
interface ConnectionTemplateSelectProps {
  onSelect: (template: ConnectionTemplate) => void;
  selectedId?: string;
}

export function ConnectionTemplateSelect({
  onSelect,
  selectedId,
}: ConnectionTemplateSelectProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CONNECTION_TEMPLATES.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelect(template)}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
            selectedId === template.id
              ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300"
              : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          )}
        >
          <span className={cn("w-5 h-5 rounded flex items-center justify-center text-xs", template.iconBg)}>
            {template.icon}
          </span>
          {template.name}
          {selectedId === template.id && (
            <Check className="w-3.5 h-3.5 text-violet-500" />
          )}
        </button>
      ))}
    </div>
  );
}

export default ConnectionTemplates;
