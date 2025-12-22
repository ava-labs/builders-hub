"use client";

import {
  Layers,
  Coins,
  ArrowRight,
  MessageSquare,
  ArrowLeftRight,
  Shield,
  BookOpen,
  Code,
  Wallet,
  Lock,
  Blocks,
  FileCode,
  Zap,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";
import type { AcademyPathType } from './academy-types';

interface Shortcut {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

// Avalanche L1 Academy shortcuts
const avalancheShortcuts: Shortcut[] = [
  {
    id: "create-l1",
    title: "Create an L1",
    description: "Build your own blockchain using the Builder Console",
    icon: Layers,
    href: "/academy/avalanche-l1/avalanche-fundamentals/creating-an-l1"
  },
  {
    id: "custom-token",
    title: "Create your Native Token",
    description: "Design custom tokenomics for your L1",
    icon: Coins,
    href: "/academy/avalanche-l1/l1-native-tokenomics/custom-tokens"
  },
  {
    id: "interchain-messaging",
    title: "Send Cross-Chain Messages",
    description: "Learn how ICM enables communication between chains",
    icon: MessageSquare,
    href: "/academy/avalanche-l1/interchain-messaging/icm-basics"
  },
  {
    id: "bridge-tokens",
    title: "Bridge Tokens",
    description: "Transfer assets between Avalanche blockchains",
    icon: ArrowLeftRight,
    href: "/academy/avalanche-l1/interchain-token-transfer"
  },
  {
    id: "permissioned-l1",
    title: "Permissioned Validators",
    description: "Set up Proof of Authority validation",
    icon: Shield,
    href: "/academy/avalanche-l1/permissioned-l1s"
  },
];

// Blockchain Academy shortcuts
const blockchainShortcuts: Shortcut[] = [
  {
    id: "what-is-blockchain",
    title: "What is a Blockchain?",
    description: "Understand the fundamentals of distributed ledgers",
    icon: Blocks,
    href: "/academy/blockchain/blockchain-fundamentals/what-is-a-blockchain"
  },
  {
    id: "smart-contracts",
    title: "Write Smart Contracts",
    description: "Learn Solidity basics with Foundry",
    icon: FileCode,
    href: "/academy/blockchain/solidity-foundry/smart-contracts"
  },
  {
    id: "erc20-tokens",
    title: "Deploy ERC-20 Tokens",
    description: "Create and deploy your own token",
    icon: Coins,
    href: "/academy/blockchain/solidity-foundry/erc20-smart-contracts"
  },
  {
    id: "x402-payments",
    title: "HTTP-Native Payments",
    description: "Instant, permissionless payments with x402",
    icon: Zap,
    href: "/academy/blockchain/x402-payment-infrastructure"
  },
  {
    id: "encrypted-erc",
    title: "Privacy with eERC",
    description: "Add privacy to your token applications",
    icon: Lock,
    href: "/academy/blockchain/encrypted-erc"
  },
];

interface AcademyShortcutSectionProps {
  pathType: AcademyPathType;
}

export function AcademyShortcutSection({ pathType }: AcademyShortcutSectionProps) {
  const shortcuts = pathType === 'avalanche' 
    ? avalancheShortcuts 
    : pathType === 'blockchain'
    ? blockchainShortcuts
    : [];

  if (shortcuts.length === 0) return null;

  return (
    <div className="mb-16">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-sm font-medium tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
          Quick Access
        </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {shortcuts.map((shortcut) => (
          <Link
            key={shortcut.id}
            href={shortcut.href}
            className={cn(
              "group block p-4 rounded-lg transition-all duration-150",
              "bg-zinc-50/50 dark:bg-zinc-900/50",
              "border border-zinc-200/50 dark:border-zinc-800/50",
              "hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50",
              "hover:border-zinc-300/50 dark:hover:border-zinc-700/50"
            )}
          >
            <div className="h-full min-h-[100px] flex flex-col">
              {/* Icon */}
              <div className="mb-3">
                <shortcut.icon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              
              {/* Content */}
              <div className="flex-1">
                <h3 className="text-base font-medium mb-1 text-zinc-900 dark:text-zinc-100">
                  {shortcut.title}
                </h3>
                
                <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-snug">
                  {shortcut.description}
                </p>
              </div>
              
              {/* Arrow */}
              <div className="mt-3 flex justify-end">
                <ArrowRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-500 transition-colors" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

