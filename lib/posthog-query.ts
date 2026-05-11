/**
 * Server-side PostHog Query API client.
 *
 * Posts HogQL queries to /api/projects/:project_id/query/ and returns the
 * decoded result rows. Never throws — falls back to an empty array when env
 * is missing or PostHog is unreachable so the dashboard still renders.
 */

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const POSTHOG_PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;

let hasLoggedMissingKey = false;

export interface HogQLRunOptions {
  projectId: string | undefined;
  query: string;
}

/**
 * Run a HogQL query against a specific PostHog project. Returns rows shaped
 * as the caller's generic type. Empty array on missing config or any error
 * (logged, never thrown) so the dashboard remains rendering-safe.
 */
export async function runHogQL<TRow>({ projectId, query }: HogQLRunOptions): Promise<TRow[]> {
  if (!POSTHOG_PERSONAL_API_KEY || !projectId) {
    if (!hasLoggedMissingKey) {
      console.debug(
        "[PostHog] POSTHOG_PERSONAL_API_KEY or projectId not set — Builder Insights visit charts will render empty.",
      );
      hasLoggedMissingKey = true;
    }
    return [];
  }

  try {
    const response = await fetch(`${POSTHOG_HOST}/api/projects/${projectId}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { kind: "HogQLQuery", query },
      }),
    });

    if (!response.ok) {
      console.error(`[PostHog] HogQL query failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const json = (await response.json()) as {
      columns?: string[];
      results?: unknown[][];
    };

    const columns = json.columns ?? [];
    const results = json.results ?? [];
    return results.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj as TRow;
    });
  } catch (error) {
    console.error("[PostHog] HogQL query threw:", error);
    return [];
  }
}
