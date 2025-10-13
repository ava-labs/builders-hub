"use client";

import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";
import { ResultField } from "@/components/toolbox/components/ResultField";
import feeManagerAbi from "@/contracts/precompiles/FeeManager.json";
import { AllowlistComponent } from "@/components/toolbox/components/AllowListComponents";
import { CheckPrecompile } from "@/components/toolbox/components/CheckPrecompile";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

// Default Fee Manager address
const DEFAULT_FEE_MANAGER_ADDRESS =
  "0x0200000000000000000000000000000000000003";

const metadata: ConsoleToolMetadata = {
  title: "Fee Manager",
  description: "Configure dynamic fee parameters and manage allowlist for your L1",
  walletRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function FeeManager({ onSuccess }: BaseConsoleToolProps) {
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const [gasLimit, setGasLimit] = useState<string>("20000000");
  const [targetBlockRate, setTargetBlockRate] = useState<string>("2");
  const [minBaseFee, setMinBaseFee] = useState<string>("25000000000");
  const [targetGas, setTargetGas] = useState<string>("15000000");
  const [baseFeeChangeDenominator, setBaseFeeChangeDenominator] = useState<string>("48");
  const [minBlockGasCost, setMinBlockGasCost] = useState<string>("0");
  const [maxBlockGasCost, setMaxBlockGasCost] = useState<string>("10000000");
  const [blockGasCostStep, setBlockGasCostStep] = useState<string>("500000");

  // Transaction state
  const [isSettingConfig, setIsSettingConfig] = useState(false);
  const [isReadingConfig, setIsReadingConfig] = useState(false);
  const [lastChangedAt, setLastChangedAt] = useState<number | null>(null);
  const [currentConfig, setCurrentConfig] = useState<any>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSetFeeConfig = async () => {
    if (!coreWalletClient) throw new Error("Wallet client not found");

    setIsSettingConfig(true);

    try {
      const hash = await coreWalletClient.writeContract({
        address: DEFAULT_FEE_MANAGER_ADDRESS as `0x${string}`,
        abi: feeManagerAbi.abi,
        functionName: "setFeeConfig",
        args: [
          BigInt(gasLimit),
          BigInt(targetBlockRate),
          BigInt(minBaseFee),
          BigInt(targetGas),
          BigInt(baseFeeChangeDenominator),
          BigInt(minBlockGasCost),
          BigInt(maxBlockGasCost),
          BigInt(blockGasCostStep),
        ],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        gas: BigInt(1_000_000),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        onSuccess?.();
      } else {
        throw new Error("Transaction failed");
      }
    } finally {
      setIsSettingConfig(false);
    }
  };

  const handleGetFeeConfig = async () => {
    setIsReadingConfig(true);

    const result = (await publicClient.readContract({
      address: DEFAULT_FEE_MANAGER_ADDRESS as `0x${string}`,
      abi: feeManagerAbi.abi,
      functionName: "getFeeConfig",
    })) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

    const [
      gasLimit,
      targetBlockRate,
      minBaseFee,
      targetGas,
      baseFeeChangeDenominator,
      minBlockGasCost,
      maxBlockGasCost,
      blockGasCostStep,
    ] = result;

    setCurrentConfig({
      gasLimit: gasLimit.toString(),
      targetBlockRate: targetBlockRate.toString(),
      minBaseFee: minBaseFee.toString(),
      targetGas: targetGas.toString(),
      baseFeeChangeDenominator: baseFeeChangeDenominator.toString(),
      minBlockGasCost: minBlockGasCost.toString(),
      maxBlockGasCost: maxBlockGasCost.toString(),
      blockGasCostStep: blockGasCostStep.toString(),
    });
    setIsReadingConfig(false);
  };

  const handleGetLastChangedAt = async () => {
    const result = await publicClient.readContract({
      address: DEFAULT_FEE_MANAGER_ADDRESS as `0x${string}`,
      abi: feeManagerAbi.abi,
      functionName: "getFeeConfigLastChangedAt",
    });

    setLastChangedAt(Number(result));
  };

  const canSetFeeConfig = Boolean(
    walletEVMAddress &&
    coreWalletClient &&
    !isSettingConfig
  );

  return (
    <CheckPrecompile
      configKey="feeManagerConfig"
      precompileName="Fee Manager"
    >
        <>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                label="Gas Limit"
                value={gasLimit}
                onChange={setGasLimit}
                type="number"
                min="0"
                disabled={isSettingConfig}
                helperText={Number(gasLimit) < 15_000_000 || Number(gasLimit) > 30_000_000 ?
                  "Expected value between 15,000,000 and 30,000,000" : undefined}
              />
              <Input
                label="Target Block Rate"
                value={targetBlockRate}
                onChange={setTargetBlockRate}
                type="number"
                min="0"
                disabled={isSettingConfig}
                helperText={Number(targetBlockRate) < 1 || Number(targetBlockRate) > 10 ?
                  "Expected value between 1 and 10" : undefined}
              />
              <Input
                label="Minimum Base Fee (gwei)"
                value={minBaseFee}
                onChange={setMinBaseFee}
                type="number"
                min="0"
                disabled={isSettingConfig}
                helperText={Number(minBaseFee) < 1_000_000_000 || Number(minBaseFee) > 500_000_000_000 ?
                  "Expected value between 1,000,000,000 and 500,000,000,000" : undefined}
              />
              <Input
                label="Target Gas"
                value={targetGas}
                onChange={setTargetGas}
                type="number"
                min="0"
                disabled={isSettingConfig}
                helperText={Number(targetGas) < 1_000_000 || Number(targetGas) > 50_000_000 ?
                  "Expected value between 1,000,000 and 50,000,000" : undefined}
              />
              <Input
                label="Base Fee Change Denominator"
                value={baseFeeChangeDenominator}
                onChange={setBaseFeeChangeDenominator}
                type="number"
                min="0"
                disabled={isSettingConfig}
                helperText={Number(baseFeeChangeDenominator) < 8 || Number(baseFeeChangeDenominator) > 1000 ?
                  "Expected value between 8 and 1,000" : undefined}
              />
              <Input
                label="Minimum Block Gas Cost"
                value={minBlockGasCost}
                onChange={setMinBlockGasCost}
                type="number"
                min="0"
                disabled={isSettingConfig}
                helperText={Number(minBlockGasCost) > 1_000_000_000 ?
                  "Expected value between 0 and 1,000,000,000" : undefined}
              />
              <Input
                label="Maximum Block Gas Cost"
                value={maxBlockGasCost}
                onChange={setMaxBlockGasCost}
                type="number"
                min="0"
                disabled={isSettingConfig}
                helperText={Number(maxBlockGasCost) > 10_000_000_000 ?
                  "Expected value between 0 and 10,000,000,000" : undefined}
              />
              <Input
                label="Block Gas Cost Step"
                value={blockGasCostStep}
                onChange={setBlockGasCostStep}
                type="number"
                min="0"
                disabled={isSettingConfig}
                helperText={Number(blockGasCostStep) > 5_000_000 ?
                  "Expected value between 0 and 5,000,000" : undefined}
              />
            </div>

            <Button
              onClick={handleSetFeeConfig}
              loading={isSettingConfig}
              variant="primary"
              disabled={!canSetFeeConfig}
            >
              Set Fee Configuration
            </Button>

            {txHash && (
              <ResultField
                label="Transaction Successful"
                value={txHash}
                showCheck={true}
              />
            )}
          </div>
        </>

        <div className="space-y-4 mt-8">
          <div className="space-y-4">
            <Button
              onClick={handleGetFeeConfig}
              loading={isReadingConfig}
              variant="primary"
              disabled={isReadingConfig}
            >
              Get Current Config
            </Button>
            <Button
              onClick={handleGetLastChangedAt}
              variant="secondary"
              disabled={isReadingConfig || isSettingConfig}
            >
              Get Last Changed At
            </Button>

            {currentConfig && (
              <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
                <pre className="text-sm">
                  {JSON.stringify(currentConfig, null, 2)}
                </pre>
              </div>
            )}

            {lastChangedAt !== null && (
              <div className="mt-4">
                <p className="text-sm">Last changed at block: {lastChangedAt}</p>
              </div>
            )}
          </div>
        </div>

        <AllowlistComponent
          precompileAddress={DEFAULT_FEE_MANAGER_ADDRESS}
          precompileType="Fee Manager"
          onSuccess={onSuccess}
        />
      </CheckPrecompile>
  );
}

export default withConsoleToolMetadata(FeeManager, metadata);
