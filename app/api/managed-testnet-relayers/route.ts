import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { InternalError, RateLimitError, ValidationError } from '@/lib/api/errors';
import { RelayerServiceURLs } from './constants';
import type { CreateRelayerRequest, Relayer } from './types';

export const GET = withApi(
  async (_req: NextRequest, { session }) => {
    const userId = session.user.id;
    const password = process.env.MANAGED_TESTNET_NODE_SERVICE_PASSWORD;
    if (!password) {
      throw new InternalError('Relayer service is not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(RelayerServiceURLs.list(password), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new InternalError('Failed to fetch relayers from Builder Hub');
      }

      const data = await response.json();

      // Handle both array response and object with relayers property
      let allRelayers: any[] = [];
      if (Array.isArray(data)) {
        allRelayers = data;
      } else if (data && Array.isArray(data.relayers)) {
        allRelayers = data.relayers;
      } else if (data && typeof data === 'object') {
        allRelayers = Object.values(data);
      }

      // Map API response to our Relayer interface
      const mappedRelayers = allRelayers.map((item: any) => ({
        relayerId: item.relayerId || item.address || item.id || item.relayer_id || '',
        label: item.label || '',
        configs: item.configs || [],
        port: item.port || 0,
        createdAt: item.createdAt || item.created_at || item.dateCreated || '',
        expiresAt: item.expiresAt || item.expires_at || '',
        health: item.health || null,
      }));

      // Filter relayers by userId label (case-insensitive)
      const relayers = mappedRelayers.filter(
        (relayer: Relayer) => relayer.label && relayer.label.toLowerCase() === userId.toLowerCase(),
      );

      return successResponse({ relayers, total: relayers.length });
    } finally {
      clearTimeout(timeoutId);
    }
  },
  { auth: true },
);

// schema: not applicable — body validated inline with field-level checks
export const POST = withApi(
  async (req: NextRequest, { session }) => {
    const userId = session.user.id;
    const password = process.env.MANAGED_TESTNET_NODE_SERVICE_PASSWORD;
    if (!password) {
      throw new InternalError('Relayer service is not configured');
    }

    const body: CreateRelayerRequest = await req.json();
    const { configs } = body;

    if (!configs || !Array.isArray(configs) || configs.length === 0) {
      throw new ValidationError('Configs array is required and must not be empty');
    }

    for (const config of configs) {
      if (!config.subnetId || !config.blockchainId || !config.rpcUrl || !config.wsUrl) {
        throw new ValidationError('Each config must have subnetId, blockchainId, rpcUrl, and wsUrl');
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(RelayerServiceURLs.create(password), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ configs, label: userId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new RateLimitError('Rate limit exceeded. Please wait before creating again.');
        }
        throw new InternalError('Failed to create relayer in Builder Hub');
      }

      const data = await response.json();
      return successResponse({ relayer: data }, 201);
    } finally {
      clearTimeout(timeoutId);
    }
  },
  { auth: true },
);
