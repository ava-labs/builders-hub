/**
 * Server-side PostHog utilities
 *
 * This module provides functions for capturing PostHog events from server-side code
 * (API routes, server components, etc.) using the PostHog HTTP API.
 */

const POSTHOG_API_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

/**
 * Capture a generic server-side event to PostHog
 */
export async function captureServerEvent(
  event: string,
  properties: Record<string, unknown>,
  distinctId: string = 'server'
) {
  if (!POSTHOG_API_KEY) return;

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
 * Capture an AI/LLM generation event to PostHog
 * Uses PostHog's $ai_generation event format for LLM observability
 */
export async function captureAIGeneration({
  distinctId,
  model,
  input,
  output,
  inputTokens,
  outputTokens,
  latencyMs,
  traceId,
}: {
  distinctId?: string;
  model: string;
  input: string;
  output: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  traceId?: string;
}) {
  if (!POSTHOG_API_KEY) return;

  try {
    // Estimate tokens if not provided (rough estimate: 1 token ≈ 4 chars)
    const estimatedInputTokens = inputTokens ?? Math.ceil(input.length / 4);
    const estimatedOutputTokens = outputTokens ?? Math.ceil(output.length / 4);

    // GPT-4o-mini pricing: $0.15/1M input, $0.60/1M output
    const inputCost = (estimatedInputTokens / 1000000) * 0.15;
    const outputCost = (estimatedOutputTokens / 1000000) * 0.60;

    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        event: '$ai_generation',
        distinct_id: distinctId || 'anonymous',
        properties: {
          $ai_model: model,
          $ai_provider: 'openai',
          $ai_input: input,
          $ai_output_choices: [{ message: { content: output } }],
          $ai_input_tokens: estimatedInputTokens,
          $ai_output_tokens: estimatedOutputTokens,
          $ai_total_cost_usd: inputCost + outputCost,
          $ai_latency: latencyMs / 1000, // Convert to seconds
          $ai_trace_id: traceId,
          $ai_http_status: 200,
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
