/**
 * Server-side PostHog utilities
 *
 * This module provides functions for capturing PostHog events from server-side code
 * (API routes, server components, etc.) using the PostHog HTTP API.
 */

const POSTHOG_API_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// Log once if API key is missing (helps with debugging)
let hasLoggedMissingKey = false;

/**
 * Truncate a string to a maximum length, adding ellipsis if truncated.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Capture a generic server-side event to PostHog.
 *
 * @param event - The event name (e.g., 'mcp_search', 'user_action')
 * @param properties - Event properties to track
 * @param distinctId - Identifier for the user/session. Use:
 *   - User ID for authenticated users
 *   - Session ID for anonymous tracking
 *   - 'server' (default) for server-side operations not tied to a user
 *   - 'mcp_server' for MCP server events
 */
export async function captureServerEvent(
  event: string,
  properties: Record<string, unknown>,
  distinctId: string = 'server'
) {
  if (!POSTHOG_API_KEY) {
    if (!hasLoggedMissingKey) {
      console.debug('[PostHog] NEXT_PUBLIC_POSTHOG_KEY not set - events will not be tracked');
      hasLoggedMissingKey = true;
    }
    return;
  }

  try {
    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        event,
        distinct_id: distinctId,
        properties,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error(`PostHog capture failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to capture PostHog event:', error);
  }
}

/**
 * Model pricing per 1M tokens (USD)
 * Update these values as pricing changes
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
};

// Default pricing if model not found
const DEFAULT_PRICING = { input: 0.15, output: 0.60 };

// Maximum length for input/output content in analytics (to avoid huge payloads)
const MAX_CONTENT_LENGTH = 500;

/**
 * Capture an AI/LLM generation event to PostHog.
 * Uses PostHog's $ai_generation event format for LLM observability.
 *
 * @param options - AI generation event options
 * @param options.distinctId - User/session identifier
 * @param options.model - The AI model used (e.g., 'gpt-4o-mini')
 * @param options.provider - The AI provider (e.g., 'openai', 'anthropic')
 * @param options.input - The input prompt (will be truncated for analytics)
 * @param options.output - The model output (will be truncated for analytics)
 * @param options.inputTokens - Actual input token count (estimated if not provided)
 * @param options.outputTokens - Actual output token count (estimated if not provided)
 * @param options.latencyMs - Response latency in milliseconds
 * @param options.traceId - Optional trace ID for request correlation
 * @param options.httpStatus - HTTP status code of the AI request (default: 200)
 * @param options.thinkingMode - Whether thinking mode (in-depth) was used
 */
export async function captureAIGeneration({
  distinctId,
  model,
  provider = 'openai',
  input,
  output,
  inputTokens,
  outputTokens,
  latencyMs,
  traceId,
  httpStatus = 200,
  thinkingMode = false,
}: {
  distinctId?: string;
  model: string;
  provider?: string;
  input: string;
  output: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  traceId?: string;
  httpStatus?: number;
  thinkingMode?: boolean;
}) {
  if (!POSTHOG_API_KEY) {
    if (!hasLoggedMissingKey) {
      console.debug('[PostHog] NEXT_PUBLIC_POSTHOG_KEY not set - events will not be tracked');
      hasLoggedMissingKey = true;
    }
    return;
  }

  try {
    // Estimate tokens if not provided (rough estimate: 1 token ≈ 4 chars)
    const estimatedInputTokens = inputTokens ?? Math.ceil(input.length / 4);
    const estimatedOutputTokens = outputTokens ?? Math.ceil(output.length / 4);

    // Get pricing for model (fallback to default if unknown)
    const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
    const inputCost = (estimatedInputTokens / 1000000) * pricing.input;
    const outputCost = (estimatedOutputTokens / 1000000) * pricing.output;

    // Truncate input/output to avoid large payloads
    const truncatedInput = truncate(input, MAX_CONTENT_LENGTH);
    const truncatedOutput = truncate(output, MAX_CONTENT_LENGTH);

    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        event: '$ai_generation',
        distinct_id: distinctId || 'anonymous',
        properties: {
          $ai_model: model,
          $ai_provider: provider,
          $ai_input: truncatedInput,
          $ai_output_choices: [{ message: { content: truncatedOutput } }],
          $ai_input_tokens: estimatedInputTokens,
          $ai_output_tokens: estimatedOutputTokens,
          $ai_total_cost_usd: inputCost + outputCost,
          $ai_latency: latencyMs / 1000, // Convert to seconds
          $ai_trace_id: traceId,
          $ai_http_status: httpStatus,
          thinking_mode: thinkingMode, // Track response mode preference
        },
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error(`PostHog AI capture failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to capture AI generation event:', error);
  }
}
