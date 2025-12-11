"use client";

import Image from "next/image";

export interface ChainInfo {
  chainId: string;
  chainName: string;
  chainSlug: string;
  chainLogoURI: string;
  color: string;
  tokenSymbol?: string;
}

export interface ChainChipProps {
  chain: ChainInfo;
  size?: "xs" | "sm" | "md";
  onClick?: () => void;
  showName?: boolean;
}

/**
 * Reusable chain chip component displaying chain logo and name with colored background
 */
export function ChainChip({ 
  chain, 
  size = "sm", 
  onClick,
  showName = true,
}: ChainChipProps) {
  const sizeConfig = {
    xs: { img: 12, fallback: "w-3 h-3", text: "text-[10px]", padding: "px-1.5 py-0.5" },
    sm: { img: 14, fallback: "w-3.5 h-3.5", text: "text-[10px]", padding: "px-1.5 py-0.5" },
    md: { img: 16, fallback: "w-4 h-4", text: "text-xs", padding: "px-2 py-1" },
  };

  const config = sizeConfig[size];

  return (
    <span
      className={`inline-flex items-center gap-1 ${config.padding} rounded ${config.text} font-medium transition-opacity ${
        onClick ? "hover:opacity-80 cursor-pointer" : ""
      }`}
      style={{ backgroundColor: `${chain.color}20`, color: chain.color }}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          e.preventDefault();
          onClick();
        }
      }}
    >
      {chain.chainLogoURI ? (
        <Image
          src={chain.chainLogoURI}
          alt={chain.chainName}
          width={config.img}
          height={config.img}
          className="rounded-full"
        />
      ) : (
        <span 
          className={`${config.fallback} rounded-full flex-shrink-0`} 
          style={{ backgroundColor: chain.color }} 
        />
      )}
      {showName && chain.chainName}
    </span>
  );
}

/**
 * Helper to create ChainInfo from l1-chains.json data
 */
export function createChainInfo(chain: {
  chainId: string;
  chainName: string;
  slug: string;
  chainLogoURI?: string;
  color?: string;
  networkToken?: { symbol?: string };
}): ChainInfo {
  return {
    chainId: chain.chainId,
    chainName: chain.chainName,
    chainSlug: chain.slug,
    chainLogoURI: chain.chainLogoURI || '',
    color: chain.color || '#6B7280',
    tokenSymbol: chain.networkToken?.symbol || '',
  };
}

