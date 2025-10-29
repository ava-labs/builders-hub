import { createOpenAPI } from 'fumadocs-openapi/server';

export const dataApi = createOpenAPI({
  // Glacier Data API
  input: ['https://glacier-api.avax.network/api-json'],
});

export const metricsApi = createOpenAPI({
  // Popsicle Metrics API
  input: ['https://popsicle-api.avax.network/api-json'],
});