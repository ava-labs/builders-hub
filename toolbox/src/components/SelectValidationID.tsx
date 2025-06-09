import { Input, type Suggestion } from "./Input";
import { useMemo, useState, useEffect } from "react";
import { cb58ToHex, hexToCB58 } from "../toolbox/Conversion/FormatConverter";
import { AvaCloudSDK } from "@avalabs/avacloud-sdk";
import { useWalletStore } from "../stores/walletStore";
import { networkIDs } from "@avalabs/avalanchejs";
import { L1ValidatorDetailsFull, GlobalParamNetwork } from "@avalabs/avacloud-sdk/models/components";
import { formatAvaxBalance } from "../coreViem/utils/format";

export type ValidationSelection = {
  validationId: string;
  nodeId: string;
}

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
  subnetId = "",
  format = "cb58" 
}: { 
  value: string, 
  onChange: (selection: ValidationSelection) => void, 
  error?: string | null, 
  subnetId?: string,
  format?: "cb58" | "hex"
}) {
  const { avalancheNetworkID } = useWalletStore();
  const [validators, setValidators] = useState<L1ValidatorDetailsFull[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [validationIdToNodeId, setValidationIdToNodeId] = useState<Record<string, string>>({});

  // Network names for display
  const networkNames: Record<number, GlobalParamNetwork> = {
    [networkIDs.MainnetID]: "mainnet",
    [networkIDs.FujiID]: "fuji",
  };

  // Fetch validators from the API
  useEffect(() => {
    const fetchValidators = async () => {
      if (!subnetId) return;
      
      setIsLoading(true);
      try {
        const network = networkNames[Number(avalancheNetworkID)];
        if (!network) return;

        const result = await new AvaCloudSDK().data.primaryNetwork.listL1Validators({
          network: network,
          subnetId: subnetId,
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
        validatorsList.forEach(v => {
          if (v.validationId && v.nodeId && v.weight > 0) {
            mapping[v.validationId] = v.nodeId;
            // Also add hex format for easy lookup
            try {
              const hexId = "0x" + cb58ToHex(v.validationId);
              mapping[hexId] = v.nodeId;
            } catch (error) {
              // Skip if conversion fails
            }
          }
        });
        setValidationIdToNodeId(mapping);
      } catch (error) {
        console.error("Error fetching validators:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchValidators();
  }, [subnetId, avalancheNetworkID]);

  // Get the currently selected node ID
  const selectedNodeId = useMemo(() => {
    return validationIdToNodeId[value] || 
           (value && value.startsWith("0x") && validationIdToNodeId[value]) || 
           (value && !value.startsWith("0x") && validationIdToNodeId["0x" + cb58ToHex(value)]) || 
           "";
  }, [value, validationIdToNodeId]);

  const validationIDSuggestions: Suggestion[] = useMemo(() => {
    const result: Suggestion[] = [];

    // Filter out validators with weight 0 and only add suggestions from validators with node IDs
    const validatorsWithWeight = validators.filter(validator => validator.weight > 0);
    
    for (const validator of validatorsWithWeight) {
      if (validator.validationId) {
        // Use full node ID
        const nodeId = validator.nodeId;
        const weightDisplay = validator.weight.toLocaleString();
        const balanceDisplay = formatAvaxBalance(validator.remainingBalance);
        const isSelected = nodeId === selectedNodeId;
        
        // Add just one version based on the format prop
        if (format === "hex") {
          try {
            const hexId = "0x" + cb58ToHex(validator.validationId);
            result.push({
              title: `${nodeId}${isSelected ? " ✓" : ""}`,
              value: hexId,
              description: `Weight: ${weightDisplay} | Balance: ${balanceDisplay}${isSelected ? " (Selected)" : ""}`
            });
          } catch (error) {
            // Skip if conversion fails
          }
        } else {
          // Default to CB58 format
          result.push({
            title: `${nodeId}${isSelected ? " ✓" : ""}`,
            value: validator.validationId,
            description: `Weight: ${weightDisplay} | ${balanceDisplay}${isSelected ? " (Selected)" : ""}`
          });
        }
      }
    }

    return result;
  }, [validators, format, selectedNodeId]);

  // Handle value change with format conversion
  const handleValueChange = (newValue: string) => {
    let formattedValue = newValue;

    // Convert to the desired format if needed
    try {
      if (format === "hex" && !newValue.startsWith("0x")) {
        // Convert CB58 to hex
        formattedValue = "0x" + cb58ToHex(newValue);
      } else if (format === "cb58" && newValue.startsWith("0x")) {
        // Convert hex to CB58
        formattedValue = hexToCB58(newValue.slice(2));
      }
    } catch (error) {
      // If conversion fails, use the original value
      formattedValue = newValue;
    }

    // Look up the nodeId for this validation ID
    let nodeId = validationIdToNodeId[formattedValue] || "";
    
    // If not found directly, try the alternate format
    if (!nodeId) {
      const alternateFormat = format === "hex" 
        ? hexToCB58(formattedValue.slice(2)) 
        : "0x" + cb58ToHex(formattedValue);
      nodeId = validationIdToNodeId[alternateFormat] || "";
    }

    // Return both the validation ID and node ID
    onChange({
      validationId: formattedValue,
      nodeId
    });
  };

  return <Input
    label="Validation ID"
    value={value}
    onChange={handleValueChange}
    suggestions={validationIDSuggestions}
    error={error}
    placeholder={isLoading ? "Loading validators..." : `Enter validation ID in ${format.toUpperCase()} format`}
  />
}
