import React from 'react';
import { CheckWalletRequirements } from './CheckWalletRequirements';
import { WalletRequirementsConfigKey } from '../hooks/useWalletRequirements';
import { Container } from './Container';

// Console tool metadata interface
export interface ConsoleToolMetadata {
    /** Display name of the tool */
    title: string;
    /** Brief description of what the tool does */
    description: string;
    /** Wallet requirements including if the tool is only available on testnet */
    walletRequirements: WalletRequirementsConfigKey[];
    /** GitHub URL for editing the tool source code */
    githubUrl?: string;
}

// Props interface for console tools
export interface BaseConsoleToolProps {
    /** Function to call when the tool succeeds. This can be used to navigate the user to the next step. */
    onSuccess?: () => void;
}

// Base console tool component type (before wrapping with metadata)
type BaseConsoleToolComponent = React.ComponentType<BaseConsoleToolProps>;

// Console Tool with Metadata
type ConsoleToolComponent = BaseConsoleToolComponent & {
    /** Required metadata for all console tools */
    metadata: ConsoleToolMetadata;
};

/**
 * Higher-Order Component that wraps console tools with metadata and wallet requirements.
 * 
 * @param BaseComponent - The base console tool component
 * @param metadata - Console tool metadata including wallet requirements
 * @returns Console tool component with metadata and wallet wrapper
 * 
 * @example
 * const CrossChainTransfer = withConsoleToolMetadata(
 *     CrossChainTransferInner,
 *     {
 *         title: "Cross-Chain Transfer",
 *         description: "Transfer AVAX between Platform (P) and Contract (C) chains",
 *         walletRequirements: [WalletRequirementsConfigKey.CoreWalletConnected]
 *     }
 * );
 */
export function withConsoleToolMetadata(
    BaseComponent: BaseConsoleToolComponent,
    metadata: ConsoleToolMetadata
): ConsoleToolComponent {
    const WrappedComponent = (props: BaseConsoleToolProps) => {
        const ContainerContent = () => (
            <Container title={metadata.title} description={metadata.description} githubUrl={metadata.githubUrl}>
                <BaseComponent {...props} />
            </Container>
        );

        // If no wallet requirements, render container directly
        if (!metadata.walletRequirements || metadata.walletRequirements.length === 0) {
            return <ContainerContent />;
        }

        // Wrap with wallet requirements
        return (
            <CheckWalletRequirements configKey={metadata.walletRequirements}>
                <ContainerContent />
            </CheckWalletRequirements>
        );
    };

    // Attach metadata to the component
    const ComponentWithMetadata = Object.assign(WrappedComponent, { metadata });

    return ComponentWithMetadata;
}

