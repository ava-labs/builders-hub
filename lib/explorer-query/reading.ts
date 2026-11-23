/* the reader: a fast model writes the callouts under a kept chart again from its rows */

import { anthropic } from "./meter";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { CALLOUT_RAW, CALLOUT_SHOWN } from "./visual-spec";
import { READER_RULES, codeWords, heldHex, plainDecimals, plainWords, rowWords, shownLength, withFullHex } from "./reader-words";
import { ALL_ROWS, rowsBrief, sharesOf, staleBrief, withShares, type DesignInput } from "./figures";

/** the reader runs on Sonnet 5.5 at low effort. Sonnet 5.5 refuses a forced tool call (a 400), so its turn asks for the call */
const READER_MODEL = "claude-sonnet-5-5";
const READER_OPTIONS = { anthropic: { effort: "low" as const } };
export const READ_ONLY = "Reply only with one call to the reading tool.";

/** fresh callouts for a kept layout: the layout outlives its rows, the
    sentences do not, so a fast model writes them again from these rows */
export async function writeReading(input: Omit<DesignInput, "chart">, again = true): Promise<string[]> {
  if (input.rows.length === 0) return [];
  let out: string[] = [];
  const reading = tool({
    description: "One to three callouts on these rows.",
    inputSchema: z.object({ callouts: z.array(z.string().max(CALLOUT_RAW)).max(3) }),
    execute: async ({ callouts }) => {
      // a callout that names a column or an address the rows do not hold, or that runs past CALLOUT_SHOWN as shown, is left out
      const names = input.columns.map((c) => c.name);
      const held = heldHex(input);
      const shown = rowWords(input.rows, input.names);
      const shares = sharesOf(input);
      out = callouts.map((c) => c.replace(/\u2014/g, ",")).map(plainWords).map(plainDecimals).filter((c) => codeWords(c, names, shown).length === 0).map((c) => withFullHex(c, held)).filter((c): c is string => c !== null).filter((c) => shownLength(c) <= CALLOUT_SHOWN).map((c) => withShares(c, shares)).slice(0, 3);
      return { ok: true };
    },
  });
  try {
    await generateText({
      model: anthropic(READER_MODEL, input.spent),
      providerOptions: READER_OPTIONS,
      system: [
        "You write the short reading under a chart on the Avalanche explorer.",
        "At most three sentences a developer would act on, each with a name and a figure from the rows: concentration (one sender behind a method), failure (a method that always reverts), cost (who pays the most gas).",
        "No adjectives, no restating the title. Do not mention the data window. No em dashes. Never say settled or waiting.",
        `Each callout is one full sentence that ends with a period, at most ${CALLOUT_SHOWN} characters as the page shows it (an address or hash counts as 11). Write figures as people read them: 3.16M, 64.7k, 41.6%; never 3159411 or 1.395e+6. Write a day short, with the month its row gives: 2025-03-04 is Mar 4.`,
        `Figures are computed over all rows; past ${ALL_ROWS} rows the rows shown are a sample. Take every peak, low, total, first and last value, and the row that holds it, from Figures, never from the rows shown.`,
        "When Figures says the rows are cut, say they are the first (or the newest) of the total, and never call a sum over them the total.",
        READER_RULES,
        "Call the reading tool once.",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            `Question: ${input.question}`,
            `Title: ${input.title}`,
            ...staleBrief(input.anchor),
            `Native token: ${input.symbol}. Rows: ${input.rows.length}${input.totals && input.totals.rows > input.rows.length ? ` of ${input.totals.rows}` : ""}.`,
            ...rowsBrief(input),
            READ_ONLY,
          ].join("\n"),
        },
      ],
      tools: { reading },
      // on auto, a reply in prose leaves the reading empty, and an empty reading is written once more (below)
      toolChoice: "auto",
      stopWhen: [stepCountIs(1)],
      maxRetries: 1,
    });
  } catch (e) {
    console.warn("[explorer-query] reading failed:", e instanceof Error ? e.message : e);
  }
  // an empty reading is written once more: a kept chart with no sentence under it reads as broken
  if (out.length === 0 && again) return writeReading(input, false);
  return out;
}
