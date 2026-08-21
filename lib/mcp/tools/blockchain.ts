/**
 * Blockchain tool domain — lookup tools extracted from the chat route.
 *
 * Fixes the previously broken blockchain_lookup_address tool which was
 * calling a non-existent /api/mcp/blockchain route.
 */

import { avalancheRPC, jsonRpcPost, isUpstreamUnavailable } from '../rpc';
import { withCache, CACHE_TTL } from '../cache';
import type { ToolDomain, ToolResult, Network } from '../types';
import { P_CHAIN_ID, EVM_ID_TO_NETWORK, C_CHAIN_EVM_ID, VM_NAMES, networkSchemaProp, networkLabel } from './lib/constants';
import { rpcErrorResult } from './lib/tool-helpers';

// ---------------------------------------------------------------------------
// P-Chain transaction parser (extracted from chat/route.ts)
// ---------------------------------------------------------------------------

interface ParsedTx {
  type: string;
  description: string;
  details: Record<string, unknown>;
}

function parsePChainTransaction(rawTx: unknown): ParsedTx {
  const tx = ((rawTx as Record<string, unknown>)?.tx ||
    (rawTx as Record<string, unknown>)?.unsignedTx ||
    rawTx) as Record<string, unknown>;

  const typeIdMap: Record<number, { type: string; description: string }> = {
    0: { type: 'CreateChainTx', description: 'Creates a new blockchain' },
    12: { type: 'AddValidatorTx', description: 'Adds a validator to the Primary Network' },
    13: { type: 'AddSubnetValidatorTx', description: 'Adds a validator to a Subnet' },
    14: { type: 'AddDelegatorTx', description: 'Delegates stake to a validator' },
    15: { type: 'CreateSubnetTx', description: 'Creates a new Subnet' },
    16: { type: 'ImportTx', description: 'Imports AVAX from another chain' },
    17: { type: 'ExportTx', description: 'Exports AVAX to another chain' },
    18: { type: 'AdvanceTimeTx', description: 'Advances the chain timestamp' },
    19: { type: 'RewardValidatorTx', description: 'Rewards a validator' },
    20: { type: 'RemoveSubnetValidatorTx', description: 'Removes a validator from a Subnet' },
    21: { type: 'TransformSubnetTx', description: 'Transformed a Subnet into an Elastic Subnet, no longer accepted since Etna/ACP-77, so this only appears on historical transactions' },
    22: { type: 'AddPermissionlessValidatorTx', description: 'Adds a permissionless validator' },
    23: { type: 'AddPermissionlessDelegatorTx', description: 'Adds a permissionless delegator' },
    24: { type: 'TransferSubnetOwnershipTx', description: 'Transfers Subnet ownership' },
    25: { type: 'BaseTx', description: 'Base transaction (AVAX transfer on P-Chain)' },
    33: { type: 'ConvertSubnetToL1Tx', description: 'Converts a Subnet to a Sovereign L1' },
  };

  let typeId: number | undefined;
  const details: Record<string, unknown> = {};

  const unsignedTx = (tx.unsignedTx || {}) as Record<string, unknown>;

  if (typeof tx.typeID === 'number') typeId = tx.typeID;
  else if (typeof unsignedTx.typeID === 'number') typeId = unsignedTx.typeID as number;

  const nodeID = tx.nodeID || unsignedTx.nodeID;
  if (nodeID) {
    details.nodeID = nodeID;
    details._lookupHints = details._lookupHints || [];
    (details._lookupHints as unknown[]).push({ type: 'validator', id: nodeID });
  }

  const subnetID = tx.subnetID || unsignedTx.subnetID;
  if (subnetID) {
    details.subnetID = subnetID;
    details._lookupHints = details._lookupHints || [];
    (details._lookupHints as unknown[]).push({ type: 'subnet', id: subnetID });
  }

  const chainID = tx.chainID || unsignedTx.chainID || tx.blockchainID || unsignedTx.blockchainID;
  if (chainID) {
    details.chainID = chainID;
    details._lookupHints = details._lookupHints || [];
    (details._lookupHints as unknown[]).push({ type: 'chain', id: chainID });
  }

  if (tx.genesisData || unsignedTx.genesisData) details.hasGenesisData = true;

  const signer = tx.signer || unsignedTx.signer;
  if (signer && (signer as Record<string, unknown>).publicKey) {
    details.blsPublicKey = (signer as Record<string, unknown>).publicKey;
  }

  const delegationFee = tx.delegationFee || unsignedTx.delegationFee || tx.shares || unsignedTx.shares;
  if (delegationFee) {
    details.delegationFee = `${(parseInt(String(delegationFee)) / 10000 * 100).toFixed(2)}%`;
  }

  const startTime = tx.startTime || unsignedTx.startTime;
  if (startTime) details.startTime = new Date(parseInt(String(startTime)) * 1000).toISOString();

  const endTime = tx.endTime || unsignedTx.endTime;
  if (endTime) details.endTime = new Date(parseInt(String(endTime)) * 1000).toISOString();

  const weight = tx.weight || unsignedTx.weight;
  if (weight) details.weight = (parseInt(String(weight)) / 1e9).toFixed(4) + ' AVAX';

  const stakeOutputs = (tx.stake || unsignedTx.stake || []) as Array<{ output?: { amount?: string } }>;
  if (stakeOutputs.length > 0) {
    let totalStake = 0;
    for (const output of stakeOutputs) {
      if (output.output?.amount) totalStake += parseInt(output.output.amount);
    }
    if (totalStake > 0) details.stakeAmount = (totalStake / 1e9).toFixed(4) + ' AVAX';
  }

  const chainName = tx.chainName || unsignedTx.chainName;
  if (chainName) details.chainName = chainName;

  const vmID = tx.vmID || unsignedTx.vmID;
  if (vmID) {
    details.vmID = vmID;
    if (VM_NAMES[String(vmID)]) details.vmName = VM_NAMES[String(vmID)];
  }

  const rewardsOwner = tx.rewardsOwner || unsignedTx.rewardsOwner;
  if (rewardsOwner && (rewardsOwner as Record<string, unknown>).addresses) {
    details.rewardsAddresses = (rewardsOwner as Record<string, unknown>).addresses;
  }

  if (typeId !== undefined && typeIdMap[typeId]) {
    return { type: typeIdMap[typeId].type, description: typeIdMap[typeId].description, details };
  }

  if (chainName && vmID) return { type: 'CreateChainTx', description: 'Creates a new blockchain on a Subnet', details };
  if (subnetID && !nodeID && !chainName) return { type: 'CreateSubnetTx', description: 'Creates a new Subnet', details };
  if (nodeID) {
    if (stakeOutputs.length > 0) return { type: 'AddValidatorTx', description: 'Adds a validator to the network', details };
    if (subnetID && subnetID !== P_CHAIN_ID) {
      return { type: 'AddSubnetValidatorTx', description: 'Adds a validator to a Subnet', details };
    }
    return { type: 'ValidatorTx', description: 'Validator-related transaction', details };
  }
  if (tx.sourceChain || unsignedTx.sourceChain) {
    details.sourceChain = tx.sourceChain || unsignedTx.sourceChain;
    return { type: 'ImportTx', description: 'Imports AVAX from another chain', details };
  }
  if (tx.destinationChain || unsignedTx.destinationChain) {
    details.destinationChain = tx.destinationChain || unsignedTx.destinationChain;
    return { type: 'ExportTx', description: 'Exports AVAX to another chain', details };
  }
  return { type: 'PlatformTx', description: 'Platform transaction', details };
}

function parseXChainTransaction(rawTx: unknown): ParsedTx {
  const tx = ((rawTx as Record<string, unknown>)?.tx ||
    (rawTx as Record<string, unknown>)?.unsignedTx ||
    rawTx) as Record<string, unknown>;
  const details: Record<string, unknown> = {};

  const typeIdMap: Record<number, { type: string; description: string }> = {
    0: { type: 'BaseTx', description: 'Basic AVAX/asset transfer' },
    1: { type: 'CreateAssetTx', description: 'Creates a new asset' },
    2: { type: 'OperationTx', description: 'NFT/asset operation' },
    3: { type: 'ImportTx', description: 'Imports assets from another chain' },
    4: { type: 'ExportTx', description: 'Exports assets to another chain' },
  };

  let typeId: number | undefined;
  if (typeof tx.typeID === 'number') typeId = tx.typeID;
  else if ((tx.unsignedTx as Record<string, unknown>)?.typeID !== undefined) {
    typeId = (tx.unsignedTx as Record<string, unknown>).typeID as number;
  }

  const assetID = tx.assetID || (tx.unsignedTx as Record<string, unknown>)?.assetID;
  if (assetID) details.assetID = assetID;

  const name = tx.name || (tx.unsignedTx as Record<string, unknown>)?.name;
  if (name) details.assetName = name;

  const symbol = tx.symbol || (tx.unsignedTx as Record<string, unknown>)?.symbol;
  if (symbol) details.assetSymbol = symbol;

  const outputs = (tx.outputs || (tx.unsignedTx as Record<string, unknown>)?.outputs || []) as Array<{
    output?: { amount?: string };
    amount?: string;
  }>;
  if (outputs.length > 0) {
    let totalAmount = 0;
    for (const output of outputs) {
      if (output.output?.amount) totalAmount += parseInt(output.output.amount);
      else if (output.amount) totalAmount += parseInt(output.amount);
    }
    if (totalAmount > 0) details.totalAmount = (totalAmount / 1e9).toFixed(4) + ' AVAX';
  }

  if (typeId !== undefined && typeIdMap[typeId]) {
    return { type: typeIdMap[typeId].type, description: typeIdMap[typeId].description, details };
  }
  return { type: 'AssetTx', description: 'X-Chain asset transaction', details };
}

// ---------------------------------------------------------------------------
// EVM helpers (C-Chain)
// ---------------------------------------------------------------------------

const BASE_URLS: Record<Network, string> = {
  mainnet: 'https://api.avax.network',
  fuji: 'https://api.avax-test.network',
};

async function evmRPC(network: Network, method: string, params: unknown[]): Promise<unknown> {
  // Delegates to the shared helper so C-Chain EVM calls get the same retry/backoff
  // and the HTML-response guard (a rate-limit page previously crashed JSON.parse here).
  const url = `${BASE_URLS[network]}/ext/bc/C/rpc`;
  return jsonRpcPost(url, method, params);
}

// ---------------------------------------------------------------------------
// Tool domain
//
// NOTE: blockchain_get_native_balance / blockchain_get_contract_info /
// blockchain_lookup_address were retired — they hit live public RPC (rate-
// limited) and overlap onchain_lookup (Glacier-indexed). Use onchain_lookup for
// balances, contract info, and address details.
// ---------------------------------------------------------------------------

export const blockchainTools: ToolDomain = {
  tools: [
    {
      name: 'blockchain_lookup_transaction',
      description:
        'Look up a transaction by hash on Avalanche (C-Chain, P-Chain, or X-Chain). Supports 0x format (C-Chain) and CB58 format (P/X-Chain).',
      inputSchema: {
        type: 'object',
        properties: {
          txHash: {
            type: 'string',
            description: 'Transaction hash (0x... for C-Chain, CB58 for P/X-Chain)',
          },
          network: networkSchemaProp({ withDefault: true, description: 'Network to search' }),
        },
        required: ['txHash'],
      },
    },
    {
      name: 'blockchain_lookup_subnet',
      description:
        'Look up a Subnet / L1 by its ID — validators, chains, and configuration.',
      inputSchema: {
        type: 'object',
        properties: {
          subnetId: { type: 'string', description: 'The Subnet ID' },
          network: networkSchemaProp({ withDefault: true }),
        },
        required: ['subnetId'],
      },
    },
    {
      name: 'blockchain_lookup_chain',
      description: 'Look up a blockchain by its ID — name, VM type, and Subnet/L1.',
      inputSchema: {
        type: 'object',
        properties: {
          chainId: { type: 'string', description: 'The blockchain ID' },
          network: networkSchemaProp({ withDefault: true }),
        },
        required: ['chainId'],
      },
    },
    {
      name: 'blockchain_lookup_validator',
      description: 'Look up a validator by node ID — stake, uptime, delegation info.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Node ID (e.g. NodeID-...)' },
          subnetId: {
            type: 'string',
            default: P_CHAIN_ID,
            description: 'Subnet ID (default: Primary Network)',
          },
          network: networkSchemaProp({ withDefault: true }),
        },
        required: ['nodeId'],
      },
    },
  ],

  handlers: {
    // -------------------------------------------------------------------------
    // blockchain_lookup_transaction
    // -------------------------------------------------------------------------
    blockchain_lookup_transaction: async (args): Promise<ToolResult> => {
      const txHash = args.txHash as string;
      const network = ((args.network as string) || 'mainnet') as Network;
      const isTestnet = network === 'fuji';
      const altNetwork: Network = isTestnet ? 'mainnet' : 'fuji';

      try {
        const isEVMHash = txHash.startsWith('0x') && txHash.length === 66;
        // For the hash's format-appropriate chain(s), track whether we ever got a
        // clean "not here" answer vs only transient RPC failures — so a throttle
        // can't masquerade as a definitive not-found (see the final return below).
        let sawDefinitiveMiss = false;
        let sawTransient = false;

        if (isEVMHash) {
          // Try primary network C-Chain
          for (const net of [network, altNetwork] as Network[]) {
            try {
              const tx = await evmRPC(net, 'eth_getTransactionByHash', [txHash]) as Record<string, string> | null;
              if (tx) {
                const receipt = await evmRPC(net, 'eth_getTransactionReceipt', [txHash]) as Record<string, string> | null;
                const foundOnTestnet = net === 'fuji';
                return {
                  content: [{
                    type: 'text',
                    text: JSON.stringify({
                      found: true,
                      chain: 'C-Chain',
                      transaction: {
                        hash: tx.hash,
                        from: tx.from,
                        to: tx.to,
                        value: tx.value ? (parseInt(tx.value, 16) / 1e18).toFixed(6) + ' AVAX' : '0 AVAX',
                        blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : 'pending',
                        status: receipt?.status === '0x1' ? 'success' : receipt?.status === '0x0' ? 'failed' : 'pending',
                        gasUsed: receipt?.gasUsed ? parseInt(receipt.gasUsed, 16).toString() : 'unknown',
                      },
                      network: foundOnTestnet ? 'Fuji Testnet' : 'Mainnet',
                      ...(net !== network ? { note: `Found on ${foundOnTestnet ? 'Fuji Testnet' : 'Mainnet'} (different from requested)` } : {}),
                      explorerUrl: foundOnTestnet
                        ? `https://testnet.snowtrace.io/tx/${txHash}`
                        : `https://snowtrace.io/tx/${txHash}`,
                    }),
                  }],
                };
              }
              sawDefinitiveMiss = true; // node answered: no such tx on this C-Chain
            } catch (err) {
              if (isUpstreamUnavailable(err)) sawTransient = true;
              else sawDefinitiveMiss = true; // malformed-hash JSON-RPC error = definitive
            }
          }
        }

        // Try P-Chain on primary then alternate
        for (const net of [network, altNetwork] as Network[]) {
          try {
            const pResult = await avalancheRPC(net, 'pchain', 'platform.getTx', { txID: txHash, encoding: 'json' }) as Record<string, unknown>;
            if (pResult) {
              const rawTx = (pResult as Record<string, unknown>).tx || pResult;
              const parsed = parsePChainTransaction(rawTx);

              let txStatus = 'Unknown';
              try {
                const statusResult = await avalancheRPC(net, 'pchain', 'platform.getTxStatus', { txID: txHash }) as Record<string, unknown>;
                txStatus = (statusResult?.status as string) || (typeof statusResult === 'string' ? statusResult : 'Unknown');
              } catch { /* ignore */ }

              const foundOnTestnet = net === 'fuji';
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    found: true,
                    chain: 'P-Chain',
                    transaction: { txID: txHash, type: parsed.type, typeDescription: parsed.description, status: txStatus, ...parsed.details },
                    network: foundOnTestnet ? 'Fuji Testnet' : 'Mainnet',
                    explorerUrl: `https://explorer${foundOnTestnet ? '-test' : ''}.avax.network/p-chain/tx/${txHash}`,
                    note: net !== network
                      ? `Found on ${foundOnTestnet ? 'Fuji Testnet' : 'Mainnet'} (different from requested)`
                      : 'P-Chain transactions include validator operations, delegations, subnet creation, and L1 management',
                  }),
                }],
              };
            }
            if (!isEVMHash) sawDefinitiveMiss = true; // P-Chain replied: no such tx
          } catch (err) {
            if (!isEVMHash && isUpstreamUnavailable(err)) sawTransient = true;
            else if (!isEVMHash) sawDefinitiveMiss = true;
          }

          // Try X-Chain
          try {
            const xResult = await avalancheRPC(net, 'xchain', 'avm.getTx', { txID: txHash, encoding: 'json' }) as Record<string, unknown>;
            if (xResult) {
              const parsed = parseXChainTransaction(xResult);

              let txStatus = 'Unknown';
              try {
                const statusResult = await avalancheRPC(net, 'xchain', 'avm.getTxStatus', { txID: txHash }) as Record<string, unknown>;
                txStatus = (statusResult?.status as string) || (typeof statusResult === 'string' ? statusResult : 'Unknown');
              } catch { /* ignore */ }

              const foundOnTestnet = net === 'fuji';
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    found: true,
                    chain: 'X-Chain',
                    transaction: { txID: txHash, type: parsed.type, typeDescription: parsed.description, status: txStatus, ...parsed.details },
                    network: foundOnTestnet ? 'Fuji Testnet' : 'Mainnet',
                    ...(net !== network ? { note: `Found on ${foundOnTestnet ? 'Fuji Testnet' : 'Mainnet'} (different from requested)` } : {}),
                    explorerUrl: `https://explorer${foundOnTestnet ? '-test' : ''}.avax.network/x-chain/tx/${txHash}`,
                  }),
                }],
              };
            }
            if (!isEVMHash) sawDefinitiveMiss = true; // X-Chain replied: no such tx
          } catch (err) {
            if (!isEVMHash && isUpstreamUnavailable(err)) sawTransient = true;
            else if (!isEVMHash) sawDefinitiveMiss = true;
          }
        }

        // Nothing matched. Distinguish a real miss from "couldn't check": if the
        // format-appropriate chain only failed transiently (throttle/timeout) and
        // never returned a clean negative, do NOT claim not-found — that false-
        // negative is exactly what a rate-limited RPC produced before this guard.
        if (sawTransient && !sawDefinitiveMiss) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                found: false,
                indeterminate: true,
                error: 'Could not verify this transaction — the upstream RPC was rate-limited or unreachable, so this is NOT a confirmed "not found". Retry shortly, or use onchain_lookup (Glacier-indexed).',
                txHash,
              }),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              found: false,
              error: 'Transaction not found on any chain (C-Chain, P-Chain, X-Chain) on mainnet or testnet',
              txHash,
            }),
          }],
        };
      } catch (err) {
        return rpcErrorResult(err, 'Error looking up transaction');
      }
    },

    // -------------------------------------------------------------------------
    // blockchain_lookup_subnet
    // -------------------------------------------------------------------------
    blockchain_lookup_subnet: async (args): Promise<ToolResult> => {
      const subnetId = String(args.subnetId ?? '').trim();
      const network = ((args.network as string) || 'mainnet') as Network;
      const isTestnet = network === 'fuji';
      const isPrimaryNetwork = subnetId === P_CHAIN_ID;

      // Validate before querying: a missing or malformed id must not be echoed back as a real,
      // zero-activity Subnet/L1 (which produced ".../subnets/undefined" and non-deterministic counts).
      if (!subnetId) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ found: false, error: 'subnetId is required (a cb58 Subnet ID, e.g. from platform_get_subnets).' }) }],
          isError: true,
        };
      }
      if (!isPrimaryNetwork && !/^[1-9A-HJ-NP-Za-km-z]{40,60}$/.test(subnetId)) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ found: false, subnetId, error: `"${subnetId}" is not a valid Subnet ID (expected a cb58-encoded id).` }) }],
          isError: true,
        };
      }

      try {
        const [validatorsResult, chainsResult] = await Promise.allSettled([
          avalancheRPC(network, 'pchain', 'platform.getCurrentValidators', { subnetID: subnetId }),
          withCache(
            `blockchain:blockchains:${network}`,
            CACHE_TTL.CHAINS,
            () => avalancheRPC(network, 'pchain', 'platform.getBlockchains', {})
          ),
        ]);

        interface ValidatorRaw {
          nodeID?: string;
          weight?: string;
          stakeAmount?: string;
          startTime?: string;
          endTime?: string;
          connected?: boolean;
          uptime?: string;
        }

        let validators: ValidatorRaw[] = [];
        if (validatorsResult.status === 'fulfilled') {
          const vData = validatorsResult.value as { validators?: ValidatorRaw[] };
          validators = (vData?.validators || []).map((v) => ({
            nodeID: v.nodeID,
            weight: v.weight ? (parseInt(v.weight) / 1e9).toFixed(4) + ' AVAX' : undefined,
            stakeAmount: v.stakeAmount ? (parseInt(v.stakeAmount) / 1e9).toFixed(4) + ' AVAX' : undefined,
            startTime: v.startTime ? new Date(parseInt(v.startTime) * 1000).toISOString() : undefined,
            endTime: v.endTime ? new Date(parseInt(v.endTime) * 1000).toISOString() : undefined,
            connected: v.connected,
            uptime: v.uptime,
          }));
        }

        interface ChainRaw { id?: string; name?: string; subnetID?: string; vmID?: string }
        let chains: ChainRaw[] = [];
        if (chainsResult.status === 'fulfilled') {
          const cData = chainsResult.value as { blockchains?: ChainRaw[] };
          chains = (cData?.blockchains || [])
            .filter((c) => c.subnetID === subnetId)
            .map((c) => ({ id: c.id, name: c.name, vmID: c.vmID }));
        }

        // Honest not-found: a non-primary id with no validators AND no blockchains is either
        // nonexistent or actually a blockchain id — don't present it as a real empty Subnet/L1.
        if (!isPrimaryNetwork && validators.length === 0 && chains.length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                found: false,
                subnetId,
                network: networkLabel(isTestnet),
                error: 'No Subnet/L1 found with this ID on this network (no validators or blockchains). It may not exist, be on the other network (try network:"fuji"), or be a blockchain ID rather than a Subnet ID.',
              }),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              found: true,
              subnetId,
              network: networkLabel(isTestnet),
              isPrimaryNetwork,
              validatorCount: validators.length,
              validators: validators.slice(0, 10),
              hasMoreValidators: validators.length > 10,
              chains,
              explorerUrl: `https://explorer${isTestnet ? '-test' : ''}.avax.network/subnets/${subnetId}`,
            }),
          }],
        };
      } catch (err) {
        return rpcErrorResult(err, 'Error looking up Subnet/L1');
      }
    },

    // -------------------------------------------------------------------------
    // blockchain_lookup_chain
    // -------------------------------------------------------------------------
    blockchain_lookup_chain: async (args): Promise<ToolResult> => {
      // Accept a blockchain id (cb58), a chain name (e.g. "C-Chain"), or a value under `value`.
      // The old code matched only an exact `chainId`, so "C-Chain" or 43114 returned not-found.
      const query = String(args.chainId ?? args.name ?? args.value ?? '').trim();
      const explicitNet = args.network as Network | undefined;
      const needle = query.toLowerCase();
      // A numeric EVM chain id pins the network unambiguously (43113 = Fuji, 43114 = Mainnet).
      // Without this, 43113 matched Mainnet C-Chain first and was mislabelled Mainnet.
      const pinnedByEvmId = EVM_ID_TO_NETWORK[needle];
      const network = (explicitNet || pinnedByEvmId || 'mainnet') as Network;
      const altNetwork: Network = network === 'fuji' ? 'mainnet' : 'fuji';
      // For a numeric EVM chain id the network is unambiguous — don't fall back to the other network.
      const netsToSearch: Network[] = pinnedByEvmId && !explicitNet ? [network] : [network, altNetwork];
      // Map short aliases / EVM ids to the canonical primary-chain name (getBlockchains keys on name).
      const aliasName: Record<string, string> = {
        [C_CHAIN_EVM_ID.mainnet]: 'c-chain', [C_CHAIN_EVM_ID.fuji]: 'c-chain', cchain: 'c-chain', c: 'c-chain',
        xchain: 'x-chain', x: 'x-chain', pchain: 'p-chain', p: 'p-chain',
      };
      const wantName = aliasName[needle] ?? needle;
      if (!query) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ found: false, error: 'Provide a blockchain id or name (e.g. chainId:"<cb58 id>" or name:"C-Chain").' }) }],
          isError: true,
        };
      }

      const chainSlug = (name: string): string => {
        const n = (name || '').toLowerCase();
        if (n === 'c-chain' || n === 'x-chain' || n === 'p-chain') return n;
        return n.replace(/\s+/g, '-') || 'c-chain';
      };

      // P-Chain is the Primary Network platform chain — it is NOT returned by
      // platform.getBlockchains, so resolve it from canonical constants.
      if (wantName === 'p-chain' || query === P_CHAIN_ID) {
        const testnet = network === 'fuji';
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              found: true,
              query,
              chainId: P_CHAIN_ID,
              name: 'P-Chain',
              subnetId: P_CHAIN_ID,
              vmID: 'platformvm',
              vmName: 'Platform VM (P-Chain)',
              network: networkLabel(testnet),
              explorerUrl: `https://explorer${testnet ? '-test' : ''}.avax.network/p-chain`,
              note: 'The P-Chain is the Primary Network platform chain; it is not listed by platform.getBlockchains.',
            }),
          }],
        };
      }

      try {
        for (const net of netsToSearch) {
          const result = await withCache(
            `blockchain:blockchains:${net}`,
            CACHE_TTL.CHAINS,
            () => avalancheRPC(net, 'pchain', 'platform.getBlockchains', {})
          ) as { blockchains?: Array<{ id: string; name: string; subnetID: string; vmID: string }> };

          interface BlockchainRaw { id: string; name: string; subnetID: string; vmID: string }
          const list = (result?.blockchains || []) as BlockchainRaw[];
          const nameOf = (c: BlockchainRaw) => (c.name || '').toLowerCase();
          const chain =
            list.find((c) => c.id === query) ||
            list.find((c) => nameOf(c) === wantName) ||
            list.find((c) => nameOf(c) === needle) ||
            (needle.length >= 2 ? list.find((c) => nameOf(c).startsWith(needle)) : undefined);
          if (chain) {
            const foundOnTestnet = net === 'fuji';
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  found: true,
                  query,
                  chainId: chain.id,
                  name: chain.name,
                  subnetId: chain.subnetID,
                  vmID: chain.vmID,
                  vmName: VM_NAMES[chain.vmID] || 'Custom VM',
                  network: foundOnTestnet ? 'Fuji Testnet' : 'Mainnet',
                  ...(net !== network ? { note: `Found on ${foundOnTestnet ? 'Fuji Testnet' : 'Mainnet'} (different from requested)` } : {}),
                  explorerUrl: `https://explorer${foundOnTestnet ? '-test' : ''}.avax.network/${chainSlug(chain.name)}`,
                }),
              }],
            };
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ found: false, query, error: 'Chain not found on mainnet or testnet (searched by id and name).' }),
          }],
        };
      } catch (err) {
        return rpcErrorResult(err, 'Error looking up chain');
      }
    },

    // -------------------------------------------------------------------------
    // blockchain_lookup_validator
    // -------------------------------------------------------------------------
    blockchain_lookup_validator: async (args): Promise<ToolResult> => {
      const nodeId = args.nodeId as string;
      const subnetId = (args.subnetId as string) || P_CHAIN_ID;
      const network = ((args.network as string) || 'mainnet') as Network;
      const isTestnet = network === 'fuji';

      try {
        const result = await avalancheRPC(network, 'pchain', 'platform.getCurrentValidators', {
          subnetID: subnetId,
          nodeIDs: [nodeId],
        }) as { validators?: Array<Record<string, unknown>> };

        const validators = result?.validators || [];

        if (validators.length === 0) {
          // Check pending
          const pendingResult = await avalancheRPC(network, 'pchain', 'platform.getPendingValidators', {
            subnetID: subnetId,
            nodeIDs: [nodeId],
          }) as { validators?: Array<Record<string, unknown>> };

          const pending = (pendingResult?.validators || []);
          if (pending.length > 0) {
            const v = pending[0];
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  found: true,
                  status: 'pending',
                  nodeId: v.nodeID,
                  stakeAmount: v.stakeAmount ? (parseInt(String(v.stakeAmount)) / 1e9).toFixed(4) + ' AVAX' : undefined,
                  startTime: v.startTime ? new Date(parseInt(String(v.startTime)) * 1000).toISOString() : undefined,
                  endTime: v.endTime ? new Date(parseInt(String(v.endTime)) * 1000).toISOString() : undefined,
                  network: networkLabel(isTestnet),
                }),
              }],
            };
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ found: false, nodeId, error: 'Validator not found in current or pending validators' }),
            }],
          };
        }

        const v = validators[0];
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              found: true,
              status: 'active',
              nodeId: v.nodeID,
              stakeAmount: v.stakeAmount ? (parseInt(String(v.stakeAmount)) / 1e9).toFixed(4) + ' AVAX' : undefined,
              weight: v.weight ? (parseInt(String(v.weight)) / 1e9).toFixed(4) + ' AVAX' : undefined,
              startTime: v.startTime ? new Date(parseInt(String(v.startTime)) * 1000).toISOString() : undefined,
              endTime: v.endTime ? new Date(parseInt(String(v.endTime)) * 1000).toISOString() : undefined,
              delegationFee: v.delegationFee
                ? `${(parseInt(String(v.delegationFee)) / 10000 * 100).toFixed(2)}%`
                : undefined,
              connected: v.connected,
              uptime: v.uptime,
              delegatorCount: Array.isArray(v.delegators) ? v.delegators.length : 0,
              potentialReward: v.potentialReward
                ? (parseInt(String(v.potentialReward)) / 1e9).toFixed(4) + ' AVAX'
                : undefined,
              network: networkLabel(isTestnet),
              explorerUrl: `https://explorer${isTestnet ? '-test' : ''}.avax.network/validators/${nodeId}`,
            }),
          }],
        };
      } catch (err) {
        return rpcErrorResult(err, 'Error looking up validator');
      }
    },
  },
};
