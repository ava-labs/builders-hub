/**
 * Maps known Solidity revert selectors and error names to human-readable messages.
 * Used by contract hooks to provide actionable error messages instead of raw hex.
 */

const KNOWN_ERRORS: Record<string, string> = {
  // ── Churn / weight ──────────────────────────────────────────────────
  '0xdfae8801':
    'Exceeds the maximum churn rate. The network limits how much weight can change at once (typically 20% of total weight). Try a smaller amount or wait.',
  MaxChurnRateExceeded:
    'Exceeds the maximum churn rate. The network limits how much weight can change at once (typically 20% of total weight). Try a smaller amount or wait.',
  '0x3e1a7851': 'Invalid total weight. The resulting total weight would be zero or exceed limits.',
  '0xe8e82e76': 'Invalid total weight. The resulting total weight would be zero or exceed limits.',
  InvalidTotalWeight: 'Invalid total weight. The resulting total weight would be zero or exceed limits.',
  '0xdaa3fc0a': 'Maximum weight exceeded. The validator or delegation weight exceeds the allowed limit for this L1.',
  MaxWeightExceeded:
    'Maximum weight exceeded. The validator or delegation weight exceeds the allowed limit for this L1.',
  '0x3e5e7fe0': 'Invalid churn period length. The churn period configuration is outside the allowed range.',
  InvalidChurnPeriodLength: 'Invalid churn period length. The churn period configuration is outside the allowed range.',
  '0x94b377fe': 'Invalid maximum churn percentage. The churn percentage must be between 1 and 100.',
  InvalidMaximumChurnPercentage: 'Invalid maximum churn percentage. The churn percentage must be between 1 and 100.',

  // ── Validator status / lifecycle ────────────────────────────────────
  '0x5c3324cc': 'Invalid validator status. The validator may already have a pending operation or may not be active.',
  '0x5765a929': 'Invalid validator status. The validator may already have a pending operation or may not be active.',
  InvalidValidatorStatus:
    'Invalid validator status. The validator may already have a pending operation or may not be active.',
  '0x2d071353':
    'Unexpected registration status. The validator registration is not in the expected state for this operation.',
  UnexpectedRegistrationStatus:
    'Unexpected registration status. The validator registration is not in the expected state for this operation.',
  '0xfee31445':
    'Unexpected validation ID. The on-chain validation ID does not match the expected value. The validator may have been re-registered.',
  UnexpectedValidationID:
    'Unexpected validation ID. The on-chain validation ID does not match the expected value. The validator may have been re-registered.',

  // ── BLS key validation ──────────────────────────────────────────────
  '0x4c8eb65e': 'Invalid BLS public key length. Expected 48 bytes (96 hex chars). Check the validator credentials.',
  InvalidBLSKeyLength:
    'Invalid BLS public key length. Expected 48 bytes (96 hex chars). Check the validator credentials.',
  '0x06cf438f': 'Invalid BLS public key. Ensure the BLS key and proof of possession are correct.',
  InvalidBLSPublicKey: 'Invalid BLS public key. Ensure the BLS key and proof of possession are correct.',

  // ── Validator registration / removal ────────────────────────────────
  '0xa41f772f': 'This node is already registered as a validator.',
  NodeAlreadyRegistered: 'This node is already registered as a validator.',
  '0x11327166': 'Invalid validation ID. The validator may not have been registered on the P-Chain yet.',
  InvalidValidationID: 'Invalid validation ID. The validator may not have been registered on the P-Chain yet.',
  '0x6b2f19e9': 'Invalid warp message. Ensure the P-Chain transaction was successful and wait for confirmation.',
  InvalidWarpMessage: 'Invalid warp message. Ensure the P-Chain transaction was successful and wait for confirmation.',
  '0x756b3ca9': 'This validator has already been registered.',
  ValidatorAlreadyRegistered: 'This validator has already been registered.',
  '0x1f0a1ec4': 'This validator cannot be removed in its current state.',
  ValidatorNotRemovable: 'This validator cannot be removed in its current state.',
  '0x7c11424a': 'Invalid node ID format or length. Node IDs should be 20 bytes. Check the node ID you entered.',
  InvalidNodeID: 'Invalid node ID format or length. Node IDs should be 20 bytes. Check the node ID you entered.',
  '0x5c33785a':
    'Invalid nonce. The contract nonce does not match. This can happen if another transaction was processed first. Try again.',
  InvalidNonce:
    'Invalid nonce. The contract nonce does not match. This can happen if another transaction was processed first. Try again.',

  // ── P-Chain owner validation ────────────────────────────────────────
  '0xc08a0f1d':
    'Invalid P-Chain owner threshold. The threshold must be greater than zero and not exceed the number of owner addresses.',
  InvalidPChainOwnerThreshold:
    'Invalid P-Chain owner threshold. The threshold must be greater than zero and not exceed the number of owner addresses.',
  '0x7882c487': 'Invalid P-Chain owner addresses. At least one P-Chain owner address is required.',
  InvalidPChainOwnerAddresses: 'Invalid P-Chain owner addresses. At least one P-Chain owner address is required.',

  // ── Staking validation ──────────────────────────────────────────────
  '0x88b4590c': 'Stake amount is outside the allowed range. Check the minimum and maximum stake amounts for this L1.',
  InvalidStakeAmount:
    'Stake amount is outside the allowed range. Check the minimum and maximum stake amounts for this L1.',
  '0xbe25cd86': 'Invalid delegation fee. The fee must meet the minimum delegation fee requirement for this L1.',
  InvalidDelegationFee: 'Invalid delegation fee. The fee must meet the minimum delegation fee requirement for this L1.',
  '0x000540da': 'Invalid minimum stake duration. The duration is below the required minimum for this L1.',
  InvalidMinStakeDuration: 'Invalid minimum stake duration. The duration is below the required minimum for this L1.',
  '0xfb6ce63f':
    'Minimum stake duration has not passed yet. You must wait until the minimum staking period ends before removing this validator.',
  MinStakeDurationNotPassed:
    'Minimum stake duration has not passed yet. You must wait until the minimum staking period ends before removing this validator.',
  '0xb86d9ac8': 'Invalid stake multiplier. The multiplier value is outside the allowed range.',
  InvalidStakeMultiplier: 'Invalid stake multiplier. The multiplier value is outside the allowed range.',
  '0xa7330071': 'Weight-to-value factor cannot be zero. This is a contract configuration error.',
  ZeroWeightToValueFactor: 'Weight-to-value factor cannot be zero. This is a contract configuration error.',
  '0x30efa98b':
    'This validator is not a Proof-of-Stake validator. This operation is only available for PoS validators, not PoA.',
  ValidatorNotPoS:
    'This validator is not a Proof-of-Stake validator. This operation is only available for PoS validators, not PoA.',

  // ── Delegation ──────────────────────────────────────────────────────
  '0xe6e253e4': 'Invalid delegation ID. The delegation may not have been initiated yet.',
  InvalidDelegationID: 'Invalid delegation ID. The delegation may not have been initiated yet.',
  '0x26061110': 'This delegation has already been completed.',
  DelegatorAlreadyRegistered: 'This delegation has already been completed.',
  '0xec355034':
    'Delegator is not in the expected state for this operation. Check if the delegation was already completed or removed.',
  InvalidDelegatorStatus:
    'Delegator is not in the expected state for this operation. Check if the delegation was already completed or removed.',

  // ── Rewards ─────────────────────────────────────────────────────────
  '0xb7fed07e':
    'Validator uptime is too low to receive rewards. Use "Force Remove Validator" to remove without claiming rewards.',
  ValidatorIneligibleForRewards:
    'Validator uptime is too low to receive rewards. Use "Force Remove Validator" to remove without claiming rewards.',
  '0x206d9f22':
    'Delegator is ineligible for rewards because the associated validator did not meet the uptime requirement.',
  DelegatorIneligibleForRewards:
    'Delegator is ineligible for rewards because the associated validator did not meet the uptime requirement.',
  '0xcaa903f9': 'Invalid reward recipient address. The reward recipient cannot be the zero address.',
  InvalidRewardRecipient: 'Invalid reward recipient address. The reward recipient cannot be the zero address.',

  // ── ERC20 — check BEFORE access control since the raw error message
  // from viem can contain both the ERC20 error data AND decoded
  // OwnableUnauthorizedAccount text ────────────────────────────────────
  '0xfb8f41b2': 'Insufficient ERC20 token allowance. Click "Approve Tokens" first, then retry.',
  ERC20InsufficientAllowance: 'Insufficient ERC20 token allowance. Click "Approve Tokens" first, then retry.',
  '0xe450d38c': 'Insufficient ERC20 token balance.',
  ERC20InsufficientBalance: 'Insufficient ERC20 token balance.',
  '0x5274afe7':
    'ERC20 token transfer failed. The token contract rejected the operation. Check the token contract for transfer restrictions.',
  SafeERC20FailedOperation:
    'ERC20 token transfer failed. The token contract rejected the operation. Check the token contract for transfer restrictions.',

  // ── Access control ──────────────────────────────────────────────────
  '0x118cdaa7': 'You are not the owner of this contract. Only the owner can perform this operation.',
  OwnableUnauthorizedAccount: 'You are not the owner of this contract. Only the owner can perform this operation.',
  '0x1e4fbdf7': 'Invalid owner address. The provided owner address is not valid (e.g., zero address).',
  OwnableInvalidOwner: 'Invalid owner address. The provided owner address is not valid (e.g., zero address).',
  '0xdc599aea': 'You are not the validator owner. Only the validator owner can perform this operation.',
  UnauthorizedOwner: 'You are not the validator owner. Only the validator owner can perform this operation.',

  // ── Infrastructure / warp ───────────────────────────────────────────
  '0x026f3ae8': 'Invalid warp origin sender address. The message came from an unexpected contract address.',
  InvalidWarpOriginSenderAddress:
    'Invalid warp origin sender address. The message came from an unexpected contract address.',
  '0x6ba589a5': 'Invalid warp source chain ID. The message came from an unexpected chain.',
  InvalidWarpSourceChainID: 'Invalid warp source chain ID. The message came from an unexpected chain.',
  '0xbaaea89d': 'Invalid conversion ID. The L1 conversion ID does not match the expected value.',
  InvalidConversionID: 'Invalid conversion ID. The L1 conversion ID does not match the expected value.',
  '0x2f6bd1db': 'Invalid uptime blockchain ID. The uptime proof references an unexpected blockchain.',
  InvalidUptimeBlockchainID: 'Invalid uptime blockchain ID. The uptime proof references an unexpected blockchain.',
  '0xbe204834':
    'Invalid Validator Manager address. The address does not match the expected Validator Manager contract.',
  InvalidValidatorManagerAddress:
    'Invalid Validator Manager address. The address does not match the expected Validator Manager contract.',
  '0xe5614fce': 'Invalid Validator Manager blockchain ID. The blockchain ID does not match the expected L1.',
  InvalidValidatorManagerBlockchainID:
    'Invalid Validator Manager blockchain ID. The blockchain ID does not match the expected L1.',

  // ── Initialization ──────────────────────────────────────────────────
  '0xf92ee8a9': 'Contract has already been initialized. This is a one-time operation.',
  InvalidInitialization: 'Contract has already been initialized. This is a one-time operation.',
  '0x7fab81e5': 'Invalid initialization status. The contract is not in the correct state for this initialization step.',
  InvalidInitializationStatus:
    'Invalid initialization status. The contract is not in the correct state for this initialization step.',
  '0xd7e6bcf8': 'Contract is not currently initializing. This function can only be called during initialization.',
  NotInitializing: 'Contract is not currently initializing. This function can only be called during initialization.',

  // ── General / safety ────────────────────────────────────────────────
  '0xd92e233d': 'A zero address was provided where a valid address is required.',
  ZeroAddress: 'A zero address was provided where a valid address is required.',
  '0xcd786059': 'Insufficient native token balance in the contract to complete this operation.',
  AddressInsufficientBalance: 'Insufficient native token balance in the contract to complete this operation.',
  '0x9996b315':
    'The target address contains no contract code. Ensure you are interacting with the correct contract address.',
  AddressEmptyCode:
    'The target address contains no contract code. Ensure you are interacting with the correct contract address.',
  '0x1425ea42': 'An internal contract call failed. This may indicate a contract configuration issue.',
  FailedInnerCall: 'An internal contract call failed. This may indicate a contract configuration issue.',
  '0x3ee5aeb5': 'Reentrancy detected. The contract blocked a reentrant call for safety. Try the operation again.',
  ReentrancyGuardReentrantCall:
    'Reentrancy detected. The contract blocked a reentrant call for safety. Try the operation again.',
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
