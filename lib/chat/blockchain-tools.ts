/**
 * Blockchain lookup tools for the AI chat.
 *
 * Extracted from app/api/chat/route.ts for readability.
 * Each export returns an AI SDK `tool()` definition.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { blockchainTools } from '@/lib/mcp/tools';

// ─── P-Chain transaction parser ─────────────────────────────────────────────

const P_CHAIN_TX_TYPES: Record<number, { type: string; description: string }> = {
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

function parsePChainTransaction(rawTx: any): { type: string; description: string; details: Record<string, any> } {
  const tx = rawTx.tx || rawTx.unsignedTx || rawTx;
  const unsignedTx = tx.unsignedTx || {};
  const details: Record<string, any> = {};

  // Type ID
  const typeId = typeof tx.typeID === 'number' ? tx.typeID
    : typeof unsignedTx.typeID === 'number' ? unsignedTx.typeID
    : undefined;

  // Node ID
  const nodeID = tx.nodeID || unsignedTx.nodeID;
  if (nodeID) {
    details.nodeID = nodeID;
    details._lookupHints = details._lookupHints || [];
    details._lookupHints.push({ type: 'validator', id: nodeID });
  }

  // Subnet ID
  const subnetID = tx.subnetID || unsignedTx.subnetID;
  if (subnetID) {
    details.subnetID = subnetID;
    details._lookupHints = details._lookupHints || [];
    details._lookupHints.push({ type: 'subnet', id: subnetID });
  }

  // Chain ID
  const chainID = tx.chainID || unsignedTx.chainID || tx.blockchainID || unsignedTx.blockchainID;
  if (chainID) {
    details.chainID = chainID;
    details._lookupHints = details._lookupHints || [];
    details._lookupHints.push({ type: 'chain', id: chainID });
  }

  if (tx.genesisData || unsignedTx.genesisData) details.hasGenesisData = true;

  const signer = tx.signer || unsignedTx.signer;
  if (signer?.publicKey) details.blsPublicKey = signer.publicKey;

  const delegationFee = tx.delegationFee || unsignedTx.delegationFee || tx.shares || unsignedTx.shares;
  if (delegationFee) details.delegationFee = `${(parseInt(delegationFee) / 10000 * 100).toFixed(2)}%`;

  const startTime = tx.startTime || unsignedTx.startTime;
  if (startTime) details.startTime = new Date(parseInt(startTime) * 1000).toISOString();

  const endTime = tx.endTime || unsignedTx.endTime;
  if (endTime) details.endTime = new Date(parseInt(endTime) * 1000).toISOString();

  const weight = tx.weight || unsignedTx.weight;
  if (weight) details.weight = (parseInt(weight) / 1e9).toFixed(4) + ' AVAX';

  const stakeOutputs = tx.stake || unsignedTx.stake || [];
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
    if (vmNames[vmID]) details.vmName = vmNames[vmID];
  }

  const fxIDs = tx.fxIDs || unsignedTx.fxIDs;
  if (fxIDs && Array.isArray(fxIDs) && fxIDs.length > 0) details.fxIDs = fxIDs;

  const rewardsOwner = tx.rewardsOwner || unsignedTx.rewardsOwner;
  if (rewardsOwner?.addresses?.length > 0) details.rewardsAddresses = rewardsOwner.addresses;

  if (typeId !== undefined && P_CHAIN_TX_TYPES[typeId]) {
    return { ...P_CHAIN_TX_TYPES[typeId], details };
  }

  // Fallback: infer type from structure
  if (chainName && vmID) return { type: 'CreateChainTx', description: 'Creates a new blockchain on a Subnet', details };
  if (subnetID && !nodeID && !chainName) return { type: 'CreateSubnetTx', description: 'Creates a new Subnet', details };
  if (nodeID) {
    if (stakeOutputs.length > 0) return { type: 'AddValidatorTx', description: 'Adds a validator to the network', details };
    if (subnetID && subnetID !== '11111111111111111111111111111111LpoYY') return { type: 'AddSubnetValidatorTx', description: 'Adds a validator to a Subnet', details };
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

// ─── X-Chain transaction parser ─────────────────────────────────────────────

const X_CHAIN_TX_TYPES: Record<number, { type: string; description: string }> = {
  0: { type: 'BaseTx', description: 'Basic AVAX/asset transfer' },
  1: { type: 'CreateAssetTx', description: 'Creates a new asset' },
  2: { type: 'OperationTx', description: 'NFT/asset operation' },
  3: { type: 'ImportTx', description: 'Imports assets from another chain' },
  4: { type: 'ExportTx', description: 'Exports assets to another chain' },
};

function parseXChainTransaction(rawTx: any): { type: string; description: string; details: Record<string, any> } {
  const tx = rawTx.tx || rawTx.unsignedTx || rawTx;
  const details: Record<string, any> = {};

  const typeId = typeof tx.typeID === 'number' ? tx.typeID
    : typeof tx.unsignedTx?.typeID === 'number' ? tx.unsignedTx.typeID
    : undefined;

  if (tx.assetID || tx.unsignedTx?.assetID) details.assetID = tx.assetID || tx.unsignedTx?.assetID;
  if (tx.name || tx.unsignedTx?.name) details.assetName = tx.name || tx.unsignedTx?.name;
  if (tx.symbol || tx.unsignedTx?.symbol) details.assetSymbol = tx.symbol || tx.unsignedTx?.symbol;

  const outputs = tx.outputs || tx.unsignedTx?.outputs || [];
  if (outputs.length > 0) {
    let totalAmount = 0;
    for (const output of outputs) {
      const amt = output.output?.amount || output.amount;
      if (amt) totalAmount += parseInt(amt);
    }
    if (totalAmount > 0) details.totalAmount = (totalAmount / 1e9).toFixed(4) + ' AVAX';
  }

  if (typeId !== undefined && X_CHAIN_TX_TYPES[typeId]) return { ...X_CHAIN_TX_TYPES[typeId], details };
  return { type: 'AssetTx', description: 'X-Chain asset transaction', details };
}

// ─── RPC helpers ────────────────────────────────────────────────────────────

function rpcUrl(network: 'mainnet' | 'fuji', chain: 'C' | 'P' | 'X') {
  const base = network === 'fuji' ? 'https://api.avax-test.network' : 'https://api.avax.network';
  return chain === 'C' ? `${base}/ext/bc/C/rpc` : `${base}/ext/bc/${chain}`;
}

async function rpcCall(url: string, method: string, params: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.error ? null : json.result;
}

function explorerUrl(chain: string, type: 'tx' | 'subnet' | 'validator', id: string, isTestnet: boolean) {
  const prefix = `https://subnets${isTestnet ? '-test' : ''}.avax.network`;
  if (chain === 'C-Chain') return isTestnet ? `https://testnet.snowtrace.io/tx/${id}` : `https://snowtrace.io/tx/${id}`;
  if (type === 'subnet') return `${prefix}/subnets/${id}`;
  if (type === 'validator') return `${prefix}/validators/${id}`;
  return `${prefix}/${chain.toLowerCase()}/tx/${id}`;
}

// ─── Tool definitions ───────────────────────────────────────────────────────

export const blockchainLookupTransaction = tool({
  description: 'Look up a transaction by hash on Avalanche (C-Chain, P-Chain, or X-Chain). Supports 0x format (C-Chain) and base58 format (P/X-Chain). Auto-detects chain and falls back to alternate network.',
  inputSchema: z.object({
    txHash: z.string().describe('Transaction hash (0x for C-Chain, base58 for P/X-Chain)'),
    network: z.enum(['mainnet', 'fuji']).default('mainnet'),
  }),
  execute: async ({ txHash, network }) => {
    const isTestnet = network === 'fuji';
    const altNetwork = isTestnet ? 'mainnet' as const : 'fuji' as const;

    try {
      const isEVMHash = txHash.startsWith('0x') && txHash.length === 66;

      // C-Chain (EVM hash)
      if (isEVMHash) {
        for (const net of [network, altNetwork]) {
          const url = rpcUrl(net, 'C');
          const tx = await rpcCall(url, 'eth_getTransactionByHash', [txHash]);
          if (tx) {
            const receipt = await rpcCall(url, 'eth_getTransactionReceipt', [txHash]);
            const isAlt = net !== network;
            return {
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
              network: net === 'fuji' ? 'Fuji Testnet' : 'Mainnet',
              ...(isAlt ? { note: `Found on ${net === 'fuji' ? 'Fuji Testnet' : 'Mainnet'} (different from requested)` } : {}),
              explorerUrl: explorerUrl('C-Chain', 'tx', txHash, net === 'fuji'),
            };
          }
        }
      }

      // P-Chain
      for (const net of [network, altNetwork]) {
        const url = rpcUrl(net, 'P');
        const result = await rpcCall(url, 'platform.getTx', { txID: txHash, encoding: 'json' });
        if (result) {
          const rawTx = result.tx || result;
          const parsed = parsePChainTransaction(rawTx);
          let txStatus = 'Unknown';
          try {
            const statusResult = await rpcCall(url, 'platform.getTxStatus', { txID: txHash });
            if (statusResult?.status) txStatus = statusResult.status;
            else if (typeof statusResult === 'string') txStatus = statusResult;
          } catch { /* ignore */ }

          const isAlt = net !== network;
          return {
            found: true,
            chain: 'P-Chain',
            transaction: { txID: txHash, type: parsed.type, typeDescription: parsed.description, status: txStatus, ...parsed.details },
            network: net === 'fuji' ? 'Fuji Testnet' : 'Mainnet',
            ...(isAlt ? { note: `Found on ${net === 'fuji' ? 'Fuji Testnet' : 'Mainnet'} (different from requested)` } : {}),
            explorerUrl: explorerUrl('P-Chain', 'tx', txHash, net === 'fuji'),
          };
        }
      }

      // X-Chain
      for (const net of [network, altNetwork]) {
        const url = rpcUrl(net, 'X');
        const result = await rpcCall(url, 'avm.getTx', { txID: txHash, encoding: 'json' });
        if (result) {
          const parsed = parseXChainTransaction(result);
          let txStatus = 'Unknown';
          try {
            const statusResult = await rpcCall(url, 'avm.getTxStatus', { txID: txHash });
            if (statusResult?.status) txStatus = statusResult.status;
            else if (typeof statusResult === 'string') txStatus = statusResult;
          } catch { /* ignore */ }

          const isAlt = net !== network;
          return {
            found: true,
            chain: 'X-Chain',
            transaction: { txID: txHash, type: parsed.type, typeDescription: parsed.description, status: txStatus, ...parsed.details },
            network: net === 'fuji' ? 'Fuji Testnet' : 'Mainnet',
            ...(isAlt ? { note: `Found on ${net === 'fuji' ? 'Fuji Testnet' : 'Mainnet'} (different from requested)` } : {}),
            explorerUrl: explorerUrl('X-Chain', 'tx', txHash, net === 'fuji'),
          };
        }
      }

      return {
        found: false,
        error: 'Transaction not found on any chain (C-Chain, P-Chain, X-Chain) on mainnet or testnet',
        txHash,
        suggestion: 'Check if the transaction hash is correct and the transaction has been confirmed',
      };
    } catch (error) {
      return { error: 'Failed to lookup transaction', details: String(error) };
    }
  },
});

export const blockchainLookupAddress = tool({
  description: 'Look up an address — balance, contract info, recent transactions. Use when users paste an address (0x...).',
  inputSchema: z.object({
    address: z.string().describe('The address to look up (0x format)'),
    chainId: z.string().default('43114').describe('Chain ID — 43114 for C-Chain mainnet, 43113 for Fuji testnet'),
  }),
  execute: async ({ address, chainId }) => {
    try {
      const toolResult = await blockchainTools.handlers.blockchain_lookup_address({ address, chainId });
      const text = toolResult.content?.[0]?.text;
      return text ? JSON.parse(text) : { error: 'No result' };
    } catch (error) {
      return { error: 'Failed to lookup address', details: String(error) };
    }
  },
});

export const blockchainLookupSubnet = tool({
  description: 'Look up a Subnet/L1 by ID — validators, chains, and configuration.',
  inputSchema: z.object({
    subnetId: z.string().describe('The Subnet ID to look up'),
    network: z.enum(['mainnet', 'fuji']).default('mainnet'),
  }),
  execute: async ({ subnetId, network }) => {
    const isTestnet = network === 'fuji';
    const pChainUrl = rpcUrl(network, 'P');

    try {
      const [validatorsResult, chainsResult] = await Promise.all([
        rpcCall(pChainUrl, 'platform.getCurrentValidators', { subnetID: subnetId }),
        rpcCall(pChainUrl, 'platform.getBlockchains', {}),
      ]);

      const validators = (validatorsResult?.validators || []).map((v: any) => ({
        nodeID: v.nodeID,
        weight: v.weight ? (parseInt(v.weight) / 1e9).toFixed(4) + ' AVAX' : undefined,
        stakeAmount: v.stakeAmount ? (parseInt(v.stakeAmount) / 1e9).toFixed(4) + ' AVAX' : undefined,
        startTime: v.startTime ? new Date(parseInt(v.startTime) * 1000).toISOString() : undefined,
        endTime: v.endTime ? new Date(parseInt(v.endTime) * 1000).toISOString() : undefined,
        connected: v.connected,
        uptime: v.uptime,
      }));

      const chains = (chainsResult?.blockchains || [])
        .filter((c: any) => c.subnetID === subnetId)
        .map((c: any) => ({ id: c.id, name: c.name, vmID: c.vmID }));

      const isPrimaryNetwork = subnetId === '11111111111111111111111111111111LpoYY';

      return {
        subnetId,
        network: isTestnet ? 'Fuji Testnet' : 'Mainnet',
        isPrimaryNetwork,
        validatorCount: validators.length,
        validators: validators.slice(0, 10),
        hasMoreValidators: validators.length > 10,
        chains,
        explorerUrl: explorerUrl('', 'subnet', subnetId, isTestnet),
      };
    } catch (error) {
      return { error: 'Failed to lookup subnet', details: String(error) };
    }
  },
});

export const blockchainLookupChain = tool({
  description: 'Look up a blockchain by its chain ID — name, subnet, VM type.',
  inputSchema: z.object({
    chainId: z.string().describe('The blockchain/chain ID to look up'),
    network: z.enum(['mainnet', 'fuji']).default('mainnet'),
  }),
  execute: async ({ chainId, network }) => {
    const vmNames: Record<string, string> = {
      'jvYyfQTxGMJLuGWa55kdP2p2zSUYsQ5Raupu4TW34ZAUBAbtq': 'AvalancheVM (EVM)',
      'mgj786NP7uDwBCcq6YwThhaN8FLyybkCa4zBWTQbNgmK6k9A6': 'Timestamp VM',
      'tGas3T58KzdjLHhBDMnH2TvrddhqTji5iZAMZ3RXs2NLpSnhH': 'Subnet EVM',
      'srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy': 'Coreth (C-Chain VM)',
    };

    for (const net of [network, network === 'fuji' ? 'mainnet' as const : 'fuji' as const]) {
      const url = rpcUrl(net, 'P');
      const result = await rpcCall(url, 'platform.getBlockchains', {});
      const chain = result?.blockchains?.find((c: any) => c.id === chainId);
      if (chain) {
        const isTestnet = net === 'fuji';
        return {
          found: true,
          chainId,
          name: chain.name,
          subnetId: chain.subnetID,
          vmID: chain.vmID,
          vmName: vmNames[chain.vmID] || 'Custom VM',
          network: isTestnet ? 'Fuji Testnet' : 'Mainnet',
          explorerUrl: `https://subnets${isTestnet ? '-test' : ''}.avax.network/c-chain`,
        };
      }
    }

    return { found: false, chainId, error: 'Chain not found on mainnet or testnet' };
  },
});

export const blockchainLookupValidator = tool({
  description: 'Look up a validator by node ID — stake, uptime, delegation info.',
  inputSchema: z.object({
    nodeId: z.string().describe('The node ID (e.g., NodeID-...)'),
    subnetId: z.string().default('11111111111111111111111111111111LpoYY').describe('Subnet ID (default: Primary Network)'),
    network: z.enum(['mainnet', 'fuji']).default('mainnet'),
  }),
  execute: async ({ nodeId, subnetId, network }) => {
    const isTestnet = network === 'fuji';
    const pChainUrl = rpcUrl(network, 'P');

    try {
      const result = await rpcCall(pChainUrl, 'platform.getCurrentValidators', { subnetID: subnetId, nodeIDs: [nodeId] });
      const validators = result?.validators || [];

      if (validators.length === 0) {
        // Check pending
        const pendingResult = await rpcCall(pChainUrl, 'platform.getPendingValidators', { subnetID: subnetId, nodeIDs: [nodeId] });
        const pending = pendingResult?.validators || [];
        if (pending.length > 0) {
          const v = pending[0];
          return {
            found: true,
            status: 'pending',
            nodeId: v.nodeID,
            stakeAmount: v.stakeAmount ? (parseInt(v.stakeAmount) / 1e9).toFixed(4) + ' AVAX' : undefined,
            startTime: v.startTime ? new Date(parseInt(v.startTime) * 1000).toISOString() : undefined,
            endTime: v.endTime ? new Date(parseInt(v.endTime) * 1000).toISOString() : undefined,
            network: isTestnet ? 'Fuji Testnet' : 'Mainnet',
          };
        }
        return { found: false, nodeId, error: 'Validator not found in current or pending validators' };
      }

      const v = validators[0];
      return {
        found: true,
        status: 'active',
        nodeId: v.nodeID,
        stakeAmount: v.stakeAmount ? (parseInt(v.stakeAmount) / 1e9).toFixed(4) + ' AVAX' : undefined,
        weight: v.weight ? (parseInt(v.weight) / 1e9).toFixed(4) + ' AVAX' : undefined,
        startTime: v.startTime ? new Date(parseInt(v.startTime) * 1000).toISOString() : undefined,
        endTime: v.endTime ? new Date(parseInt(v.endTime) * 1000).toISOString() : undefined,
        delegationFee: v.delegationFee ? `${(parseInt(v.delegationFee) / 10000 * 100).toFixed(2)}%` : undefined,
        connected: v.connected,
        uptime: v.uptime,
        delegatorCount: v.delegators?.length || 0,
        potentialReward: v.potentialReward ? (parseInt(v.potentialReward) / 1e9).toFixed(4) + ' AVAX' : undefined,
        network: isTestnet ? 'Fuji Testnet' : 'Mainnet',
        explorerUrl: explorerUrl('', 'validator', nodeId, isTestnet),
      };
    } catch (error) {
      return { error: 'Failed to lookup validator', details: String(error) };
    }
  },
});
