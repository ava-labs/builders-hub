import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { Avalanche } from '@avalanche-sdk/chainkit';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { validateParams } from '@/lib/api/validate';
import { EVM_ADDRESS_REGEX } from '@/lib/api/constants';

const paramsSchema = z.object({
  chainId: z.string().regex(/^\d+$/, 'chainId must be numeric'),
  tokenAddress: z.string().regex(EVM_ADDRESS_REGEX, 'Invalid token address format'),
});

const avalanche = new Avalanche({
  network: 'mainnet',
});

export const GET = withApi(
  async (_req: NextRequest, { params }) => {
    const { chainId, tokenAddress } = validateParams(params, paramsSchema);

    try {
      const result = await avalanche.data.evm.contracts.getMetadata({
        address: tokenAddress,
        chainId,
      });

      if (!result) {
        return successResponse({});
      }

      // Extract symbol based on contract type
      let symbol: string | undefined;
      if (result.ercType === 'ERC-20' || result.ercType === 'ERC-721' || result.ercType === 'ERC-1155') {
        symbol = result.symbol || undefined;
      }

      return successResponse({
        name: result.name || undefined,
        symbol,
        logoUri: result.logoAsset?.imageUri || undefined,
        ercType: result.ercType || undefined,
      });
    } catch {
      // Glacier API might not have data for this token
      return successResponse({});
    }
  },
  {
    rateLimit: { windowMs: 60_000, maxRequests: 60, identifier: 'ip' },
  },
);
