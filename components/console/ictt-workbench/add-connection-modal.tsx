"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";
import { RadioGroup } from "@/components/toolbox/components/RadioGroup";
import { L1ListItem, WellKnownERC20 } from "@/components/toolbox/stores/l1ListStore";
import { PendingConnection, TokenType, tokenTypeLabels } from "@/hooks/useICTTWorkbench";
import { cn } from "@/lib/utils";
import { ArrowRight, Coins, Globe, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

interface AddConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pendingConnection: PendingConnection | null;
  updatePendingConnection: (updates: Partial<PendingConnection>) => void;
  sourceChain?: L1ListItem;
  targetChain?: L1ListItem;
}

const TOKEN_TYPE_OPTIONS = [
  {
    value: "erc20-to-erc20" as TokenType,
    label: "ERC20 to ERC20",
    description: "Bridge an ERC20 token to your L1 as an ERC20 representation",
    icon: "ERC20",
  },
  {
    value: "erc20-to-native" as TokenType,
    label: "ERC20 to Native",
    description: "Bridge an ERC20 token to become the native gas token on your L1",
    icon: "Native",
  },
  {
    value: "native-to-erc20" as TokenType,
    label: "Native to ERC20",
    description: "Bridge a native gas token (e.g., AVAX) to appear as an ERC20 on your L1",
    icon: "ERC20",
  },
  {
    value: "native-to-native" as TokenType,
    label: "Native to Native",
    description: "Bridge native gas tokens between chains (e.g., AVAX to AVAX)",
    icon: "Gas",
  },
];

export function AddConnectionModal({
  isOpen,
  onClose,
  onConfirm,
  pendingConnection,
  updatePendingConnection,
  sourceChain,
  targetChain,
}: AddConnectionModalProps) {
  const [customTokenAddress, setCustomTokenAddress] = useState("");
  const [customTokenName, setCustomTokenName] = useState("");
  const [customTokenSymbol, setCustomTokenSymbol] = useState("");
  const [customTokenDecimals, setCustomTokenDecimals] = useState("18");
  const [selectedWellKnown, setSelectedWellKnown] = useState<WellKnownERC20 | null>(null);
  const [useCustomToken, setUseCustomToken] = useState(false);
  const [useNativeToken, setUseNativeToken] = useState(false);

  const currentStep = pendingConnection?.step || "select-token";

  // Get well-known tokens from source chain
  const wellKnownTokens = useMemo(() => {
    return sourceChain?.wellKnownERC20s || [];
  }, [sourceChain]);

  // Navigation
  const goToStep = (step: PendingConnection["step"]) => {
    updatePendingConnection({ step });
  };

  const goBack = () => {
    switch (currentStep) {
      case "select-type":
        goToStep("select-token");
        break;
      case "configure":
        goToStep("select-type");
        break;
      case "confirm":
        goToStep("select-type");
        break;
    }
  };

  const goNext = () => {
    switch (currentStep) {
      case "select-token":
        // Save token info
        if (useNativeToken) {
          // Native gas token selected
          const nativeSymbol = sourceChain?.coinName || "Native";
          updatePendingConnection({
            token: {
              address: undefined, // Native tokens don't have an address
              name: `${nativeSymbol} (Native)`,
              symbol: nativeSymbol,
              decimals: 18,
            },
            step: "select-type", // Go to step 2 to choose native-to-erc20 or native-to-native
          });
        } else if (useCustomToken) {
          updatePendingConnection({
            token: {
              address: customTokenAddress,
              name: customTokenName,
              symbol: customTokenSymbol,
              decimals: parseInt(customTokenDecimals) || 18,
            },
            step: "select-type",
          });
        } else if (selectedWellKnown) {
          updatePendingConnection({
            token: {
              address: selectedWellKnown.address,
              name: selectedWellKnown.name,
              symbol: selectedWellKnown.symbol,
              decimals: selectedWellKnown.decimals,
              logoUrl: selectedWellKnown.logoUrl,
            },
            step: "select-type",
          });
        }
        break;
      case "select-type":
        goToStep("confirm");
        break;
      case "confirm":
        onConfirm();
        break;
    }
  };

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case "select-token":
        if (useNativeToken) {
          return true;
        }
        if (useCustomToken) {
          return customTokenAddress && customTokenSymbol && customTokenName;
        }
        return selectedWellKnown !== null;
      case "select-type":
        return pendingConnection?.tokenType !== undefined;
      case "confirm":
        return true;
      default:
        return false;
    }
  }, [currentStep, useNativeToken, useCustomToken, customTokenAddress, customTokenSymbol, customTokenName, selectedWellKnown, pendingConnection]);

  // Filter token type options based on what token was selected
  // ERC20 tokens can be bridged as ERC20-to-ERC20 or ERC20-to-Native
  // Native tokens can be bridged as Native-to-ERC20 or Native-to-Native
  const filteredTokenTypeOptions = useMemo(() => {
    // If the selected token has an address, it's an ERC20
    const isERC20 = pendingConnection?.token?.address !== undefined;

    if (isERC20) {
      return TOKEN_TYPE_OPTIONS.filter(opt =>
        opt.value === "erc20-to-erc20" || opt.value === "erc20-to-native"
      );
    }
    // Native token - show native-to-erc20 and native-to-native
    return TOKEN_TYPE_OPTIONS.filter(opt =>
      opt.value === "native-to-erc20" || opt.value === "native-to-native"
    );
  }, [pendingConnection?.token?.address]);

  const handleTokenTypeSelect = (value: string) => {
    updatePendingConnection({ tokenType: value as TokenType });
  };

  if (!pendingConnection || !sourceChain || !targetChain) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-700 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-xl">Create Bridge Connection</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Set up a token bridge between {sourceChain.name} and {targetChain.name}
          </DialogDescription>
        </DialogHeader>

        {/* Chain indicators */}
        <div className="flex items-center justify-center gap-3 py-4 bg-zinc-800/50 rounded-lg my-2">
          <div className="flex items-center gap-2">
            {sourceChain.logoUrl ? (
              <img src={sourceChain.logoUrl} alt={sourceChain.name} className="w-6 h-6 rounded-full" />
            ) : (
              <Globe className="w-6 h-6 text-zinc-500" />
            )}
            <span className="text-sm font-medium">{sourceChain.name}</span>
          </div>
          <ArrowRight className="w-5 h-5 text-zinc-500" />
          <div className="flex items-center gap-2">
            {targetChain.logoUrl ? (
              <img src={targetChain.logoUrl} alt={targetChain.name} className="w-6 h-6 rounded-full" />
            ) : (
              <Globe className="w-6 h-6 text-zinc-500" />
            )}
            <span className="text-sm font-medium">{targetChain.name}</span>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {["select-token", "select-type", "confirm"].map((step, index) => (
            <React.Fragment key={step}>
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  currentStep === step
                    ? "bg-blue-600 text-white"
                    : ["select-type", "confirm"].indexOf(currentStep) > ["select-token", "select-type", "confirm"].indexOf(step)
                    ? "bg-green-600 text-white"
                    : "bg-zinc-700 text-zinc-400"
                )}
              >
                {index + 1}
              </div>
              {index < 2 && (
                <div
                  className={cn(
                    "w-8 h-0.5",
                    ["select-type", "confirm"].indexOf(currentStep) > index
                      ? "bg-green-600"
                      : "bg-zinc-700"
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[200px]">
          {/* Step 1: Select Token */}
          {currentStep === "select-token" && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-300">What token do you want to bridge?</h3>

              {/* Native Token Option */}
              {!useCustomToken && (() => {
                // Check if this is C-Chain (mainnet: 43114, testnet: 43113)
                const isCChain = sourceChain?.evmChainId === 43114 || sourceChain?.evmChainId === 43113;
                const nativeLabel = isCChain ? "AVAX" : "Native Gas Token";
                const nativeDescription = isCChain
                  ? "Avalanche native token"
                  : `Native gas token on ${sourceChain?.name || "this chain"}`;

                return (
                  <button
                    onClick={() => {
                      setUseNativeToken(!useNativeToken);
                      if (!useNativeToken) {
                        setSelectedWellKnown(null);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
                      useNativeToken
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-zinc-700 hover:border-zinc-600 bg-zinc-800/50"
                    )}
                  >
                    {isCChain ? (
                      <img
                        src="/images/avax.png"
                        alt="AVAX"
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                        <Coins className="w-4 h-4 text-zinc-400" />
                      </div>
                    )}
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">{nativeLabel}</div>
                      <div className="text-xs text-zinc-500">{nativeDescription}</div>
                    </div>
                    {useNativeToken && (
                      <div className="text-xs text-blue-400 font-medium">Selected</div>
                    )}
                  </button>
                );
              })()}

              {/* Well-known tokens */}
              {wellKnownTokens.length > 0 && !useCustomToken && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Popular ERC20 tokens on {sourceChain.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {wellKnownTokens.map((token) => (
                      <button
                        key={token.address}
                        onClick={() => {
                          setSelectedWellKnown(token);
                          setUseNativeToken(false);
                        }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border transition-all",
                          selectedWellKnown?.address === token.address && !useNativeToken
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-zinc-700 hover:border-zinc-600 bg-zinc-800/50"
                        )}
                      >
                        {token.logoUrl ? (
                          <img src={token.logoUrl} alt={token.symbol} className="w-8 h-8 rounded-full" />
                        ) : (
                          <Coins className="w-8 h-8 text-zinc-500" />
                        )}
                        <div className="text-left">
                          <div className="font-medium text-sm">{token.symbol}</div>
                          <div className="text-xs text-zinc-500">{token.name}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom token toggle */}
              <button
                onClick={() => {
                  setUseCustomToken(!useCustomToken);
                  setSelectedWellKnown(null);
                  if (!useCustomToken) {
                    setUseNativeToken(false);
                  }
                }}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                {useCustomToken ? "Use a popular token" : "Use a custom token address"}
              </button>

              {/* Custom token form */}
              {useCustomToken && !useNativeToken && (
                <div className="space-y-3 pt-2">
                  <Input
                    label="Token Contract Address"
                    value={customTokenAddress}
                    onChange={setCustomTokenAddress}
                    placeholder="0x..."
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Token Name"
                      value={customTokenName}
                      onChange={setCustomTokenName}
                      placeholder="e.g., My Token"
                    />
                    <Input
                      label="Symbol"
                      value={customTokenSymbol}
                      onChange={setCustomTokenSymbol}
                      placeholder="e.g., MTK"
                    />
                  </div>
                  <Input
                    label="Decimals"
                    value={customTokenDecimals}
                    onChange={setCustomTokenDecimals}
                    type="number"
                    placeholder="18"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Token Type */}
          {currentStep === "select-type" && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-300">How should the token appear on {targetChain.name}?</h3>

              <div className="space-y-2">
                {filteredTokenTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleTokenTypeSelect(option.value)}
                    className={cn(
                      "w-full flex items-start gap-4 p-4 rounded-lg border transition-all text-left",
                      pendingConnection.tokenType === option.value
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-zinc-700 hover:border-zinc-600 bg-zinc-800/50"
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold",
                        pendingConnection.tokenType === option.value
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-700 text-zinc-400"
                      )}
                    >
                      {option.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{option.label}</div>
                      <div className="text-xs text-zinc-500 mt-1">{option.description}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Warning for "to native" options (destination is native gas token) */}
              {pendingConnection.tokenType?.endsWith("-to-native") && (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-yellow-200">
                    <strong>Note:</strong> Bridging to a native gas token requires additional setup including
                    wrapped token contracts and collateral management.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {currentStep === "confirm" && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-300">Review your bridge configuration</h3>

              <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Token</span>
                  <div className="flex items-center gap-2">
                    {pendingConnection.token?.logoUrl && (
                      <img
                        src={pendingConnection.token.logoUrl}
                        alt={pendingConnection.token.symbol}
                        className="w-5 h-5 rounded-full"
                      />
                    )}
                    <span className="font-medium">
                      {pendingConnection.token?.symbol} ({pendingConnection.token?.name})
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Bridge Type</span>
                  <span className="font-medium">
                    {pendingConnection.tokenType
                      ? tokenTypeLabels[pendingConnection.tokenType]
                      : "Not selected"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Source Chain</span>
                  <span className="font-medium">{sourceChain.name}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Destination Chain</span>
                  <span className="font-medium">{targetChain.name}</span>
                </div>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-200">
                  After creating this connection, you&apos;ll need to deploy the bridge contracts and
                  configure the relayer. The status dashboard will guide you through each step.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between gap-2">
          <div>
            {currentStep !== "select-token" && (
              <Button
                variant="outline"
                onClick={goBack}
                className="border-zinc-600 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-zinc-600 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={goNext}
              disabled={!canProceed}
            >
              {currentStep === "confirm" ? "Create Connection" : "Continue"}
              {currentStep !== "confirm" && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddConnectionModal;
