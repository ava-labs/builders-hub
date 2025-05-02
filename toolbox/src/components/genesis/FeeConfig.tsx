import { useCallback, memo } from "react";
import { Input } from "../../components/Input";
import { Textarea as TextArea } from "../../components/TextArea";
import { Info } from "lucide-react";
import { Address } from 'viem';
import { ValidationMessages } from "./types";

// Helper function to convert gwei to wei
const gweiToWei = (gwei: number): number => gwei * 1000000000;

// Define the type for the fee configuration
export type FeeConfigType = {
  baseFeeChangeDenominator: number;
  blockGasCostStep: number;
  maxBlockGasCost: number;
  minBaseFee: number;
  minBlockGasCost: number;
  targetGas: number;
};

// Type for Fee/Reward Manager state passed up/down
type ManagerState = {
    enabled: boolean;
    adminAddresses: Address[];
}

type FeeConfigProps = {
  gasLimit: number;
  setGasLimit: (value: number) => void;
  targetBlockRate: number;
  setTargetBlockRate: (value: number) => void;
  feeManager: ManagerState;
  setFeeManager: (value: ManagerState) => void;
  rewardManager: ManagerState;
  setRewardManager: (value: ManagerState) => void;
  feeConfig: FeeConfigType; // Receive the current detailed fee config
  onFeeConfigChange: (config: FeeConfigType) => void; // Callback to update detailed fee config in parent
  validationMessages: ValidationMessages;
};

function FeeConfigBase({
  gasLimit,
  setGasLimit,
  targetBlockRate,
  setTargetBlockRate,
  feeManager,
  setFeeManager,
  rewardManager,
  setRewardManager,
  feeConfig,           // Use the passed fee config directly
  onFeeConfigChange,   
  validationMessages 
}: FeeConfigProps) {

  // Helper function to parse address lists
  const parseAddressList = useCallback((input: string): Address[] => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return [];
    if (!trimmedInput.includes(',')) {
      const singleAddress = trimmedInput.trim();
      return /^0x[a-fA-F0-9]{40}$/i.test(singleAddress) ? [singleAddress as Address] : [];
    }
    const addresses = trimmedInput.split(',')
      .map(addr => addr.trim())
      .filter(addr => /^0x[a-fA-F0-9]{40}$/i.test(addr));
    return addresses as Address[];
  }, []);

  const formatAddressList = useCallback((addresses: Address[]): string => {
    return addresses.map(addr => addr.startsWith('0x') ? addr : `0x${addr}`).join(', ');
  }, []);

  // Only allow numbers handler
  const handleNumberInput = useCallback((value: string, setter: (value: number) => void, min?: number) => {
      if (value === "") {
          setter(min !== undefined ? min : 0);
          return;
      }
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
          if (min === undefined || numValue >= min) {
              setter(numValue);
          }
      } 
  }, []);

  // Helper to handle gwei input -> update parent state
  const handleGweiInput = useCallback((value: string, key: keyof FeeConfigType) => {
      let weiValue = 0;
      if (value === "" || value === ".") {
          weiValue = 0; 
      } else {
          const gweiValue = parseFloat(value);
          if (!isNaN(gweiValue)) {
              weiValue = gweiToWei(gweiValue);
          }
      }
      onFeeConfigChange({ ...feeConfig, [key]: weiValue });
  }, [feeConfig, onFeeConfigChange]);

  // Helper to handle direct number input for feeConfig -> update parent state
  const handleFeeConfigNumberInput = useCallback((value: string, key: keyof FeeConfigType, min?: number) => {
      let numValue = min !== undefined ? min : 0;
      if (value !== "") {
          const parsedValue = parseInt(value);
          if (!isNaN(parsedValue)) {
              if (min === undefined || parsedValue >= min) {
                  numValue = parsedValue;
              }
          }
      }
      // Special case: maxBlockGasCost must be >= minBlockGasCost
      if (key === 'maxBlockGasCost' && numValue < feeConfig.minBlockGasCost) {
          numValue = feeConfig.minBlockGasCost; // Don't allow setting below min
      }
      onFeeConfigChange({ ...feeConfig, [key]: numValue });
  }, [feeConfig, onFeeConfigChange]);

  // Memoize the manager handlers
  const handleFeeManagerEnabledChange = useCallback((enabled: boolean) => {
    setFeeManager({
      ...feeManager,
      enabled
    });
  }, [feeManager, setFeeManager]);

  const handleRewardManagerEnabledChange = useCallback((enabled: boolean) => {
    setRewardManager({
      ...rewardManager,
      enabled
    });
  }, [rewardManager, setRewardManager]);

  const handleFeeManagerAdminsChange = useCallback((adminAddresses: Address[]) => {
    setFeeManager({
      ...feeManager,
      adminAddresses
    });
  }, [feeManager, setFeeManager]);

  const handleRewardManagerAdminsChange = useCallback((adminAddresses: Address[]) => {
    setRewardManager({
      ...rewardManager,
      adminAddresses
    });
  }, [rewardManager, setRewardManager]);

  return (
    <div className="space-y-6">
      {/* Fee Configuration Parameters */}
      <div>
        <h4 className="font-medium mb-3">Fee Configuration Parameters</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Input
              label="Gas Limit"
              value={gasLimit.toString()} 
              onChange={(value) => handleNumberInput(value, setGasLimit, 8000000)}
              placeholder="15000000"
              type="number"
              error={validationMessages.errors.gasLimit}
              helperText={validationMessages.errors.gasLimit ? undefined : "Maximum gas per block (8M-100M)"}
            />
            {validationMessages.warnings.gasLimit && !validationMessages.errors.gasLimit && (
              <div className="text-amber-500 dark:text-amber-400 text-sm mt-1">
                ⚠️ {validationMessages.warnings.gasLimit}
              </div>
            )}
          </div>
          <div>
            <Input
              label="Target Block Rate (seconds)"
              value={targetBlockRate.toString()} 
              onChange={(value) => handleNumberInput(value, setTargetBlockRate, 1)}
              placeholder="2"
              type="number"
              error={validationMessages.errors.blockRate}
              helperText={validationMessages.errors.blockRate ? undefined : "Target time between blocks (1-120s)"}
            />
            {validationMessages.warnings.blockRate && !validationMessages.errors.blockRate && (
              <div className="text-amber-500 dark:text-amber-400 text-sm mt-1">
                ⚠️ {validationMessages.warnings.blockRate}
              </div>
            )}
          </div>
          <div>
            <Input
              label="Min Base Fee (gwei)"
              value={(feeConfig.minBaseFee / 1000000000).toString()} 
              onChange={(value) => handleGweiInput(value, 'minBaseFee')}
              placeholder="25"
              type="text" 
              pattern="[0-9]*\.?[0-9]*"
              inputMode="decimal"
              error={validationMessages.errors.minBaseFee}
              helperText={validationMessages.errors.minBaseFee ? undefined : "Minimum base fee in gwei (≥1 gwei)"}
            />
            {validationMessages.warnings.minBaseFee && !validationMessages.errors.minBaseFee && (
              <div className="text-amber-500 dark:text-amber-400 text-sm mt-1">
                ⚠️ {validationMessages.warnings.minBaseFee}
              </div>
            )}
          </div>
          <div>
            <Input
              label="Base Fee Change Denominator"
              value={feeConfig.baseFeeChangeDenominator.toString()} 
              onChange={(value) => handleFeeConfigNumberInput(value, 'baseFeeChangeDenominator', 2)}
              placeholder="48"
              type="number"
              error={validationMessages.errors.baseFeeChangeDenominator}
              helperText={validationMessages.errors.baseFeeChangeDenominator ? undefined : "Controls fee adjustment rate (≥2)"}
            />
            {validationMessages.warnings.baseFeeChangeDenominator && !validationMessages.errors.baseFeeChangeDenominator && (
              <div className="text-amber-500 dark:text-amber-400 text-sm mt-1">
                ⚠️ {validationMessages.warnings.baseFeeChangeDenominator}
              </div>
            )}
          </div>
          <div>
            <Input
              label="Min Block Gas Cost"
              value={feeConfig.minBlockGasCost.toString()} 
              onChange={(value) => handleFeeConfigNumberInput(value, 'minBlockGasCost', 0)}
              placeholder="0"
              type="number"
              error={validationMessages.errors.minBlockGasCost}
              helperText={validationMessages.errors.minBlockGasCost ? undefined : "Minimum block gas cost (≥0)"}
            />
            {validationMessages.warnings.minBlockGasCost && !validationMessages.errors.minBlockGasCost && (
              <div className="text-amber-500 dark:text-amber-400 text-sm mt-1">
                ⚠️ {validationMessages.warnings.minBlockGasCost}
              </div>
            )}
          </div>
          <div>
            <Input
              label="Max Block Gas Cost"
              value={feeConfig.maxBlockGasCost.toString()} 
              onChange={(value) => handleFeeConfigNumberInput(value, 'maxBlockGasCost', feeConfig.minBlockGasCost)}
              placeholder="1000000"
              type="number"
              error={validationMessages.errors.maxBlockGasCost}
              helperText={validationMessages.errors.maxBlockGasCost ? undefined : "Maximum block gas cost (≥ Min Block Gas Cost)"}
            />
            {validationMessages.warnings.maxBlockGasCost && !validationMessages.errors.maxBlockGasCost && (
              <div className="text-amber-500 dark:text-amber-400 text-sm mt-1">
                ⚠️ {validationMessages.warnings.maxBlockGasCost}
              </div>
            )}
          </div>
          <div>
            <Input
              label="Block Gas Cost Step"
              value={feeConfig.blockGasCostStep.toString()} 
              onChange={(value) => handleFeeConfigNumberInput(value, 'blockGasCostStep', 0)}
              placeholder="200000"
              type="number"
              error={validationMessages.errors.blockGasCostStep} 
              helperText={validationMessages.errors.blockGasCostStep ? undefined : "Step size for block gas cost changes (≥0)"}
            />
            {validationMessages.warnings.blockGasCostStep && !validationMessages.errors.blockGasCostStep && (
              <div className="text-amber-500 dark:text-amber-400 text-sm mt-1">
                ⚠️ {validationMessages.warnings.blockGasCostStep}
              </div>
            )}
          </div>
          <div>
            <Input
              label="Target Gas"
              value={feeConfig.targetGas.toString()} 
              onChange={(value) => handleFeeConfigNumberInput(value, 'targetGas', 500000)} 
              placeholder="15000000"
              type="number"
              error={validationMessages.errors.targetGas}
              helperText={validationMessages.errors.targetGas ? undefined : "Target gas per block (500K-200M)"}
            />
            {validationMessages.warnings.targetGas && !validationMessages.errors.targetGas && (
              <div className="text-amber-500 dark:text-amber-400 text-sm mt-1">
                ⚠️ {validationMessages.warnings.targetGas}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 bg-blue-50/70 dark:bg-blue-900/20 p-3 rounded-md flex items-center border border-blue-100 dark:border-blue-800/40">
          <Info className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            These parameters control how transaction fees are calculated and adjusted. Adjust with caution.
          </p>
        </div>
      </div>

      {/* Fee Manager */}
      <div>
        <h4 className="font-medium mb-3 text-zinc-800 dark:text-white">Dynamic Fee Parameters</h4>
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-start">
              <input 
                type="radio" 
                id="static-fees" 
                name="fee-manager"
                className="mt-1 mr-2"
                checked={!feeManager.enabled}
                onChange={() => handleFeeManagerEnabledChange(false)}
              />
              <label htmlFor="static-fees" className="cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">
                Fixed fee parameters (require network upgrade to change).
              </label>
            </div>
            <div className="flex items-start">
              <input 
                type="radio" 
                id="dynamic-fees" 
                name="fee-manager"
                className="mt-1 mr-2"
                checked={feeManager.enabled}
                onChange={() => handleFeeManagerEnabledChange(true)}
              />
              <label htmlFor="dynamic-fees" className="cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">
                Dynamically adjustable fee parameters via FeeManager precompile.
              </label>
            </div>
          </div>

          {feeManager.enabled && (
            <div className="pl-6 space-y-2 mt-2">
              <TextArea
                label="Fee Manager Admin Addresses"
                value={formatAddressList(feeManager.adminAddresses)}
                onChange={(value: string) => handleFeeManagerAdminsChange(parseAddressList(value))}
                placeholder="0x1234..., 0x5678..."
                helperText="Comma-separated list of addresses that can manage fees via precompile 0x02...03"
                rows={2}
                error={validationMessages.errors.feeManager}
              />
            </div>
          )}
        </div>
      </div>

      {/* Reward Manager */}
      <div>
        <h4 className="font-medium mb-3 text-zinc-800 dark:text-white">Dynamic Reward Parameters</h4>
         <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-start">
              <input 
                type="radio" 
                id="static-rewards" 
                name="reward-manager"
                className="mt-1 mr-2"
                checked={!rewardManager.enabled}
                onChange={() => handleRewardManagerEnabledChange(false)}
              />
              <label htmlFor="static-rewards" className="cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">
                Fixed reward parameters.
              </label>
            </div>
            <div className="flex items-start">
              <input 
                type="radio" 
                id="dynamic-rewards" 
                name="reward-manager"
                className="mt-1 mr-2"
                checked={rewardManager.enabled}
                onChange={() => handleRewardManagerEnabledChange(true)}
              />
              <label htmlFor="dynamic-rewards" className="cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">
                Dynamically adjustable reward parameters via RewardManager precompile.
              </label>
            </div>
          </div>

          {rewardManager.enabled && (
            <div className="pl-6 space-y-2 mt-2">
              <TextArea
                label="Reward Manager Admin Addresses"
                value={formatAddressList(rewardManager.adminAddresses)}
                onChange={(value: string) => handleRewardManagerAdminsChange(parseAddressList(value))}
                placeholder="0x1234..., 0x5678..."
                helperText="Comma-separated list of addresses that can manage rewards via precompile 0x02...04"
                rows={2}
                error={validationMessages.errors.rewardManager}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Export a memoized version of the component to prevent unnecessary rerenders
const FeeConfig = memo(FeeConfigBase);
export default FeeConfig;
