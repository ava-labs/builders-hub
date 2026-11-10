import { ADDRESSES } from './addresses'

/* The incident banner on the RWA dashboard. An exploit drained the tranche
   pool on October 27, 2026. Set RWA_INCIDENT_BANNER to false to remove the
   banner when the facility administrator closes the incident. */
export const RWA_INCIDENT_BANNER = true

export const RWA_INCIDENT = {
  title: 'Incident: Valinor / OatFi tranche pool',
  date: 'October 27, 2026',
  pool: ADDRESSES.TRANCHE_POOL,
} as const
