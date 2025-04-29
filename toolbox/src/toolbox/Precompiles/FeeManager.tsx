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
  warning,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type: string;
  warning?: string;
  disabled?: boolean;
}) => {
  return (
    <div className="space-y-1">
      <Input
        label={label}
        value={value}
        onChange={onChange}
        type={type}
        disabled={disabled}
      />
      {warning && !disabled && (
        <div className="text-yellow-600 text-sm">{warning}</div>
      )}
    </div>
  );
};

export default function FeeManager() {
  const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const [feeManagerAddress, setFeeManagerAddress] = useState<string>(
    DEFAULT_FEE_MANAGER_ADDRESS
  );
  const [isAddressSet, setIsAddressSet] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const [validationWarnings, setValidationWarnings] = useState<
    Record<string, string>
  >({});

  // Validation effect
  useEffect(() => {
    const warnings: Record<string, string> = {};

    // Validate each field
    const gasLimitValidation = validateGasLimit(gasLimit);
    if (gasLimitValidation.isWarning) {
      warnings.gasLimit = gasLimitValidation.message!;
    }

    const targetBlockRateValidation = validateTargetBlockRate(targetBlockRate);
    if (targetBlockRateValidation.isWarning) {
      warnings.targetBlockRate = targetBlockRateValidation.message!;
    }

    const minBaseFeeValidation = validateMinBaseFee(minBaseFee);
    if (minBaseFeeValidation.isWarning) {
      warnings.minBaseFee = minBaseFeeValidation.message!;
    }

    const targetGasValidation = validateTargetGas(targetGas);
    if (targetGasValidation.isWarning) {
      warnings.targetGas = targetGasValidation.message!;
    }

    const baseFeeChangeDenominatorValidation = validateBaseFeeChangeDenominator(
      baseFeeChangeDenominator
    );
    if (baseFeeChangeDenominatorValidation.isWarning) {
      warnings.baseFeeChangeDenominator =
        baseFeeChangeDenominatorValidation.message!;
    }

    const minBlockGasCostValidation = validateMinBlockGasCost(minBlockGasCost);
    if (minBlockGasCostValidation.isWarning) {
      warnings.minBlockGasCost = minBlockGasCostValidation.message!;
    }

    const maxBlockGasCostValidation = validateMaxBlockGasCost(
      maxBlockGasCost,
      minBlockGasCost
    );
    if (maxBlockGasCostValidation.isWarning) {
      warnings.maxBlockGasCost = maxBlockGasCostValidation.message!;
    }

    const blockGasCostStepValidation =
      validateBlockGasCostStep(blockGasCostStep);
    if (blockGasCostStepValidation.isWarning) {
      warnings.blockGasCostStep = blockGasCostStepValidation.message!;
    }

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

  const handleSetAddress = async () => {
    setIsProcessing(true);

    // Skip bytecode verification for the default address
    if (feeManagerAddress === DEFAULT_FEE_MANAGER_ADDRESS) {
      setIsAddressSet(true);
      setIsProcessing(false);
      return;
    }

    // Verify the address is a valid Fee Manager contract
    const code = await publicClient.getBytecode({
      address: feeManagerAddress as `0x${string}`,
    });

    if (!code || code === "0x") {
      throw new Error("Invalid contract address");
    }

    setIsAddressSet(true);
    setIsProcessing(false);
  };

  const handleSetFeeConfig = async () => {
    if (!coreWalletClient) throw new Error("Wallet client not found");

    setIsSettingConfig(true);

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
        throw new Error("Transaction failed");
      }
    } finally {
      setIsSettingConfig(false);
    }
  };

  const handleGetFeeConfig = async () => {
    setIsReadingConfig(true);

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
    setIsReadingConfig(false);
  };

  const handleGetLastChangedAt = async () => {
    const result = await publicClient.readContract({
      address: feeManagerAddress as `0x${string}`,
      abi: feeManagerAbi.abi,
      functionName: "getFeeConfigLastChangedAt",
    });

    setLastChangedAt(Number(result));
  };

  const canSetAddress = Boolean(
    feeManagerAddress &&
    walletEVMAddress &&
    !isProcessing
  );

  const isValidFeeConfig = Boolean(
    validateGasLimit(gasLimit).isValid &&
    validateTargetBlockRate(targetBlockRate).isValid &&
    validateMinBaseFee(minBaseFee).isValid &&
    validateTargetGas(targetGas).isValid &&
    validateBaseFeeChangeDenominator(baseFeeChangeDenominator).isValid &&
    validateMinBlockGasCost(minBlockGasCost).isValid &&
    validateMaxBlockGasCost(maxBlockGasCost, minBlockGasCost).isValid &&
    validateBlockGasCostStep(blockGasCostStep).isValid
  );

  const canSetFeeConfig = Boolean(
    walletEVMAddress &&
    coreWalletClient &&
    isValidFeeConfig &&
    !isSettingConfig
  );

  if (!isAddressSet) {
    return (
      <Container
        title="Configure Fee Manager"
        description="Set the address of the Fee Manager precompile contract. The default address is pre-filled, but you can change it if needed."
      >
        <div className="space-y-4">
          <EVMAddressInput
            value={feeManagerAddress}
            onChange={setFeeManagerAddress}
            label="Fee Manager Address"
            disabled={isProcessing}
          />

          <div className="flex space-x-4">
            <Button
              variant="primary"
              onClick={handleSetAddress}
              disabled={!canSetAddress}
              loading={isProcessing}
            >
              Set Fee Manager Address
            </Button>
            <Button
              variant="secondary"
              onClick={() => setFeeManagerAddress("")}
              disabled={isProcessing}
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
          <div className="space-y-2">
            <InputWithValidation
              label="Gas Limit"
              value={gasLimit}
              onChange={setGasLimit}
              type="number"
              warning={validationWarnings.gasLimit}
              disabled={isSettingConfig}
            />
            <InputWithValidation
              label="Target Block Rate"
              value={targetBlockRate}
              onChange={setTargetBlockRate}
              type="number"
              warning={validationWarnings.targetBlockRate}
              disabled={isSettingConfig}
            />
            <InputWithValidation
              label="Minimum Base Fee (gwei)"
              value={minBaseFee}
              onChange={setMinBaseFee}
              type="number"
              warning={validationWarnings.minBaseFee}
              disabled={isSettingConfig}
            />
            <InputWithValidation
              label="Target Gas"
              value={targetGas}
              onChange={setTargetGas}
              type="number"
              warning={validationWarnings.targetGas}
              disabled={isSettingConfig}
            />
            <InputWithValidation
              label="Base Fee Change Denominator"
              value={baseFeeChangeDenominator}
              onChange={setBaseFeeChangeDenominator}
              type="number"
              warning={validationWarnings.baseFeeChangeDenominator}
              disabled={isSettingConfig}
            />
            <InputWithValidation
              label="Minimum Block Gas Cost"
              value={minBlockGasCost}
              onChange={setMinBlockGasCost}
              type="number"
              warning={validationWarnings.minBlockGasCost}
              disabled={isSettingConfig}
            />
            <InputWithValidation
              label="Maximum Block Gas Cost"
              value={maxBlockGasCost}
              onChange={setMaxBlockGasCost}
              type="number"
              warning={validationWarnings.maxBlockGasCost}
              disabled={isSettingConfig}
            />
            <InputWithValidation
              label="Block Gas Cost Step"
              value={blockGasCostStep}
              onChange={setBlockGasCostStep}
              type="number"
              warning={validationWarnings.blockGasCostStep}
              disabled={isSettingConfig}
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
