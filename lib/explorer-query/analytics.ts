/* What Query sends PostHog (lib/posthog-server.ts), from the server, when
   a request's work is done: each question as it was asked, what answered
   it and what its model calls cost, and each stage's calls on each model
   as one LLM analytics generation, priced at Anthropic's list prices. A
   layout and a reading join the trace of the question they serve. A
   signed-in asker counts by the id the site identifies them by (the id
   useTrackNewUser gives PostHog); anyone else counts by the page's own
   PostHog id, or a fresh one, with no person profile. */

import { captureServerEvent, claudeCost } from "@/lib/posthog-server";
import type { ModelCall } from "./meter";
import type { QueryAnswer } from "./types";

/** the stage model calls serve: the writer writes the SQL, the designer lays out the rows, the reader writes the reading */
export type Stage = "writer" | "designer" | "reader";

/** what answered a question: a live feed, the other chain, a suggestion's fixed SQL, a kept answer, or the writer */
export type Source = "monitor" | "route" | "suggestion" | "kept" | "writer";

/** who asked, as PostHog counts them */
export interface Asker {
  id: string;
  signedIn: boolean;
  /** the page's PostHog session, which joins the events to its replay */
  session?: string;
}

/** a PostHog id as the page sends it: its own UUID, or the id it identified the user by */
const PH_ID = /^[\w.@:-]{1,200}$/;
/** a question's trace, as the route makes it and the page sends it back */
export const TRACE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** the asker of a request: the signed-in user by their id, else the page's PostHog ids (query-client.ts), else a fresh id */
export function askerOf(req: Request, userId?: string | null): Asker {
  const sent = (name: string) => {
    const v = req.headers.get(name);
    return v && PH_ID.test(v) ? v : undefined;
  };
  const session = sent("x-posthog-session-id");
  if (userId) return { id: userId, signedIn: true, session };
  return { id: sent("x-posthog-distinct-id") ?? crypto.randomUUID(), signedIn: false, session };
}

/** the properties on each event of a request */
const common = (who: Asker) => ({
  ...(who.session ? { $session_id: who.session } : {}),
  // the server's address says nothing about where the asker is
  $geoip_disable: true,
  ...(who.signedIn ? {} : { $process_person_profile: false }),
});

/** the calls' tokens, model time and cost at list prices; priced is false when a model has no price */
function sum(calls: readonly ModelCall[]) {
  const t = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, ms: 0, inputCost: 0, outputCost: 0, priced: true };
  for (const c of calls) {
    t.input += c.input;
    t.cacheRead += c.cacheRead;
    t.cacheWrite += c.cacheWrite;
    t.output += c.output;
    t.ms += c.ms;
    const cost = claudeCost(c.model, c);
    if (cost) {
      t.inputCost += cost.input;
      t.outputCost += cost.output;
    } else t.priced = false;
  }
  return t;
}

/** what a stage's calls served */
export interface Served {
  who: Asker;
  trace: string;
  stage: Stage;
  chainId: number;
  question: string;
  /** what the stage handed back in words: the answer's title, or why there is none */
  output?: string;
  /** the kept answer the calls serve */
  key?: string;
}

/** a stage's calls on each model, as one generation each */
function generations(calls: readonly ModelCall[], on: Served): Promise<void>[] {
  return [...new Set(calls.map((c) => c.model))].map((model) => {
    const of = calls.filter((c) => c.model === model);
    const t = sum(of);
    const failed = of.filter((c) => c.error);
    return captureServerEvent(
      "$ai_generation",
      {
        $ai_trace_id: on.trace,
        $ai_span_name: on.stage,
        $ai_model: model,
        $ai_provider: "anthropic",
        // the question stands for the input: the prompts and the rows are too large to send
        $ai_input: [{ role: "user", content: on.question }],
        ...(on.output ? { $ai_output_choices: [{ role: "assistant", content: on.output }] } : {}),
        $ai_input_tokens: t.input,
        $ai_cache_read_input_tokens: t.cacheRead,
        $ai_cache_creation_input_tokens: t.cacheWrite,
        $ai_output_tokens: t.output,
        // a model with no list price is left for PostHog to price
        ...(t.priced ? { $ai_input_cost_usd: t.inputCost, $ai_output_cost_usd: t.outputCost, $ai_total_cost_usd: t.inputCost + t.outputCost } : {}),
        $ai_latency: t.ms / 1000,
        $ai_is_error: failed.length > 0,
        ...(failed.length ? { $ai_error: failed[failed.length - 1].error } : {}),
        steps: of.length,
        chain_id: on.chainId,
        ...(on.key ? { answer_key: on.key } : {}),
        ...common(on.who),
      },
      on.who.id,
    );
  });
}

/** one question, once its answer or its error is out */
export interface Asked {
  who: Asker;
  trace: string;
  chainId: number;
  chain: string;
  question: string;
  followUp: boolean;
  ms: number;
  source: Source | null;
  answer?: QueryAnswer | null;
  failed?: { error: string; status: number } | null;
  escalated?: boolean;
  calls: readonly ModelCall[];
}

/** what answered: a live feed, the other chain, a kept or a fixed recipe (a fixed one has no key), else the writer when it ran */
export function sourceOf(answer: QueryAnswer | null, calls: readonly ModelCall[]): Source | null {
  if (answer?.monitor) return "monitor";
  if (answer?.route) return "route";
  if (answer?.model?.cached) return answer.key ? "kept" : "suggestion";
  return answer || calls.length ? "writer" : null;
}

/** sends a question's event, and its writer's calls as generations */
export async function sendQuestion(q: Asked): Promise<void> {
  const t = sum(q.calls);
  const a = q.answer ?? null;
  await Promise.all([
    captureServerEvent(
      "explorer_query_asked",
      {
        question: q.question,
        chain_id: q.chainId,
        chain: q.chain,
        follow_up: q.followUp,
        source: q.source,
        answered: !!a && !q.failed,
        ...(q.failed ? { error: q.failed.error, status: q.failed.status } : {}),
        ...(a ? { title: a.title, rows: a.result?.rowCount ?? 0, chart: a.chart.kind } : {}),
        ...(a?.model ? { writer: a.model.writer, steps: a.model.steps, tries: a.model.tries } : {}),
        escalated: !!q.escalated,
        ms: q.ms,
        signed_in: q.who.signedIn,
        model_calls: q.calls.length,
        input_tokens: t.input,
        cache_read_tokens: t.cacheRead,
        cache_write_tokens: t.cacheWrite,
        output_tokens: t.output,
        cost_usd: t.inputCost + t.outputCost,
        trace_id: q.trace,
        ...common(q.who),
      },
      q.who.id,
    ),
    ...generations(q.calls, { who: q.who, trace: q.trace, stage: "writer", chainId: q.chainId, question: q.question, output: a?.title || q.failed?.error, key: a?.key }),
  ]);
}

/** sends a layout's or a reading's calls as generations, under the trace of the question they serve */
export async function sendStage(calls: readonly ModelCall[], on: Served): Promise<void> {
  await Promise.all(generations(calls, on));
}
