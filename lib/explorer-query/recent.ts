/* The questions asked on this device, newest first, per chain. They come
   back on the Query page and in the search bar, so a question someone
   asks every morning is one click the next day. */

const KEY = "explorer-query-recent";
const MAX = 8;

type Store = Record<string, string[]>;

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

export function recentQuestions(chain: string): string[] {
  if (typeof window === "undefined") return [];
  return read()[chain] ?? [];
}

export function rememberQuestion(chain: string, q: string): void {
  try {
    const all = read();
    const norm = q.trim();
    const list = [norm, ...(all[chain] ?? []).filter((x) => x.toLowerCase() !== norm.toLowerCase())].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify({ ...all, [chain]: list }));
  } catch {
    /* private mode: nothing is kept */
  }
}

export function forgetQuestions(chain: string): void {
  try {
    const all = read();
    delete all[chain];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* nothing to forget */
  }
}
