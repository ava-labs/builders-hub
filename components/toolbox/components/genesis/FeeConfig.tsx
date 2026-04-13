import { useCallback, useEffect, useState } from 'react';
import { RawInput } from '../Input';
import { Zap, Building2, Settings2, HelpCircle, Gamepad2, TrendingUp } from 'lucide-react';
import { ValidationMessages } from './types';
import { useGenesisHighlight } from './GenesisHighlightContext';
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

const PRESETS: Record<
  Exclude<PresetType, 'custom'>,
  {
    name: string;
    description: string;
    icon: typeof Zap;
    gasLimit: number;
    feeConfig: FeeConfigType;
    color: string;
  }
> = {
  testnet: {
    name: 'Testnet',
    description: 'Optimized for development and testing. Low fees, high throughput, static pricing.',
    icon: Zap,
    color: 'green',
    gasLimit: 100000000, // 100M - high throughput
    feeConfig: {
      baseFeeChangeDenominator: 48,
      blockGasCostStep: 0, // Disable dynamic fees
      maxBlockGasCost: 0, // Disable dynamic fees
      minBaseFee: 1000000000, // 1 gwei - cheap
      minBlockGasCost: 0,
      targetGas: 100000000, // Match gas limit for static pricing
    },
  },
  mainnet: {
    name: 'Mainnet',
    description: 'Balanced for production use. Standard fees with congestion protection.',
    icon: Building2,
    color: 'blue',
    gasLimit: 15000000, // 15M - standard
    feeConfig: {
      baseFeeChangeDenominator: 48,
      blockGasCostStep: 200000,
      maxBlockGasCost: 1000000,
      minBaseFee: 25000000000, // 25 gwei
      minBlockGasCost: 0,
      targetGas: 15000000,
    },
  },
  gaming: {
    name: 'Gaming',
    description: 'Maximum throughput with predictable, low-cost static fees.',
    icon: Gamepad2,
    color: 'pink',
    gasLimit: 100000000, // 100M - max throughput
    feeConfig: {
      baseFeeChangeDenominator: 48,
      blockGasCostStep: 0, // Static pricing - no fee surprises mid-game
      maxBlockGasCost: 0, // Static pricing
      minBaseFee: 1000000000, // 1 gwei
      minBlockGasCost: 0,
      targetGas: 100000000, // Match gas limit for static pricing
    },
  },
  defi: {
    name: 'DeFi',
    description: 'Optimized for decentralized finance with MEV protection.',
    icon: TrendingUp,
    color: 'violet',
    gasLimit: 30000000, // 30M
    feeConfig: {
      baseFeeChangeDenominator: 36,
      blockGasCostStep: 500000,
      maxBlockGasCost: 10000000, // 10M - high for liquidations
      minBaseFee: 10000000000, // 10 gwei
      minBlockGasCost: 0,
      targetGas: 15000000, // 15M
    },
  },
  rwa: {
    name: 'Tokenization',
    description: 'Compliant infrastructure for real-world asset tokenization.',
    icon: Building2,
    color: 'emerald',
    gasLimit: 15000000, // 15M
    feeConfig: {
      baseFeeChangeDenominator: 36,
      blockGasCostStep: 200000,
      maxBlockGasCost: 1000000,
      minBaseFee: 25000000000, // 25 gwei
      minBlockGasCost: 0,
      targetGas: 15000000,
    },
  },
};

// Field descriptions for tooltips
const FIELD_DESCRIPTIONS = {
  preset: {
    title: 'Configuration Preset',
    description: 'Choose a preset optimized for your use case, or customize each parameter manually.',
  },
  gasLimit: {
    title: 'Gas Limit',
    description:
      'Maximum gas allowed per block. Higher values allow more transactions per block but require more validator resources.',
    recommendation: 'Testnet: 100M for high throughput. Mainnet: 15-40M for balanced performance. C-Chain uses 37.5M.',
    unit: 'gas units',
  },
  minBaseFee: {
    title: 'Minimum Base Fee',
    description:
      'The lowest possible transaction fee. This is the floor that fees cannot go below, even during low network activity.',
    recommendation: 'Testnet: 1 gwei (cheap). Mainnet: 25+ gwei (spam protection).',
    unit: 'gwei',
  },
  baseFeeChangeDenominator: {
    title: 'Base Fee Change Denominator',
    description:
      'Controls how quickly fees adjust to congestion. Lower values = faster fee changes. The fee can change by at most 1/denominator per block.',
    recommendation: '48 is standard. Lower (8-24) for more reactive fees, higher (100+) for stability.',
    unit: 'denominator',
  },
  targetGas: {
    title: 'Target Gas (per 10s)',
    description:
      'Target gas consumption over a 10-second window. When actual usage exceeds this, fees increase. Set higher than (gasLimit × 10 ÷ blockRate) for static pricing.',
    recommendation: 'For static fees: set to gasLimit or higher. For dynamic fees: set to 50-100% of gasLimit.',
    unit: 'gas units',
  },
  minBlockGasCost: {
    title: 'Min Block Gas Cost',
    description:
      'Minimum additional gas cost added to each block. Part of the dynamic fee mechanism that adjusts based on block fullness.',
    recommendation: 'Usually 0. Only increase if you need a minimum fee floor that rises with usage.',
    unit: 'gas units',
  },
  maxBlockGasCost: {
    title: 'Max Block Gas Cost',
    description:
      'Maximum additional gas cost per block. Caps how high dynamic fees can go. Set to 0 to disable dynamic fee adjustments.',
    recommendation: 'Testnet: 0 (disabled). Mainnet: 1M for moderate fee ceiling.',
    unit: 'gas units',
  },
  blockGasCostStep: {
    title: 'Block Gas Cost Step',
    description:
      'How much the block gas cost changes per block based on fullness. Set to 0 to disable dynamic fee adjustments entirely.',
    recommendation: 'Testnet: 0 (static fees). Mainnet: 200K for gradual adjustments.',
    unit: 'gas units per block',
  },
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
          {'recommendation' in info && <p className="text-xs text-blue-300">💡 {info.recommendation}</p>}
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
  type = 'number',
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
        inputMode={type === 'text' ? 'decimal' : 'numeric'}
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
      {!error && warning && <div className="text-xs text-zinc-500 dark:text-zinc-400">{warning}</div>}
    </div>
  </div>
);

// Color mappings for presets
const PRESET_COLORS: Record<string, { border: string; bg: string; icon: string; text: string }> = {
  green: {
    border: 'border-green-500',
    bg: 'bg-green-50 dark:bg-green-950/30',
    icon: 'text-green-600 dark:text-green-400',
    text: 'text-green-700 dark:text-green-300',
  },
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    icon: 'text-blue-600 dark:text-blue-400',
    text: 'text-blue-700 dark:text-blue-300',
  },
  pink: {
    border: 'border-pink-500',
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    icon: 'text-pink-600 dark:text-pink-400',
    text: 'text-pink-700 dark:text-pink-300',
  },
  violet: {
    border: 'border-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    icon: 'text-violet-600 dark:text-violet-400',
    text: 'text-violet-700 dark:text-violet-300',
  },
  emerald: {
    border: 'border-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: 'text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  purple: {
    border: 'border-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    icon: 'text-purple-600 dark:text-purple-400',
    text: 'text-purple-700 dark:text-purple-300',
  },
};

// Preset selector component
const PresetSelector = ({ selected, onSelect }: { selected: PresetType; onSelect: (preset: PresetType) => void }) => {
  const presetOrder: PresetType[] = ['testnet', 'mainnet', 'custom', 'gaming', 'defi', 'rwa'];
  const presetDescriptions: Record<PresetType, string> = {
    testnet: 'Low fees, high throughput',
    mainnet: 'Production-ready defaults',
    custom: 'Fine-tune all parameters',
    gaming: 'High TPS, stable fees',
    defi: 'MEV protection, high gas',
    rwa: 'Compliance & audit trail',
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
          const isComingSoon = presetKey === 'defi' || presetKey === 'rwa';

          return (
            <button
              key={presetKey}
              type="button"
              onClick={() => !isComingSoon && onSelect(presetKey)}
              disabled={isComingSoon}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                isComingSoon
                  ? 'border-zinc-200 dark:border-zinc-800 opacity-50 cursor-not-allowed'
                  : isSelected
                    ? `${colors.border} ${colors.bg}`
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
            >
              <Icon
                className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                  isComingSoon ? 'text-zinc-300 dark:text-zinc-600' : isSelected ? colors.icon : 'text-zinc-400'
                }`}
              />
              <div className="min-w-0 flex-1 overflow-hidden">
                <div
                  className={`font-medium text-sm flex items-center gap-1.5 overflow-hidden ${
                    isComingSoon
                      ? 'text-zinc-400 dark:text-zinc-500'
                      : isSelected
                        ? colors.text
                        : 'text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <span className="truncate">{isCustom ? 'Custom' : preset!.name}</span>
                  {isComingSoon ? (
                    <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 whitespace-nowrap flex-shrink-0">
                      Coming Soon
                    </span>
                  ) : isBlueprint ? (
                    <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 whitespace-nowrap flex-shrink-0">
                      Blueprint
                    </span>
                  ) : null}
                </div>
                <div
                  className={`text-xs mt-0.5 truncate ${
                    isComingSoon ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
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
  initialPreset,
}: FeeConfigProps) {
  const { setHighlightPath } = useGenesisHighlight();

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('testnet');
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Track when user explicitly selects a blueprint to prevent auto-detection overwriting it
  // Initialize from initialPreset if it's a blueprint to prevent auto-detection from overriding it
  const [userSelectedBlueprint, setUserSelectedBlueprint] = useState<PresetType | null>(
    initialPreset && ['gaming', 'defi', 'rwa'].includes(initialPreset) ? (initialPreset as PresetType) : null,
  );

  // Track if initial preset has been applied to avoid re-applying on every render
  const [initialPresetApplied, setInitialPresetApplied] = useState(false);

  // Apply initial preset on mount if provided (e.g., from blueprint navigation)
  useEffect(() => {
    if (
      initialPreset &&
      !initialPresetApplied &&
      initialPreset !== 'custom' &&
      PRESETS[initialPreset as Exclude<PresetType, 'custom'>]
    ) {
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
  const [baseFeeChangeDenominatorInput, setBaseFeeChangeDenominatorInput] = useState(
    feeConfig.baseFeeChangeDenominator.toString(),
  );
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
  const handlePresetSelect = useCallback(
    (preset: PresetType) => {
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
      }
    },
    [setGasLimit, onFeeConfigChange],
  );

  // Sync local strings from props when not actively editing
  useEffect(() => {
    if (focusedField !== 'gasLimit') setGasLimitInput(gasLimit.toString());
  }, [gasLimit, focusedField]);
  useEffect(() => {
    if (focusedField !== 'minBaseFee') setMinBaseFeeInput((feeConfig.minBaseFee / 1000000000).toString());
  }, [feeConfig.minBaseFee, focusedField]);
  useEffect(() => {
    if (focusedField !== 'baseFeeChangeDenominator')
      setBaseFeeChangeDenominatorInput(feeConfig.baseFeeChangeDenominator.toString());
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
  const handleGasLimitChange = useCallback(
    (value: string) => {
      setGasLimitInput(value);
      const parsed = parseInt(value);
      if (!isNaN(parsed)) {
        setGasLimit(parsed);
      }
    },
    [setGasLimit],
  );

  const handleMinBaseFeeChange = useCallback(
    (value: string) => {
      setMinBaseFeeInput(value);
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        onFeeConfigChange({ ...feeConfig, minBaseFee: gweiToWei(parsed) });
      }
    },
    [feeConfig, onFeeConfigChange],
  );

  const handleFeeConfigNumberChange = useCallback(
    (key: keyof FeeConfigType, value: string) => {
      const setLocal = (v: string) => {
        switch (key) {
          case 'baseFeeChangeDenominator':
            setBaseFeeChangeDenominatorInput(v);
            break;
          case 'minBlockGasCost':
            setMinBlockGasCostInput(v);
            break;
          case 'maxBlockGasCost':
            setMaxBlockGasCostInput(v);
            break;
          case 'blockGasCostStep':
            setBlockGasCostStepInput(v);
            break;
          case 'targetGas':
            setTargetGasInput(v);
            break;
        }
      };
      setLocal(value);
      const parsed = parseInt(value);
      if (!isNaN(parsed)) {
        onFeeConfigChange({ ...feeConfig, [key]: parsed });
      }
    },
    [feeConfig, onFeeConfigChange],
  );

  // Blur handlers
  const normalizeOnBlur = useCallback(
    (field: string) => {
      switch (field) {
        case 'gasLimit': {
          const parsed = parseInt(gasLimitInput);
          if (gasLimitInput === '' || isNaN(parsed)) setGasLimitInput(gasLimit.toString());
          break;
        }
        case 'minBaseFee': {
          const parsed = parseFloat(minBaseFeeInput);
          if (minBaseFeeInput === '' || isNaN(parsed))
            setMinBaseFeeInput((feeConfig.minBaseFee / 1000000000).toString());
          break;
        }
        case 'baseFeeChangeDenominator': {
          const parsed = parseInt(baseFeeChangeDenominatorInput);
          if (baseFeeChangeDenominatorInput === '' || isNaN(parsed))
            setBaseFeeChangeDenominatorInput(feeConfig.baseFeeChangeDenominator.toString());
          break;
        }
        case 'minBlockGasCost': {
          const parsed = parseInt(minBlockGasCostInput);
          if (minBlockGasCostInput === '' || isNaN(parsed))
            setMinBlockGasCostInput(feeConfig.minBlockGasCost.toString());
          break;
        }
        case 'maxBlockGasCost': {
          const parsed = parseInt(maxBlockGasCostInput);
          if (maxBlockGasCostInput === '' || isNaN(parsed))
            setMaxBlockGasCostInput(feeConfig.maxBlockGasCost.toString());
          break;
        }
        case 'blockGasCostStep': {
          const parsed = parseInt(blockGasCostStepInput);
          if (blockGasCostStepInput === '' || isNaN(parsed))
            setBlockGasCostStepInput(feeConfig.blockGasCostStep.toString());
          break;
        }
        case 'targetGas': {
          const parsed = parseInt(targetGasInput);
          if (targetGasInput === '' || isNaN(parsed)) setTargetGasInput(feeConfig.targetGas.toString());
          break;
        }
      }
      setFocusedField(null);
    },
    [
      gasLimitInput,
      gasLimit,
      minBaseFeeInput,
      feeConfig,
      baseFeeChangeDenominatorInput,
      minBlockGasCostInput,
      maxBlockGasCostInput,
      blockGasCostStepInput,
      targetGasInput,
    ],
  );

  // Calculate static gas pricing threshold (uses targetBlockRate from validator config, default 2s)
  const staticGasThreshold = Math.ceil((gasLimit * 10) / targetBlockRate);
  const isStaticPricing = feeConfig.targetGas >= staticGasThreshold;

  // Computed metrics for display
  const blockUtilizationTarget =
    gasLimit > 0 ? Math.min(100, Math.round(((feeConfig.targetGas * targetBlockRate) / (gasLimit * 10)) * 100)) : 0;

  // Slider range for target gas — ensures static threshold is reachable
  const targetGasSliderMax = Math.max(staticGasThreshold * 1.2, 200000000);

  // Common slider class
  const sliderClass =
    'w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-sm';

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

      {/* Core Parameters - Enhanced */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        {/* Header with live metrics */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Core Parameters</h4>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  isStaticPricing
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                }`}
              >
                {isStaticPricing ? 'Static' : 'Dynamic'}
              </span>
            </div>
          </div>
        </div>

        <div className={`p-4 ${compact ? 'space-y-4' : 'space-y-6'}`}>
          {/* Gas Limit */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor="gasLimit">
                  Gas Limit per Block
                </label>
                <FieldTooltip field="gasLimit" />
              </div>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                {formatNumber(parseInt(gasLimitInput) || 0)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <input
                  type="range"
                  min={1000000}
                  max={200000000}
                  step={1000000}
                  value={gasLimit}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    setGasLimit(value);
                    setGasLimitInput(value.toString());
                  }}
                  className={sliderClass}
                />
                <div className="relative h-5 mt-0.5">
                  <span className="absolute left-0 text-[9px] text-zinc-400">1M</span>
                  <span className="absolute right-0 text-[9px] text-zinc-400">200M</span>
                  <span
                    className="absolute -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${((37_500_000 - 1_000_000) / (200_000_000 - 1_000_000)) * 100}%` }}
                  >
                    <span className="w-px h-1.5 bg-zinc-300 dark:bg-zinc-600" />
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">C-Chain 37.5M</span>
                  </span>
                </div>
              </div>
              <div className="w-[120px] flex-shrink-0">
                <RawInput
                  id="gasLimit"
                  type="text"
                  value={gasLimitInput}
                  onChange={(e) => handleGasLimitChange((e.target as HTMLInputElement).value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  onFocus={() => handleFocus('gasLimit')}
                  onBlur={() => normalizeOnBlur('gasLimit')}
                  className="py-1.5 text-xs font-mono text-right"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
            </div>
            {validationMessages.errors.gasLimit && (
              <div className="text-xs text-red-500">{validationMessages.errors.gasLimit}</div>
            )}
            {!validationMessages.errors.gasLimit && validationMessages.warnings.gasLimit && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{validationMessages.warnings.gasLimit}</div>
            )}
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800/50" />

          {/* Min Base Fee */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor="minBaseFee">
                  Minimum Base Fee
                </label>
                <FieldTooltip field="minBaseFee" />
              </div>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                {parseFloat(minBaseFeeInput) || 0} gwei
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <input
                  type="range"
                  min={0}
                  max={100000000000}
                  step={1000000000}
                  value={feeConfig.minBaseFee}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    onFeeConfigChange({ ...feeConfig, minBaseFee: value });
                    setMinBaseFeeInput((value / 1000000000).toString());
                  }}
                  className={sliderClass}
                />
                <div className="relative h-5 mt-0.5">
                  <span className="absolute left-0 text-[9px] text-zinc-400">0 gwei</span>
                  <span className="absolute right-0 text-[9px] text-zinc-400">100 gwei</span>
                  <span className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: '25%' }}>
                    <span className="w-px h-1.5 bg-zinc-300 dark:bg-zinc-600" />
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">25 gwei</span>
                  </span>
                </div>
              </div>
              <div className="w-[120px] flex-shrink-0 flex items-center gap-1">
                <RawInput
                  id="minBaseFee"
                  type="text"
                  value={minBaseFeeInput}
                  onChange={(e) => handleMinBaseFeeChange((e.target as HTMLInputElement).value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  onFocus={() => handleFocus('minBaseFee')}
                  onBlur={() => normalizeOnBlur('minBaseFee')}
                  className="py-1.5 text-xs font-mono text-right"
                  inputMode="decimal"
                  autoComplete="off"
                />
                <span className="text-[10px] text-zinc-400 flex-shrink-0">gwei</span>
              </div>
            </div>
            {validationMessages.errors.minBaseFee && (
              <div className="text-xs text-red-500">{validationMessages.errors.minBaseFee}</div>
            )}
            {!validationMessages.errors.minBaseFee && validationMessages.warnings.minBaseFee && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{validationMessages.warnings.minBaseFee}</div>
            )}
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800/50" />

          {/* Target Gas */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor="targetGas">
                  Target Gas (10s window)
                </label>
                <FieldTooltip field="targetGas" />
              </div>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  isStaticPricing
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                }`}
              >
                {isStaticPricing ? 'Static' : `Dynamic ${blockUtilizationTarget}%`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <div className="relative">
                  <input
                    type="range"
                    min={1000000}
                    max={targetGasSliderMax}
                    step={1000000}
                    value={feeConfig.targetGas}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      handleFeeConfigNumberChange('targetGas', value.toString());
                    }}
                    className={sliderClass}
                  />
                  {/* Static pricing threshold marker */}
                  {staticGasThreshold > 1000000 && staticGasThreshold < targetGasSliderMax && (
                    <div
                      className="absolute top-0 h-1.5 w-0 border-r-[2px] border-dashed border-green-500/50 pointer-events-none"
                      style={{
                        left: `${((staticGasThreshold - 1000000) / (targetGasSliderMax - 1000000)) * 100}%`,
                      }}
                    />
                  )}
                </div>
                <div className="relative h-5 mt-0.5">
                  <span className="absolute left-0 text-[9px] text-zinc-400">1M</span>
                  <span className="absolute right-0 text-[9px] text-zinc-400">
                    {formatNumber(Math.round(targetGasSliderMax))}
                  </span>
                  {staticGasThreshold > 1000000 && staticGasThreshold < targetGasSliderMax && (
                    <span
                      className="absolute -translate-x-1/2 flex flex-col items-center"
                      style={{ left: `${((staticGasThreshold - 1000000) / (targetGasSliderMax - 1000000)) * 100}%` }}
                    >
                      <span className="w-px h-1.5 bg-green-400 dark:bg-green-500" />
                      <span className="text-[9px] text-green-600 dark:text-green-400 whitespace-nowrap">static</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="w-[120px] flex-shrink-0">
                <RawInput
                  id="targetGas"
                  type="text"
                  value={targetGasInput}
                  onChange={(e) => handleFeeConfigNumberChange('targetGas', (e.target as HTMLInputElement).value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  onFocus={() => handleFocus('targetGas')}
                  onBlur={() => normalizeOnBlur('targetGas')}
                  className="py-1.5 text-xs font-mono text-right"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
            </div>
            {/* Inline pricing explanation */}
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {isStaticPricing
                ? 'Fees remain constant regardless of network activity.'
                : `Fees adjust when block utilization exceeds ${blockUtilizationTarget}% of capacity. Threshold: ${formatNumber(staticGasThreshold)} gas.`}
            </p>
            {validationMessages.errors.targetGas && (
              <div className="text-xs text-red-500">{validationMessages.errors.targetGas}</div>
            )}
            {!validationMessages.errors.targetGas && validationMessages.warnings.targetGas && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{validationMessages.warnings.targetGas}</div>
            )}
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
        <span className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▼</span>
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
