import { useCallback, useEffect, useState } from "react";
import { RawInput } from "../Input";
import { Info, Zap, Building2, Settings2, HelpCircle, Gamepad2, TrendingUp, ChevronDown } from "lucide-react";
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
  initialPreset?: string | null;
};

// Preset configurations
type PresetType = 'testnet' | 'mainnet' | 'gaming' | 'defi' | 'rwa' | 'custom';

// Blueprint-specific compliance options
type BlueprintComplianceOptions = {
  enableTxAllowlist: boolean;
  enableDeployerAllowlist: boolean;
  disablePruning: boolean;
};

const PRESETS: Record<Exclude<PresetType, 'custom'>, {
  name: string;
  description: string;
  icon: typeof Zap;
  gasLimit: number;
  feeConfig: FeeConfigType;
  color: string;
  compliance?: BlueprintComplianceOptions;
}> = {
  testnet: {
    name: 'Testnet',
    description: 'Optimized for development and testing. Low fees, high throughput, static pricing.',
    icon: Zap,
    color: 'green',
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
    name: 'Mainnet',
    description: 'Balanced for production use. Standard fees with congestion protection.',
    icon: Building2,
    color: 'blue',
    gasLimit: 15000000,         // 15M - standard
    feeConfig: {
      baseFeeChangeDenominator: 48,
      blockGasCostStep: 200000,
      maxBlockGasCost: 1000000,
      minBaseFee: 25000000000,   // 25 gwei
      minBlockGasCost: 0,
      targetGas: 15000000
    }
  },
  gaming: {
    name: 'Gaming',
    description: 'High throughput, stable fees for gaming applications.',
    icon: Gamepad2,
    color: 'pink',
    gasLimit: 20000000,           // 20M
    feeConfig: {
      baseFeeChangeDenominator: 48, // Stable fees
      blockGasCostStep: 200000,
      maxBlockGasCost: 1000000,
      minBaseFee: 1000000000,     // 1 gwei
      minBlockGasCost: 0,
      targetGas: 10000000          // 10M
    }
  },
  defi: {
    name: 'DeFi',
    description: 'Optimized for decentralized finance with MEV protection.',
    icon: TrendingUp,
    color: 'violet',
    gasLimit: 30000000,           // 30M
    feeConfig: {
      baseFeeChangeDenominator: 36,
      blockGasCostStep: 500000,
      maxBlockGasCost: 10000000,   // 10M - high for liquidations
      minBaseFee: 10000000000,     // 10 gwei
      minBlockGasCost: 0,
      targetGas: 15000000          // 15M
    }
  },
  rwa: {
    name: 'Tokenization',
    description: 'Compliant infrastructure for real-world asset tokenization.',
    icon: Building2,
    color: 'emerald',
    gasLimit: 15000000,           // 15M
    feeConfig: {
      baseFeeChangeDenominator: 36,
      blockGasCostStep: 200000,
      maxBlockGasCost: 1000000,
      minBaseFee: 25000000000,     // 25 gwei
      minBlockGasCost: 0,
      targetGas: 15000000
    },
    compliance: {
      enableTxAllowlist: true,
      enableDeployerAllowlist: true,
      disablePruning: true
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

// Color mappings for presets
const PRESET_COLORS: Record<string, { border: string; bg: string; icon: string; text: string }> = {
  green: {
    border: 'border-green-500',
    bg: 'bg-green-50 dark:bg-green-950/30',
    icon: 'text-green-600 dark:text-green-400',
    text: 'text-green-700 dark:text-green-300'
  },
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    icon: 'text-blue-600 dark:text-blue-400',
    text: 'text-blue-700 dark:text-blue-300'
  },
  pink: {
    border: 'border-pink-500',
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    icon: 'text-pink-600 dark:text-pink-400',
    text: 'text-pink-700 dark:text-pink-300'
  },
  violet: {
    border: 'border-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    icon: 'text-violet-600 dark:text-violet-400',
    text: 'text-violet-700 dark:text-violet-300'
  },
  emerald: {
    border: 'border-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: 'text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-300'
  },
  purple: {
    border: 'border-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    icon: 'text-purple-600 dark:text-purple-400',
    text: 'text-purple-700 dark:text-purple-300'
  }
};

// Preset selector component
const PresetSelector = ({
  selected,
  onSelect
}: {
  selected: PresetType;
  onSelect: (preset: PresetType) => void;
}) => {
  const presetOrder: PresetType[] = ['testnet', 'mainnet', 'custom', 'gaming', 'defi', 'rwa'];
  const presetDescriptions: Record<PresetType, string> = {
    testnet: 'Low fees, high throughput',
    mainnet: 'Production-ready defaults',
    custom: 'Fine-tune all parameters',
    gaming: 'High TPS, stable fees',
    defi: 'MEV protection, high gas',
    rwa: 'Compliance & audit trail'
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Configuration Preset</span>
        <FieldTooltip field="preset" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {presetOrder.map((presetKey) => {
          const isCustom = presetKey === 'custom';
          const preset = isCustom ? null : PRESETS[presetKey];
          const color = isCustom ? 'purple' : preset!.color;
          const colors = PRESET_COLORS[color];
          const Icon = isCustom ? Settings2 : preset!.icon;
          const isSelected = selected === presetKey;
          const isBlueprint = ['gaming', 'defi', 'rwa'].includes(presetKey);

          return (
            <button
              key={presetKey}
              type="button"
              onClick={() => onSelect(presetKey)}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                isSelected
                  ? `${colors.border} ${colors.bg}`
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
            >
              <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                isSelected ? colors.icon : 'text-zinc-400'
              }`} />
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className={`font-medium text-sm flex items-center gap-1.5 overflow-hidden ${
                  isSelected ? colors.text : 'text-zinc-700 dark:text-zinc-300'
                }`}>
                  <span className="truncate">{isCustom ? 'Custom' : preset!.name}</span>
                  {isBlueprint && (
                    <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 whitespace-nowrap flex-shrink-0">
                      Blueprint
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                  {presetDescriptions[presetKey]}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

function FeeConfigBase({
  gasLimit,
  setGasLimit,
  targetBlockRate, // Used for static pricing calculation only
  feeConfig,
  onFeeConfigChange,
  validationMessages,
  compact,
  initialPreset
}: FeeConfigProps) {
  const { setHighlightPath } = useGenesisHighlight();

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('testnet');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBlueprintCustomizer, setShowBlueprintCustomizer] = useState(false);
  // Track when user explicitly selects a blueprint to prevent auto-detection overwriting it
  // Initialize from initialPreset if it's a blueprint to prevent auto-detection from overriding it
  const [userSelectedBlueprint, setUserSelectedBlueprint] = useState<PresetType | null>(
    initialPreset && ['gaming', 'defi', 'rwa'].includes(initialPreset) ? (initialPreset as PresetType) : null
  );

  // Blueprint-specific compliance state (only used for RWA)
  const [complianceOptions, setComplianceOptions] = useState<BlueprintComplianceOptions>({
    enableTxAllowlist: false,
    enableDeployerAllowlist: false,
    disablePruning: false
  });

  // Check if a blueprint preset is selected
  const isBlueprintPreset = ['gaming', 'defi', 'rwa'].includes(selectedPreset);

  // Track if initial preset has been applied to avoid re-applying on every render
  const [initialPresetApplied, setInitialPresetApplied] = useState(false);

  // Apply initial preset on mount if provided (e.g., from blueprint navigation)
  useEffect(() => {
    if (initialPreset && !initialPresetApplied && initialPreset !== 'custom' && PRESETS[initialPreset as Exclude<PresetType, 'custom'>]) {
      const presetKey = initialPreset as Exclude<PresetType, 'custom'>;
      const presetConfig = PRESETS[presetKey];

      setSelectedPreset(presetKey);
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

      // Track if user selected a blueprint
      if (['gaming', 'defi', 'rwa'].includes(presetKey)) {
        setUserSelectedBlueprint(presetKey);
      }

      // Set compliance options if present
      if (presetConfig.compliance) {
        setComplianceOptions(presetConfig.compliance);
      }

      setInitialPresetApplied(true);
    }
  }, [initialPreset, initialPresetApplied, setGasLimit, onFeeConfigChange]);

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
    // Skip auto-detection when user has explicitly selected a blueprint OR initialPreset is a blueprint
    // This prevents customizer changes or closing from resetting to 'custom'
    if (
      (userSelectedBlueprint && ['gaming', 'defi', 'rwa'].includes(userSelectedBlueprint)) ||
      (initialPreset && ['gaming', 'defi', 'rwa'].includes(initialPreset))
    ) {
      return;
    }

    const checkPreset = (presetKey: Exclude<PresetType, 'custom'>) => {
      const preset = PRESETS[presetKey];
      return (
        gasLimit === preset.gasLimit &&
        feeConfig.minBaseFee === preset.feeConfig.minBaseFee &&
        feeConfig.maxBlockGasCost === preset.feeConfig.maxBlockGasCost &&
        feeConfig.baseFeeChangeDenominator === preset.feeConfig.baseFeeChangeDenominator
      );
    };

    if (checkPreset('testnet')) {
      setSelectedPreset('testnet');
    } else if (checkPreset('mainnet')) {
      setSelectedPreset('mainnet');
    } else if (checkPreset('gaming')) {
      setSelectedPreset('gaming');
    } else if (checkPreset('defi')) {
      setSelectedPreset('defi');
    } else if (checkPreset('rwa')) {
      setSelectedPreset('rwa');
    } else {
      setSelectedPreset('custom');
    }
  }, [gasLimit, feeConfig, userSelectedBlueprint]);

  // Handle preset selection
  const handlePresetSelect = useCallback((preset: PresetType) => {
    setSelectedPreset(preset);

    // Track if user explicitly selected a blueprint preset
    if (['gaming', 'defi', 'rwa'].includes(preset)) {
      setUserSelectedBlueprint(preset);
    } else {
      // Clear user selection when switching to non-blueprint presets
      setUserSelectedBlueprint(null);
    }

    if (preset !== 'custom') {
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

      // Set compliance options if present
      if (presetConfig.compliance) {
        setComplianceOptions(presetConfig.compliance);
      } else {
        setComplianceOptions({
          enableTxAllowlist: false,
          enableDeployerAllowlist: false,
          disablePruning: false
        });
      }
    }

    // Reset customizer visibility when changing presets
    setShowBlueprintCustomizer(false);
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
      {selectedPreset !== 'custom' && (() => {
        const preset = PRESETS[selectedPreset];
        const colors = PRESET_COLORS[preset.color];
        const Icon = preset.icon;
        const bgColorMap: Record<string, string> = {
          green: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/50',
          blue: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50',
          pink: 'bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800/50',
          violet: 'bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800/50',
          emerald: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50'
        };
        const textColorMap: Record<string, { title: string; body: string; detail: string }> = {
          green: { title: 'text-green-800 dark:text-green-200', body: 'text-green-700 dark:text-green-300', detail: 'text-green-600 dark:text-green-400' },
          blue: { title: 'text-blue-800 dark:text-blue-200', body: 'text-blue-700 dark:text-blue-300', detail: 'text-blue-600 dark:text-blue-400' },
          pink: { title: 'text-pink-800 dark:text-pink-200', body: 'text-pink-700 dark:text-pink-300', detail: 'text-pink-600 dark:text-pink-400' },
          violet: { title: 'text-violet-800 dark:text-violet-200', body: 'text-violet-700 dark:text-violet-300', detail: 'text-violet-600 dark:text-violet-400' },
          emerald: { title: 'text-emerald-800 dark:text-emerald-200', body: 'text-emerald-700 dark:text-emerald-300', detail: 'text-emerald-600 dark:text-emerald-400' }
        };

        return (
          <div className={`rounded-lg p-4 border ${bgColorMap[preset.color]}`}>
            <div className="flex items-start gap-3">
              <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${colors.icon}`} />
              <div className="space-y-2">
                <div className={`font-medium text-sm ${textColorMap[preset.color].title}`}>
                  {preset.name}
                </div>
                <div className={`text-xs ${textColorMap[preset.color].body}`}>
                  {preset.description}
                </div>
                <div className={`text-xs space-y-1 pt-1 ${textColorMap[preset.color].detail}`}>
                  <div>• Gas limit: <strong>{formatNumber(preset.gasLimit)}</strong></div>
                  <div>• Min fee: <strong>{preset.feeConfig.minBaseFee / 1000000000} gwei</strong></div>
                  <div>• Fee model: <strong>{preset.feeConfig.maxBlockGasCost === 0 ? 'Static (consistent)' : 'Dynamic (congestion-based)'}</strong></div>
                  {preset.compliance && (
                    <div>• Compliance: <strong>KYC + Allowlist enabled</strong></div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Blueprint Customization Panel */}
      {isBlueprintPreset && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBlueprintCustomizer(!showBlueprintCustomizer)}
            className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Customize Blueprint
              </span>
              <span className="text-xs text-zinc-400">
                Adjust parameters from defaults
              </span>
            </div>
            <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${showBlueprintCustomizer ? 'rotate-180' : ''}`} />
          </button>

          {showBlueprintCustomizer && (
            <div className="p-4 space-y-6 bg-white dark:bg-zinc-950">
              {/* Gas & Performance Sliders */}
              <div className="space-y-4">
                <h5 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Gas & Performance
                </h5>

                {/* Gas Limit Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Gas Limit
                    </label>
                    <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
                      {formatNumber(gasLimit)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10000000}
                    max={50000000}
                    step={1000000}
                    value={gasLimit}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      setGasLimit(value);
                      setGasLimitInput(value.toString());
                    }}
                    className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>10M</span>
                    <span>50M</span>
                  </div>
                </div>

                {/* Min Base Fee Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Min Base Fee
                    </label>
                    <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
                      {feeConfig.minBaseFee / 1000000000} gwei
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={25000000000}
                    step={1000000000}
                    value={feeConfig.minBaseFee}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      onFeeConfigChange({ ...feeConfig, minBaseFee: value });
                      setMinBaseFeeInput((value / 1000000000).toString());
                    }}
                    className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>0 gwei</span>
                    <span>25 gwei</span>
                  </div>
                </div>

                {/* Fee Stability Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Fee Stability
                    </label>
                    <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
                      {feeConfig.baseFeeChangeDenominator}
                      <span className="text-xs text-zinc-400 ml-1">
                        ({feeConfig.baseFeeChangeDenominator >= 48 ? 'Stable' : feeConfig.baseFeeChangeDenominator >= 36 ? 'Standard' : 'Volatile'})
                      </span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min={24}
                    max={72}
                    step={6}
                    value={feeConfig.baseFeeChangeDenominator}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      onFeeConfigChange({ ...feeConfig, baseFeeChangeDenominator: value });
                      setBaseFeeChangeDenominatorInput(value.toString());
                    }}
                    className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>24 (Volatile)</span>
                    <span>72 (Stable)</span>
                  </div>
                </div>
              </div>

              {/* RWA-specific Compliance Toggles */}
              {selectedPreset === 'rwa' && (
                <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <h5 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Compliance Settings
                  </h5>

                  {/* Transaction Allowlist Toggle */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Transaction Allowlist
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Only authorized addresses can transact
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={complianceOptions.enableTxAllowlist}
                      onClick={() => setComplianceOptions(prev => ({ ...prev, enableTxAllowlist: !prev.enableTxAllowlist }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        complianceOptions.enableTxAllowlist ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                          complianceOptions.enableTxAllowlist ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </label>

                  {/* Contract Deployer Allowlist Toggle */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Contract Deployer Allowlist
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Only authorized addresses can deploy contracts
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={complianceOptions.enableDeployerAllowlist}
                      onClick={() => setComplianceOptions(prev => ({ ...prev, enableDeployerAllowlist: !prev.enableDeployerAllowlist }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        complianceOptions.enableDeployerAllowlist ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                          complianceOptions.enableDeployerAllowlist ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </label>

                  {/* Disable State Pruning Toggle */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Disable State Pruning
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Keep full blockchain history for audit compliance
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={complianceOptions.disablePruning}
                      onClick={() => setComplianceOptions(prev => ({ ...prev, disablePruning: !prev.disablePruning }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        complianceOptions.disablePruning ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                          complianceOptions.disablePruning ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </label>
                </div>
              )}

              {/* Preview Changes */}
              {(() => {
                const preset = PRESETS[selectedPreset as Exclude<PresetType, 'custom'>];
                const changes: Array<{ label: string; from: string; to: string }> = [];

                if (gasLimit !== preset.gasLimit) {
                  changes.push({
                    label: 'Gas Limit',
                    from: formatNumber(preset.gasLimit),
                    to: formatNumber(gasLimit)
                  });
                }
                if (feeConfig.minBaseFee !== preset.feeConfig.minBaseFee) {
                  changes.push({
                    label: 'Min Base Fee',
                    from: `${preset.feeConfig.minBaseFee / 1000000000} gwei`,
                    to: `${feeConfig.minBaseFee / 1000000000} gwei`
                  });
                }
                if (feeConfig.baseFeeChangeDenominator !== preset.feeConfig.baseFeeChangeDenominator) {
                  changes.push({
                    label: 'Fee Stability',
                    from: String(preset.feeConfig.baseFeeChangeDenominator),
                    to: String(feeConfig.baseFeeChangeDenominator)
                  });
                }

                if (changes.length === 0) return null;

                return (
                  <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <h5 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                      Changes from Default
                    </h5>
                    <div className="space-y-2">
                      {changes.map((change, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-zinc-600 dark:text-zinc-400">{change.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400 line-through">{change.from}</span>
                            <span className="text-zinc-400">→</span>
                            <span className="font-medium text-violet-600 dark:text-violet-400">{change.to}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
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
