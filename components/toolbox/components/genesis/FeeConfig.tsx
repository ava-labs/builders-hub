import { useCallback, memo, useState } from "react";
import { RawInput } from "../Input";
import { Info, Zap, DollarSign, Gauge } from "lucide-react";
import { ValidationMessages } from "./types";
import { useGenesisHighlight } from "./GenesisHighlightContext";
import { GasSlider } from "./GasSlider";
import { cn } from "@/lib/cn";

// Helper function to convert gwei to wei
const gweiToWei = (gwei: number): number => gwei * 1000000000;

// Define the type for the fee configuration
type FeeConfigType = {
  baseFeeChangeDenominator: number;
  blockGasCostStep: number;
  maxBlockGasCost: number;
  minBaseFee: number;
  minBlockGasCost: number;
  targetGas: number;
};

type FeeConfigProps = {
  gasLimit: number;
  setGasLimit: (value: number) => void;
  targetBlockRate: number;
  setTargetBlockRate: (value: number) => void;
  feeConfig: FeeConfigType; // Receive the current detailed fee config
  onFeeConfigChange: (config: FeeConfigType) => void; // Callback to update detailed fee config in parent
  validationMessages: ValidationMessages;
  compact?: boolean;
};

function FeeConfigBase({
  gasLimit,
  setGasLimit,
  targetBlockRate,
  setTargetBlockRate,
  feeConfig,           // Use the passed fee config directly
  onFeeConfigChange,
  validationMessages,
  compact
}: FeeConfigProps) {
  const { setHighlightPath, clearHighlight } = useGenesisHighlight();

  const handleFocus = (path: string) => {
    setHighlightPath(path);
  };

  const handleBlur = () => {
    clearHighlight();
  };

  const Field = ({
    label,
    value,
    onChange,
    placeholder,
    type = "number",
    error,
    warning,
    onFocus,
    onBlur,
  }: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    type?: string;
    error?: string;
    warning?: string;
    onFocus?: () => void;
    onBlur?: () => void;
  }) => (
    <div className="space-y-1 text-[13px]">
      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</label>
      <RawInput
        type={type}
        value={value}
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className="py-2 text-[14px]"
        inputMode={type === "text" ? "decimal" : undefined}
      />
      {error && <div className="text-xs text-red-500">{error}</div>}
      {!error && warning && <div className="text-xs text-amber-500">⚠️ {warning}</div>}
    </div>
  );

  // Helper function to parse address lists
  // (Removed address parsing utilities; dynamic fee/reward config now managed in Precompiles section.)

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

  // (Removed dynamic fee/reward handlers.)

  const [viewMode, setViewMode] = useState<'simple' | 'advanced'>('simple');

  // Helper to update fee config
  const updateFeeConfig = useCallback((updates: Partial<FeeConfigType>) => {
    onFeeConfigChange({ ...feeConfig, ...updates });
  }, [feeConfig, onFeeConfigChange]);

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('simple')}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                viewMode === 'simple'
                  ? "bg-zinc-400 dark:bg-zinc-500 text-white dark:text-white"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              <Zap className="w-3 h-3 inline mr-1" />
              Simple
            </button>
            <button
              onClick={() => setViewMode('advanced')}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                viewMode === 'advanced'
                  ? "bg-zinc-400 dark:bg-zinc-500 text-white dark:text-white"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              <Gauge className="w-3 h-3 inline mr-1" />
              Advanced
            </button>
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {viewMode === 'simple' ? 'Intuitive controls' : 'All parameters'}
          </span>
        </div>
      </div>

      {viewMode === 'simple' ? (
        /* Simple Mode with Sliders */
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md p-4 space-y-5">
          <GasSlider
            label="Gas Limit"
            value={gasLimit}
            onChange={setGasLimit}
            min={8000000}
            max={30000000}
            step={1000000}
            unit="gas"
            description="Maximum gas allowed per block. Higher values allow more transactions but may impact performance."
            presets={[
              { label: "8M", value: 8000000, description: "Conservative, stable performance" },
              { label: "15M", value: 15000000, description: "Balanced for most use cases" },
              { label: "25M", value: 25000000, description: "High throughput, may impact node performance" }
            ]}
            formatValue={(val) => (val / 1000000).toFixed(1) + "M"}
            error={validationMessages.errors.gasLimit}
            warning={validationMessages.warnings.gasLimit}
            onFocus={() => handleFocus('gasLimit')}
            onBlur={handleBlur}
          />

          <GasSlider
            label="Target Block Time"
            value={targetBlockRate}
            onChange={setTargetBlockRate}
            min={1}
            max={10}
            step={1}
            unit="seconds"
            description="How often new blocks are produced (integer values only). Faster blocks mean quicker confirmations but higher resource usage."
            presets={[
              { label: "1s", value: 1, description: "Near-instant finality" },
              { label: "2s", value: 2, description: "Good balance" },
              { label: "5s", value: 5, description: "Lower resource usage" }
            ]}
            error={validationMessages.errors.blockRate}
            warning={validationMessages.warnings.blockRate}
            onFocus={() => handleFocus('targetBlockRate')}
            onBlur={handleBlur}
          />

          <GasSlider
            label="Minimum Base Fee"
            value={feeConfig.minBaseFee / 1000000000} // Convert from wei to gwei for display
            onChange={(gweiValue) => updateFeeConfig({ minBaseFee: gweiValue * 1000000000 })}
            min={1}
            max={1000}
            step={1}
            unit="gwei"
            description="Minimum gas price. Lower values make transactions cheaper but may allow spam."
            presets={[
              { label: "Very Low (1 gwei)", value: 1 },
              { label: "Low (25 gwei)", value: 25 },
              { label: "Standard (100 gwei)", value: 100 },
              { label: "High (500 gwei)", value: 500 }
            ]}
            logarithmic={true}
            error={validationMessages.errors.minBaseFee}
            warning={validationMessages.warnings.minBaseFee}
            onFocus={() => handleFocus('minBaseFee')}
            onBlur={handleBlur}
          />

          <GasSlider
            label="Target Gas Usage"
            value={feeConfig.targetGas}
            onChange={(value) => updateFeeConfig({ targetGas: value })}
            min={1000000}
            max={Math.max(500000000, gasLimit * 20)}
            step={1000000}
            unit="gas/10s"
            description="Target gas usage per 10-second rolling window. Base fee adjusts to maintain this target across ~5 blocks (at 2s block time)."
            presets={[
              { label: "Dynamic (50%)", value: Math.floor(gasLimit * 0.5), description: "Congestion-based pricing" },
              { label: "Dynamic (75%)", value: Math.floor(gasLimit * 0.75), description: "Less sensitive pricing" },
              { label: "Static", value: Math.ceil((gasLimit * 10) / targetBlockRate) + 1000000, description: "Fixed gas price" }
            ]}
            formatValue={(val) => {
              const percentage = Math.round(val / gasLimit * 100);
              if (percentage > 999) {
                return `${(val / 1000000).toFixed(0)}M`;
              }
              return `${(val / 1000000).toFixed(1)}M (${percentage}%)`;
            }}
            error={validationMessages.errors.targetGas}
            warning={validationMessages.warnings.targetGas}
            onFocus={() => handleFocus('targetGas')}
            onBlur={handleBlur}
          />

          {/* Static Gas Price Info */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-md p-3">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-medium text-blue-900 dark:text-blue-100">Want fixed gas prices?</div>
                <div className="text-blue-800 dark:text-blue-200">
                  Click the "Static" preset above or set Target Gas to {Math.ceil((gasLimit * 10) / targetBlockRate / 1000000)}M+ 
                  to disable dynamic pricing.
                </div>
                <div className="text-blue-700 dark:text-blue-300">
                  Best for permissioned chains and backend-managed transactions.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Advanced Mode with All Fields */
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md p-3">
          <h4 className="text-[13px] font-medium mb-2">Fee Configuration</h4>
          <div className={`grid grid-cols-1 md:grid-cols-2 ${compact ? 'gap-3' : 'gap-4'}`}>
          <Field
            label="Gas Limit"
            value={gasLimit.toString()}
            onChange={(value) => handleNumberInput(value, setGasLimit, 8000000)}
            onFocus={() => handleFocus('gasLimit')}
            onBlur={handleBlur}
            placeholder="15000000"
            error={validationMessages.errors.gasLimit}
            warning={validationMessages.warnings.gasLimit}
          />
          <Field
            label="Target Block Time (seconds)"
            value={targetBlockRate.toString()}
            onChange={(value) => handleNumberInput(value, setTargetBlockRate, 1)}
            onFocus={() => handleFocus('targetBlockRate')}
            onBlur={handleBlur}
            placeholder="2"
            error={validationMessages.errors.blockRate}
            warning={validationMessages.warnings.blockRate}
          />
          <Field
            label="Min Base Fee (gwei)"
            value={(feeConfig.minBaseFee / 1000000000).toString()}
            onChange={(value) => handleGweiInput(value, 'minBaseFee')}
            onFocus={() => handleFocus('minBaseFee')}
            onBlur={handleBlur}
            placeholder="25"
            type="text"
            error={validationMessages.errors.minBaseFee}
            warning={validationMessages.warnings.minBaseFee}
          />
          <Field
            label="Base Fee Change Denominator"
            value={feeConfig.baseFeeChangeDenominator.toString()}
            onChange={(value) => handleFeeConfigNumberInput(value, 'baseFeeChangeDenominator', 2)}
            onFocus={() => handleFocus('baseFeeChangeDenominator')}
            onBlur={handleBlur}
            placeholder="48"
            error={validationMessages.errors.baseFeeChangeDenominator}
            warning={validationMessages.warnings.baseFeeChangeDenominator}
          />
          <Field
            label="Min Block Gas Cost"
            value={feeConfig.minBlockGasCost.toString()}
            onChange={(value) => handleFeeConfigNumberInput(value, 'minBlockGasCost', 0)}
            onFocus={() => handleFocus('minBlockGasCost')}
            onBlur={handleBlur}
            placeholder="0"
            error={validationMessages.errors.minBlockGasCost}
            warning={validationMessages.warnings.minBlockGasCost}
          />
          <Field
            label="Max Block Gas Cost"
            value={feeConfig.maxBlockGasCost.toString()}
            onChange={(value) => handleFeeConfigNumberInput(value, 'maxBlockGasCost', feeConfig.minBlockGasCost)}
            onFocus={() => handleFocus('maxBlockGasCost')}
            onBlur={handleBlur}
            placeholder="1000000"
            error={validationMessages.errors.maxBlockGasCost}
            warning={validationMessages.warnings.maxBlockGasCost}
          />
          <Field
            label="Block Gas Cost Step"
            value={feeConfig.blockGasCostStep.toString()}
            onChange={(value) => handleFeeConfigNumberInput(value, 'blockGasCostStep', 0)}
            onFocus={() => handleFocus('blockGasCostStep')}
            onBlur={handleBlur}
            placeholder="200000"
            error={validationMessages.errors.blockGasCostStep}
            warning={validationMessages.warnings.blockGasCostStep}
          />
          <Field
            label="Target Gas (per 10s window)"
            value={feeConfig.targetGas.toString()}
            onChange={(value) => handleFeeConfigNumberInput(value, 'targetGas', 100000)}
            onFocus={() => handleFocus('targetGas')}
            onBlur={handleBlur}
            placeholder="15000000"
            error={validationMessages.errors.targetGas}
            warning={validationMessages.warnings.targetGas}
          />
        </div>

        {/* Static Gas Price Info for Advanced Mode */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-md p-3 mt-3">
          <div className="flex gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-medium text-blue-900 dark:text-blue-100">Tip: Static Gas Price</div>
              <div className="text-blue-800 dark:text-blue-200">
                For static gas pricing (no congestion-based adjustments), set Target Gas &gt; (Gas Limit × 10 ÷ Block Time).
                Current threshold: &gt;{Math.ceil((gasLimit * 10) / targetBlockRate)} gas (~{Math.ceil((gasLimit * 10) / targetBlockRate / 1000000)}M).
                Useful for permissioned chains where congestion pricing isn't needed.
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Dynamic fee/reward sections removed; these are now configured under Precompiles. */}
    </div>
  );
}

// Export a memoized version of the component to prevent unnecessary rerenders
const FeeConfig = memo(FeeConfigBase);
export default FeeConfig;
