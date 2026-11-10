/* A P-Chain block as the node returns it (platform.getBlockByHeight, json
   encoding), read into the rows the city's P-Chain pane shows. The node's
   JSON names no tx type: an unsigned tx is told apart by the fields it
   carries, the way AvalancheGo tags them, and given the indexer's type name
   so a node row and the indexer row that later replaces it read the same. */

export interface NodeBlockTx {
  hash: string;
  /** the indexer's type name: RewardValidatorTx, AddPermissionlessDelegatorTx, ImportTx ... */
  type: string;
  height: number;
  /** unix seconds, the block's time */
  ts: number;
  /** the tx's place in its block */
  index: number;
  nodeId?: string;
  subnetId?: string;
}

interface RawTx {
  id?: string;
  unsignedTx?: Record<string, unknown>;
}

/** a block's JSON: a standard block carries `txs`, a proposal block its one `tx` as well */
export interface RawBlock {
  height?: number | string;
  time?: number | string;
  txs?: RawTx[];
  tx?: RawTx;
}

interface Validator {
  nodeID?: string;
  subnetID?: string;
}

const has = (u: Record<string, unknown>, k: string) => u[k] !== undefined && u[k] !== null;

/** the tx's type from the fields its unsigned JSON carries */
export function pchainTxTypeOf(u: Record<string, unknown>): string {
  const v = u.validator as Validator | undefined;
  // a reward names only the staking tx it pays
  if (has(u, "txID") && !has(u, "inputs")) return "RewardValidatorTx";
  if (has(u, "message")) return has(u, "balance") ? "RegisterL1ValidatorTx" : "SetL1ValidatorWeightTx";
  if (has(u, "validationID")) return has(u, "balance") ? "IncreaseL1ValidatorBalanceTx" : "DisableL1ValidatorTx";
  if (has(u, "validators") && has(u, "address")) return "ConvertSubnetToL1Tx";
  if (has(u, "chainName") || has(u, "vmID") || has(u, "genesisData")) return "CreateChainTx";
  if (has(u, "assetID") && has(u, "subnetID")) return "TransformSubnetTx";
  if (has(u, "owner")) return has(u, "subnetID") ? "TransferSubnetOwnershipTx" : "CreateSubnetTx";
  if (has(u, "sourceChain") || has(u, "importedInputs")) return "ImportTx";
  if (has(u, "destinationChain") || has(u, "exportedOutputs")) return "ExportTx";
  if (v) {
    if (has(u, "signer") || has(u, "validationRewardsOwner")) return "AddPermissionlessValidatorTx";
    if (has(u, "subnetID")) return "AddPermissionlessDelegatorTx";
    // a subnet validator names its subnet inside the validator
    if (v.subnetID !== undefined || has(u, "subnetAuthorization")) return "AddSubnetValidatorTx";
    return has(u, "shares") ? "AddValidatorTx" : "AddDelegatorTx";
  }
  if (has(u, "nodeID") && has(u, "subnetID")) return "RemoveSubnetValidatorTx";
  return "BaseTx";
}

/** the block's transactions as rows, in the block's order */
export function txsOfBlock(block: RawBlock): NodeBlockTx[] {
  const height = Number(block.height ?? 0);
  const ts = Number(block.time ?? 0);
  const list = [...(block.txs ?? []), ...(block.tx ? [block.tx] : [])];
  const seen = new Set<string>();
  const out: NodeBlockTx[] = [];
  for (const raw of list) {
    if (!raw?.id || seen.has(raw.id)) continue;
    seen.add(raw.id);
    const u = raw.unsignedTx ?? {};
    const v = u.validator as Validator | undefined;
    const nodeId = v?.nodeID ?? (typeof u.nodeID === "string" ? u.nodeID : undefined);
    const subnetId = (typeof u.subnetID === "string" ? u.subnetID : undefined) ?? v?.subnetID;
    out.push({ hash: raw.id, type: pchainTxTypeOf(u), height, ts, index: out.length, nodeId, subnetId });
  }
  return out;
}
