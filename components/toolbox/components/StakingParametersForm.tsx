import { Input } from "@/components/toolbox/components/Input";

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
    tokenLabel = "tokens"
}: StakingParametersFormProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
                label={`Minimum Stake Amount (in ${tokenLabel})`}
                value={minimumStakeAmount}
                onChange={setMinimumStakeAmount}
                type="number"
                step="0.000000000000000001"
                min="0"
                disabled={disabled}
            />

            <Input
                label={`Maximum Stake Amount (in ${tokenLabel})`}
                value={maximumStakeAmount}
                onChange={setMaximumStakeAmount}
                type="number"
                step="0.000000000000000001"
                min="0"
                disabled={disabled}
            />

            <Input
                label="Minimum Stake Duration (seconds)"
                value={minimumStakeDuration}
                onChange={setMinimumStakeDuration}
                type="number"
                min="0"
                disabled={disabled}
                placeholder="86400 (1 day)"
            />

            <Input
                label="Minimum Delegation Fee (bips, 100 = 1%)"
                value={minimumDelegationFeeBips}
                onChange={setMinimumDelegationFeeBips}
                type="number"
                min="0"
                max="10000"
                disabled={disabled}
            />

            <Input
                label="Maximum Stake Multiplier"
                value={maximumStakeMultiplier}
                onChange={setMaximumStakeMultiplier}
                type="number"
                min="1"
                max="255"
                disabled={disabled}
            />

            <Input
                label="Weight to Value Factor"
                value={weightToValueFactor}
                onChange={setWeightToValueFactor}
                type="number"
                step="0.000000000000000001"
                min="0"
                disabled={disabled}
            />
        </div>
    );
}
