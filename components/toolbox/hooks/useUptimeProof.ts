import { useState } from 'react';
import { bytesToHex, hexToBytes } from 'viem';
import { packValidationUptimeMessage } from '@/components/toolbox/coreViem/utils/convertWarp';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import { cb58ToHex, hexToCB58 } from '@/components/toolbox/console/utilities/format-converter/FormatConverter';

interface UptimeProofResult {
  uptimeSeconds: bigint;
  signedWarpMessage: string;
  unsignedWarpMessage: string;
}

export function useUptimeProof() {
  const { avalancheNetworkID } = useWalletStore();
  const { aggregateSignature } = useAvalancheSDKChainkit();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch current validators and extract uptime for a specific validation ID
   */
  async function getValidatorUptime(validationID: string, rpcUrl: string): Promise<bigint> {
    try {
      const validatorsRpcUrl = rpcUrl.replace('/rpc', '/validators');
      const response = await fetch(validatorsRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'validators.getCurrentValidators',
          params: { nodeIDs: [] },
          id: 1,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch validators');
      }

      const data = await response.json();
      if (!data?.result?.validators) {
        throw new Error('No validators found in response');
      }

      let hexValidationID = validationID;
      let cb58ValidationID = '';

      if (validationID.startsWith('0x')) {
        hexValidationID = validationID.toLowerCase();
        try {
          cb58ValidationID = hexToCB58(validationID.slice(2));
        } catch {
          // If conversion fails, just use hex
        }
      } else {
        cb58ValidationID = validationID;
        try {
          hexValidationID = '0x' + cb58ToHex(validationID).toLowerCase();
        } catch {
          // If conversion fails, just use CB58
        }
      }

      const validator = data.result.validators.find((v: any) => {
        const responseId = v.validationID || '';
        if (responseId === validationID) return true;
        if (responseId.toLowerCase() === hexValidationID) return true;
        if (responseId === cb58ValidationID) return true;

        if (!responseId.startsWith('0x') && hexValidationID) {
          try {
            const responseHex = '0x' + cb58ToHex(responseId).toLowerCase();
            if (responseHex === hexValidationID) return true;
          } catch {
            // Conversion failed, skip
          }
        }

        return false;
      });

      if (!validator) {
        throw new Error(`Validator with validationID ${validationID} not found`);
      }

      return BigInt(validator.uptimeSeconds || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to get validator uptime: ${message}`);
    }
  }

  /**
   * Create an unsigned uptime proof warp message
   */
  function createUptimeProofWarpMessage(
    validationID: Uint8Array,
    uptimeSeconds: bigint,
    signingSubnetId: string,
  ): Uint8Array {
    try {
      return packValidationUptimeMessage({ validationID, uptime: uptimeSeconds }, avalancheNetworkID, signingSubnetId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to create uptime proof warp message: ${message}`);
    }
  }

  /**
   * Complete uptime proof flow: fetch uptime, create message, and sign
   * Tries progressively lower uptime percentages if aggregation fails
   */
  async function createAndSignUptimeProof(
    validationID: string,
    rpcUrl: string,
    signingSubnetId: string,
  ): Promise<UptimeProofResult> {
    setIsLoading(true);
    setError(null);

    try {
      const reportedUptime = await getValidatorUptime(validationID, rpcUrl);
      const validationIDBytes = hexToBytes(validationID as `0x${string}`);

      // Try with progressively lower uptime percentages
      const reductionPercentages = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
      let allServerErrors = true;

      for (const percentage of reductionPercentages) {
        const adjustedUptime = (reportedUptime * BigInt(percentage)) / 100n;

        try {
          const unsignedMessage = createUptimeProofWarpMessage(validationIDBytes, adjustedUptime, signingSubnetId);
          const unsignedWarpMessage = bytesToHex(unsignedMessage);

          // Use timeout to fail faster
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Signature aggregation timeout')), 10000);
          });

          const signaturePromise = aggregateSignature({
            message: unsignedWarpMessage,
            signingSubnetId,
          });

          const result = await Promise.race([signaturePromise, timeoutPromise]);

          return {
            uptimeSeconds: adjustedUptime,
            signedWarpMessage: result.signedMessage,
            unsignedWarpMessage,
          };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const isServerError =
            errorMessage.includes('500') ||
            errorMessage.includes('InternalServerError') ||
            errorMessage.includes('Failed to process') ||
            errorMessage.includes('timeout');

          if (!isServerError) {
            allServerErrors = false;
          }
          continue;
        }
      }

      if (allServerErrors) {
        throw new Error(
          'Signature aggregation service is currently unavailable. ' +
            'Please try again later or proceed without uptime proof.',
        );
      } else {
        throw new Error('Failed to sign uptime proof. No uptime value was accepted by validators.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return {
    getValidatorUptime,
    createUptimeProofWarpMessage,
    createAndSignUptimeProof,
    isLoading,
    error,
  };
}
