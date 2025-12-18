import FlowIntroduction from "@/components/console/flow-introduction";
import { type FlowConfig } from "@/components/console/step-flow";
import { steps } from "./steps";

export default function Page() {
  const config: FlowConfig = {
    title: "ICTT Setup",
    description: "Set up Interchain Token Transfer (ICTT) to enable seamless token bridging between your L1 and other chains in the Avalanche ecosystem.",
    metadata: {
      prerequisites: [
        { requirement: "ICM (Interchain Messaging) already set up on your L1", type: "infrastructure" },
        { requirement: "RPC endpoints for home and remote chains", type: "infrastructure" },
        { requirement: "Wallet with sufficient balance on both chains", type: "wallet" },
        { requirement: "Source token contract address (or deploy new one)", type: "wallet" },
        { requirement: "Understanding of token standards (ERC20)", type: "knowledge" },
        { requirement: "Familiarity with cross-chain token bridging concepts", type: "knowledge" },
      ],
      estimatedTime: "20-40 min",
      useCases: [
        "Bridge existing ERC20 tokens between your L1 and other chains",
        "Create wrapped versions of your native token on other networks",
        "Enable liquidity sharing across multiple chains",
        "Build cross-chain DeFi protocols with unified token access",
        "Support multi-chain gaming with in-game currency transfers",
      ],
    },
    resources: [
      { label: "Interchain Token Transfer", href: "/academy/interchain-token-transfer" },
      { label: "Interchain Messaging", href: "/academy/interchain-messaging" },
    ],
  };

  return (
    <FlowIntroduction
      config={config}
      steps={steps}
      url={import.meta.url}
    />
  );
}
