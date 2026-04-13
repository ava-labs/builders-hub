import type { NextRequest } from 'next/server';
import { z } from 'zod';
import SafeApiKit from '@safe-global/api-kit';
import { getAddress } from 'viem';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError } from '@/lib/api/errors';

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

interface ChainConfig {
  chainId: string;
  chainName: string;
  transactionService: string;
  shortName: string;
  [key: string]: any;
}

async function getSupportedChain(chainId: string): Promise<{ txServiceUrl: string; shortName: string }> {
  const response = await fetch('https://wallet-client.ash.center/v1/chains', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new BadRequestError(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new BadRequestError(data.error);
  }

  const supportedChain: ChainConfig | undefined = data.results.find((chain: ChainConfig) => chain.chainId === chainId);
  if (!supportedChain) {
    throw new BadRequestError(`Chain ${chainId} is not supported for Ash L1 Multisig operations`);
  }

  let txServiceUrl = supportedChain.transactionService;
  if (!txServiceUrl.endsWith('/api') && !txServiceUrl.includes('/api/')) {
    txServiceUrl = txServiceUrl.endsWith('/') ? `${txServiceUrl}api` : `${txServiceUrl}/api`;
  }

  return { txServiceUrl, shortName: supportedChain.shortName };
}

// ---------------------------------------------------------------------------
// Schema — bounds address arrays to max 50 entries
// ---------------------------------------------------------------------------

const safeBodySchema = z.object({
  action: z.string().min(1, 'Missing action parameter'),
  chainId: z.string().min(1),
  safeAddress: z.string().optional(),
  proposalData: z.record(z.string(), z.unknown()).optional(),
  safeTxHash: z.string().optional(),
  ownerAddress: z.string().optional(),
  safeAddresses: z.array(z.string()).max(50, 'Maximum 50 addresses per request').optional(),
});

type SafeBody = z.infer<typeof safeBodySchema>;

// ---------------------------------------------------------------------------
// POST /api/safe
// ---------------------------------------------------------------------------

// withApi: auth intentionally omitted — public anonymous access supported
export const POST = withApi<SafeBody>(
  async (_req: NextRequest, { body }) => {
    const { action, chainId, safeAddress, ...params } = body;

    const chainInfo = await getSupportedChain(chainId);
    const apiKit = new SafeApiKit({
      chainId: BigInt(chainId),
      txServiceUrl: chainInfo.txServiceUrl,
    });

    switch (action) {
      case 'getSafeInfo': {
        const safeInfo = await apiKit.getSafeInfo(safeAddress!);
        return successResponse(safeInfo);
      }

      case 'getNextNonce': {
        const nonce = await apiKit.getNextNonce(safeAddress!);
        return successResponse({ nonce: Number(nonce) });
      }

      case 'proposeTransaction': {
        const { proposalData } = params;
        if (!proposalData) {
          throw new BadRequestError('Missing proposalData');
        }

        const pd = proposalData as Record<string, any>;
        const formattedProposalData = {
          ...pd,
          safeAddress: getAddress(pd.safeAddress),
          senderAddress: getAddress(pd.senderAddress),
          safeTransactionData: {
            ...pd.safeTransactionData,
            to: getAddress(pd.safeTransactionData.to),
            nonce: Number(pd.safeTransactionData.nonce),
          },
        };

        await apiKit.proposeTransaction(formattedProposalData as any);
        return successResponse({ proposed: true });
      }

      case 'getPendingTransactions': {
        const transactions = await apiKit.getPendingTransactions(safeAddress!);
        return successResponse(transactions);
      }

      case 'getTransaction': {
        if (!params.safeTxHash) {
          throw new BadRequestError('Missing safeTxHash');
        }
        const transaction = await apiKit.getTransaction(params.safeTxHash);
        return successResponse(transaction);
      }

      case 'getSafesByOwner': {
        if (!params.ownerAddress) {
          throw new BadRequestError('Missing ownerAddress');
        }
        const safesByOwner = await apiKit.getSafesByOwner(getAddress(params.ownerAddress));
        return successResponse(safesByOwner);
      }

      case 'getAllSafesInfo': {
        const { safeAddresses } = params;
        if (!safeAddresses || !Array.isArray(safeAddresses)) {
          throw new BadRequestError('Missing safeAddresses array');
        }

        const safeInfos: Record<string, any> = {};
        const errors: Record<string, string> = {};

        for (const addr of safeAddresses) {
          try {
            safeInfos[addr] = await apiKit.getSafeInfo(getAddress(addr));
          } catch (error) {
            errors[addr] = (error as Error).message;
          }
        }

        return successResponse({
          safeInfos,
          errors: Object.keys(errors).length > 0 ? errors : undefined,
        });
      }

      case 'getAshWalletUrl': {
        if (!safeAddress) {
          throw new BadRequestError('Missing safeAddress');
        }
        const walletChainInfo = await getSupportedChain(chainId);
        const url = `https://wallet.ash.center/transactions/queue?safe=${walletChainInfo.shortName}:${safeAddress}`;
        return successResponse({ url, shortName: walletChainInfo.shortName });
      }

      default:
        throw new BadRequestError(`Unknown action: ${action}`);
    }
  },
  { schema: safeBodySchema },
);
