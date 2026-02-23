/**
 * Blockchain tool domain — lookup tools extracted from the chat route.
 *
 * Fixes the previously broken blockchain_lookup_address tool which was
 * calling a non-existent /api/mcp/blockchain route.
 */

import { avalancheRPC } from '../rpc';
import { withCache, CACHE_TTL } from '../cache';
import type { ToolDomain, ToolResult, Network } from '../types';

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
    21: { type: 'TransformSubnetTx', description: 'Transforms a Subnet to a permissionless L1' },
    22: { type: 'AddPermissionlessValidatorTx', description: 'Adds a permissionless validator' },
    23: { type: 'AddPermissionlessDelegatorTx', description: 'Adds a permissionless delegator' },
    24: { type: 'TransferSubnetOwnershipTx', description: 'Transfers Subnet ownership' },
    25: { type: 'BaseTx', description: 'Base transaction (AVAX transfer on P-Chain)' },
    33: { type: 'ConvertSubnetTx', description: 'Converts a Subnet to a Sovereign L1' },
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
    const vmNames: Record<string, string> = {
      'jvYyfQTxGMJLuGWa55kdP2p2zSUYsQ5Raupu4TW34ZAUBAbtq': 'AvalancheVM (EVM)',
      'mgj786NP7uDwBCcq6YwThhaN8FLyybkCa4zBWTQbNgmK6k9A6': 'Timestamp VM',
      'tGas3T58KzdjLHhBDMnH2TvrddhqTji5iZAMZ3RXs2NLpSnhH': 'Subnet EVM',
      'srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy': 'Coreth (C-Chain)',
    };
    if (vmNames[String(vmID)]) details.vmName = vmNames[String(vmID)];
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
    if (subnetID && subnetID !== '11111111111111111111111111111111LpoYY') {
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
  const url = `${BASE_URLS[network]}/ext/bc/C/rpc`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    const json = await res.json() as { result?: unknown; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// blockchain_get_native_balance
// ---------------------------------------------------------------------------

async function getNativeBalance(address: string, chainId: string): Promise<{
  address: string;
  chainId: string;
  balance: string;
  balanceFormatted: string;
  symbol: string;
}> {
  const network: Network = chainId === '43113' ? 'fuji' : 'mainnet';
  const result = await evmRPC(network, 'eth_getBalance', [address, 'latest']) as string;
  const balanceWei = BigInt(result || '0x0');
  const balanceEth = Number(balanceWei) / 1e18;
  return {
    address,
    chainId,
    balance: result,
    balanceFormatted: balanceEth.toFixed(6),
    symbol: 'AVAX',
  };
}

// ---------------------------------------------------------------------------
// blockchain_get_contract_info
// ---------------------------------------------------------------------------

async function getContractInfo(address: string, chainId: string): Promise<{
  address: string;
  chainId: string;
  isContract: boolean;
  name?: string;
  symbol?: string;
  ercType?: string;
}> {
  const network: Network = chainId === '43113' ? 'fuji' : 'mainnet';

  // Check if it's a contract
  const code = await evmRPC(network, 'eth_getCode', [address, 'latest']) as string;
  const isContract = code !== '0x' && code !== '0x0' && code.length > 2;

  if (!isContract) return { address, chainId, isContract: false };

  // Try to get ERC20 name/symbol
  try {
    // name() selector: 0x06fdde03
    const nameResult = await evmRPC(network, 'eth_call', [
      { to: address, data: '0x06fdde03' },
      'latest',
    ]) as string;

    // symbol() selector: 0x95d89b41
    const symbolResult = await evmRPC(network, 'eth_call', [
      { to: address, data: '0x95d89b41' },
      'latest',
    ]) as string;

    if (nameResult && nameResult !== '0x') {
      // Decode ABI-encoded string
      const decodeString = (hex: string): string => {
        try {
          const data = hex.slice(2);
          const offset = parseInt(data.slice(0, 64), 16) * 2;
          const length = parseInt(data.slice(offset, offset + 64), 16) * 2;
          const strHex = data.slice(offset + 64, offset + 64 + length);
          return Buffer.from(strHex, 'hex').toString('utf8').replace(/\x00/g, '');
        } catch {
          return '';
        }
      };

      const name = decodeString(nameResult);
      const symbol = decodeString(symbolResult);

      if (name) {
        return { address, chainId, isContract: true, name, symbol, ercType: 'ERC20' };
      }
    }
  } catch {
    // Not an ERC20 or call failed
  }

  return { address, chainId, isContract: true };
}

// ---------------------------------------------------------------------------
// Tool domain
// ---------------------------------------------------------------------------

export const blockchainTools: ToolDomain = {
  tools: [
    {
      name: 'blockchain_get_native_balance',
      description: 'Get the native AVAX balance of an address on C-Chain',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'EVM address (0x...)' },
          chainId: {
            type: 'string',
            description: 'Chain ID — "43114" for C-Chain mainnet, "43113" for Fuji testnet',
            default: '43114',
          },
        },
        required: ['address'],
      },
    },
    {
      name: 'blockchain_get_contract_info',
      description: 'Check if an address is a contract and get its ERC20 name/symbol if applicable',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'EVM address (0x...)' },
          chainId: {
            type: 'string',
            description: 'Chain ID — "43114" for C-Chain mainnet, "43113" for Fuji testnet',
            default: '43114',
          },
        },
        required: ['address'],
      },
    },
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
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            default: 'mainnet',
            description: 'Network to search',
          },
        },
        required: ['txHash'],
      },
    },
    {
      name: 'blockchain_lookup_address',
      description:
        'Look up an address — balance, contract info. Use when users paste an 0x address.',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'The address to look up (0x format)' },
          chainId: {
            type: 'string',
            default: '43114',
            description: 'Chain ID — "43114" for C-Chain mainnet, "43113" for Fuji testnet',
          },
        },
        required: ['address'],
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
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            default: 'mainnet',
          },
        },
        required: ['subnetId'],
      },
    },
    {
      name: 'blockchain_lookup_chain',
      description: 'Look up a blockchain by its ID — name, VM type, and subnet.',
      inputSchema: {
        type: 'object',
        properties: {
          chainId: { type: 'string', description: 'The blockchain ID' },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            default: 'mainnet',
          },
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
            default: '11111111111111111111111111111111LpoYY',
            description: 'Subnet ID (default: Primary Network)',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            default: 'mainnet',
          },
        },
        required: ['nodeId'],
      },
    },
  ],

  handlers: {
    // -------------------------------------------------------------------------
    // blockchain_get_native_balance
    // -------------------------------------------------------------------------
    blockchain_get_native_balance: async (args): Promise<ToolResult> => {
      const address = args.address as string;
      const chainId = (args.chainId as string) || '43114';
      try {
        const result = await getNativeBalance(address, chainId);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'Error fetching balance' }],
          isError: true,
        };
      }
    },

    // -------------------------------------------------------------------------
    // blockchain_get_contract_info
    // -------------------------------------------------------------------------
    blockchain_get_contract_info: async (args): Promise<ToolResult> => {
      const address = args.address as string;
      const chainId = (args.chainId as string) || '43114';
      try {
        const result = await getContractInfo(address, chainId);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'Error fetching contract info' }],
          isError: true,
        };
      }
    },

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
            } catch { /* try next */ }
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
                    ...(net !== network ? { note: `Found on ${foundOnTestnet ? 'Fuji Testnet' : 'Mainnet'} (different from requested)` } : {}),
                    explorerUrl: `https://subnets${foundOnTestnet ? '-test' : ''}.avax.network/p-chain/tx/${txHash}`,
                    note: net !== network
                      ? `Found on ${foundOnTestnet ? 'Fuji Testnet' : 'Mainnet'} (different from requested)`
                      : 'P-Chain transactions include validator operations, delegations, subnet creation, and L1 management',
                  }),
                }],
              };
            }
          } catch { /* try X-Chain */ }

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
                    explorerUrl: `https://subnets${foundOnTestnet ? '-test' : ''}.avax.network/x-chain/tx/${txHash}`,
                  }),
                }],
              };
            }
          } catch { /* try next network */ }
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
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'Error looking up transaction' }],
          isError: true,
        };
      }
    },

    // -------------------------------------------------------------------------
    // blockchain_lookup_address — fixed: no longer calls missing blockchain route
    // -------------------------------------------------------------------------
    blockchain_lookup_address: async (args): Promise<ToolResult> => {
      const address = args.address as string;
      const chainId = (args.chainId as string) || '43114';
      try {
        const [balance, contractInfo] = await Promise.allSettled([
          getNativeBalance(address, chainId),
          getContractInfo(address, chainId),
        ]);

        const b = balance.status === 'fulfilled' ? balance.value : null;
        const c = contractInfo.status === 'fulfilled' ? contractInfo.value : null;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              address,
              chainId,
              network: chainId === '43113' ? 'Fuji Testnet' : 'C-Chain Mainnet',
              balance: b ? `${b.balanceFormatted} ${b.symbol}` : 'unknown',
              isContract: c?.isContract || false,
              contractInfo: c?.isContract
                ? { name: c.name, symbol: c.symbol, ercType: c.ercType }
                : null,
              explorerUrl: chainId === '43113'
                ? `https://testnet.snowtrace.io/address/${address}`
                : `https://snowtrace.io/address/${address}`,
            }),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'Error looking up address' }],
          isError: true,
        };
      }
    },

    // -------------------------------------------------------------------------
    // blockchain_lookup_subnet
    // -------------------------------------------------------------------------
    blockchain_lookup_subnet: async (args): Promise<ToolResult> => {
      const subnetId = args.subnetId as string;
      const network = ((args.network as string) || 'mainnet') as Network;
      const isTestnet = network === 'fuji';

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

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              subnetId,
              network: isTestnet ? 'Fuji Testnet' : 'Mainnet',
              isPrimaryNetwork: subnetId === '11111111111111111111111111111111LpoYY',
              validatorCount: validators.length,
              validators: validators.slice(0, 10),
              hasMoreValidators: validators.length > 10,
              chains,
              explorerUrl: `https://subnets${isTestnet ? '-test' : ''}.avax.network/subnets/${subnetId}`,
            }),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'Error looking up subnet' }],
          isError: true,
        };
      }
    },

    // -------------------------------------------------------------------------
    // blockchain_lookup_chain
    // -------------------------------------------------------------------------
    blockchain_lookup_chain: async (args): Promise<ToolResult> => {
      const chainId = args.chainId as string;
      const network = ((args.network as string) || 'mainnet') as Network;
      const isTestnet = network === 'fuji';
      const altNetwork: Network = isTestnet ? 'mainnet' : 'fuji';

      const vmNames: Record<string, string> = {
        'jvYyfQTxGMJLuGWa55kdP2p2zSUYsQ5Raupu4TW34ZAUBAbtq': 'AvalancheVM (EVM)',
        'mgj786NP7uDwBCcq6YwThhaN8FLyybkCa4zBWTQbNgmK6k9A6': 'Timestamp VM',
        'tGas3T58KzdjLHhBDMnH2TvrddhqTji5iZAMZ3RXs2NLpSnhH': 'Subnet EVM',
        'srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy': 'Coreth (C-Chain VM)',
      };

      try {
        for (const net of [network, altNetwork] as Network[]) {
          const result = await withCache(
            `blockchain:blockchains:${net}`,
            CACHE_TTL.CHAINS,
            () => avalancheRPC(net, 'pchain', 'platform.getBlockchains', {})
          ) as { blockchains?: Array<{ id: string; name: string; subnetID: string; vmID: string }> };

          interface BlockchainRaw { id: string; name: string; subnetID: string; vmID: string }
          const chain = (result?.blockchains || []).find((c: BlockchainRaw) => c.id === chainId);
          if (chain) {
            const foundOnTestnet = net === 'fuji';
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  found: true,
                  chainId,
                  name: chain.name,
                  subnetId: chain.subnetID,
                  vmID: chain.vmID,
                  vmName: vmNames[chain.vmID] || 'Custom VM',
                  network: foundOnTestnet ? 'Fuji Testnet' : 'Mainnet',
                  ...(net !== network ? { note: `Found on ${foundOnTestnet ? 'Fuji Testnet' : 'Mainnet'} (different from requested)` } : {}),
                  explorerUrl: `https://subnets${foundOnTestnet ? '-test' : ''}.avax.network/c-chain`,
                }),
              }],
            };
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ found: false, chainId, error: 'Chain not found on mainnet or testnet' }),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'Error looking up chain' }],
          isError: true,
        };
      }
    },

    // -------------------------------------------------------------------------
    // blockchain_lookup_validator
    // -------------------------------------------------------------------------
    blockchain_lookup_validator: async (args): Promise<ToolResult> => {
      const nodeId = args.nodeId as string;
      const subnetId = (args.subnetId as string) || '11111111111111111111111111111111LpoYY';
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
                  network: isTestnet ? 'Fuji Testnet' : 'Mainnet',
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
              network: isTestnet ? 'Fuji Testnet' : 'Mainnet',
              explorerUrl: `https://subnets${isTestnet ? '-test' : ''}.avax.network/validators/${nodeId}`,
            }),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'Error looking up validator' }],
          isError: true,
        };
      }
    },
  },
};
