"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useICTTWorkbench, BridgeConnection } from "@/hooks/useICTTWorkbench";
import { ChainNode } from "./chain-node";
import { ConnectionLine } from "./connection-line";
import { AddConnectionModal } from "./add-connection-modal";
import { ConnectionStatus } from "./connection-status";
import { RelayerConfig } from "./relayer-config";
import { ChainSelector } from "./chain-selector";
import { ConnectionActionPanel } from "./connection-action-panel";
import { L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

// Position calculation for radial layout
function calculateNodePositions(
  connectedChains: L1ListItem[],
  canvasWidth: number,
  canvasHeight: number
) {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const radius = Math.min(canvasWidth, canvasHeight) * 0.35;

  const positions: Record<string, { x: number; y: number }> = {};

  connectedChains.forEach((chain, index) => {
    const angle = (2 * Math.PI * index) / connectedChains.length - Math.PI / 2;
    positions[chain.id] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  return positions;
}

export function ICTTWorkbench() {
  const {
    centerChain,
    availableChains,
    connectedChains,
    connections,
    pendingConnection,
    getChainById,
    canConnectToChain,
    startConnectionToChain,
    updateConnection,
    removeConnection,
    cancelPendingConnection,
    finalizePendingConnection,
    updatePendingConnection,
  } = useICTTWorkbench();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  // Derive selectedConnection from connections array to stay in sync with store updates
  const selectedConnection = useMemo(() => {
    if (!selectedConnectionId) return null;
    return connections.find(c => c.id === selectedConnectionId) || null;
  }, [selectedConnectionId, connections]);

  // Responsive canvas sizing
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 700, height: 500 });

  // ResizeObserver for responsive canvas
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      // Maintain minimum dimensions for usability
      setCanvasSize({
        width: Math.max(width, 400),
        height: Math.max(height, 400)
      });
    });

    if (canvasRef.current) {
      observer.observe(canvasRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Calculate positions for connected chain nodes
  const nodePositions = useMemo(() => {
    return calculateNodePositions(connectedChains, canvasSize.width, canvasSize.height);
  }, [connectedChains, canvasSize]);

  const centerPosition = {
    x: canvasSize.width / 2,
    y: canvasSize.height / 2,
  };

  // Handle connecting to a new chain
  const handleConnectChain = useCallback(
    (chainId: string) => {
      if (canConnectToChain(chainId)) {
        startConnectionToChain(chainId);
        setIsModalOpen(true);
      }
    },
    [canConnectToChain, startConnectionToChain]
  );

  // Handle clicking on a connection
  const handleConnectionClick = useCallback(
    (connection: BridgeConnection) => {
      setSelectedConnectionId(connection.id);
    },
    []
  );

  // Handle removing a connection
  const handleRemoveConnection = useCallback(
    (connectionId: string) => {
      removeConnection(connectionId);
      setSelectedConnectionId(null);
    },
    [removeConnection]
  );

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    cancelPendingConnection();
  }, [cancelPendingConnection]);

  // Handle modal confirm
  const handleModalConfirm = useCallback(() => {
    const newId = finalizePendingConnection();
    if (newId) {
      setIsModalOpen(false);
      // Auto-select the new connection to open the action panel
      setSelectedConnectionId(newId);
    }
  }, [finalizePendingConnection]);

  // Get connection for a specific chain
  const getConnectionForChain = useCallback(
    (chainId: string) => {
      return connections.find(
        (conn) => conn.sourceChainId === chainId || conn.targetChainId === chainId
      );
    },
    [connections]
  );

  if (!centerChain) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[400px] bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="text-zinc-500 dark:text-zinc-400 text-center">
          <p className="text-lg font-medium mb-2">No Chain Selected</p>
          <p className="text-sm">Please connect your wallet and select a chain to get started.</p>
        </div>
      </div>
    );
  }

  // Handle closing the action panel
  const handleCloseActionPanel = useCallback(() => {
    setSelectedConnectionId(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Chain Selector Bar */}
      <ChainSelector
        availableChains={availableChains}
        connectedChains={connectedChains}
        onConnectChain={handleConnectChain}
        canConnectToChain={canConnectToChain}
      />

      {/* Main Canvas + Action Panel */}
      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-[550px] h-[calc(100vh-400px)] max-h-[800px] rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        {/* Visual Canvas Panel */}
        <ResizablePanel defaultSize={selectedConnection ? 65 : 100} minSize={50}>
          <div
            ref={canvasRef}
            className="relative bg-zinc-900 dark:bg-zinc-950 h-full overflow-hidden"
          >
            {/* Canvas Header */}
            <div className="absolute top-4 left-4 z-10">
              <h3 className="text-sm font-medium text-zinc-400">Bridge Topology</h3>
            </div>

            {/* SVG Canvas for connections */}
            <svg
              width="100%"
              height="100%"
              className="absolute inset-0"
              viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Grid pattern background */}
              <defs>
                <pattern
                  id="grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Connection lines */}
              {connectedChains.map((chain: L1ListItem) => {
                const connection = getConnectionForChain(chain.id);
                if (!connection) return null;

                const targetPos = nodePositions[chain.id];
                if (!targetPos) return null;

                return (
                  <ConnectionLine
                    key={chain.id}
                    startX={centerPosition.x}
                    startY={centerPosition.y}
                    endX={targetPos.x}
                    endY={targetPos.y}
                    status={connection.status}
                    token={connection.token}
                    onClick={() => handleConnectionClick(connection)}
                    isSelected={selectedConnection?.id === connection.id}
                  />
                );
              })}
            </svg>

            {/* Center Chain Node */}
            <div
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
              style={{
                left: `${(centerPosition.x / canvasSize.width) * 100}%`,
                top: `${(centerPosition.y / canvasSize.height) * 100}%`,
              }}
            >
              <ChainNode
                chain={centerChain}
                isCenter={true}
                connectionsCount={connections.length}
              />
            </div>

            {/* Connected Chain Nodes */}
            {connectedChains.map((chain: L1ListItem) => {
              const position = nodePositions[chain.id];
              if (!position) return null;

              const connection = getConnectionForChain(chain.id);

              return (
                <div
                  key={chain.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
                  style={{
                    left: `${(position.x / canvasSize.width) * 100}%`,
                    top: `${(position.y / canvasSize.height) * 100}%`,
                  }}
                >
                  <ChainNode
                    chain={chain}
                    isCenter={false}
                    status={connection?.status}
                    token={connection?.token}
                    onClick={() => connection && handleConnectionClick(connection)}
                    isSelected={selectedConnection?.id === connection?.id}
                  />
                </div>
              );
            })}

            {/* Empty state */}
            {connectedChains.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-zinc-500 dark:text-zinc-400 mt-20">
                  <Plus className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Click a chain above to create a bridge connection</p>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        {/* Action Panel (shown when connection is selected) */}
        {selectedConnection && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
              <ConnectionActionPanel
                connection={selectedConnection}
                onUpdate={(updates) => updateConnection(selectedConnection.id, updates)}
                onClose={handleCloseActionPanel}
                getChainById={getChainById}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Connection Status Dashboard */}
      <ConnectionStatus
        connections={connections}
        getChainById={getChainById}
        onConnectionClick={handleConnectionClick}
        selectedConnection={selectedConnection}
        onRemoveConnection={handleRemoveConnection}
      />

      {/* Relayer Config */}
      {connections.length > 0 && (
        <RelayerConfig
          connections={connections}
          centerChain={centerChain}
          getChainById={getChainById}
        />
      )}

      {/* Add Connection Modal */}
      <AddConnectionModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onConfirm={handleModalConfirm}
        pendingConnection={pendingConnection}
        updatePendingConnection={updatePendingConnection}
        sourceChain={pendingConnection ? getChainById(pendingConnection.sourceChainId) : undefined}
        targetChain={pendingConnection ? getChainById(pendingConnection.targetChainId) : undefined}
      />
    </div>
  );
}

export default ICTTWorkbench;
