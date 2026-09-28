/* When a search box should ask instead of look up. Anything that is not an
   identifier and reads like a sentence (three or more words, or a question
   mark) is a question; one or two words still find chains by name. */

export function looksLikeQuestion(q: string, opts: { identifier: boolean; chainHit: boolean }): boolean {
  const s = q.trim();
  if (!s || opts.identifier) return false;
  if (s.endsWith("?")) return true;
  const words = s.split(/\s+/).filter(Boolean).length;
  return opts.chainHit ? words >= 3 : words >= 2;
}

/** a phrase of two words or more can always be offered as a question */
export function canAskPhrase(q: string, identifier: boolean): boolean {
  return !identifier && q.trim().split(/\s+/).filter(Boolean).length >= 2;
}
