import React from 'react';
import { CheckRequirements, RequirementsConfigKey } from './CheckRequirements';
import { Container } from './Container';

// Console tool metadata interface
export interface ConsoleToolMetadata {
    /** Display name of the tool */
    title: string;
    /** Brief description of what the tool does */
    description: string;
    /** Tool requirements (wallet and/or account requirements) */
    toolRequirements: RequirementsConfigKey[];
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
 * Higher-Order Component that wraps console tools with metadata and requirements.
 * 
 * @param BaseComponent - The base console tool component
 * @param metadata - Console tool metadata including tool requirements
 * @returns Console tool component with metadata and requirements wrapper
 * 
 * @example
 * const CrossChainTransfer = withConsoleToolMetadata(
 *     CrossChainTransferInner,
 *     {
 *         title: "Cross-Chain Transfer",
 *         description: "Transfer AVAX between Platform (P) and Contract (C) chains",
 *         toolRequirements: [WalletRequirementsConfigKey.CoreWalletConnected]
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

        // If no tool requirements, render container directly
        if (!metadata.toolRequirements || metadata.toolRequirements.length === 0) {
            return <ContainerContent />;
        }

        // Wrap with tool requirements
        return (
            <CheckRequirements toolRequirements={metadata.toolRequirements}>
                <ContainerContent />
            </CheckRequirements>
        );
    };

    // Attach metadata to the component
    const ComponentWithMetadata = Object.assign(WrappedComponent, { metadata });

    return ComponentWithMetadata;
}

