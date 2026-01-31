"use client";

import React from 'react';
import { Step } from "fumadocs-ui/components/steps";
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';

type ValidatorManagerDetailsReturn = ReturnType<typeof useValidatorManagerDetails>;

export interface L1SubnetStepProps {
    subnetId: string;
    onSubnetIdChange: (value: string) => void;
    description?: string;
    validatorManagerDetails: Omit<ValidatorManagerDetailsReturn, 'error'>;
    validatorManagerError: string | null;
    isExpanded: boolean;
    onToggleExpanded: () => void;
}

export default function L1SubnetStep({
    subnetId,
    onSubnetIdChange,
    description = "Choose the L1 subnet for this operation.",
    validatorManagerDetails,
    validatorManagerError,
    isExpanded,
    onToggleExpanded,
}: L1SubnetStepProps) {
    return (
        <Step>
            <h2 className="text-lg font-semibold">Select L1 Subnet</h2>
            <p className="text-sm text-gray-500 mb-4">{description}</p>
            <div className="space-y-2">
                <SelectSubnetId
                    value={subnetId}
                    onChange={onSubnetIdChange}
                    error={validatorManagerError}
                    hidePrimaryNetwork={true}
                />
                <ValidatorManagerDetails
                    validatorManagerAddress={validatorManagerDetails.validatorManagerAddress}
                    blockchainId={validatorManagerDetails.blockchainId}
                    subnetId={subnetId}
                    isLoading={validatorManagerDetails.isLoading}
                    signingSubnetId={validatorManagerDetails.signingSubnetId}
                    contractTotalWeight={validatorManagerDetails.contractTotalWeight}
                    l1WeightError={validatorManagerDetails.l1WeightError}
                    isLoadingL1Weight={validatorManagerDetails.isLoadingL1Weight}
                    contractOwner={validatorManagerDetails.contractOwner}
                    ownershipError={validatorManagerDetails.ownershipError}
                    isLoadingOwnership={validatorManagerDetails.isLoadingOwnership}
                    isOwnerContract={validatorManagerDetails.isOwnerContract}
                    ownerType={validatorManagerDetails.ownerType}
                    isDetectingOwnerType={validatorManagerDetails.isDetectingOwnerType}
                    isExpanded={isExpanded}
                    onToggleExpanded={onToggleExpanded}
                />
            </div>
        </Step>
    );
}
