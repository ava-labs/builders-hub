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
  '0xa41f772f':
    'This node is already registered as a validator. You must complete the full removal process (Initiate Removal → P-Chain Weight Update → Complete Removal) before re-registering, or use a different Node ID.',
  NodeAlreadyRegistered:
    'This node is already registered as a validator. You must complete the full removal process (Initiate Removal → P-Chain Weight Update → Complete Removal) before re-registering, or use a different Node ID.',

  // Validator registration / removal
  '0x5c33785a':
    'Invalid contract nonce — the validator state has already advanced past this operation. This usually means a prior transaction for this validator was already confirmed. Refresh the page and check the validator status.',
  InvalidNonce:
    'Invalid contract nonce — the validator state has already advanced past this operation. This usually means a prior transaction for this validator was already confirmed. Refresh the page and check the validator status.',
  InvalidValidationID: 'Invalid validation ID. The validator may not have been registered on the P-Chain yet.',
  InvalidWarpMessage: 'Invalid warp message. Ensure the P-Chain transaction was successful and wait for confirmation.',
  ValidatorAlreadyRegistered: 'This validator has already been registered.',
  InvalidDelegationID: 'Invalid delegation ID. The delegation may not have been initiated yet.',
  DelegatorAlreadyRegistered: 'This delegation has already been completed.',
  ValidatorNotRemovable: 'This validator cannot be removed in its current state.',

  // ERC20 — check BEFORE access control since the raw error message from viem
  // can contain both the ERC20 error data AND decoded OwnableUnauthorizedAccount text
  '0xfb8f41b2': 'Insufficient ERC20 token allowance. Click "Approve Tokens" first, then retry.',
  ERC20InsufficientAllowance: 'Insufficient ERC20 token allowance. Click "Approve Tokens" first, then retry.',
  '0xe450d38c': 'Insufficient ERC20 token balance.',
  ERC20InsufficientBalance: 'Insufficient ERC20 token balance.',

  // Access control
  '0x118cdaa7': 'You are not the owner of this contract. Only the owner can perform this operation.',
  OwnableUnauthorizedAccount: 'You are not the owner of this contract. Only the owner can perform this operation.',
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

  // Check for known selectors and error names FIRST — these provide specific,
  // actionable messages. Must run before broad substring heuristics below.
  for (const [key, message] of Object.entries(KNOWN_ERRORS)) {
    if (raw.includes(key)) {
      return message;
    }
  }

  // Wallet-level nonce errors (stale nonce after rapid tx or tab switching).
  // Checked AFTER KNOWN_ERRORS so that contract-level InvalidNonce gets its
  // own specific message instead of this misleading wallet-nonce message.
  if (raw.includes('nonce')) {
    return 'Nonce conflict — your wallet sent a stale nonce. This usually means a previous transaction was already confirmed. Refresh the page and check your transaction history.';
  }

  // Generic revert with some context
  if (raw.includes('reverted')) {
    return `Transaction reverted: ${raw}`;
  }

  return raw;
}
