/**
 * Code Sample Merger for OpenAPI Specs
 *
 * Merges code samples from a Speakeasy OpenAPI specification into individual
 * Glacier and Popsicle API specifications for documentation generation.
 *
 * @module add-code-samples
 */

// ============================================================================
// Types
// ============================================================================

interface OpenAPISpec {
  paths?: Record<string, PathItem>;
  servers?: Server[];
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
  servers?: Server[];
}

interface Operation {
  operationId?: string;
  servers?: Server[];
  "x-speakeasy-name-override"?: string;
  "x-speakeasy-group"?: string;
  "x-codeSamples"?: CodeSample[];
}

interface CodeSample {
  lang: string;
  label: string;
  source: string;
}

interface Server {
  url: string;
}

interface OperationWithSamples {
  operation: Operation;
  codeSamples: CodeSample[];
  path?: string;
  method?: string;
}

type HTTPMethod = "get" | "post" | "put" | "delete" | "patch";

// ============================================================================
// Constants
// ============================================================================

const HTTP_METHODS: readonly HTTPMethod[] = [
  "get",
  "post",
  "put",
  "delete",
  "patch",
] as const;

const CHAINKIT_PACKAGE = "@avalanche-sdk/chainkit";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extracts the server URL for an operation following OpenAPI precedence rules:
 * operation-level > path-level > spec-level
 */
function getServerUrl(
  spec: OpenAPISpec,
  pathItem: PathItem,
  operation: Operation
): string | null {
  if (operation.servers?.length) {
    return operation.servers[0].url;
  }

  if (pathItem.servers?.length) {
    return pathItem.servers[0].url;
  }

  if (spec.servers?.length) {
    return spec.servers[0].url;
  }

  return null;
}

/**
 * Filters code samples to retain only those using the ChainKit SDK.
 * Removes samples that use alternative SDKs like @avalanche-sdk/devtools.
 */
function filterChainKitSamples(
  samples: CodeSample[] | undefined
): CodeSample[] {
  if (!Array.isArray(samples)) {
    return [];
  }

  return samples.filter(
    (sample) =>
      sample.source &&
      typeof sample.source === "string" &&
      sample.source.includes(CHAINKIT_PACKAGE)
  );
}

/**
 * Type guard to validate that an object is a valid PathItem
 */
function isValidPathItem(value: unknown): value is PathItem {
  return value !== null && typeof value === "object";
}

/**
 * Type guard to validate that an object is a valid Operation
 */
function isValidOperation(value: unknown): value is Operation {
  return value !== null && typeof value === "object";
}

// ============================================================================
// Index Builders
// ============================================================================

interface OperationIndexes {
  byOperationId: Map<string, CodeSample[]>;
  byNameOverride: Map<string, CodeSample[]>;
  byGroup: Map<string, OperationWithSamples[]>;
  byServer: Map<string, OperationWithSamples[]>;
}

/**
 * Builds indexes of Speakeasy operations for efficient matching.
 * Indexes are created by operationId, nameOverride, group, and server URL.
 */
function buildOperationIndexes(speakeasySpec: OpenAPISpec): OperationIndexes {
  const byOperationId = new Map<string, CodeSample[]>();
  const byNameOverride = new Map<string, CodeSample[]>();
  const byGroup = new Map<string, OperationWithSamples[]>();
  const byServer = new Map<string, OperationWithSamples[]>();

  if (!speakeasySpec.paths) {
    return { byOperationId, byNameOverride, byGroup, byServer };
  }

  for (const [path, pathItem] of Object.entries(speakeasySpec.paths)) {
    if (!isValidPathItem(pathItem)) {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isValidOperation(operation)) {
        continue;
      }

      const filteredSamples = filterChainKitSamples(operation["x-codeSamples"]);
      if (filteredSamples.length === 0) {
        continue;
      }

      // Index by operationId
      if (operation.operationId) {
        byOperationId.set(operation.operationId, filteredSamples);
      }

      // Index by nameOverride
      const nameOverride = operation["x-speakeasy-name-override"];
      if (nameOverride) {
        byNameOverride.set(nameOverride, filteredSamples);
      }

      // Index by group
      const group = operation["x-speakeasy-group"];
      if (group) {
        if (!byGroup.has(group)) {
          byGroup.set(group, []);
        }
        byGroup.get(group)!.push({
          operation,
          codeSamples: filteredSamples,
        });
      }

      // Index by server URL
      const serverUrl = getServerUrl(speakeasySpec, pathItem, operation);
      if (serverUrl) {
        if (!byServer.has(serverUrl)) {
          byServer.set(serverUrl, []);
        }
        byServer.get(serverUrl)!.push({
          operation,
          codeSamples: filteredSamples,
          path,
          method,
        });
      }
    }
  }

  return { byOperationId, byNameOverride, byGroup, byServer };
}

// ============================================================================
// Matching Strategies
// ============================================================================

interface MatchResult {
  codeSamples: CodeSample[];
  strategy: "path" | "operationId" | "nameOverride" | "group" | "server";
}

/**
 * Attempts to match an operation using multiple strategies in order of precedence.
 * Returns the first successful match or null if no match is found.
 */
function findMatchingCodeSamples(
  targetOperation: Operation,
  targetPath: string,
  targetMethod: HTTPMethod,
  targetPathItem: PathItem,
  targetSpec: OpenAPISpec,
  speakeasySpec: OpenAPISpec,
  indexes: OperationIndexes
): MatchResult | null {
  // Strategy 1: Exact path + method match
  const speakeasyPathItem = speakeasySpec.paths?.[targetPath];
  if (speakeasyPathItem) {
    const speakeasyOperation = speakeasyPathItem[targetMethod];
    if (isValidOperation(speakeasyOperation)) {
      const filtered = filterChainKitSamples(
        speakeasyOperation["x-codeSamples"]
      );
      if (filtered.length > 0) {
        return { codeSamples: filtered, strategy: "path" };
      }
    }
  }

  // Strategy 2: Match by operationId
  if (targetOperation.operationId) {
    const samples = indexes.byOperationId.get(targetOperation.operationId);
    if (samples) {
      return { codeSamples: samples, strategy: "operationId" };
    }
  }

  // Strategy 3: Match by nameOverride
  const nameOverride = targetOperation["x-speakeasy-name-override"];
  if (nameOverride) {
    const samples = indexes.byNameOverride.get(nameOverride);
    if (samples) {
      return { codeSamples: samples, strategy: "nameOverride" };
    }
  }

  // Strategy 4: Match by group
  const group = targetOperation["x-speakeasy-group"];
  if (group) {
    const groupOperations = indexes.byGroup.get(group);
    if (groupOperations?.length) {
      return {
        codeSamples: groupOperations[0].codeSamples,
        strategy: "group",
      };
    }
  }

  // Strategy 5: Match by server URL
  const targetServerUrl = getServerUrl(
    targetSpec,
    targetPathItem,
    targetOperation
  );
  if (targetServerUrl) {
    const serverOperations = indexes.byServer.get(targetServerUrl);
    if (serverOperations?.length) {
      // Prefer exact path+method match within the same server
      const exactMatch = serverOperations.find(
        (op) => op.path === targetPath && op.method === targetMethod
      );

      const matched = exactMatch || serverOperations[0];
      if (matched) {
        return { codeSamples: matched.codeSamples, strategy: "server" };
      }
    }
  }

  return null;
}

// ============================================================================
// Main Function
// ============================================================================

interface MatchingStats {
  byPath: number;
  byOperationId: number;
  byNameOverride: number;
  byGroup: number;
  byServer: number;
  totalAdded: number;
}

/**
 * Merges code samples from a Speakeasy OpenAPI spec into a target spec.
 *
 * Uses a multi-tier matching strategy to associate operations between specs:
 * 1. Exact path + HTTP method match
 * 2. operationId match
 * 3. x-speakeasy-name-override match
 * 4. x-speakeasy-group match
 * 5. Server URL match
 *
 * Only code samples using @avalanche-sdk/chainkit are included.
 *
 * @param targetSpec - The OpenAPI spec to enrich with code samples (modified in place)
 * @param speakeasySpec - The Speakeasy spec containing code samples
 * @param specName - Identifier for logging purposes (e.g., "Glacier", "Popsicle")
 *
 * @throws {Error} If speakeasySpec is missing required structure
 */
export function addCodeSamplesToSpec(
  targetSpec: OpenAPISpec,
  speakeasySpec: OpenAPISpec,
  specName: string
): void {
  if (!speakeasySpec.paths) {
    console.warn(`⚠️  Speakeasy spec missing paths structure for ${specName}`);
    return;
  }

  if (!targetSpec.paths) {
    console.warn(`⚠️  Target spec missing paths structure for ${specName}`);
    return;
  }

  const indexes = buildOperationIndexes(speakeasySpec);
  const stats: MatchingStats = {
    byPath: 0,
    byOperationId: 0,
    byNameOverride: 0,
    byGroup: 0,
    byServer: 0,
    totalAdded: 0,
  };

  // Process each operation in the target spec
  for (const [path, pathItem] of Object.entries(targetSpec.paths)) {
    if (!isValidPathItem(pathItem)) {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isValidOperation(operation)) {
        continue;
      }

      const match = findMatchingCodeSamples(
        operation,
        path,
        method,
        pathItem,
        targetSpec,
        speakeasySpec,
        indexes
      );

      if (match) {
        operation["x-codeSamples"] = match.codeSamples;

        switch (match.strategy) {
          case "path":
            stats.byPath++;
            break;
          case "operationId":
            stats.byOperationId++;
            break;
          case "nameOverride":
            stats.byNameOverride++;
            break;
          case "group":
            stats.byGroup++;
            break;
          case "server":
            stats.byServer++;
            break;
        }

        stats.totalAdded++;
      }
    }
  }

  // Log matching statistics
  console.log(
    `  📝 ${specName}: ` +
      `${stats.byPath} by path, ` +
      `${stats.byOperationId} by operationId, ` +
      `${stats.byNameOverride} by nameOverride, ` +
      `${stats.byGroup} by group, ` +
      `${stats.byServer} by server → ` +
      `${stats.totalAdded} total operations enriched`
  );
}
