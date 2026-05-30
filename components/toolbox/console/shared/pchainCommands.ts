/**
 * Mapping of P-Chain transactions to platform-cli commands.
 * Source: https://github.com/ava-labs/platform-cli/blob/main/docs/pchain-operations.md
 *
 * Every console flow that submits a P-Chain transaction must render the
 * corresponding CLI command via `CliAlternative` or `PChainManualSubmit`.
 * CI enforces this via scripts/check-cli-coverage.sh.
 */

// ---------------------------------------------------------------------------
// P-Chain Transaction → platform-cli Command Mapping
// ---------------------------------------------------------------------------

export const PCHAIN_COMMANDS = {
  /** IssueRegisterL1ValidatorTx — register a new validator on an L1 */
  registerL1Validator: (opts: {
    signedWarpMessage: string;
    balance: string;
    network: 'fuji' | 'mainnet';
    keyName?: string;
  }) =>
    `platform l1 register-validator --message ${opts.signedWarpMessage} --balance ${opts.balance} --network ${opts.network}${opts.keyName ? ` --key-name ${opts.keyName}` : ''}`,

  /** IssueSetL1ValidatorWeightTx — update validator weight (used for removal, delegation, weight change) */
  setL1ValidatorWeight: (opts: { signedWarpMessage: string; network: 'fuji' | 'mainnet'; keyName?: string }) =>
    `platform l1 set-weight --message ${opts.signedWarpMessage} --network ${opts.network}${opts.keyName ? ` --key-name ${opts.keyName}` : ''}`,

  /** IssueIncreaseL1ValidatorBalanceTx — top up validator balance */
  addBalance: (opts: { validationId: string; balance: string; network: 'fuji' | 'mainnet'; keyName?: string }) =>
    `platform l1 add-balance --validation-id ${opts.validationId} --balance ${opts.balance} --network ${opts.network}${opts.keyName ? ` --key-name ${opts.keyName}` : ''}`,

  /** IssueDisableL1ValidatorTx — disable a validator */
  disableValidator: (opts: { validationId: string; network: 'fuji' | 'mainnet'; keyName?: string }) =>
    `platform l1 disable-validator --validation-id ${opts.validationId} --network ${opts.network}${opts.keyName ? ` --key-name ${opts.keyName}` : ''}`,

  /** IssueCreateSubnetTx */
  createSubnet: (opts: { network: 'fuji' | 'mainnet'; keyName?: string }) =>
    `platform subnet create --network ${opts.network}${opts.keyName ? ` --key-name ${opts.keyName}` : ''}`,

  /** IssueCreateChainTx */
  createChain: (opts: {
    subnetId: string;
    genesisFile: string;
    name: string;
    network: 'fuji' | 'mainnet';
    keyName?: string;
  }) =>
    `platform chain create --subnet-id ${opts.subnetId} --genesis ${opts.genesisFile} --name "${opts.name}" --network ${opts.network}${opts.keyName ? ` --key-name ${opts.keyName}` : ''}`,

  /** IssueConvertSubnetToL1Tx */
  convertToL1: (opts: {
    subnetId: string;
    chainId: string;
    contractAddress: string;
    network: 'fuji' | 'mainnet';
    keyName?: string;
  }) =>
    `platform subnet convert-l1 --subnet-id ${opts.subnetId} --chain-id ${opts.chainId} --contract-address ${opts.contractAddress} --network ${opts.network}${opts.keyName ? ` --key-name ${opts.keyName}` : ''}`,

  /** IssueAddPermissionlessValidatorTx (Primary Network) */
  addValidator: (opts: {
    nodeId: string;
    stake: string;
    duration: string;
    delegationFee: string;
    network: 'fuji' | 'mainnet';
    keyName?: string;
  }) =>
    `platform validator add --node-id ${opts.nodeId} --stake ${opts.stake} --duration ${opts.duration} --delegation-fee ${opts.delegationFee} --network ${opts.network}${opts.keyName ? ` --key-name ${opts.keyName}` : ''}`,

  /** IssueAddPermissionlessDelegatorTx (Primary Network) */
  addDelegator: (opts: {
    nodeId: string;
    stake: string;
    duration: string;
    network: 'fuji' | 'mainnet';
    keyName?: string;
  }) =>
    `platform validator delegate --node-id ${opts.nodeId} --stake ${opts.stake} --duration ${opts.duration} --network ${opts.network}${opts.keyName ? ` --key-name ${opts.keyName}` : ''}`,
} as const;

// ---------------------------------------------------------------------------
// Cast command helpers for EVM transactions with warp access lists
// ---------------------------------------------------------------------------

/** Warp precompile address used in access lists */
const WARP_PRECOMPILE = '0x0200000000000000000000000000000000000005';

/**
 * Build a cast send command for an EVM transaction that includes a warp
 * message via the access list (the standard pattern for ICM contract calls
 * that consume signed warp messages).
 */
export function buildCastCommand(opts: {
  contractAddress: string;
  functionSig: string;
  args: string[];
  rpcUrl: string;
  signedWarpMessage?: string;
}): string {
  const args = opts.args.join(' ');
  const accessList = opts.signedWarpMessage
    ? ` --access-list '[{"address":"${WARP_PRECOMPILE}","storageKeys":["${opts.signedWarpMessage}"]}]'`
    : '';

  return `cast send ${opts.contractAddress} "${opts.functionSig}" ${args}${accessList} --rpc-url ${opts.rpcUrl} --private-key <your-private-key>`;
}

// ---------------------------------------------------------------------------
// Convenience: pre-built cast commands for common console operations
// ---------------------------------------------------------------------------

export const CAST_COMMANDS = {
  completeValidatorRegistration: (opts: { managerAddress: string; rpcUrl: string; signedWarpMessage: string }) =>
    buildCastCommand({
      contractAddress: opts.managerAddress,
      functionSig: 'completeValidatorRegistration(uint32)',
      args: ['0'],
      rpcUrl: opts.rpcUrl,
      signedWarpMessage: opts.signedWarpMessage,
    }),

  completeValidatorRemoval: (opts: { managerAddress: string; rpcUrl: string; signedWarpMessage: string }) =>
    buildCastCommand({
      contractAddress: opts.managerAddress,
      functionSig: 'completeValidatorRemoval(uint32)',
      args: ['0'],
      rpcUrl: opts.rpcUrl,
      signedWarpMessage: opts.signedWarpMessage,
    }),

  initiateValidatorRemoval: (opts: {
    managerAddress: string;
    validationId: string;
    includeUptimeProof: boolean;
    rpcUrl: string;
    signedWarpMessage?: string;
  }) =>
    buildCastCommand({
      contractAddress: opts.managerAddress,
      functionSig: 'initiateValidatorRemoval(bytes32,bool,uint32)',
      args: [opts.validationId, String(opts.includeUptimeProof), '0'],
      rpcUrl: opts.rpcUrl,
      signedWarpMessage: opts.signedWarpMessage,
    }),

  completeDelegatorRemoval: (opts: {
    managerAddress: string;
    delegationId: string;
    rpcUrl: string;
    signedWarpMessage: string;
  }) =>
    buildCastCommand({
      contractAddress: opts.managerAddress,
      functionSig: 'completeDelegatorRemoval(bytes32,uint32)',
      args: [opts.delegationId, '0'],
      rpcUrl: opts.rpcUrl,
      signedWarpMessage: opts.signedWarpMessage,
    }),

  submitUptimeProof: (opts: {
    managerAddress: string;
    validationId: string;
    rpcUrl: string;
    signedWarpMessage: string;
  }) =>
    buildCastCommand({
      contractAddress: opts.managerAddress,
      functionSig: 'submitUptimeProof(bytes32,uint32)',
      args: [opts.validationId, '0'],
      rpcUrl: opts.rpcUrl,
      signedWarpMessage: opts.signedWarpMessage,
    }),

  completeValidatorWeightUpdate: (opts: { managerAddress: string; rpcUrl: string; signedWarpMessage: string }) =>
    buildCastCommand({
      contractAddress: opts.managerAddress,
      functionSig: 'completeValidatorWeightUpdate(uint32)',
      args: ['0'],
      rpcUrl: opts.rpcUrl,
      signedWarpMessage: opts.signedWarpMessage,
    }),

  completeDelegatorRegistration: (opts: {
    managerAddress: string;
    delegationId: string;
    rpcUrl: string;
    signedWarpMessage: string;
  }) =>
    buildCastCommand({
      contractAddress: opts.managerAddress,
      functionSig: 'completeDelegatorRegistration(bytes32,uint32)',
      args: [opts.delegationId, '0'],
      rpcUrl: opts.rpcUrl,
      signedWarpMessage: opts.signedWarpMessage,
    }),
} as const;
