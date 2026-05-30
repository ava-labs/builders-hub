import React from 'react';
import { CheckRequirements, RequirementsConfigKey } from './CheckRequirements';
import { Container } from './Container';

// Console tool metadata interface
export interface ConsoleToolMetadata {
  /** Display name of the tool */
  title: string;
  /** Brief description of what the tool does (supports ReactNode for links) */
  description: React.ReactNode;
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

/**
 * Higher-Order Component that wraps console tools with metadata and requirements.
 *
 * Generic over the tool's prop type so tools with extra props (e.g. a
 * `preinstallDefaults` override forwarded from a parent flow) preserve
 * those props through the wrapper instead of being narrowed to just
 * `BaseConsoleToolProps`. The tool must still accept at least
 * `BaseConsoleToolProps`.
 *
 * @example
 * const CrossChainTransfer = withConsoleToolMetadata(
 *     CrossChainTransferInner,
 *     {
 *         title: "Cross-Chain Transfer",
 *         description: "Transfer AVAX between Platform (P) and Contract (C) chains",
 *         toolRequirements: [WalletRequirementsConfigKey.WalletConnected]
 *     }
 * );
 */
export function withConsoleToolMetadata<P extends BaseConsoleToolProps = BaseConsoleToolProps>(
  BaseComponent: React.ComponentType<P>,
  metadata: ConsoleToolMetadata,
): React.ComponentType<P> & { metadata: ConsoleToolMetadata } {
  const WrappedComponent = (props: P) => {
    // Render Container + BaseComponent as plain JSX so the JSX tree reuses
    // the same element types across re-renders. The previous version declared
    // `const ContainerContent = () => (...)` inside the render body and then
    // returned `<ContainerContent />`. That produced a NEW component function
    // reference every render, which React reconciliation treats as a fresh
    // component type — unmounting and remounting the entire `<Container>` /
    // `<BaseComponent>` subtree on every parent re-render. Tools with local
    // `useState` (e.g. `CreateManagedTestnetRelayer` mid-flow) lost all their
    // state whenever an ancestor re-rendered for any reason (chain switch,
    // store update, sibling phase advance, etc.).
    const containerElement = (
      <Container title={metadata.title} description={metadata.description} githubUrl={metadata.githubUrl}>
        <BaseComponent {...props} />
      </Container>
    );

    // If no tool requirements, render container directly
    if (!metadata.toolRequirements || metadata.toolRequirements.length === 0) {
      return containerElement;
    }

    // Wrap with tool requirements
    return <CheckRequirements toolRequirements={metadata.toolRequirements}>{containerElement}</CheckRequirements>;
  };

  return Object.assign(WrappedComponent, { metadata });
}
