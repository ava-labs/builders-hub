import React, { useState } from 'react';
import { Container } from '../../../components/Container';
import { Button } from '../../../components/Button';
import { AlertCircle } from 'lucide-react';
import SelectSubnetId from '../../../components/SelectSubnetId';
import { ValidatorManagerDetails } from '../../../components/ValidatorManagerDetails';
import { useValidatorManagerDetails } from '../../hooks/useValidatorManagerDetails';
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Success } from '../../../components/Success';

import InitiateChangeWeight from './InitiateChangeWeight';
import SubmitPChainTxChangeWeight from './SubmitPChainTxChangeWeight';
import CompleteChangeWeight from './CompleteChangeWeight';
import { useCreateChainStore } from '../../../stores/createChainStore';

const ChangeWeightStateless: React.FC = () => {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // State for passing data between components
  const [evmTxHash, setEvmTxHash] = useState<string>('');
  const [pChainTxId, setPChainTxId] = useState<string>('');

  // Form state
  const createChainStoreSubnetId = useCreateChainStore()(state => state.subnetId);
  const [subnetIdL1, setSubnetIdL1] = useState<string>(createChainStoreSubnetId || "");
  const [nodeId, setNodeId] = useState<string>('');
  const [validationId, setValidationId] = useState<string>('');
  const [newWeight, setNewWeight] = useState<string>('');
  const [resetInitiateForm, setResetInitiateForm] = useState<boolean>(false);
  const [resetKey, setResetKey] = useState<number>(0);

  const {
    validatorManagerAddress,
    error: validatorManagerError,
    isLoading: isLoadingVMCDetails,
    blockchainId
  } = useValidatorManagerDetails({ subnetId: subnetIdL1 });

  const handleReset = () => {
    setGlobalError(null);
    setGlobalSuccess(null);
    setEvmTxHash('');
    setPChainTxId('');
    setSubnetIdL1('');
    setNodeId('');
    setValidationId('');
    setNewWeight('');
    setResetInitiateForm(true);
    setResetKey(prev => prev + 1); // Force re-render of all child components
    // Reset the flag after a brief delay to allow the child component to process it
    setTimeout(() => setResetInitiateForm(false), 100);
  };

  return (
    <Container title="Change Validator Weight" description="Modify a validator's weight by following these steps in order.">
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
              Choose the L1 subnet where you want to change the validator weight.
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
              />
            </div>
          </Step>

          <Step>
            <h2 className="text-lg font-semibold">Initiate Weight Change</h2>
            <p className="text-sm text-gray-500 mb-4">
              Start the weight change process by specifying the validator and new weight.
            </p>
            <InitiateChangeWeight
              subnetId={subnetIdL1}
              validatorManagerAddress={validatorManagerAddress}
              resetForm={resetInitiateForm}
              initialNodeId={nodeId}
              initialValidationId={validationId}
              initialWeight={newWeight}
              onSuccess={(data) => {
                setNodeId(data.nodeId);
                setValidationId(data.validationId);
                setNewWeight(data.weight);
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
              Sign the warp message and submit the transaction to the P-Chain.
            </p>
            <SubmitPChainTxChangeWeight
              key={`submit-pchain-${resetKey}`}
              subnetIdL1={subnetIdL1}
              initialEvmTxHash={evmTxHash}
              onSuccess={(pChainTxId) => {
                setPChainTxId(pChainTxId);
                setGlobalError(null);
              }}
              onError={(message) => setGlobalError(message)}
            />
          </Step>

          <Step>
            <h2 className="text-lg font-semibold">Sign P-Chain Warp Message & Complete Weight Change</h2>
            <p className="text-sm text-gray-500 mb-4">
              Complete the weight change by signing the P-Chain warp message.
            </p>
            <CompleteChangeWeight
              key={`complete-change-${resetKey}`}
              subnetIdL1={subnetIdL1}
              initialPChainTxId={pChainTxId}
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

        {(evmTxHash || pChainTxId || globalError || globalSuccess) && (
          <Button onClick={handleReset} className="mt-6">
            Reset All Steps
          </Button>
        )}
      </div>
    </Container>
  );
};

export default ChangeWeightStateless;
