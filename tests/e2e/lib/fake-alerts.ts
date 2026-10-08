import type { FakeAnswers } from './fake-auth';

// The validator alert API (app/api/validator-alerts) for the profile's Alerts section: one Primary Network validator
// with uptime and expiry checks, and one alert sent. The pause switch sends a PUT, answered with the paused alert.

const ALERT = {
  id: 'alert-1',
  user_id: 'returning-test-user',
  node_id: 'NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg',
  subnet_id: 'primary',
  label: 'Primary validator',
  uptime_alert: true,
  uptime_threshold: 90,
  version_alert: true,
  expiry_alert: true,
  expiry_days: 7,
  balance_alert: false,
  balance_threshold: 5000000000,
  balance_threshold_days: 30,
  security_alert: false,
  last_known_ip: null,
  email: 'signup@example.test',
  active: true,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  alert_logs: [
    {
      id: 'log-1',
      alert_type: 'uptime',
      message: 'Validator Primary validator has uptime 87.2%, below your threshold of 90%.',
      sent_at: '2026-10-01T12:00:00.000Z',
    },
  ],
};

export function alertsAnswers(): FakeAnswers {
  return {
    'GET /api/validator-alerts': [ALERT],
    [`PUT /api/validator-alerts/${ALERT.id}`]: { ...ALERT, active: false },
  };
}
