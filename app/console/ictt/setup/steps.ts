import { type StepDefinition } from "@/components/console/step-flow";
import DeployExampleERC20 from "@/components/toolbox/console/ictt/setup/DeployExampleERC20";
import DeployTokenHome from "@/components/toolbox/console/ictt/setup/DeployTokenHome";
import DeployERC20TokenRemote from "@/components/toolbox/console/ictt/setup/DeployERC20TokenRemote";
import DeployNativeTokenRemote from "@/components/toolbox/console/ictt/setup/DeployNativeTokenRemote";
import RegisterWithHome from "@/components/toolbox/console/ictt/setup/RegisterWithHome";
import AddCollateral from "@/components/toolbox/console/ictt/setup/AddCollateral";
import DeployWrappedNative from "@/components/toolbox/console/ictt/setup/DeployWrappedNative";

export const steps: StepDefinition[] = [
    {
      type: "branch",
      key: "deploy-source-token",
      title: "Deploy Source Token",
      description: "Deploy or select the token that will be bridged across chains. You can deploy a test ERC20 token for development purposes, or wrap your L1's native token to enable native asset transfers. If you already have a token deployed, you can skip this step.",
      optional: true,
      options: [
        { 
          key: "deploy-test-erc20", 
          label: "Deploy Test ERC20", 
          component: DeployExampleERC20,
          outcomes: [
            "Standard ERC20 token deployed for testing purposes",
            "Full control over token supply, name, and symbol",
          ],
        },
        { 
          key: "deploy-wrapped-native", 
          label: "Deploy Wrapped Native Token", 
          component: DeployWrappedNative,
          outcomes: [
            "Wrapped version of your L1's native token created",
            "Support for bridging native assets across chains",
          ],
        },
      ],
    },
    {
      type: "single",
      key: "deploy-token-home",
      title: "Deploy Token Home",
      component: DeployTokenHome,
      description: "Deploy the TokenHome contract on your source chain. This contract acts as the central hub for your token bridge, managing token locking (for native transfers), burning (for multi-mint), and minting operations. It coordinates with remote contracts to ensure secure cross-chain transfers.",
      outcomes: [
        "TokenHome contract deployed and linked to your token",
        "Token bridge infrastructure configured on home chain",
      ],
    },
    {
      type: "branch",
      key: "deploy-remote",
      title: "Deploy Remote",
      description: "Deploy the token representation on the destination chain. Choose ERC20 Remote for standard token transfers with custom metadata support, or Native Remote if you want the token to be the native gas token on the destination chain with lower transaction costs.",
      options: [
        { 
          key: "erc20-remote", 
          label: "Deploy ERC20 Token Remote", 
          component: DeployERC20TokenRemote,
          outcomes: [
            "ERC20 token representation deployed on remote chain",
            "Supports custom token decimals, names, and metadata",
          ],
        },
        { 
          key: "native-remote", 
          label: "Deploy Native Token Remote", 
          component: DeployNativeTokenRemote,
          outcomes: [
            "Native token representation on remote chain",
            "Lower gas costs and native-like user experience",
          ],
        },
      ],
    },
    {
      type: "single",
      key: "register-with-home",
      title: "Register With Home",
      component: RegisterWithHome,
      description: "Register the remote token contract with the TokenHome contract to establish the bidirectional connection. This step configures the routing information so that cross-chain messages can flow between your home and remote contracts securely.",
      outcomes: [
        "Remote token registered and verified with TokenHome",
        "Cross-chain message routing and validation configured",
      ],
    },
    {
      type: "single",
      key: "add-collateral",
      title: "Add Collateral",
      component: AddCollateral,
      description: "Deposit initial collateral on the remote chain to enable bidirectional token transfers. This collateral allows users to transfer tokens back from the remote chain to the home chain. The amount of collateral determines how much value can flow in the reverse direction.",
      outcomes: [
        "Initial collateral deposited and locked on remote chain",
        "Bidirectional token transfers fully enabled and operational",
      ],
    },
];
