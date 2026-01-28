"use client";

import React from "react";
import { L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { ConnectionStatus, TokenInfo, statusColors } from "@/hooks/useICTTWorkbench";
import { cn } from "@/lib/utils";
import { Globe, Star } from "lucide-react";

interface ChainNodeProps {
  chain: L1ListItem;
  isCenter?: boolean;
  status?: ConnectionStatus;
  token?: TokenInfo;
  onClick?: () => void;
  isSelected?: boolean;
  connectionsCount?: number;
  isDeploying?: boolean;
  deploymentProgress?: number; // 0-100
}

export function ChainNode({
  chain,
  isCenter = false,
  status,
  token,
  onClick,
  isSelected = false,
  connectionsCount,
  isDeploying = false,
  deploymentProgress,
}: ChainNodeProps) {
  const statusColor = status ? statusColors[status] : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative group transition-all duration-200",
        onClick && "cursor-pointer",
        isSelected && "scale-110"
      )}
    >
      {/* Glow effect for center node */}
      {isCenter && (
        <div className="absolute inset-0 -m-2 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
      )}

      {/* Selected ring animation */}
      {isSelected && !isCenter && (
        <div className="absolute -inset-2 rounded-full border-2 border-blue-500 animate-ping opacity-30" />
      )}

      {/* Deploying ring animation */}
      {isDeploying && (
        <div className="absolute -inset-2 rounded-full border-2 border-yellow-500 animate-spin opacity-60" style={{ borderTopColor: 'transparent' }} />
      )}

      {/* Status ring */}
      {status && statusColor && (
        <div
          className={cn(
            "absolute -inset-1 rounded-full opacity-60",
            status === "live" && "animate-pulse"
          )}
          style={{
            background: `radial-gradient(circle, ${
              status === "live"
                ? "rgba(34, 197, 94, 0.3)"
                : status === "not-started"
                ? "rgba(161, 161, 170, 0.2)"
                : "rgba(234, 179, 8, 0.3)"
            } 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Main node container */}
      <div
        className={cn(
          "relative flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all duration-200",
          isCenter
            ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/30"
            : "bg-zinc-800 border-zinc-600 text-zinc-100 hover:border-zinc-500",
          isSelected && !isCenter && "border-blue-500 ring-2 ring-blue-500/30",
          onClick && !isCenter && "hover:bg-zinc-700"
        )}
      >
        {/* Chain logo */}
        <div className="relative flex-shrink-0">
          {chain.logoUrl ? (
            <img
              src={chain.logoUrl}
              alt={chain.name}
              className={cn(
                "rounded-full object-cover",
                isCenter ? "w-8 h-8" : "w-6 h-6"
              )}
            />
          ) : (
            <div
              className={cn(
                "rounded-full bg-zinc-700 flex items-center justify-center",
                isCenter ? "w-8 h-8" : "w-6 h-6"
              )}
            >
              <Globe className={cn(isCenter ? "w-5 h-5" : "w-4 h-4", "text-zinc-400")} />
            </div>
          )}

          {/* Status dot */}
          {status && statusColor && (
            <div
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-800",
                statusColor.dot
              )}
            />
          )}
        </div>

        {/* Chain name and token */}
        <div className="flex flex-col min-w-0">
          <span
            className={cn(
              "font-medium truncate",
              isCenter ? "text-sm" : "text-xs"
            )}
          >
            {chain.name}
          </span>
          {token && !isCenter && (
            <span className="text-[10px] text-zinc-400 truncate">
              {token.symbol}
            </span>
          )}
        </div>

        {/* Center indicator */}
        {isCenter && (
          <Star className="w-4 h-4 text-yellow-300 flex-shrink-0" fill="currentColor" />
        )}
      </div>

      {/* Connections count badge for center node */}
      {isCenter && connectionsCount !== undefined && connectionsCount > 0 && (
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-zinc-700 text-zinc-200 text-[10px] font-medium px-2 py-0.5 rounded-full border border-zinc-600">
          {connectionsCount} bridge{connectionsCount !== 1 ? "s" : ""}
        </div>
      )}

      {/* Deployment progress badge */}
      {deploymentProgress !== undefined && deploymentProgress > 0 && deploymentProgress < 100 && (
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-[9px] font-medium px-2 py-0.5 rounded-full">
          {deploymentProgress}%
        </div>
      )}

      {/* Hover tooltip */}
      {!isCenter && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
          <div className="bg-zinc-900 text-zinc-100 text-xs px-3 py-2 rounded-lg shadow-lg border border-zinc-700 whitespace-nowrap">
            <div className="font-medium">{chain.name}</div>
            {token && (
              <div className="text-zinc-400 mt-1">
                Token: {token.symbol}
              </div>
            )}
            {status && (
              <div className={cn("mt-1", statusColor?.text)}>
                Status: {status.replace(/-/g, " ")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChainNode;
