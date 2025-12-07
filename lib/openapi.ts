import { createOpenAPI } from "fumadocs-openapi/server";

export const dataApi = createOpenAPI({
  // Glacier Data API
  input: ["./public/openapi/glacier.json"],
});

export const metricsApi = createOpenAPI({
  // Popsicle Metrics API
  input: ["./public/openapi/popsicle.json"],
});

export const pChainApi = createOpenAPI({
  // P-Chain RPC API
  input: ["./public/openapi/platformvm.yaml"],
});

export const cChainApi = createOpenAPI({
  // C-Chain RPC API
  input: ["./public/openapi/coreth.yaml"],
});

export const xChainApi = createOpenAPI({
  // X-Chain RPC API
  input: ["./public/openapi/xchain.yaml"],
});
