import { useCallback, useEffect, useState } from "react";
import { RawInput } from "../Input";
import { Info } from "lucide-react";
import { ValidationMessages } from "./types";
import { useGenesisHighlight } from "./GenesisHighlightContext";

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

// Field component defined outside to prevent recreation on each render
const Field = ({
  id,
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
  id?: string;
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
    <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor={id}>{label}</label>
    <RawInput
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange((e.target as HTMLInputElement).value)}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onPointerDownCapture={(e) => e.stopPropagation()}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      className="py-2 text-[14px]"
      inputMode={type === "text" ? "decimal" : "numeric"}
      autoComplete="off"
    />
    <div className="min-h-[16px]">
    {error && <div className="text-xs text-red-500">{error}</div>}
    {!error && warning && <div className="text-xs text-amber-500">⚠️ {warning}</div>}
    </div>
  </div>
);

function FeeConfigBase({
  gasLimit,
  setGasLimit,
  targetBlockRate,
  feeConfig,
  onFeeConfigChange,
  validationMessages,
  compact
}: FeeConfigProps) {
  const { setHighlightPath } = useGenesisHighlight();

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleFocus = (path: string) => {
    setHighlightPath(path);
    setFocusedField(path);
  };

  // Local string state for smooth typing
  const [gasLimitInput, setGasLimitInput] = useState(gasLimit.toString());
  const [minBaseFeeInput, setMinBaseFeeInput] = useState((feeConfig.minBaseFee / 1000000000).toString());
  const [baseFeeChangeDenominatorInput, setBaseFeeChangeDenominatorInput] = useState(feeConfig.baseFeeChangeDenominator.toString());
  const [minBlockGasCostInput, setMinBlockGasCostInput] = useState(feeConfig.minBlockGasCost.toString());
  const [maxBlockGasCostInput, setMaxBlockGasCostInput] = useState(feeConfig.maxBlockGasCost.toString());
  const [blockGasCostStepInput, setBlockGasCostStepInput] = useState(feeConfig.blockGasCostStep.toString());
  const [targetGasInput, setTargetGasInput] = useState(feeConfig.targetGas.toString());

  // Sync local strings from props when not actively editing the field
  useEffect(() => {
    if (focusedField !== 'gasLimit') setGasLimitInput(gasLimit.toString());
  }, [gasLimit, focusedField]);
  useEffect(() => {
    if (focusedField !== 'minBaseFee') setMinBaseFeeInput((feeConfig.minBaseFee / 1000000000).toString());
  }, [feeConfig.minBaseFee, focusedField]);
  useEffect(() => {
    if (focusedField !== 'baseFeeChangeDenominator') setBaseFeeChangeDenominatorInput(feeConfig.baseFeeChangeDenominator.toString());
  }, [feeConfig.baseFeeChangeDenominator, focusedField]);
  useEffect(() => {
    if (focusedField !== 'minBlockGasCost') setMinBlockGasCostInput(feeConfig.minBlockGasCost.toString());
  }, [feeConfig.minBlockGasCost, focusedField]);
  useEffect(() => {
    if (focusedField !== 'maxBlockGasCost') setMaxBlockGasCostInput(feeConfig.maxBlockGasCost.toString());
  }, [feeConfig.maxBlockGasCost, focusedField]);
  useEffect(() => {
    if (focusedField !== 'blockGasCostStep') setBlockGasCostStepInput(feeConfig.blockGasCostStep.toString());
  }, [feeConfig.blockGasCostStep, focusedField]);
  useEffect(() => {
    if (focusedField !== 'targetGas') setTargetGasInput(feeConfig.targetGas.toString());
  }, [feeConfig.targetGas, focusedField]);

  // Change handlers: update local immediately and parent when valid number
  const handleGasLimitChange = useCallback((value: string) => {
    setGasLimitInput(value);
    const parsed = parseInt(value);
    if (!isNaN(parsed)) {
      setGasLimit(parsed);
    }
  }, [setGasLimit]);

  const handleMinBaseFeeChange = useCallback((value: string) => {
    setMinBaseFeeInput(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      onFeeConfigChange({ ...feeConfig, minBaseFee: gweiToWei(parsed) });
    }
  }, [feeConfig, onFeeConfigChange]);

  const handleFeeConfigNumberChange = useCallback((key: keyof FeeConfigType, value: string, min: number = 0) => {
    const setLocal = (v: string) => {
      switch (key) {
        case 'baseFeeChangeDenominator': setBaseFeeChangeDenominatorInput(v); break;
        case 'minBlockGasCost': setMinBlockGasCostInput(v); break;
        case 'maxBlockGasCost': setMaxBlockGasCostInput(v); break;
        case 'blockGasCostStep': setBlockGasCostStepInput(v); break;
        case 'targetGas': setTargetGasInput(v); break;
      }
    };
    setLocal(value);
    const parsed = parseInt(value);
    if (!isNaN(parsed)) {
      onFeeConfigChange({ ...feeConfig, [key]: parsed });
    }
  }, [feeConfig, onFeeConfigChange]);

  // Blur handlers: normalize empty/invalid to current committed value
  const normalizeOnBlur = useCallback((field: string) => {
    switch (field) {
      case 'gasLimit': {
        const parsed = parseInt(gasLimitInput);
        if (gasLimitInput === '' || isNaN(parsed)) setGasLimitInput(gasLimit.toString());
        break;
      }
      case 'minBaseFee': {
        const parsed = parseFloat(minBaseFeeInput);
        if (minBaseFeeInput === '' || isNaN(parsed)) setMinBaseFeeInput((feeConfig.minBaseFee / 1000000000).toString());
        break;
      }
      case 'baseFeeChangeDenominator': {
        const parsed = parseInt(baseFeeChangeDenominatorInput);
        if (baseFeeChangeDenominatorInput === '' || isNaN(parsed)) setBaseFeeChangeDenominatorInput(feeConfig.baseFeeChangeDenominator.toString());
        break;
      }
      case 'minBlockGasCost': {
        const parsed = parseInt(minBlockGasCostInput);
        if (minBlockGasCostInput === '' || isNaN(parsed)) setMinBlockGasCostInput(feeConfig.minBlockGasCost.toString());
        break;
      }
      case 'maxBlockGasCost': {
        const parsed = parseInt(maxBlockGasCostInput);
        if (maxBlockGasCostInput === '' || isNaN(parsed)) setMaxBlockGasCostInput(feeConfig.maxBlockGasCost.toString());
        break;
      }
      case 'blockGasCostStep': {
        const parsed = parseInt(blockGasCostStepInput);
        if (blockGasCostStepInput === '' || isNaN(parsed)) setBlockGasCostStepInput(feeConfig.blockGasCostStep.toString());
        break;
      }
      case 'targetGas': {
        const parsed = parseInt(targetGasInput);
        if (targetGasInput === '' || isNaN(parsed)) setTargetGasInput(feeConfig.targetGas.toString());
        break;
      }
    }
    setFocusedField(null);
  }, [gasLimitInput, gasLimit, minBaseFeeInput, feeConfig, baseFeeChangeDenominatorInput, minBlockGasCostInput, maxBlockGasCostInput, blockGasCostStepInput, targetGasInput]);

  return (
    <div className="space-y-6">
      {/* Advanced Mode with All Fields */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md p-3">
          <h4 className="text-[13px] font-medium mb-2">Fee Configuration</h4>
          <div className={`grid grid-cols-1 md:grid-cols-2 ${compact ? 'gap-3' : 'gap-4'}`}>
          <div key="gasLimit">
            <Field
              id="gasLimit"
              label="Gas Limit"
              value={gasLimitInput}
              onChange={handleGasLimitChange}
              onFocus={() => handleFocus('gasLimit')}
              onBlur={() => normalizeOnBlur('gasLimit')}
              placeholder="15000000"
              error={validationMessages.errors.gasLimit}
              warning={validationMessages.warnings.gasLimit}
            />
          </div>
          <div key="minBaseFee">
            <Field
              id="minBaseFee"
              label="Min Base Fee (gwei)"
              value={minBaseFeeInput}
              onChange={handleMinBaseFeeChange}
              onFocus={() => handleFocus('minBaseFee')}
              onBlur={() => normalizeOnBlur('minBaseFee')}
              placeholder="25"
              type="text"
              error={validationMessages.errors.minBaseFee}
              warning={validationMessages.warnings.minBaseFee}
            />
          </div>
          <div key="baseFeeChangeDenominator">
            <Field
              id="baseFeeChangeDenominator"
              label="Base Fee Change Denominator"
              value={baseFeeChangeDenominatorInput}
              onChange={(v) => handleFeeConfigNumberChange('baseFeeChangeDenominator', v, 2)}
              onFocus={() => handleFocus('baseFeeChangeDenominator')}
              onBlur={() => normalizeOnBlur('baseFeeChangeDenominator')}
              placeholder="48"
              error={validationMessages.errors.baseFeeChangeDenominator}
              warning={validationMessages.warnings.baseFeeChangeDenominator}
            />
          </div>
          <div key="minBlockGasCost">
            <Field
              id="minBlockGasCost"
              label="Min Block Gas Cost"
              value={minBlockGasCostInput}
              onChange={(v) => handleFeeConfigNumberChange('minBlockGasCost', v, 0)}
              onFocus={() => handleFocus('minBlockGasCost')}
              onBlur={() => normalizeOnBlur('minBlockGasCost')}
              placeholder="0"
              error={validationMessages.errors.minBlockGasCost}
              warning={validationMessages.warnings.minBlockGasCost}
            />
          </div>
          <div key="maxBlockGasCost">
            <Field
              id="maxBlockGasCost"
              label="Max Block Gas Cost"
              value={maxBlockGasCostInput}
              onChange={(v) => handleFeeConfigNumberChange('maxBlockGasCost', v, feeConfig.minBlockGasCost)}
              onFocus={() => handleFocus('maxBlockGasCost')}
              onBlur={() => normalizeOnBlur('maxBlockGasCost')}
              placeholder="1000000"
              error={validationMessages.errors.maxBlockGasCost}
              warning={validationMessages.warnings.maxBlockGasCost}
            />
          </div>
          <div key="blockGasCostStep">
            <Field
              id="blockGasCostStep"
              label="Block Gas Cost Step"
              value={blockGasCostStepInput}
              onChange={(v) => handleFeeConfigNumberChange('blockGasCostStep', v, 0)}
              onFocus={() => handleFocus('blockGasCostStep')}
              onBlur={() => normalizeOnBlur('blockGasCostStep')}
              placeholder="200000"
              error={validationMessages.errors.blockGasCostStep}
              warning={validationMessages.warnings.blockGasCostStep}
            />
          </div>
          <div key="targetGas">
            <Field
              id="targetGas"
              label="Target Gas (per 10s window)"
              value={targetGasInput}
              onChange={(v) => handleFeeConfigNumberChange('targetGas', v, 100000)}
              onFocus={() => handleFocus('targetGas')}
              onBlur={() => normalizeOnBlur('targetGas')}
              placeholder="15000000"
              error={validationMessages.errors.targetGas}
              warning={validationMessages.warnings.targetGas}
            />
          </div>
        </div>

      {/* Static Gas Price Info */}
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
      {/* Dynamic fee/reward sections removed; these are now configured under Precompiles. */}
    </div>
  );
}

// Export the component directly
export default FeeConfigBase;
