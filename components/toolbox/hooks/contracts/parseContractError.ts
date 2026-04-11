/**
 * Maps known Solidity revert selectors and error names to human-readable messages.
 * Used by contract hooks to provide actionable error messages instead of raw hex.
 */

const KNOWN_ERRORS: Record<string, string> = {
  // ValidatorManager
  '0xdfae8801':
    'Exceeds the maximum churn rate. The network limits how much weight can change at once (typically 20% of total weight). Try a smaller amount or wait.',
  MaxChurnRateExceeded:
    'Exceeds the maximum churn rate. The network limits how much weight can change at once (typically 20% of total weight). Try a smaller amount or wait.',
  '0x5765a929': 'Invalid validator status. The validator may already have a pending operation or may not be active.',
  InvalidValidatorStatus:
    'Invalid validator status. The validator may already have a pending operation or may not be active.',
  '0xe8e82e76': 'Invalid total weight. The resulting total weight would be zero or exceed limits.',
  InvalidTotalWeight: 'Invalid total weight. The resulting total weight would be zero or exceed limits.',
  '0x4c8eb65e': 'Invalid BLS public key length. Expected 48 bytes (96 hex chars). Check the validator credentials.',
  InvalidBLSKeyLength:
    'Invalid BLS public key length. Expected 48 bytes (96 hex chars). Check the validator credentials.',
  '0x06cf438f': 'Invalid BLS public key. Ensure the BLS key and proof of possession are correct.',
  InvalidBLSPublicKey: 'Invalid BLS public key. Ensure the BLS key and proof of possession are correct.',
  NodeAlreadyRegistered: 'This node is already registered as a validator.',

  // Validator registration / removal
  InvalidValidationID: 'Invalid validation ID. The validator may not have been registered on the P-Chain yet.',
  InvalidWarpMessage: 'Invalid warp message. Ensure the P-Chain transaction was successful and wait for confirmation.',
  ValidatorAlreadyRegistered: 'This validator has already been registered.',
  InvalidDelegationID: 'Invalid delegation ID. The delegation may not have been initiated yet.',
  DelegatorAlreadyRegistered: 'This delegation has already been completed.',
  ValidatorNotRemovable: 'This validator cannot be removed in its current state.',

  // Access control
  '0x118cdaa7': 'You are not the owner of this contract. Only the owner can perform this operation.',
  OwnableUnauthorizedAccount: 'You are not the owner of this contract. Only the owner can perform this operation.',

  // ERC20
  ERC20InsufficientAllowance: 'Insufficient ERC20 token allowance. Please approve tokens first.',
  ERC20InsufficientBalance: 'Insufficient ERC20 token balance.',
};

/**
 * Parse a contract error into a human-readable message.
 * Checks for known revert selectors, common patterns, and falls back to the raw message.
 */
export function parseContractError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  // User rejection — pass through quickly
  if (raw.includes('User rejected') || raw.includes('user rejected')) {
    return 'Transaction was rejected by user';
  }

  // Insufficient native funds
  if (raw.includes('insufficient funds')) {
    return 'Insufficient funds for transaction';
  }

  // Nonce errors
  if (raw.includes('nonce')) {
    return 'Transaction nonce error. Please try again.';
  }

  // Check for known selectors and error names
  for (const [key, message] of Object.entries(KNOWN_ERRORS)) {
    if (raw.includes(key)) {
      return message;
    }
  }

  // Generic revert with some context
  if (raw.includes('reverted')) {
    return `Transaction reverted: ${raw}`;
  }

  return raw;
}
