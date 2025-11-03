export interface RelayerConfig {
  subnetId: string;
  blockchainId: string;
  rpcUrl: string;
  wsUrl: string;
}

export interface Relayer {
  relayerId: string; // EVM address
  label: string;
  configs: RelayerConfig[];
  port: number;
  createdAt: string | number; // Can be ISO string or Unix timestamp
  expiresAt: string | number; // Can be ISO string or Unix timestamp
  health: HealthStatus | null;
}

export interface HealthStatus {
  status: string; // "up" or "down"
  details?: {
    'network-all'?: {
      status: string;
      timestamp: string;
    };
    'relayers-all'?: {
      status: string;
      timestamp: string;
    };
  };
}

export interface TimeRemaining {
  days: number;
  hours: number;
  expired: boolean;
}

export interface StatusData {
  color: string;
  iconType: 'expired' | 'warning' | 'active';
  label: string;
}

