"use client";

import { useState, useEffect } from "react";
import { useWalletStore } from "../../lib/walletStore";
import { useViemChainStore } from "../toolboxStore";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Container } from "../components/Container";
import { EVMAddressInput } from "../components/EVMAddressInput";
import { ResultField } from "../components/ResultField";
import { AllowListWrapper } from "../components/AllowListComponents";
import feeManagerAbi from "../../../contracts/precompiles/FeeManager.json";

// Default Fee Manager address
const DEFAULT_FEE_MANAGER_ADDRESS =
  "0x0200000000000000000000000000000000000003";

// Validation constants
const VALIDATION_RULES = {
  gasLimit: {
    min: 8_000_000,
    max: 100_000_000,
    warnMin: 15_000_000,
    warnMax: 30_000_000,
    message:
      "Gas limit should be between 8M and 100M. Recommended range is 15M-30M.",
  },
  targetBlockRate: {
    min: 1,
    max: 120,
    warnMax: 10,
    message:
      "Target block rate should be between 1 and 120. Values above 10 may cause network instability.",
  },
  minBaseFee: {
    min: 25_000_000_000, // 25 gwei
    warnMin: 1_000_000_000, // 1 gwei
    warnMax: 500_000_000_000, // 500 gwei
    message:
      "Minimum base fee should be at least 25 gwei. Values below 1 gwei or above 500 gwei may cause issues.",
  },
  targetGas: {
    min: 500_000,
    max: 200_000_000,
    warnMin: 1_000_000,
    warnMax: 50_000_000,
    message:
      "Target gas should be between 500K and 200M. Recommended minimum is 1M.",
  },
  baseFeeChangeDenominator: {
    min: 2,
    warnMin: 8,
    warnMax: 1000,
    typical: 48,
    message:
      "Base fee change denominator should be at least 2. Typical value is 48. Values below 8 or above 1000 may cause instability.",
  },
  minBlockGasCost: {
    min: 0,
    warnMax: 1_000_000_000,
    message:
      "Minimum block gas cost should be at least 0. Values above 1e9 may cause issues.",
  },
  maxBlockGasCost: {
    warnMax: 10_000_000_000,
    message:
      "Maximum block gas cost should be greater than minimum block gas cost. Values above 1e10 may cause issues.",
  },
  blockGasCostStep: {
    warnMax: 5_000_000,
    message:
      "Block gas cost step should be reasonable. Values above 5M may cause large fee fluctuations.",
  },
};

// Validation helper functions
const validateGasLimit = (value: string) => {
  const num = BigInt(value);
  const rules = VALIDATION_RULES.gasLimit;
  if (num < rules.min || num > rules.max) {
    return { isValid: false, message: rules.message };
  }
  if (num < rules.warnMin || num > rules.warnMax) {
    return { isValid: true, message: rules.message, isWarning: true };
  }
  return { isValid: true };
};

const validateTargetBlockRate = (value: string) => {
  const num = BigInt(value);
  const rules = VALIDATION_RULES.targetBlockRate;
  if (num < rules.min || num > rules.max) {
    return { isValid: false, message: rules.message };
  }
  if (num > rules.warnMax) {
    return { isValid: true, message: rules.message, isWarning: true };
  }
  return { isValid: true };
};

const validateMinBaseFee = (value: string) => {
  const num = BigInt(value);
  const rules = VALIDATION_RULES.minBaseFee;
  if (num < rules.min) {
    return { isValid: false, message: rules.message };
  }
  if (num < rules.warnMin || num > rules.warnMax) {
    return { isValid: true, message: rules.message, isWarning: true };
  }
  return { isValid: true };
};

const validateTargetGas = (value: string) => {
  const num = BigInt(value);
  const rules = VALIDATION_RULES.targetGas;
  if (num < rules.min || num > rules.max) {
    return { isValid: false, message: rules.message };
  }
  if (num < rules.warnMin || num > rules.warnMax) {
    return { isValid: true, message: rules.message, isWarning: true };
  }
  return { isValid: true };
};

const validateBaseFeeChangeDenominator = (value: string) => {
  const num = BigInt(value);
  const rules = VALIDATION_RULES.baseFeeChangeDenominator;
  if (num < rules.min) {
    return { isValid: false, message: rules.message };
  }
  if (num < rules.warnMin || num > rules.warnMax) {
    return { isValid: true, message: rules.message, isWarning: true };
  }
  return { isValid: true };
};

const validateMinBlockGasCost = (value: string) => {
  const num = BigInt(value);
  const rules = VALIDATION_RULES.minBlockGasCost;
  if (num < rules.min) {
    return { isValid: false, message: rules.message };
  }
  if (num > rules.warnMax) {
    return { isValid: true, message: rules.message, isWarning: true };
  }
  return { isValid: true };
};

const validateMaxBlockGasCost = (value: string, minValue: string) => {
  const num = BigInt(value);
  const minNum = BigInt(minValue);
  const rules = VALIDATION_RULES.maxBlockGasCost;
  if (num < minNum) {
    return {
      isValid: false,
      message:
        "Maximum block gas cost must be greater than minimum block gas cost.",
    };
  }
  if (num > rules.warnMax) {
    return { isValid: true, message: rules.message, isWarning: true };
  }
  return { isValid: true };
};

const validateBlockGasCostStep = (value: string) => {
  const num = BigInt(value);
  const rules = VALIDATION_RULES.blockGasCostStep;
  if (num > rules.warnMax) {
    return { isValid: true, message: rules.message, isWarning: true };
  }
  return { isValid: true };
};

// Update the Input component to handle warnings
const InputWithValidation = ({
  label,
  value,
  onChange,
  type,
  error,
  warning,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type: string;
  error?: string;
  warning?: string;
}) => {
  return (
    <div className="space-y-1">
      <Input
        label={label}
        value={value}
        onChange={onChange}
        type={type}
        error={error}
      />
      {warning && !error && (
        <div className="text-yellow-600 text-sm">{warning}</div>
      )}
    </div>
  );
};

export default function FeeManager() {
  const { coreWalletClient, publicClient, walletEVMAddress, walletChainId } =
    useWalletStore();
  const viemChain = useViemChainStore();
  const [feeManagerAddress, setFeeManagerAddress] = useState<string>(
    DEFAULT_FEE_MANAGER_ADDRESS
  );
  const [error, setError] = useState<string | null>(null);
  const [isAddressSet, setIsAddressSet] = useState(false);

  // Fee config state
  const [gasLimit, setGasLimit] = useState<string>("20000000");
  const [targetBlockRate, setTargetBlockRate] = useState<string>("2");
  const [minBaseFee, setMinBaseFee] = useState<string>("25000000000"); // 25 gwei
  const [targetGas, setTargetGas] = useState<string>("15000000"); // 15M gas
  const [baseFeeChangeDenominator, setBaseFeeChangeDenominator] =
    useState<string>("48");
  const [minBlockGasCost, setMinBlockGasCost] = useState<string>("0");
  const [maxBlockGasCost, setMaxBlockGasCost] = useState<string>("10000000");
  const [blockGasCostStep, setBlockGasCostStep] = useState<string>("500000");

  // Transaction state
  const [isSettingConfig, setIsSettingConfig] = useState(false);
  const [isReadingConfig, setIsReadingConfig] = useState(false);
  const [lastChangedAt, setLastChangedAt] = useState<number | null>(null);
  const [currentConfig, setCurrentConfig] = useState<any>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [validationWarnings, setValidationWarnings] = useState<
    Record<string, string>
  >({});

  // Validation effect
  useEffect(() => {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    // Validate each field
    const gasLimitValidation = validateGasLimit(gasLimit);
    if (!gasLimitValidation.isValid) {
      errors.gasLimit = gasLimitValidation.message!;
    } else if (gasLimitValidation.isWarning) {
      warnings.gasLimit = gasLimitValidation.message!;
    }

    const targetBlockRateValidation = validateTargetBlockRate(targetBlockRate);
    if (!targetBlockRateValidation.isValid) {
      errors.targetBlockRate = targetBlockRateValidation.message!;
    } else if (targetBlockRateValidation.isWarning) {
      warnings.targetBlockRate = targetBlockRateValidation.message!;
    }

    const minBaseFeeValidation = validateMinBaseFee(minBaseFee);
    if (!minBaseFeeValidation.isValid) {
      errors.minBaseFee = minBaseFeeValidation.message!;
    } else if (minBaseFeeValidation.isWarning) {
      warnings.minBaseFee = minBaseFeeValidation.message!;
    }

    const targetGasValidation = validateTargetGas(targetGas);
    if (!targetGasValidation.isValid) {
      errors.targetGas = targetGasValidation.message!;
    } else if (targetGasValidation.isWarning) {
      warnings.targetGas = targetGasValidation.message!;
    }

    const baseFeeChangeDenominatorValidation = validateBaseFeeChangeDenominator(
      baseFeeChangeDenominator
    );
    if (!baseFeeChangeDenominatorValidation.isValid) {
      errors.baseFeeChangeDenominator =
        baseFeeChangeDenominatorValidation.message!;
    } else if (baseFeeChangeDenominatorValidation.isWarning) {
      warnings.baseFeeChangeDenominator =
        baseFeeChangeDenominatorValidation.message!;
    }

    const minBlockGasCostValidation = validateMinBlockGasCost(minBlockGasCost);
    if (!minBlockGasCostValidation.isValid) {
      errors.minBlockGasCost = minBlockGasCostValidation.message!;
    } else if (minBlockGasCostValidation.isWarning) {
      warnings.minBlockGasCost = minBlockGasCostValidation.message!;
    }

    const maxBlockGasCostValidation = validateMaxBlockGasCost(
      maxBlockGasCost,
      minBlockGasCost
    );
    if (!maxBlockGasCostValidation.isValid) {
      errors.maxBlockGasCost = maxBlockGasCostValidation.message!;
    } else if (maxBlockGasCostValidation.isWarning) {
      warnings.maxBlockGasCost = maxBlockGasCostValidation.message!;
    }

    const blockGasCostStepValidation =
      validateBlockGasCostStep(blockGasCostStep);
    if (blockGasCostStepValidation.isWarning) {
      warnings.blockGasCostStep = blockGasCostStepValidation.message!;
    }

    setValidationErrors(errors);
    setValidationWarnings(warnings);
  }, [
    gasLimit,
    targetBlockRate,
    minBaseFee,
    targetGas,
    baseFeeChangeDenominator,
    minBlockGasCost,
    maxBlockGasCost,
    blockGasCostStep,
  ]);

  const verifyChainConnection = async () => {
    try {
      // Get the current chain ID
      const currentChainId = await publicClient.getChainId();
      console.log("Current chain ID:", currentChainId);

      // Get the current block number to verify connection
      const blockNumber = await publicClient.getBlockNumber();
      console.log("Current block number:", blockNumber);

      return true;
    } catch (error) {
      console.error("Chain verification failed:", error);
      return false;
    }
  };

  const handleSetAddress = async () => {
    if (!feeManagerAddress) {
      setError("Fee Manager address is required");
      return;
    }

    if (!walletEVMAddress) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      // Verify chain connection
      const isConnected = await verifyChainConnection();
      if (!isConnected) {
        setError(
          "Failed to connect to the network. Please ensure your wallet is connected to the correct L1 chain (Current Chain ID: " +
            walletChainId +
            ")"
        );
        return;
      }

      // Skip bytecode verification for the default address
      if (feeManagerAddress === DEFAULT_FEE_MANAGER_ADDRESS) {
        setIsAddressSet(true);
        setError(null);
        return;
      }

      // Verify the address is a valid Fee Manager contract
      const code = await publicClient.getBytecode({
        address: feeManagerAddress as `0x${string}`,
      });

      if (!code || code === "0x") {
        setError("Invalid contract address");
        return;
      }

      setIsAddressSet(true);
      setError(null);
    } catch (error) {
      console.error("Error verifying contract:", error);
      // If it's the default address, we'll still proceed
      if (feeManagerAddress === DEFAULT_FEE_MANAGER_ADDRESS) {
        setIsAddressSet(true);
        setError(null);
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to verify contract address"
        );
      }
    }
  };

  const handleSetFeeConfig = async () => {
    if (!walletEVMAddress) {
      setError("Please connect your wallet first");
      return;
    }

    setIsSettingConfig(true);
    setError(null);

    try {
      const hash = await coreWalletClient.writeContract({
        address: feeManagerAddress as `0x${string}`,
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
      } else {
        setError("Transaction failed");
      }
    } catch (error) {
      console.error("Setting fee config failed:", error);
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          setError(
            `Failed to connect to the network. Please ensure you are connected to the correct L1 chain (Current Chain ID: ${walletChainId})`
          );
        } else {
          setError(error.message);
        }
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setIsSettingConfig(false);
    }
  };

  const handleGetFeeConfig = async () => {
    setIsReadingConfig(true);
    setError(null);

    try {
      const result = (await publicClient.readContract({
        address: feeManagerAddress as `0x${string}`,
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
    } catch (error) {
      console.error("Reading fee config failed:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setIsReadingConfig(false);
    }
  };

  const handleGetLastChangedAt = async () => {
    try {
      const result = await publicClient.readContract({
        address: feeManagerAddress as `0x${string}`,
        abi: feeManagerAbi.abi,
        functionName: "getFeeConfigLastChangedAt",
      });

      setLastChangedAt(Number(result));
    } catch (error) {
      console.error("Getting last changed timestamp failed:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred");
      }
    }
  };

  if (!isAddressSet) {
    return (
      <Container
        title="Configure Fee Manager"
        description="Set the address of the Fee Manager precompile contract. The default address is pre-filled, but you can change it if needed."
      >
        <div className="space-y-4">
          {error && (
            <div className="p-4 text-red-700 bg-red-100 rounded-md">
              {error}
            </div>
          )}

          <EVMAddressInput
            value={feeManagerAddress}
            onChange={setFeeManagerAddress}
            label="Fee Manager Address"
            disabled={isSettingConfig || isReadingConfig}
          />

          <div className="flex space-x-4">
            <Button
              variant="primary"
              onClick={handleSetAddress}
              disabled={!feeManagerAddress || !walletEVMAddress}
            >
              Set Fee Manager Address
            </Button>
            <Button
              variant="secondary"
              onClick={() => setFeeManagerAddress("")}
            >
              Clear Address
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <div className="space-y-6">
      <Container
        title="Fee Configuration"
        description="Configure the dynamic fee parameters for the chain."
      >
        <div className="space-y-4">
          {error && (
            <div className="p-4 text-red-700 bg-red-100 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <InputWithValidation
              label="Gas Limit"
              value={gasLimit}
              onChange={setGasLimit}
              type="number"
              error={validationErrors.gasLimit}
              warning={validationWarnings.gasLimit}
            />
            <InputWithValidation
              label="Target Block Rate"
              value={targetBlockRate}
              onChange={setTargetBlockRate}
              type="number"
              error={validationErrors.targetBlockRate}
              warning={validationWarnings.targetBlockRate}
            />
            <InputWithValidation
              label="Minimum Base Fee (gwei)"
              value={minBaseFee}
              onChange={setMinBaseFee}
              type="number"
              error={validationErrors.minBaseFee}
              warning={validationWarnings.minBaseFee}
            />
            <InputWithValidation
              label="Target Gas"
              value={targetGas}
              onChange={setTargetGas}
              type="number"
              error={validationErrors.targetGas}
              warning={validationWarnings.targetGas}
            />
            <InputWithValidation
              label="Base Fee Change Denominator"
              value={baseFeeChangeDenominator}
              onChange={setBaseFeeChangeDenominator}
              type="number"
              error={validationErrors.baseFeeChangeDenominator}
              warning={validationWarnings.baseFeeChangeDenominator}
            />
            <InputWithValidation
              label="Minimum Block Gas Cost"
              value={minBlockGasCost}
              onChange={setMinBlockGasCost}
              type="number"
              error={validationErrors.minBlockGasCost}
              warning={validationWarnings.minBlockGasCost}
            />
            <InputWithValidation
              label="Maximum Block Gas Cost"
              value={maxBlockGasCost}
              onChange={setMaxBlockGasCost}
              type="number"
              error={validationErrors.maxBlockGasCost}
              warning={validationWarnings.maxBlockGasCost}
            />
            <InputWithValidation
              label="Block Gas Cost Step"
              value={blockGasCostStep}
              onChange={setBlockGasCostStep}
              type="number"
              error={validationErrors.blockGasCostStep}
              warning={validationWarnings.blockGasCostStep}
            />
          </div>

          <Button
            onClick={handleSetFeeConfig}
            loading={isSettingConfig}
            variant="primary"
            disabled={
              !walletEVMAddress || Object.keys(validationErrors).length > 0
            }
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
      </Container>

      <Container
        title="Current Fee Configuration"
        description="View the current fee configuration and last change timestamp."
      >
        <div className="space-y-4">
          <Button
            onClick={handleGetFeeConfig}
            loading={isReadingConfig}
            variant="primary"
          >
            Get Current Config
          </Button>
          <Button onClick={handleGetLastChangedAt} variant="secondary">
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
      </Container>

      <div className="w-full">
        <AllowListWrapper
          precompileAddress={feeManagerAddress}
          precompileType="Fee Manager"
        />
      </div>
    </div>
  );
}
