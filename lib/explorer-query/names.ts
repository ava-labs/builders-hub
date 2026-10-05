/* A protocol's name as a question types it. A name matches when its words come in a row, in any case, or typed as
   one word ("traderjoe"). A name of six letters or more (its words joined) also matches a word one slip off, two
   from ten letters: a letter swapped with the next, missing, extra or wrong, so "pharoah" reads as Pharaoh. An
   English word near a name is never a slip of it: "balance" is not Balancer, "money" is not vMoney. The gates that
   add a chapter to the prompt and the registry's contract turn (registry-turn.ts) read names here. */

/** every English word one or two slips from a name the gates or the registry turn read (/usr/share/dict/words,
    checked 2026-09-29): a question that types one means that word */
const NOT_A_SLIP: ReadonlySet<string> = new Set([
  "athena", "balance", "balanced", "balancer", "balander", "cattlebush", "circe", "circled", "circler", "circlet", "cocket",
  "debride", "docket", "ethene", "ether", "gether", "hocket", "locket", "mether", "money", "nether", "nocket", "pocket",
  "protocol", "rebridge", "recast", "rocket", "salver", "salvo", "savor", "socker", "spectral", "spectry", "stargaze",
  "sundra", "teather", "tethery", "tetter", "tither", "tother", "valanche", "wether", "wormholed", "yether",
]);
const NONE: ReadonlySet<string> = new Set();

/** the optimal string alignment distance of a and b, where two neighbours swapped are one slip; max + 1 once past max */
export function slips(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before: number[] = [];
  let last = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(last[j] + 1, row[j - 1] + 1, last[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, before[j - 2] + 1);
      row.push(d);
    }
    if (Math.min(...row) > max) return max + 1;
    before = last;
    last = row;
  }
  return last[b.length];
}

/** a name's or a question's words, lower case, without what a name says in brackets ("LFJ (fka Trader Joe)" is lfj) */
export const wordsOf = (s: string): string[] => s.toLowerCase().replace(/\([^)]*\)/g, " ").match(/[a-z0-9]+/g) ?? [];

/** the candidates the question names, in the candidates' order. A name in `capital` (an English word too, such as
    Curve or Relay) is named only as typed with its capital, and never by a slip */
export function mentioned(question: string, candidates: readonly string[], capital: ReadonlySet<string> = NONE): string[] {
  const typed = wordsOf(question);
  const cased: string[] = question.match(/[A-Za-z0-9]+/g) ?? [];
  return candidates.filter((name) => {
    if (capital.has(name)) return cased.includes(name);
    const words = wordsOf(name);
    if (!words.length) return false;
    if (typed.some((_, at) => words.every((w, k) => typed[at + k] === w))) return true;
    const joined = words.join("");
    if (joined.length < 6) return typed.includes(joined);
    const max = joined.length >= 10 ? 2 : 1;
    return typed.some((t) => !NOT_A_SLIP.has(t) && slips(t, joined, max) <= max);
  });
}
