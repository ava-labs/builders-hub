import { Input } from '@/components/toolbox/components/Input';

interface StakingParametersFormProps {
  minimumStakeAmount: string;
  setMinimumStakeAmount: (value: string) => void;
  maximumStakeAmount: string;
  setMaximumStakeAmount: (value: string) => void;
  minimumStakeDuration: string;
  setMinimumStakeDuration: (value: string) => void;
  minimumDelegationFeeBips: string;
  setMinimumDelegationFeeBips: (value: string) => void;
  maximumStakeMultiplier: string;
  setMaximumStakeMultiplier: (value: string) => void;
  weightToValueFactor: string;
  setWeightToValueFactor: (value: string) => void;
  disabled?: boolean;
  tokenLabel?: string;
}

function QuickSelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 -mt-4">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
            value === opt.value
              ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white'
              : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'
          } disabled:opacity-50`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const DURATION_PRESETS = [
  { label: 'None', value: '0' },
  { label: '1 hour', value: '3600' },
  { label: '1 day', value: '86400' },
  { label: '1 week', value: '604800' },
  { label: '2 weeks', value: '1209600' },
  { label: '30 days', value: '2592000' },
];

const FEE_PRESETS = [
  { label: '0%', value: '0' },
  { label: '1%', value: '100' },
  { label: '2%', value: '200' },
  { label: '5%', value: '500' },
  { label: '10%', value: '1000' },
  { label: '20%', value: '2000' },
];

const MULTIPLIER_PRESETS = [
  { label: '1x', value: '1' },
  { label: '2x', value: '2' },
  { label: '4x', value: '4' },
  { label: '8x', value: '8' },
  { label: '10x', value: '10' },
];

function formatDuration(seconds: string): string {
  const s = parseInt(seconds);
  if (isNaN(s) || s === 0) return 'No minimum';
  if (s < 3600) return `${s} seconds`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} hours`;
  if (s < 604800) return `${(s / 86400).toFixed(1)} days`;
  return `${(s / 604800).toFixed(1)} weeks`;
}

function formatBips(bips: string): string {
  const b = parseInt(bips);
  if (isNaN(b)) return '';
  return `${(b / 100).toFixed(2)}%`;
}

export function StakingParametersForm({
  minimumStakeAmount,
  setMinimumStakeAmount,
  maximumStakeAmount,
  setMaximumStakeAmount,
  minimumStakeDuration,
  setMinimumStakeDuration,
  minimumDelegationFeeBips,
  setMinimumDelegationFeeBips,
  maximumStakeMultiplier,
  setMaximumStakeMultiplier,
  weightToValueFactor,
  setWeightToValueFactor,
  disabled = false,
  tokenLabel = 'tokens',
}: StakingParametersFormProps) {
  return (
    <div className="space-y-4">
      {/* Stake amounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={`Minimum Stake Amount (${tokenLabel})`}
          value={minimumStakeAmount}
          onChange={setMinimumStakeAmount}
          type="number"
          step="0.01"
          min="0"
          disabled={disabled}
          helperText="Minimum amount a validator must stake"
        />
        <Input
          label={`Maximum Stake Amount (${tokenLabel})`}
          value={maximumStakeAmount}
          onChange={setMaximumStakeAmount}
          type="number"
          step="0.01"
          min="0"
          disabled={disabled}
          helperText="Maximum amount a single validator can stake"
        />
      </div>

      {/* Duration with presets */}
      <div>
        <Input
          label="Minimum Stake Duration"
          value={minimumStakeDuration}
          onChange={setMinimumStakeDuration}
          type="number"
          min="0"
          disabled={disabled}
          helperText={`${formatDuration(minimumStakeDuration)} — validators must stake for at least this long`}
        />
        <QuickSelect
          options={DURATION_PRESETS}
          value={minimumStakeDuration}
          onChange={setMinimumStakeDuration}
          disabled={disabled}
        />
      </div>

      {/* Delegation fee with presets */}
      <div>
        <Input
          label="Minimum Delegation Fee"
          value={minimumDelegationFeeBips}
          onChange={setMinimumDelegationFeeBips}
          type="number"
          min="0"
          max="10000"
          disabled={disabled}
          helperText={`${formatBips(minimumDelegationFeeBips)} — fee charged to delegators (in basis points, 100 = 1%)`}
        />
        <QuickSelect
          options={FEE_PRESETS}
          value={minimumDelegationFeeBips}
          onChange={setMinimumDelegationFeeBips}
          disabled={disabled}
        />
      </div>

      {/* Multiplier with presets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Input
            label="Maximum Stake Multiplier"
            value={maximumStakeMultiplier}
            onChange={setMaximumStakeMultiplier}
            type="number"
            min="1"
            max="255"
            disabled={disabled}
            helperText={`e.g. a validator staking ${minimumStakeAmount || '1'} ${tokenLabel} can receive up to ${(parseFloat(minimumStakeAmount || '1') * parseFloat(maximumStakeMultiplier || '1')).toLocaleString()} ${tokenLabel} in delegations`}
          />
          <QuickSelect
            options={MULTIPLIER_PRESETS}
            value={maximumStakeMultiplier}
            onChange={setMaximumStakeMultiplier}
            disabled={disabled}
          />
        </div>
        <Input
          label="Weight to Value Factor"
          value={weightToValueFactor}
          onChange={setWeightToValueFactor}
          type="number"
          step="0.000000000000000001"
          min="0"
          disabled={disabled}
          helperText={`1 weight = ${parseFloat(weightToValueFactor || '1').toLocaleString()} ${tokenLabel} — e.g. staking 100 ${tokenLabel} = ${(100 / parseFloat(weightToValueFactor || '1')).toLocaleString()} weight`}
        />
      </div>
    </div>
  );
}
