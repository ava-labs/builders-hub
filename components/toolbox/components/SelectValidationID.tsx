import { Input, type Suggestion } from './Input';
import { useMemo, useState, useEffect } from 'react';
import { cb58ToHex, hexToCB58 } from '../console/utilities/format-converter/FormatConverter';
import { L1ValidatorDetailsFull } from '@avalabs/avacloud-sdk/models/components';
import { formatAvaxBalance } from '../coreViem/utils/format';
import { useAvalancheSDKChainkit } from '../stores/useAvalancheSDKChainkit';
import { useChainPublicClient } from '../hooks/useChainPublicClient';
import ValidatorManagerAbi from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import type { Abi } from 'viem';

// Validator lifecycle status labels from the ValidatorManager contract
const STATUS_LABELS: Record<number, string> = {
  0: 'Unknown',
  1: 'Pending',
  2: 'Active',
  3: 'Removing',
  4: 'Completed',
  5: 'Invalidated',
};

export type ValidationSelection = {
  validationId: string;
  nodeId: string;
};

/**
 * SelectValidationID Component
 *
 * A component for selecting a validator's ValidationID with integrated suggestions.
 *
 * @example
 * // Basic usage
 * const [selection, setSelection] = useState<ValidationSelection>({ validationId: '', nodeId: '' });
 *
 * <SelectValidationID
 *   value={selection.validationId}
 *   onChange={setSelection}
 *   subnetId="2PfknGKL9Wc3TXGpwJGY2NXRKj4CXqjzZYQ6PhpJhAphuhWzvC"
 * />
 *
 * @example
 * // With hex format and error handling
 * <SelectValidationID
 *   value={selection.validationId}
 *   onChange={setSelection}
 *   subnetId="2PfknGKL9Wc3TXGpwJGY2NXRKj4CXqjzZYQ6PhpJhAphuhWzvC"
 *   format="hex"
 *   error={validationIdError}
 * />
 *
 * @param props
 * @param props.value - Current validation ID value
 * @param props.onChange - Callback function that receives an object with validationId and nodeId
 * @param props.error - Optional error message to display
 * @param props.subnetId - Optional subnet ID to filter validators
 * @param props.format - Format for validation ID: "cb58" (default) or "hex"
 */
export default function SelectValidationID({
  value,
  onChange,
  error,
  subnetId = '',
  format = 'cb58',
  validatorManagerAddress,
}: {
  value: string;
  onChange: (selection: ValidationSelection) => void;
  error?: string | null;
  subnetId?: string;
  format?: 'cb58' | 'hex';
  /** Optional: pass to fetch on-chain lifecycle status for each validator */
  validatorManagerAddress?: string;
}) {
  //const { listL1Validators } = useAvaCloudSDK();
  const { listL1Validators } = useAvalancheSDKChainkit();
  const chainPublicClient = useChainPublicClient();
  const [validators, setValidators] = useState<L1ValidatorDetailsFull[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [validationIdToNodeId, setValidationIdToNodeId] = useState<Record<string, string>>({});
  // Map validationID (hex) -> on-chain status number
  const [validatorStatuses, setValidatorStatuses] = useState<Record<string, number>>({});

  // Fetch validators from the API
  useEffect(() => {
    const fetchValidators = async () => {
      if (!subnetId) return;

      setIsLoading(true);
      try {
        const result = await listL1Validators({
          subnetId: subnetId,
          pageSize: 100, // Add reasonable page size
          includeInactiveL1Validators: true,
        });

        // Handle pagination
        let validatorsList: L1ValidatorDetailsFull[] = [];
        for await (const page of result) {
          validatorsList.push(...page.result.validators);
        }

        setValidators(validatorsList);

        // Create a mapping of validation IDs to node IDs, filtering out validators with weight 0
        const mapping: Record<string, string> = {};
        validatorsList.forEach((v) => {
          if (v.validationId && v.nodeId && v.weight > 0) {
            mapping[v.validationId] = v.nodeId;
            // Also add hex format for easy lookup
            try {
              const hexId = '0x' + cb58ToHex(v.validationId);
              mapping[hexId] = v.nodeId;
            } catch {
              // Skip if conversion fails
            }
          }
        });
        setValidationIdToNodeId(mapping);
      } catch (error) {
        console.error('Error fetching validators:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchValidators();
  }, [subnetId, listL1Validators]);

  // Fetch on-chain lifecycle status for each validator via multicall
  useEffect(() => {
    const fetchStatuses = async () => {
      if (!chainPublicClient || !validatorManagerAddress || validators.length === 0) return;

      const vmcAddr = validatorManagerAddress as `0x${string}`;
      const validatorsWithId = validators.filter((v) => v.validationId);

      // Build multicall contracts array
      const contracts = validatorsWithId.map((v) => {
        const hexId = '0x' + cb58ToHex(v.validationId);
        return {
          address: vmcAddr,
          abi: ValidatorManagerAbi.abi,
          functionName: 'getValidator' as const,
          args: [hexId],
        };
      });

      if (contracts.length === 0) return;

      try {
        const results = await chainPublicClient.multicall({
          contracts: contracts.map((c) => ({
            address: c.address,
            abi: c.abi as Abi,
            functionName: c.functionName,
            args: c.args,
          })),
          allowFailure: true,
        });

        const statusMap: Record<string, number> = {};
        validatorsWithId.forEach((v, i) => {
          const result = results[i];
          if (result?.status === 'success' && result.result) {
            const data = result.result as { status: number };
            // Store by both cb58 and hex IDs for easy lookup
            statusMap[v.validationId] = data.status;
            try {
              const hexId = '0x' + cb58ToHex(v.validationId);
              statusMap[hexId] = data.status;
            } catch {
              // skip
            }
          }
        });
        setValidatorStatuses(statusMap);
      } catch (err) {
        console.error('Failed to fetch validator statuses:', err);
      }
    };

    fetchStatuses();
  }, [chainPublicClient, validatorManagerAddress, validators]);

  // Get the currently selected node ID
  const selectedNodeId = useMemo(() => {
    return (
      validationIdToNodeId[value] ||
      (value && value.startsWith('0x') && validationIdToNodeId[value]) ||
      (value && !value.startsWith('0x') && validationIdToNodeId['0x' + cb58ToHex(value)]) ||
      ''
    );
  }, [value, validationIdToNodeId]);

  const validationIDSuggestions: Suggestion[] = useMemo(() => {
    const result: Suggestion[] = [];

    // Filter out validators with weight 0 and only add suggestions from validators with node IDs
    const validatorsWithWeight = validators.filter((validator) => validator.weight > 0);

    for (const validator of validatorsWithWeight) {
      if (validator.validationId) {
        // Use full node ID
        const nodeId = validator.nodeId;
        const weightDisplay = validator.weight.toLocaleString();
        const balanceDisplay = formatAvaxBalance(validator.remainingBalance);
        const isSelected = nodeId === selectedNodeId;

        // Resolve on-chain lifecycle status
        const onChainStatus = validatorStatuses[validator.validationId];
        const statusLabel = onChainStatus !== undefined ? (STATUS_LABELS[onChainStatus] ?? 'Unknown') : null;
        const statusPrefix = statusLabel ? `[${statusLabel}] ` : '';

        // Add just one version based on the format prop
        if (format === 'hex') {
          try {
            const hexId = '0x' + cb58ToHex(validator.validationId);
            result.push({
              title: `${nodeId}${isSelected ? ' ✓' : ''}`,
              value: hexId,
              description: `${statusPrefix}Weight: ${weightDisplay} | Balance: ${balanceDisplay}${isSelected ? ' (Selected)' : ''}`,
            });
          } catch {
            // Skip if conversion fails
          }
        } else {
          // Default to CB58 format
          result.push({
            title: `${nodeId}${isSelected ? ' ✓' : ''}`,
            value: validator.validationId,
            description: `${statusPrefix}Weight: ${weightDisplay} | ${balanceDisplay}${isSelected ? ' (Selected)' : ''}`,
          });
        }
      }
    }

    return result;
  }, [validators, format, selectedNodeId, validatorStatuses]);

  // Handle value change with format conversion
  const handleValueChange = (newValue: string) => {
    let formattedValue = newValue;

    // Convert to the desired format if needed
    try {
      if (format === 'hex' && !newValue.startsWith('0x')) {
        // Convert CB58 to hex
        formattedValue = '0x' + cb58ToHex(newValue);
      } else if (format === 'cb58' && newValue.startsWith('0x')) {
        // Convert hex to CB58
        formattedValue = hexToCB58(newValue.slice(2));
      }
    } catch {
      // If conversion fails, use the original value
      formattedValue = newValue;
    }

    // Look up the nodeId for this validation ID
    let nodeId = validationIdToNodeId[formattedValue] || '';

    // If not found directly, try the alternate format
    if (!nodeId) {
      const alternateFormat = format === 'hex' ? hexToCB58(formattedValue.slice(2)) : '0x' + cb58ToHex(formattedValue);
      nodeId = validationIdToNodeId[alternateFormat] || '';
    }

    // Return both the validation ID and node ID
    onChange({
      validationId: formattedValue,
      nodeId,
    });
  };

  return (
    <Input
      label="Validation ID"
      value={value}
      onChange={handleValueChange}
      suggestions={validationIDSuggestions}
      error={error}
      placeholder={isLoading ? 'Loading validators...' : `Enter validation ID in ${format.toUpperCase()} format`}
    />
  );
}
