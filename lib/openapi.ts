import { createOpenAPI } from 'fumadocs-openapi/server';

export const dataApi = createOpenAPI({
  // Glacier Data API
  input: ['./public/openapi/glacier.json'],
});

export const metricsApi = createOpenAPI({
  // Popsicle Metrics API
  input: ['./public/openapi/popsicle.json'],
});

export const pChainApi = createOpenAPI({
  // P-Chain RPC API
  input: ['./public/openapi/platformvm.yaml'],
});

export const cChainApi = createOpenAPI({
  // C-Chain RPC API
  input: ['./public/openapi/coreth.yaml'],
});

export const xChainApi = createOpenAPI({
  // X-Chain RPC API
  input: ['./public/openapi/xchain.yaml'],
});

export const verificationApi = createOpenAPI({
  // Contract Verification API. Hand-written and committed, unlike the
  // specs above: this one describes our own routes, so it lives with them
  // rather than being fetched at build time.
  input: ['./public/openapi/verification.json'],
});