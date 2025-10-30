import { createOpenAPI } from 'fumadocs-openapi/server';

export const dataApi = createOpenAPI({
  // Glacier Data API
  input: ['./public/openapi/glacier.json'],
  // Use our proxy to filter out empty query parameters
  proxyUrl: '/api/openapi-proxy',
});

export const metricsApi = createOpenAPI({
  // Popsicle Metrics API
  input: ['./public/openapi/popsicle.json'],
  // Use our proxy to filter out empty query parameters
  proxyUrl: '/api/openapi-proxy',
});

export const pChainApi = createOpenAPI({
  // P-Chain RPC API
  input: ['./public/openapi/platformvm.yaml'],
});