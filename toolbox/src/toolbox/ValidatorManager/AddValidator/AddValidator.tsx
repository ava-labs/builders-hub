import React, { useState, useMemo } from 'react';
import { Container } from '../../../components/Container';
import { Button } from '../../../components/Button';
import { AlertCircle } from 'lucide-react';
import SelectSubnetId from '../../../components/SelectSubnetId';
import { ValidatorManagerDetails } from '../../../components/ValidatorManagerDetails';
import { useValidatorManagerDetails } from '../../hooks/useValidatorManagerDetails';
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Success } from '../../../components/Success';

import InitiateValidatorRegistration from './InitiateValidatorRegistration';
import SubmitPChainTxRegisterL1Validator from './SubmitPChainTxRegisterL1Validator';
import CompleteValidatorRegistration from './CompleteValidatorRegistration';
import { ConvertToL1Validator } from '../../../components/ValidatorListInput';
import { useCreateChainStore } from '../../../stores/createChainStore';
import { useWalletStore } from '../../../stores/walletStore';

const AddValidatorExpert: React.FC = () => {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // State for passing data between components
  const [pChainTxId, setPChainTxId] = useState<string>('');
  const [validatorBalance, setValidatorBalance] = useState<string>('');
  const [blsProofOfPossession, setBlsProofOfPossession] = useState<string>('');
  const [evmTxHash, setEvmTxHash] = useState<string>('');

  // Form state
  const { walletEVMAddress } = useWalletStore();
  const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
  const [subnetIdL1, setSubnetIdL1] = useState<string>(createChainStoreSubnetId || "");
  const [validators, setValidators] = useState<ConvertToL1Validator[]>([]);
  const [resetInitiateForm, setResetInitiateForm] = useState<boolean>(false);
  const [resetKey, setResetKey] = useState<number>(0);

  const {
    validatorManagerAddress,
    error: validatorManagerError,
    isLoading: isLoadingVMCDetails,
    blockchainId,
    contractOwner,
    isOwnerContract,
    contractTotalWeight,
    l1WeightError,
    signingSubnetId,
    isLoadingOwnership,
    isLoadingL1Weight,
    ownershipError,
    ownerType,
    isDetectingOwnerType
  } = useValidatorManagerDetails({ subnetId: subnetIdL1 });

  // Simple ownership check - direct computation
  const isContractOwner = useMemo(() => {
    return contractOwner && walletEVMAddress 
      ? walletEVMAddress.toLowerCase() === contractOwner.toLowerCase()
      : null;
  }, [contractOwner, walletEVMAddress]);

  // Determine UI state based on ownership:
  // Case 1: Contract is owned by another contract → show MultisigOption
  // Case 2: Contract is owned by current wallet → show regular button
  // Case 3: Contract is owned by different EOA → show error
  const ownershipState = useMemo(() => {
    if (isOwnerContract) {
      return 'contract'; // Case 1: Show MultisigOption
    }
    if (isContractOwner === true) {
      return 'currentWallet'; // Case 2: Show regular button
    }
    if (isContractOwner === false) {
      return 'differentEOA'; // Case 3: Show error
    }
    return 'loading'; // Still determining ownership
  }, [isOwnerContract, isContractOwner]);

  const handleReset = () => {
    setGlobalError(null);
    setGlobalSuccess(null);
    setPChainTxId('');
    setValidatorBalance('');
    setBlsProofOfPossession('');
    setEvmTxHash('');
    setSubnetIdL1('');
    setValidators([]);
    setResetInitiateForm(true);
    setResetKey(prev => prev + 1); // Force re-render of all child components
    // Reset the flag after a brief delay to allow the child component to process it
    setTimeout(() => setResetInitiateForm(false), 100);
  };

  return (
    <Container title="Add New Validator" description="Add a validator to your L1 by following these steps in order.">
      <div className="space-y-6">
        {globalError && (
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
              <span>Error: {globalError}</span>
            </div>
          </div>
        )}

        <Steps>
          <Step>
            <h2 className="text-lg font-semibold">Select L1 Subnet</h2>
            <p className="text-sm text-gray-500 mb-4">
              Choose the L1 subnet where you want to add the validator.
            </p>
            <div className="space-y-2">
              <SelectSubnetId
                value={subnetIdL1}
                onChange={setSubnetIdL1}
                error={validatorManagerError}
                hidePrimaryNetwork={true}
              />
              <ValidatorManagerDetails
                validatorManagerAddress={validatorManagerAddress}
                blockchainId={blockchainId}
                subnetId={subnetIdL1}
                isLoading={isLoadingVMCDetails}
                signingSubnetId={signingSubnetId}
                contractTotalWeight={contractTotalWeight}
                l1WeightError={l1WeightError}
                isLoadingL1Weight={isLoadingL1Weight}
                contractOwner={contractOwner}
                ownershipError={ownershipError}
                isLoadingOwnership={isLoadingOwnership}
                isOwnerContract={isOwnerContract}
                ownerType={ownerType}
                isDetectingOwnerType={isDetectingOwnerType}
              />
            </div>
          </Step>

          <Step>
            <h2 className="text-lg font-semibold">Initiate Validator Registration</h2>
            <p className="text-sm text-gray-500 mb-4">
              Start the validator registration process by providing the validator details.
            </p>
            
            <InitiateValidatorRegistration
              subnetId={subnetIdL1}
              validatorManagerAddress={validatorManagerAddress}
              resetForm={resetInitiateForm}
              initialValidators={validators}
              ownershipState={ownershipState}
              contractTotalWeight={contractTotalWeight}
              l1WeightError={l1WeightError}
              onSuccess={(data) => {
                setValidatorBalance(data.validatorBalance);
                setBlsProofOfPossession(data.blsProofOfPossession);
                setEvmTxHash(data.txHash);
                setGlobalError(null);
                setResetInitiateForm(false);
              }}
              onError={(message) => setGlobalError(message)}
            />           
          </Step>

          <Step>
            <h2 className="text-lg font-semibold">Sign Warp Message & Submit to P-Chain</h2>
            <p className="text-sm text-gray-500 mb-4">
              Sign the warp message and submit the validator registration to the P-Chain.
            </p>
            <SubmitPChainTxRegisterL1Validator
              key={`submit-pchain-${resetKey}`}
              subnetIdL1={subnetIdL1}
              validatorBalance={validatorBalance}
              blsProofOfPossession={blsProofOfPossession}
              evmTxHash={evmTxHash}
              signingSubnetId={signingSubnetId}
              onSuccess={(pChainTxId) => {
                setPChainTxId(pChainTxId);
                setGlobalError(null);
              }}
              onError={(message) => setGlobalError(message)}
            />
          </Step>

          <Step>
            <h2 className="text-lg font-semibold">Sign P-Chain Warp Message & Complete Registration</h2>
            <p className="text-sm text-gray-500 mb-4">
              Complete the validator registration by signing the P-Chain warp message.
            </p>
            <CompleteValidatorRegistration
              key={`complete-registration-${resetKey}`}
              subnetIdL1={subnetIdL1}
              pChainTxId={pChainTxId}
              ownershipState={ownershipState}
              validatorManagerAddress={validatorManagerAddress}
              signingSubnetId={signingSubnetId}
              contractOwner={contractOwner}
              isLoadingOwnership={isLoadingOwnership}
              ownerType={ownerType}
              onSuccess={(message) => {
                setGlobalSuccess(message);
                setGlobalError(null);
              }}
              onError={(message) => setGlobalError(message)}
            />
          </Step>
        </Steps>

        {globalSuccess && (
          <Success 
            label="Process Complete"
            value={globalSuccess}
          />
        )}

        {(pChainTxId || globalError || globalSuccess) && (
          <Button onClick={handleReset} className="mt-6">
            Reset All Steps
          </Button>
        )}
      </div>
    </Container>
  );
};

export default AddValidatorExpert;
