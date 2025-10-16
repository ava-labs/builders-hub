import { z } from 'zod';

export interface RelayerConfig {
  subnetId: string;
  blockchainId: string;
  rpcUrl: string;
  wsUrl: string;
}

export interface CreateRelayerRequest {
  configs: RelayerConfig[];
}

export interface Relayer {
  relayerId: string;
  label: string;
  configs: RelayerConfig[];
  port: number;
  createdAt: string;
  expiresAt: string;
  health: HealthStatus | null;
}

export interface HealthStatus {
  healthy: boolean;
  components?: {
    'network-all'?: boolean;
    'relayers-all'?: boolean;
  };
}

export const ServiceErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
});

