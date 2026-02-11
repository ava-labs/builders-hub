import { useCallback, useEffect, useState } from "react";
import { RawInput } from "../Input";
import { Info, Zap, Building2, Settings2, HelpCircle } from "lucide-react";
import { ValidationMessages } from "./types";
import { useGenesisHighlight } from "./GenesisHighlightContext";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
  targetBlockRate: number; // Still needed for static pricing calculation, but not editable here
  setTargetBlockRate: (value: number) => void;
  feeConfig: FeeConfigType;
  onFeeConfigChange: (config: FeeConfigType) => void;
  validationMessages: ValidationMessages;
  compact?: boolean;
};

// Preset configurations
type PresetType = 'testnet' | 'mainnet' | 'custom';

const PRESETS = {
  testnet: {
    name: 'Testnet (Fast & Cheap)',
    description: 'Optimized for development and testing. Low fees, high throughput, static pricing.',
    icon: Zap,
    gasLimit: 100000000,        // 100M - high throughput
    feeConfig: {
      baseFeeChangeDenominator: 48,
      blockGasCostStep: 0,       // Disable dynamic fees
      maxBlockGasCost: 0,        // Disable dynamic fees
      minBaseFee: 1000000000,    // 1 gwei - cheap
      minBlockGasCost: 0,
      targetGas: 100000000       // Match gas limit for static pricing
    }
  },
  mainnet: {
    name: 'Mainnet (Production)',
    description: 'Balanced for production use. Standard fees with congestion protection.',
    icon: Building2,
    gasLimit: 15000000,         // 15M - standard
    feeConfig: {
      baseFeeChangeDenominator: 48,
      blockGasCostStep: 200000,
      maxBlockGasCost: 1000000,
      minBaseFee: 25000000000,   // 25 gwei
      minBlockGasCost: 0,
      targetGas: 15000000
    }
  }
};

// Field descriptions for tooltips
const FIELD_DESCRIPTIONS = {
  preset: {
    title: 'Configuration Preset',
    description: 'Choose a preset optimized for your use case, or customize each parameter manually.',
  },
  gasLimit: {
    title: 'Gas Limit',
    description: 'Maximum gas allowed per block. Higher values allow more transactions per block but require more validator resources.',
    recommendation: 'Testnet: 100M for high throughput. Mainnet: 15-30M for balanced performance.',
    unit: 'gas units'
  },
  minBaseFee: {
    title: 'Minimum Base Fee',
    description: 'The lowest possible transaction fee. This is the floor that fees cannot go below, even during low network activity.',
    recommendation: 'Testnet: 1 gwei (cheap). Mainnet: 25+ gwei (spam protection).',
    unit: 'gwei'
  },
  baseFeeChangeDenominator: {
    title: 'Base Fee Change Denominator',
    description: 'Controls how quickly fees adjust to congestion. Lower values = faster fee changes. The fee can change by at most 1/denominator per block.',
    recommendation: '48 is standard. Lower (8-24) for more reactive fees, higher (100+) for stability.',
    unit: 'denominator'
  },
  targetGas: {
    title: 'Target Gas (per 10s)',
    description: 'Target gas consumption over a 10-second window. When actual usage exceeds this, fees increase. Set higher than (gasLimit × 10 ÷ blockRate) for static pricing.',
    recommendation: 'For static fees: set to gasLimit or higher. For dynamic fees: set to 50-100% of gasLimit.',
    unit: 'gas units'
  },
  minBlockGasCost: {
    title: 'Min Block Gas Cost',
    description: 'Minimum additional gas cost added to each block. Part of the dynamic fee mechanism that adjusts based on block fullness.',
    recommendation: 'Usually 0. Only increase if you need a minimum fee floor that rises with usage.',
    unit: 'gas units'
  },
  maxBlockGasCost: {
    title: 'Max Block Gas Cost',
    description: 'Maximum additional gas cost per block. Caps how high dynamic fees can go. Set to 0 to disable dynamic fee adjustments.',
    recommendation: 'Testnet: 0 (disabled). Mainnet: 1M for moderate fee ceiling.',
    unit: 'gas units'
  },
  blockGasCostStep: {
    title: 'Block Gas Cost Step',
    description: 'How much the block gas cost changes per block based on fullness. Set to 0 to disable dynamic fee adjustments entirely.',
    recommendation: 'Testnet: 0 (static fees). Mainnet: 200K for gradual adjustments.',
    unit: 'gas units per block'
  }
};

// Tooltip component for field labels
const FieldTooltip = ({ field }: { field: keyof typeof FIELD_DESCRIPTIONS }) => {
  const info = FIELD_DESCRIPTIONS[field];
  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex ml-1">
        <HelpCircle className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-2">
          <p className="font-medium text-xs">{info.title}</p>
          <p className="text-xs text-zinc-300">{info.description}</p>
          {'recommendation' in info && (
            <p className="text-xs text-blue-300">💡 {info.recommendation}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

// Field component with integrated tooltip
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
  tooltipField,
  suffix,
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
  tooltipField?: keyof typeof FIELD_DESCRIPTIONS;
  suffix?: string;
}) => (
  <div className="space-y-1 text-[13px]">
    <label className="flex items-center text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor={id}>
      {label}
      {tooltipField && <FieldTooltip field={tooltipField} />}
    </label>
    <div className="relative">
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
        className={`py-2 text-[14px] ${suffix ? 'pr-16' : ''}`}
        inputMode={type === "text" ? "decimal" : "numeric"}
        autoComplete="off"
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
    <div className="min-h-[16px]">
      {error && <div className="text-xs text-red-500">{error}</div>}
      {!error && warning && <div className="text-xs text-amber-500">⚠️ {warning}</div>}
    </div>
  </div>
);

// Preset selector component
const PresetSelector = ({
  selected,
  onSelect
}: {
  selected: PresetType;
  onSelect: (preset: PresetType) => void;
}) => (
  <div className="space-y-2">
    <div className="flex items-center gap-1">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Configuration Preset</span>
      <FieldTooltip field="preset" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {/* Testnet Preset */}
      <button
        type="button"
        onClick={() => onSelect('testnet')}
        className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
          selected === 'testnet'
            ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
        }`}
      >
        <Zap className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
          selected === 'testnet' ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'
        }`} />
        <div className="min-w-0">
          <div className={`font-medium text-sm ${
            selected === 'testnet' ? 'text-green-700 dark:text-green-300' : 'text-zinc-700 dark:text-zinc-300'
          }`}>
            Testnet
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Low fees, high throughput
          </div>
        </div>
      </button>

      {/* Mainnet Preset */}
      <button
        type="button"
        onClick={() => onSelect('mainnet')}
        className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
          selected === 'mainnet'
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
        }`}
      >
        <Building2 className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
          selected === 'mainnet' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'
        }`} />
        <div className="min-w-0">
          <div className={`font-medium text-sm ${
            selected === 'mainnet' ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-700 dark:text-zinc-300'
          }`}>
            Mainnet
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Production-ready defaults
          </div>
        </div>
      </button>

      {/* Custom Preset */}
      <button
        type="button"
        onClick={() => onSelect('custom')}
        className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
          selected === 'custom'
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
        }`}
      >
        <Settings2 className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
          selected === 'custom' ? 'text-purple-600 dark:text-purple-400' : 'text-zinc-400'
        }`} />
        <div className="min-w-0">
          <div className={`font-medium text-sm ${
            selected === 'custom' ? 'text-purple-700 dark:text-purple-300' : 'text-zinc-700 dark:text-zinc-300'
          }`}>
            Custom
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Fine-tune all parameters
          </div>
        </div>
      </button>
    </div>
  </div>
);

function FeeConfigBase({
  gasLimit,
  setGasLimit,
  targetBlockRate, // Used for static pricing calculation only
  feeConfig,
  onFeeConfigChange,
  validationMessages,
  compact
}: FeeConfigProps) {
  const { setHighlightPath } = useGenesisHighlight();

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('testnet');
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  // Detect current preset based on values
  useEffect(() => {
    const isTestnet =
      gasLimit === PRESETS.testnet.gasLimit &&
      feeConfig.minBaseFee === PRESETS.testnet.feeConfig.minBaseFee &&
      feeConfig.maxBlockGasCost === PRESETS.testnet.feeConfig.maxBlockGasCost;

    const isMainnet =
      gasLimit === PRESETS.mainnet.gasLimit &&
      feeConfig.minBaseFee === PRESETS.mainnet.feeConfig.minBaseFee &&
      feeConfig.maxBlockGasCost === PRESETS.mainnet.feeConfig.maxBlockGasCost;

    if (isTestnet) {
      setSelectedPreset('testnet');
    } else if (isMainnet) {
      setSelectedPreset('mainnet');
    } else {
      setSelectedPreset('custom');
    }
  }, [gasLimit, feeConfig]);

  // Handle preset selection
  const handlePresetSelect = useCallback((preset: PresetType) => {
    setSelectedPreset(preset);

    if (preset === 'testnet' || preset === 'mainnet') {
      const presetConfig = PRESETS[preset];
      setGasLimit(presetConfig.gasLimit);
      onFeeConfigChange(presetConfig.feeConfig);

      // Update local inputs
      setGasLimitInput(presetConfig.gasLimit.toString());
      setMinBaseFeeInput((presetConfig.feeConfig.minBaseFee / 1000000000).toString());
      setBaseFeeChangeDenominatorInput(presetConfig.feeConfig.baseFeeChangeDenominator.toString());
      setMinBlockGasCostInput(presetConfig.feeConfig.minBlockGasCost.toString());
      setMaxBlockGasCostInput(presetConfig.feeConfig.maxBlockGasCost.toString());
      setBlockGasCostStepInput(presetConfig.feeConfig.blockGasCostStep.toString());
      setTargetGasInput(presetConfig.feeConfig.targetGas.toString());
    }
  }, [setGasLimit, onFeeConfigChange]);

  // Sync local strings from props when not actively editing
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

  // Change handlers
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

  const handleFeeConfigNumberChange = useCallback((key: keyof FeeConfigType, value: string) => {
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

  // Blur handlers
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

  // Calculate static gas pricing threshold (uses targetBlockRate from validator config, default 2s)
  const staticGasThreshold = Math.ceil((gasLimit * 10) / targetBlockRate);
  const isStaticPricing = feeConfig.targetGas >= staticGasThreshold;

  // Format large numbers for display
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(0)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Preset Selector */}
      <PresetSelector selected={selectedPreset} onSelect={handlePresetSelect} />

      {/* Preset Description */}
      {selectedPreset !== 'custom' && (
        <div className={`rounded-lg p-4 ${
          selectedPreset === 'testnet'
            ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50'
            : 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50'
        }`}>
          <div className="flex items-start gap-3">
            {selectedPreset === 'testnet' ? (
              <Zap className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-2">
              <div className={`font-medium text-sm ${
                selectedPreset === 'testnet' ? 'text-green-800 dark:text-green-200' : 'text-blue-800 dark:text-blue-200'
              }`}>
                {PRESETS[selectedPreset].name}
              </div>
              <div className={`text-xs ${
                selectedPreset === 'testnet' ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'
              }`}>
                {PRESETS[selectedPreset].description}
              </div>
              <div className={`text-xs space-y-1 pt-1 ${
                selectedPreset === 'testnet' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
              }`}>
                <div>• Gas limit: <strong>{formatNumber(PRESETS[selectedPreset].gasLimit)}</strong></div>
                <div>• Min fee: <strong>{PRESETS[selectedPreset].feeConfig.minBaseFee / 1000000000} gwei</strong></div>
                <div>• Fee model: <strong>{PRESETS[selectedPreset].feeConfig.maxBlockGasCost === 0 ? 'Static (consistent)' : 'Dynamic (congestion-based)'}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Core Parameters - Always visible */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-4 text-zinc-800 dark:text-zinc-200">
          Core Parameters
        </h4>
        <div className={`grid grid-cols-1 md:grid-cols-2 ${compact ? 'gap-3' : 'gap-4'}`}>
          <Field
            id="gasLimit"
            label="Gas Limit per Block"
            value={gasLimitInput}
            onChange={handleGasLimitChange}
            onFocus={() => handleFocus('gasLimit')}
            onBlur={() => normalizeOnBlur('gasLimit')}
            placeholder="15000000"
            tooltipField="gasLimit"
            suffix={formatNumber(parseInt(gasLimitInput) || 0)}
            error={validationMessages.errors.gasLimit}
            warning={validationMessages.warnings.gasLimit}
          />
          <Field
            id="minBaseFee"
            label="Minimum Transaction Fee"
            value={minBaseFeeInput}
            onChange={handleMinBaseFeeChange}
            onFocus={() => handleFocus('minBaseFee')}
            onBlur={() => normalizeOnBlur('minBaseFee')}
            placeholder="1"
            type="text"
            tooltipField="minBaseFee"
            suffix="gwei"
            error={validationMessages.errors.minBaseFee}
            warning={validationMessages.warnings.minBaseFee}
          />
          <Field
            id="targetGas"
            label="Target Gas (10s window)"
            value={targetGasInput}
            onChange={(v) => handleFeeConfigNumberChange('targetGas', v)}
            onFocus={() => handleFocus('targetGas')}
            onBlur={() => normalizeOnBlur('targetGas')}
            placeholder="15000000"
            tooltipField="targetGas"
            suffix={formatNumber(parseInt(targetGasInput) || 0)}
            error={validationMessages.errors.targetGas}
            warning={validationMessages.warnings.targetGas}
          />
        </div>
      </div>

      {/* Pricing Model Indicator */}
      <div className={`rounded-lg p-3 ${
        isStaticPricing
          ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50'
          : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50'
      }`}>
        <div className="flex gap-2">
          <Info className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
            isStaticPricing ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
          }`} />
          <div className="text-xs space-y-1">
            <div className={`font-medium ${
              isStaticPricing ? 'text-green-900 dark:text-green-100' : 'text-amber-900 dark:text-amber-100'
            }`}>
              {isStaticPricing ? '✓ Static Fee Pricing Active' : '⚡ Dynamic Fee Pricing Active'}
            </div>
            <div className={isStaticPricing ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'}>
              {isStaticPricing
                ? 'Transaction fees will remain constant regardless of network activity. Ideal for testnets and predictable costs.'
                : `Fees will adjust based on network congestion. Target gas threshold: ${formatNumber(staticGasThreshold)}.`
              }
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Settings Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
      >
        <Settings2 className="h-4 w-4" />
        {showAdvanced ? 'Hide' : 'Show'} Advanced Fee Settings
        <span className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Settings2 className="h-4 w-4" />
            Dynamic Fee Adjustment Parameters
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            These parameters control how fees react to network congestion. Set all to 0 for completely static pricing.
          </p>
          <div className={`grid grid-cols-1 md:grid-cols-2 ${compact ? 'gap-3' : 'gap-4'}`}>
            <Field
              id="baseFeeChangeDenominator"
              label="Fee Change Rate"
              value={baseFeeChangeDenominatorInput}
              onChange={(v) => handleFeeConfigNumberChange('baseFeeChangeDenominator', v)}
              onFocus={() => handleFocus('baseFeeChangeDenominator')}
              onBlur={() => normalizeOnBlur('baseFeeChangeDenominator')}
              placeholder="48"
              tooltipField="baseFeeChangeDenominator"
              error={validationMessages.errors.baseFeeChangeDenominator}
              warning={validationMessages.warnings.baseFeeChangeDenominator}
            />
            <Field
              id="blockGasCostStep"
              label="Block Gas Cost Step"
              value={blockGasCostStepInput}
              onChange={(v) => handleFeeConfigNumberChange('blockGasCostStep', v)}
              onFocus={() => handleFocus('blockGasCostStep')}
              onBlur={() => normalizeOnBlur('blockGasCostStep')}
              placeholder="0"
              tooltipField="blockGasCostStep"
              error={validationMessages.errors.blockGasCostStep}
              warning={validationMessages.warnings.blockGasCostStep}
            />
            <Field
              id="minBlockGasCost"
              label="Min Block Gas Cost"
              value={minBlockGasCostInput}
              onChange={(v) => handleFeeConfigNumberChange('minBlockGasCost', v)}
              onFocus={() => handleFocus('minBlockGasCost')}
              onBlur={() => normalizeOnBlur('minBlockGasCost')}
              placeholder="0"
              tooltipField="minBlockGasCost"
              error={validationMessages.errors.minBlockGasCost}
              warning={validationMessages.warnings.minBlockGasCost}
            />
            <Field
              id="maxBlockGasCost"
              label="Max Block Gas Cost"
              value={maxBlockGasCostInput}
              onChange={(v) => handleFeeConfigNumberChange('maxBlockGasCost', v)}
              onFocus={() => handleFocus('maxBlockGasCost')}
              onBlur={() => normalizeOnBlur('maxBlockGasCost')}
              placeholder="0"
              tooltipField="maxBlockGasCost"
              error={validationMessages.errors.maxBlockGasCost}
              warning={validationMessages.warnings.maxBlockGasCost}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default FeeConfigBase;
