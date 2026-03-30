export interface ValidatorP2P {
  node_id: string;
  p50_uptime: number;
  weight: number;
  delegator_count: number;
  delegator_weight: number;
  delegation_fee: number;
  potential_reward: number;
  bench_observers: number;
  end_time: string;
  version: string;
  tracked_subnets: string;
  public_ip: string;
  total_stake: number;
  days_left: number;
  miss_rate_14d: number;
  miss_count_14d: number;
  block_count_14d: number;
}

export type AlertType =
  | 'uptime'
  | 'version_mandatory'
  | 'version_mandatory_urgent'
  | 'version_mandatory_critical'
  | 'version_optional'
  | 'expiry'
  | 'expiry_urgent'
  | 'expiry_critical';

export interface ReleaseClassification {
  tag: string;
  type: 'mandatory' | 'optional';
  deadline: Date | null;
  acps: string[];
}

export interface ValidatorAlertConfig {
  node_id: string;
  label?: string;
  uptime_alert: boolean;
  uptime_threshold: number;
  version_alert: boolean;
  expiry_alert: boolean;
  expiry_days: number;
  email: string;
}

export interface ValidatorAlertResponse {
  id: string;
  user_id: string;
  node_id: string;
  label: string | null;
  uptime_alert: boolean;
  uptime_threshold: number;
  version_alert: boolean;
  expiry_alert: boolean;
  expiry_days: number;
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  alert_logs: AlertLogResponse[];
}

export interface AlertLogResponse {
  id: string;
  alert_type: AlertType;
  message: string;
  sent_at: string;
}

export interface CreateAlertRequest {
  node_id: string;
  label?: string;
  uptime_alert?: boolean;
  uptime_threshold?: number;
  version_alert?: boolean;
  expiry_alert?: boolean;
  expiry_days?: number;
  email?: string;
}

export interface UpdateAlertRequest {
  label?: string;
  uptime_alert?: boolean;
  uptime_threshold?: number;
  version_alert?: boolean;
  expiry_alert?: boolean;
  expiry_days?: number;
  email?: string;
  active?: boolean;
}
