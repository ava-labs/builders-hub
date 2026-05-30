export interface TourStep {
  id: string;
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right" | "auto";
  spotlightPadding?: number;
  /** If true, this step requires wallet connection to show */
  requiresWallet?: boolean;
  /** If true, this step prompts user to connect wallet */
  isWalletPrompt?: boolean;
}

export const CONSOLE_TOUR_STEPS: TourStep[] = [
  {
    id: "sidebar",
    target: "[data-tour='sidebar']",
    title: "Sidebar",
    description: "All tools organized by category. Click to expand.",
    position: "right",
    spotlightPadding: 0,
  },
  {
    id: "command-palette",
    target: "[data-tour='command-palette']",
    title: "Quick Search",
    description: "Press ⌘K to jump to any page.",
    position: "bottom",
  },
  {
    id: "network-switch",
    target: "[data-tour='network-switch']",
    title: "Network",
    description: "Switch between Mainnet and Fuji Testnet.",
    position: "bottom",
  },
  {
    id: "wallet-prompt",
    target: "[data-tour='wallet-connect']",
    title: "Connect Wallet",
    description: "Click to connect your Core wallet.",
    position: "bottom",
    isWalletPrompt: true,
  },
  {
    id: "wallet-connected",
    target: "[data-tour='wallet-connect']",
    title: "Wallet Connected",
    description: "Click to switch chains, view balance, or copy address.",
    position: "bottom",
    requiresWallet: true,
  },
  {
    id: "notifications",
    target: "[data-tour='notifications']",
    title: "Notifications",
    description: "Transaction updates appear here.",
    position: "bottom",
  },
  {
    id: "faucet",
    target: "[data-tour='faucet-link']",
    title: "Testnet Faucet",
    description: "Get free testnet AVAX for development.",
    position: "right",
  },
  {
    id: "create-l1",
    target: "[data-tour='create-l1-link']",
    title: "Create L1",
    description: "Start building your Layer 1 blockchain.",
    position: "right",
  },
];
