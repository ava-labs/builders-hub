import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";

// Console tool metadata interface
export interface ConsoleToolMetadata {
    /** Display name of the tool */
    title: string;
    /** Brief description of what the tool does */
    description: string;
    /** Wallet requirements including if the tool is only available on testnet */
    walletRequirements: WalletRequirementsConfigKey[];
}

// Props interface for console tools
export interface BaseConsoleToolProps {
    onSuccess?: () => void;
}

// Base console tool component type (before wrapping with metadata)
type BaseConsoleToolComponent = React.ComponentType<BaseConsoleToolProps>;

// Console Tool with Metadata
export type ConsoleToolComponent = BaseConsoleToolComponent & {
    /** Required metadata for all console tools */
    metadata: ConsoleToolMetadata;
};

// Utility type to ensure a component has the required metadata
export function withConsoleToolMetadata(
    BaseComponent: BaseConsoleToolComponent,
    metadata: ConsoleToolMetadata
): ConsoleToolComponent {
    return Object.assign(BaseComponent, { metadata });
}