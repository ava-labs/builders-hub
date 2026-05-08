/**
 * P-Chain Transaction Decoder
 * Uses avalanchejs to decode and format P-Chain transactions
 */

import type { PChainBlockTransaction, PChainOutput, PChainInput, PChainOwner } from './rpc';
import { nAvaxToAvax, formatTimestamp } from './rpc';

// Helper to format AVAX values that are already converted (not nAVAX)
function formatAvaxValue(avax: number, decimals: number = 4): string {
  if (avax === 0) return '0';
  if (avax < 0.0001) return '<0.0001';
  return avax.toLocaleString(undefined, { 
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals 
  });
}

// ============================================================================
// Transaction Type Definitions
// ============================================================================

export type PChainTxType =
  | 'BaseTx'
  | 'AddValidatorTx'
  | 'AddDelegatorTx'
  | 'AddSubnetValidatorTx'
  | 'AddPermissionlessValidatorTx'
  | 'AddPermissionlessDelegatorTx'
  | 'CreateSubnetTx'
  | 'CreateChainTx'
  | 'ExportTx'
  | 'ImportTx'
  | 'RemoveSubnetValidatorTx'
  | 'TransferSubnetOwnershipTx'
  | 'TransformSubnetTx'
  | 'ConvertSubnetToL1Tx'
  | 'RegisterL1ValidatorTx'
  | 'SetL1ValidatorWeightTx'
  | 'IncreaseL1ValidatorBalanceTx'
  | 'DisableL1ValidatorTx'
  | 'RewardValidatorTx'
  | 'AdvanceTimeTx'
  | 'Unknown';

export interface DecodedTransaction {
  type: PChainTxType;
  typeId?: number;
  txId?: string;
  networkId?: number;
  blockchainId?: string;
  memo?: string;
  
  // Common fields
  inputs: DecodedInput[];
  outputs: DecodedOutput[];
  fee: number; // in AVAX
  
  // Validator-specific
  validator?: {
    nodeId: string;
    startTime: string;
    endTime: string;
    duration: string;
    weight: number; // in AVAX
    weightRaw: string;
  };
  delegationFee?: number; // percentage
  rewardsOwner?: DecodedOwner;
  
  // Staking
  stake?: DecodedOutput[];
  totalStake?: number; // in AVAX
  
  // Subnet-specific
  subnetId?: string;
  chainName?: string;
  vmId?: string;
  genesisData?: string;
  
  // Export/Import
  sourceChain?: string;
  sourceChainName?: string;
  destinationChain?: string;
  destinationChainName?: string;
  exportedOutputs?: DecodedOutput[];
  importedInputs?: DecodedInput[];
  
  // L1 Validator fields (Etna upgrade)
  validationId?: string;
  balance?: number; // in AVAX
  balanceRaw?: string;
  l1ValidatorWeight?: number;
  
  // Credentials
  signatures?: string[];
  signatureCount?: number;
  
  // Raw data
  raw?: PChainBlockTransaction;
}

export interface DecodedInput {
  txId: string;
  outputIndex: number;
  assetId: string;
  amount: number; // in AVAX
  amountRaw: string;
  signatureIndices: number[];
}

export interface DecodedOutput {
  assetId: string;
  amount: number; // in AVAX
  amountRaw: string;
  addresses: string[];
  locktime: number;
  threshold: number;
}

export interface DecodedOwner {
  addresses: string[];
  locktime: number;
  threshold: number;
}

// ============================================================================
// Transaction Type Detection
// ============================================================================

/**
 * Determine the transaction type from JSON-encoded transaction
 * This uses heuristics based on the fields present in the transaction
 */
export function detectTxType(tx: PChainBlockTransaction): PChainTxType {
  const unsignedTx = tx.unsignedTx;
  
  if (!unsignedTx) {
    return 'Unknown';
  }

  // Check for L1 Validator transactions (Etna upgrade) - check first as they have specific fields
  // DisableL1ValidatorTx: has validationID and disableAuthorization
  if (unsignedTx.validationID && unsignedTx.disableAuthorization) {
    return 'DisableL1ValidatorTx';
  }
  
  // RegisterL1ValidatorTx: has balance, proofOfPossession, and message
  if (unsignedTx.balance !== undefined && unsignedTx.proofOfPossession && unsignedTx.message) {
    return 'RegisterL1ValidatorTx';
  }
  
  // SetL1ValidatorWeightTx: has validationID and weight but no disableAuthorization
  if (unsignedTx.validationID && unsignedTx.weight !== undefined && !unsignedTx.disableAuthorization) {
    return 'SetL1ValidatorWeightTx';
  }
  
  // IncreaseL1ValidatorBalanceTx: has validationID and balance but no proofOfPossession
  if (unsignedTx.validationID && unsignedTx.balance !== undefined && !unsignedTx.proofOfPossession) {
    return 'IncreaseL1ValidatorBalanceTx';
  }

  // Check for validator-related fields
  if (unsignedTx.validator) {
    // Has stake array = AddValidator or AddDelegator
    if (unsignedTx.stake && unsignedTx.stake.length > 0) {
      // AddValidator has shares field
      if (unsignedTx.shares !== undefined) {
        return 'AddValidatorTx';
      }
      // AddDelegator doesn't have shares
      return 'AddDelegatorTx';
    }
    
    // Subnet validator (has subnetID but no stake)
    if (unsignedTx.subnetID) {
      return 'AddSubnetValidatorTx';
    }
  }

  // Check for subnet creation (has controlKeys in the output type)
  if (unsignedTx.outputs && unsignedTx.outputs.length === 0 && 
      !unsignedTx.validator && !unsignedTx.destinationChain && !unsignedTx.sourceChain) {
    // Could be CreateSubnetTx - check if there's a specific type indicator
    // For now, check for subnet-related fields
  }

  // Check for chain creation
  if (unsignedTx.chainName || unsignedTx.vmID || unsignedTx.genesisData) {
    return 'CreateChainTx';
  }

  // Check for export transaction
  if (unsignedTx.destinationChain && unsignedTx.exportedOutputs) {
    return 'ExportTx';
  }

  // Check for import transaction
  if (unsignedTx.sourceChain && unsignedTx.importedInputs) {
    return 'ImportTx';
  }

  // Check for subnet ID (could be various subnet-related txs)
  if (unsignedTx.subnetID) {
    // Various subnet operations
    return 'BaseTx'; // Default for now
  }

  // Default to BaseTx for simple transfers
  if (unsignedTx.inputs && unsignedTx.outputs) {
    return 'BaseTx';
  }

  return 'Unknown';
}

// ============================================================================
// Transaction Decoding
// ============================================================================

/**
 * Decode a JSON-encoded P-Chain transaction into a human-readable format
 */
export function decodePChainTx(tx: PChainBlockTransaction): DecodedTransaction {
  const unsignedTx = tx.unsignedTx || {};
  const type = detectTxType(tx);
  
  // Decode inputs
  const inputs: DecodedInput[] = (unsignedTx.inputs || []).map(decodeInput);
  
  // Decode outputs
  const outputs: DecodedOutput[] = (unsignedTx.outputs || []).map(decodeOutput);
  
  // Calculate fee (sum of all inputs - sum of all outputs)
  // Regular inputs
  const totalInputs = inputs.reduce((sum, i) => sum + i.amount, 0);
  const totalOutputs = outputs.reduce((sum, o) => sum + o.amount, 0);
  
  // Decode stake if present
  const stake = unsignedTx.stake?.map(decodeOutput) || [];
  const totalStake = stake.reduce((sum, s) => sum + s.amount, 0);
  
  // Imported inputs (for ImportTx - inputs come from another chain)
  const importedInputs = unsignedTx.importedInputs?.map(decodeInput) || [];
  const totalImportedInputs = importedInputs.reduce((sum, i) => sum + i.amount, 0);
  
  // Exported outputs (for ExportTx - outputs go to another chain)
  const exportedOutputs = unsignedTx.exportedOutputs?.map(decodeOutput) || [];
  const totalExportedOutputs = exportedOutputs.reduce((sum, o) => sum + o.amount, 0);
  
  // L1 validator balance (for RegisterL1ValidatorTx, IncreaseL1ValidatorBalanceTx)
  // This is the amount being sent to the validator, not a fee
  const l1ValidatorBalance = unsignedTx.balance !== undefined 
    ? nAvaxToAvax(BigInt(unsignedTx.balance)) 
    : 0;
  
  // Calculate fee:
  // Fee = (inputs + importedInputs) - (outputs + exportedOutputs + stake + l1ValidatorBalance)
  const allInputs = totalInputs + totalImportedInputs;
  const allOutputs = totalOutputs + totalExportedOutputs + totalStake + l1ValidatorBalance;
  const fee = Math.max(0, allInputs - allOutputs);
  
  // Build decoded transaction
  const decoded: DecodedTransaction = {
    type,
    txId: tx.id,
    networkId: unsignedTx.networkID,
    blockchainId: unsignedTx.blockchainID,
    memo: unsignedTx.memo,
    inputs,
    outputs,
    fee,
    raw: tx,
  };
  
  // Add validator info if present
  if (unsignedTx.validator) {
    const v = unsignedTx.validator;
    const startTime = formatTimestamp(v.start);
    const endTime = formatTimestamp(v.end);
    const durationMs = (v.end - v.start) * 1000;
    const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));
    
    decoded.validator = {
      nodeId: v.nodeID,
      startTime,
      endTime,
      duration: `${durationDays} days`,
      weight: nAvaxToAvax(v.weight),
      weightRaw: v.weight.toString(),
    };
  }
  
  // Add delegation fee if present
  if (unsignedTx.shares !== undefined) {
    // Shares are in basis points (10000 = 100%)
    decoded.delegationFee = unsignedTx.shares / 10000 * 100;
  }
  
  // Add rewards owner if present
  if (unsignedTx.rewardsOwner) {
    decoded.rewardsOwner = {
      addresses: unsignedTx.rewardsOwner.addresses,
      locktime: unsignedTx.rewardsOwner.locktime,
      threshold: unsignedTx.rewardsOwner.threshold,
    };
  }
  
  // Add stake info
  if (stake.length > 0) {
    decoded.stake = stake;
    decoded.totalStake = totalStake;
  }
  
  // Add subnet info
  if (unsignedTx.subnetID) {
    decoded.subnetId = unsignedTx.subnetID;
  }
  
  // Add chain creation info
  if (unsignedTx.chainName) {
    decoded.chainName = unsignedTx.chainName;
  }
  if (unsignedTx.vmID) {
    decoded.vmId = unsignedTx.vmID;
  }
  if (unsignedTx.genesisData) {
    decoded.genesisData = unsignedTx.genesisData;
  }
  
  // Add L1 validator info (Etna upgrade)
  if (unsignedTx.validationID) {
    decoded.validationId = unsignedTx.validationID;
  }
  if (unsignedTx.balance !== undefined) {
    decoded.balance = nAvaxToAvax(BigInt(unsignedTx.balance));
    decoded.balanceRaw = String(unsignedTx.balance);
  }
  if (unsignedTx.weight !== undefined) {
    decoded.l1ValidatorWeight = unsignedTx.weight;
  }
  
  // Add export info
  if (unsignedTx.destinationChain) {
    decoded.destinationChain = unsignedTx.destinationChain;
    decoded.destinationChainName = getChainName(unsignedTx.destinationChain);
    decoded.exportedOutputs = unsignedTx.exportedOutputs?.map(decodeOutput);
  }
  
  // Add import info
  if (unsignedTx.sourceChain) {
    decoded.sourceChain = unsignedTx.sourceChain;
    decoded.sourceChainName = getChainName(unsignedTx.sourceChain);
    decoded.importedInputs = unsignedTx.importedInputs?.map(decodeInput);
  }
  
  // Add signature info
  if (tx.credentials && tx.credentials.length > 0) {
    const allSignatures = tx.credentials.flatMap(c => c.signatures || []);
    decoded.signatures = allSignatures;
    decoded.signatureCount = allSignatures.length;
  }
  
  return decoded;
}

/**
 * Decode a P-Chain input
 */
function decodeInput(input: PChainInput): DecodedInput {
  return {
    txId: input.txID,
    outputIndex: input.outputIndex,
    assetId: input.assetID,
    amount: nAvaxToAvax(input.input.amount),
    amountRaw: input.input.amount.toString(),
    signatureIndices: input.input.signatureIndices,
  };
}

/**
 * Decode a P-Chain output
 */
function decodeOutput(output: PChainOutput): DecodedOutput {
  return {
    assetId: output.assetID,
    amount: nAvaxToAvax(output.output.amount),
    amountRaw: output.output.amount.toString(),
    addresses: output.output.addresses,
    locktime: output.output.locktime,
    threshold: output.output.threshold,
  };
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Get a human-readable description of the transaction type
 */
export function getTxTypeDescription(type: PChainTxType): string {
  const descriptions: Record<PChainTxType, string> = {
    'BaseTx': 'Base Transaction',
    'AddValidatorTx': 'Add Validator',
    'AddDelegatorTx': 'Add Delegator',
    'AddSubnetValidatorTx': 'Add Subnet Validator',
    'AddPermissionlessValidatorTx': 'Add Permissionless Validator',
    'AddPermissionlessDelegatorTx': 'Add Permissionless Delegator',
    'CreateSubnetTx': 'Create Subnet',
    'CreateChainTx': 'Create Chain',
    'ExportTx': 'Export',
    'ImportTx': 'Import',
    'RemoveSubnetValidatorTx': 'Remove Subnet Validator',
    'TransferSubnetOwnershipTx': 'Transfer Subnet Ownership',
    'TransformSubnetTx': 'Transform Subnet',
    'ConvertSubnetToL1Tx': 'Convert Subnet to L1',
    'RegisterL1ValidatorTx': 'Register L1 Validator',
    'SetL1ValidatorWeightTx': 'Set L1 Validator Weight',
    'IncreaseL1ValidatorBalanceTx': 'Increase L1 Validator Balance',
    'DisableL1ValidatorTx': 'Disable L1 Validator',
    'RewardValidatorTx': 'Reward Validator',
    'AdvanceTimeTx': 'Advance Time',
    'Unknown': 'Unknown Transaction',
  };
  return descriptions[type] || 'Unknown Transaction';
}

/**
 * Get a color for the transaction type badge
 */
export function getTxTypeColor(type: PChainTxType): string {
  const colors: Record<PChainTxType, string> = {
    'BaseTx': '#6B7280', // gray
    'AddValidatorTx': '#10B981', // green
    'AddDelegatorTx': '#34D399', // light green
    'AddSubnetValidatorTx': '#059669', // dark green
    'AddPermissionlessValidatorTx': '#10B981', // green
    'AddPermissionlessDelegatorTx': '#34D399', // light green
    'CreateSubnetTx': '#8B5CF6', // purple
    'CreateChainTx': '#A855F7', // light purple
    'ExportTx': '#F59E0B', // amber
    'ImportTx': '#FBBF24', // yellow
    'RemoveSubnetValidatorTx': '#EF4444', // red
    'TransferSubnetOwnershipTx': '#EC4899', // pink
    'TransformSubnetTx': '#8B5CF6', // purple
    'ConvertSubnetToL1Tx': '#6366F1', // indigo
    'RegisterL1ValidatorTx': '#3B82F6', // blue
    'SetL1ValidatorWeightTx': '#60A5FA', // light blue
    'IncreaseL1ValidatorBalanceTx': '#22D3EE', // cyan
    'DisableL1ValidatorTx': '#EF4444', // red
    'RewardValidatorTx': '#F59E0B', // amber
    'AdvanceTimeTx': '#6B7280', // gray
    'Unknown': '#9CA3AF', // light gray
  };
  return colors[type] || '#9CA3AF';
}

/**
 * Get an icon name for the transaction type
 */
export function getTxTypeIcon(type: PChainTxType): string {
  const icons: Record<PChainTxType, string> = {
    'BaseTx': 'ArrowRightLeft',
    'AddValidatorTx': 'ShieldCheck',
    'AddDelegatorTx': 'Users',
    'AddSubnetValidatorTx': 'ShieldPlus',
    'AddPermissionlessValidatorTx': 'ShieldCheck',
    'AddPermissionlessDelegatorTx': 'Users',
    'CreateSubnetTx': 'Network',
    'CreateChainTx': 'Link2',
    'ExportTx': 'ArrowUpRight',
    'ImportTx': 'ArrowDownLeft',
    'RemoveSubnetValidatorTx': 'ShieldMinus',
    'TransferSubnetOwnershipTx': 'UserCog',
    'TransformSubnetTx': 'RefreshCw',
    'ConvertSubnetToL1Tx': 'Layers',
    'RegisterL1ValidatorTx': 'UserPlus',
    'SetL1ValidatorWeightTx': 'Scale',
    'IncreaseL1ValidatorBalanceTx': 'TrendingUp',
    'DisableL1ValidatorTx': 'UserMinus',
    'RewardValidatorTx': 'Gift',
    'AdvanceTimeTx': 'Clock',
    'Unknown': 'HelpCircle',
  };
  return icons[type] || 'HelpCircle';
}

/**
 * Format a transaction for display in a list
 */
export function formatTxSummary(decoded: DecodedTransaction): string {
  switch (decoded.type) {
    case 'AddValidatorTx':
      return `Stake ${formatAvaxValue(decoded.totalStake || 0)} AVAX to ${decoded.validator?.nodeId}`;
    case 'AddDelegatorTx':
      return `Delegate ${formatAvaxValue(decoded.totalStake || 0)} AVAX to ${decoded.validator?.nodeId}`;
    case 'CreateSubnetTx':
      return 'Create new subnet';
    case 'CreateChainTx':
      return `Create chain "${decoded.chainName || 'Unknown'}"`;
    case 'ExportTx':
      const exportAmount = decoded.exportedOutputs?.reduce((s, o) => s + o.amount, 0) || 0;
      const destChain = decoded.destinationChainName || 'Unknown';
      return `Export ${formatAvaxValue(exportAmount)} AVAX to ${destChain}`;
    case 'ImportTx':
      const importAmount = decoded.outputs.reduce((s, o) => s + o.amount, 0);
      const srcChain = decoded.sourceChainName || 'Unknown';
      return `Import ${formatAvaxValue(importAmount)} AVAX from ${srcChain}`;
    case 'BaseTx':
      const transferAmount = decoded.outputs.reduce((s, o) => s + o.amount, 0);
      return `Transfer ${formatAvaxValue(transferAmount)} AVAX`;
    // L1 Validator types (Etna upgrade)
    case 'RegisterL1ValidatorTx':
      return `Register L1 validator with ${formatAvaxValue(decoded.balance || 0)} AVAX balance`;
    case 'DisableL1ValidatorTx':
      return `Disable L1 validator ${decoded.validationId ? `(${decoded.validationId.slice(0, 8)}...)` : ''}`;
    case 'SetL1ValidatorWeightTx':
      return `Set L1 validator weight to ${decoded.l1ValidatorWeight?.toLocaleString() || 0}`;
    case 'IncreaseL1ValidatorBalanceTx':
      return `Increase L1 validator balance by ${formatAvaxValue(decoded.balance || 0)} AVAX`;
    default:
      return getTxTypeDescription(decoded.type);
  }
}

/**
 * Get the chain name from blockchain ID
 * Supports both Mainnet and Fuji testnet chain IDs
 */
export function getChainName(blockchainId: string): string {
  const knownChains: Record<string, string> = {
    // P-Chain (same ID for both networks - the zero address)
    '11111111111111111111111111111111LpoYY': 'P-Chain',
    
    // Mainnet
    '2oYMBNV4eNHyqk2fjjV5nVQLDbtmNJzq5s3qs3Lo6ftnC6FByM': 'X-Chain',
    '2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5': 'C-Chain',
    
    // Fuji Testnet
    '2JVSBoinj9C2J33VntvzYtVJNZdN2NKiwwKjcumHUWEb5DbBrm': 'X-Chain (Fuji)',
    'yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp': 'C-Chain (Fuji)',
  };
  return knownChains[blockchainId] || `Unknown Chain (${blockchainId.slice(0, 8)}...)`;
}

/**
 * Get chain info with ID and name
 */
export function getChainInfo(blockchainId: string): { id: string; name: string } {
  return {
    id: blockchainId,
    name: getChainName(blockchainId),
  };
}

