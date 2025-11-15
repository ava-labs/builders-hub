import FlowIntroduction from "@/components/console/flow-introduction";
import { type FlowConfig } from "@/components/console/step-flow";
import { steps } from "./steps";

export default function Page() {
  const config: FlowConfig = {
    title: "ICM Setup",
    description: "Learn how to set up Interchain Messaging (ICM) on your L1, enabling cross-chain communication and applications like Interchain Token Transfers.",
    metadata: {
      prerequisites: [
        { requirement: "Access to your L1 RPC endpoint", type: "infrastructure" },
        { requirement: "Deployed L1 blockchain network", type: "infrastructure" },
        { requirement: "Wallet connected to your L1 network", type: "wallet" },
        { requirement: "Sufficient balance for contract deployments", type: "wallet" },
        { requirement: "Basic understanding of smart contracts", type: "knowledge" },
        { requirement: "Familiarity with cross-chain messaging concepts", type: "knowledge" },
      ],
      estimatedTime: "15-30 min",
      useCases: [
        "Enable cross-chain token transfers between your L1 and other chains",
        "Build multi-chain dApps that communicate across networks",
        "Create cross-chain NFT marketplaces or gaming ecosystems",
        "Implement cross-chain governance or DAO voting",
        "Bridge assets between your L1 and C-Chain or other L1s",
      ],
    },
    resources: [
      { label: "Interchain Messaging", href: "/academy/interchain-messaging" },
      { label: "ICM & Chainlink", href: "/academy/icm-chainlink" },
      { label: "Token Transfer", href: "/academy/interchain-token-transfer" },
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

