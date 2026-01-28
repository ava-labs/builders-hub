"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Lightbulb,
  ChevronRight,
  Server,
  Link2,
  Coins,
  Shield,
  Zap,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DecisionOption {
  id: "l1" | "c-chain";
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  pros: string[];
  cons: string[];
  bestFor: string[];
  recommendation?: string;
}

interface ValidatorManagerDecisionProps {
  /** Called when user selects an option */
  onSelect?: (choice: "l1" | "c-chain") => void;
  /** Pre-selected option */
  selected?: "l1" | "c-chain" | null;
  /** Additional CSS classes */
  className?: string;
  /** Show in compact mode */
  compact?: boolean;
  /** Title override */
  title?: string;
}

const OPTIONS: DecisionOption[] = [
  {
    id: "l1",
    title: "Deploy on Your L1",
    subtitle: "Self-managed validator contract",
    icon: <Server className="h-6 w-6" />,
    pros: [
      "Lower transaction fees (use your L1's native token)",
      "Full control over contract upgrades",
      "No dependency on C-Chain congestion",
      "Customizable gas parameters",
    ],
    cons: [
      "Requires bootstrap validators initially",
      "Must maintain sufficient L1 network health",
      "Initial setup is more complex",
    ],
    bestFor: [
      "Production L1s with established validator sets",
      "Teams prioritizing cost efficiency",
      "High-throughput networks",
    ],
    recommendation: "Recommended for most teams due to significant cost savings",
  },
  {
    id: "c-chain",
    title: "Deploy on C-Chain",
    subtitle: "Avalanche primary network",
    icon: <Link2 className="h-6 w-6" />,
    pros: [
      "Inherits C-Chain security immediately",
      "No bootstrap validators needed",
      "Simpler initial setup",
      "Battle-tested infrastructure",
    ],
    cons: [
      "Higher transaction fees (AVAX gas costs)",
      "Subject to C-Chain network congestion",
      "Less control over gas parameters",
    ],
    bestFor: [
      "New L1s during bootstrap phase",
      "Teams prioritizing simplicity",
      "Networks requiring immediate C-Chain integration",
    ],
  },
];

/**
 * Interactive decision helper for choosing where to deploy Validator Manager.
 * Helps users understand the tradeoffs between L1 and C-Chain deployment.
 */
export function ValidatorManagerDecision({
  onSelect,
  selected,
  className,
  compact = false,
  title = "Where should your Validator Manager live?",
}: ValidatorManagerDecisionProps) {
  const [hoveredOption, setHoveredOption] = useState<"l1" | "c-chain" | null>(null);
  const [showDetails, setShowDetails] = useState(!compact);

  const handleSelect = (optionId: "l1" | "c-chain") => {
    onSelect?.(optionId);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 text-white">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Compare deployment options to make the best choice for your network
            </p>
          </div>
        </div>
      </div>

      {/* Options Grid */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OPTIONS.map((option) => {
            const isSelected = selected === option.id;
            const isHovered = hoveredOption === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option.id)}
                onMouseEnter={() => setHoveredOption(option.id)}
                onMouseLeave={() => setHoveredOption(null)}
                className={cn(
                  "relative p-4 rounded-lg border-2 text-left transition-all duration-200",
                  isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500/20"
                    : isHovered
                    ? "border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50"
                    : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                )}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="h-5 w-5 text-blue-500" />
                  </div>
                )}

                {/* Option header */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-lg",
                      isSelected
                        ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    )}
                  >
                    {option.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {option.title}
                    </h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {option.subtitle}
                    </p>
                  </div>
                </div>

                {/* Quick pros/cons */}
                <div className="space-y-2">
                  {option.pros.slice(0, 2).map((pro, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{pro}</span>
                    </div>
                  ))}
                  {option.cons.slice(0, 1).map((con, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{con}</span>
                    </div>
                  ))}
                </div>

                {/* Recommendation badge */}
                {option.recommendation && (
                  <div className="mt-3 flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded-full w-fit">
                    <Lightbulb className="h-3 w-3" />
                    {option.recommendation}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Toggle details */}
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="mt-4 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              showDetails && "rotate-90"
            )}
          />
          {showDetails ? "Hide detailed comparison" : "Show detailed comparison"}
        </button>

        {/* Detailed Comparison */}
        {showDetails && (
          <div className="mt-4 border-t border-zinc-200 dark:border-zinc-700 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {OPTIONS.map((option) => (
                <div key={option.id} className="space-y-4">
                  <h5 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    {option.id === "l1" ? (
                      <Server className="h-4 w-4" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    {option.title}
                  </h5>

                  {/* All Pros */}
                  <div>
                    <h6 className="text-xs font-medium uppercase tracking-wider text-green-600 dark:text-green-400 mb-2">
                      Advantages
                    </h6>
                    <ul className="space-y-1.5">
                      {option.pros.map((pro, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          {pro}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* All Cons */}
                  <div>
                    <h6 className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                      Considerations
                    </h6>
                    <ul className="space-y-1.5">
                      {option.cons.map((con, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                        >
                          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                          {con}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Best For */}
                  <div>
                    <h6 className="text-xs font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">
                      Best For
                    </h6>
                    <ul className="space-y-1.5">
                      {option.bestFor.map((use, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                        >
                          <Users className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          {use}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary comparison table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="text-left py-2 px-3 text-zinc-600 dark:text-zinc-400 font-medium">
                      Feature
                    </th>
                    <th className="text-center py-2 px-3 text-zinc-600 dark:text-zinc-400 font-medium">
                      <div className="flex items-center justify-center gap-1">
                        <Server className="h-4 w-4" />
                        Your L1
                      </div>
                    </th>
                    <th className="text-center py-2 px-3 text-zinc-600 dark:text-zinc-400 font-medium">
                      <div className="flex items-center justify-center gap-1">
                        <Link2 className="h-4 w-4" />
                        C-Chain
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-zinc-900 dark:text-zinc-100">
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 px-3 flex items-center gap-2">
                      <Coins className="h-4 w-4 text-zinc-400" />
                      Transaction Fees
                    </td>
                    <td className="py-2 px-3 text-center text-green-600 dark:text-green-400">Lower</td>
                    <td className="py-2 px-3 text-center text-amber-600 dark:text-amber-400">Higher</td>
                  </tr>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 px-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-zinc-400" />
                      Setup Complexity
                    </td>
                    <td className="py-2 px-3 text-center text-amber-600 dark:text-amber-400">Higher</td>
                    <td className="py-2 px-3 text-center text-green-600 dark:text-green-400">Lower</td>
                  </tr>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 px-3 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-zinc-400" />
                      Security Model
                    </td>
                    <td className="py-2 px-3 text-center">Self-managed</td>
                    <td className="py-2 px-3 text-center">Inherited</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 flex items-center gap-2">
                      <Server className="h-4 w-4 text-zinc-400" />
                      Bootstrap Required
                    </td>
                    <td className="py-2 px-3 text-center text-amber-600 dark:text-amber-400">Yes</td>
                    <td className="py-2 px-3 text-center text-green-600 dark:text-green-400">No</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick tip */}
        <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Tip:</strong> Most production teams choose to deploy on their L1 for significant gas cost savings. Start with C-Chain during initial development if you need faster iteration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ValidatorManagerDecision;
