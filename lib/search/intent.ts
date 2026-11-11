import type { PinnedPage } from './dialog-rows';

// What a search query asks for, beyond the pages Algolia finds: a term the
// vocabulary pins to its page, a Console tool, or a question for the AI chat.
// The docs search dialog (components/search.tsx) shows the answer above and
// below the found pages.

/** A Console tool, as the toolbox registry lists it (components/toolbox/console/toolbox/tools.ts). */
export interface ToolEntry {
  name: string;
  description: string;
  path: string;
  category: string;
  external?: boolean;
}

export interface VocabularyEntry {
  /** what people type, in any word order, singular or plural */
  terms: string[];
  /** the pages that answer it, best first */
  pages?: Array<{ url: string; title: string }>;
  /** the paths of the Console tools that do it */
  tools?: string[];
  /** one line under the first page, for a term the site renamed */
  note?: string;
}

export interface SearchIntent {
  question: boolean;
  /** above the found pages: the vocabulary's pages and tools, then the tools the query names in full */
  top: PinnedPage[];
  /** below the found pages: the tools the query names in part */
  bottom: PinnedPage[];
}

const STOP_WORDS = new Set([
  ...'a an the to of for in on at by with and or from into about as'.split(' '),
  ...'is are was were be been am do does did has have i me my mine we our you your it its'.split(' '),
  ...'this that these those how what why when where which who can could should would will may might must'.split(' '),
  ...'need want much many own new get please avalanche'.split(' '),
]);

const QUESTION_WORDS = new Set(
  'how what why when where which who whom whose can could should would will is are was were do does did has have may might must'.split(
    ' ',
  ),
);

const MAX_TOOLS = 2;

const stem = (word: string) =>
  word.length >= 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;

/** The words of a query that carry meaning: lower case, no filler words, no single letters, no plural s. */
export function queryWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map(stem);
}

// A longer word matches no row, and V8 cannot compile a highlighter pattern with a word of 32,768 characters or more.
const MAX_HIGHLIGHT_WORD = 100;

/**
 * The words of a query that carry meaning, as typed, for highlighting matches: "how much AVAX do I need to
 * stake" gives "AVAX stake". All the query's words when none carries meaning. Words too long to match are left out.
 */
export function highlightTerms(query: string): string {
  const words = query.split(/\s+/).filter((word) => word && word.length <= MAX_HIGHLIGHT_WORD);
  const meaningful = words.filter((word) => {
    const bare = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    return bare.length > 1 && !STOP_WORDS.has(bare);
  });
  return (meaningful.length ? meaningful : words).join(' ');
}

/** A query asked as a question: it ends with "?", or it opens with a question word and runs three words or more. */
export function isQuestion(query: string): boolean {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  return query.trim().endsWith('?') || (words.length >= 3 && QUESTION_WORDS.has(words[0].toLowerCase()));
}

export const VOCABULARY: VocabularyEntry[] = [
  {
    // the site's own wording: content/blog/etna-changes.mdx, "Subnets Are Now Called L1s"
    terms: ['subnet'],
    pages: [{ url: '/docs/avalanche-l1s', title: 'Avalanche L1s' }],
    note: 'Subnets are now called L1s.',
  },
  { terms: ['l1'], pages: [{ url: '/docs/avalanche-l1s', title: 'Avalanche L1s' }] },
  {
    // the page's "Note on Terminology"
    terms: ['teleporter', 'teleporter messenger', 'teleportermessenger'],
    pages: [{ url: '/docs/cross-chain/icm-contracts/overview', title: 'What is ICM Contracts?' }],
    note: 'Teleporter (TeleporterMessenger) is an ICM Contract.',
  },
  {
    terms: ['icm', 'interchain messaging', 'awm', 'warp messaging'],
    pages: [{ url: '/docs/cross-chain/avalanche-warp-messaging/overview', title: 'What is ICM?' }],
  },
  {
    terms: ['ictt', 'interchain token transfer', 'token bridge'],
    pages: [
      {
        url: '/docs/cross-chain/interchain-token-transfer/overview',
        title: 'Avalanche Interchain Token Transfer (ICTT)',
      },
    ],
  },
  {
    terms: ['become validator', 'run validator', 'validator node'],
    pages: [
      { url: '/docs/primary-network/validate/node-validator', title: 'Turn Node Into Validator' },
      { url: '/docs/primary-network/validate/how-to-stake', title: 'How to Stake' },
    ],
  },
  {
    terms: ['stake', 'staking', 'stake avax', 'avax staking', 'minimum stake'],
    pages: [{ url: '/docs/primary-network/validate/how-to-stake', title: 'How to Stake' }],
  },
  {
    terms: ['reward', 'staking reward', 'validator reward', 'delegation reward'],
    pages: [{ url: '/docs/primary-network/validate/rewards-formula', title: 'Rewards Formula' }],
  },
  {
    terms: ['faucet', 'testnet avax', 'test avax', 'fuji avax', 'free avax', 'testnet token'],
    tools: ['/console/primary-network/faucet'],
  },
  {
    terms: ['launch l1', 'create blockchain', 'launch blockchain'],
    tools: ['/console/create-l1'],
  },
];

const bag = (words: string[]) => [...words].sort().join(' ');

const BY_TERM = new Map(
  VOCABULARY.flatMap((entry) => entry.terms.map((term) => [bag(queryWords(term)), entry] as const)),
);

interface ToolMatch {
  tool: ToolEntry;
  /** the share of the query's words that are in the tool's name */
  inName: number;
  /** the share of the name's words that are in the query */
  ofName: number;
}

/**
 * The words a tool answers to: its name's, and its category's too when the name keeps a single word, so
 * "Deploy Your Own" (Encrypted ERC) does not answer every query that says "deploy".
 */
function toolWords(tool: ToolEntry): string[] {
  const name = queryWords(tool.name);
  return name.length > 1 ? name : [...name, ...queryWords(tool.category)];
}

/** How a query and a tool's name overlap. The last query word may be the start of a name word, while it is typed. */
function matchTool(words: string[], tool: ToolEntry): ToolMatch {
  const name = toolWords(tool);
  const same = (nameWord: string, i: number) =>
    nameWord === words[i] || (i === words.length - 1 && nameWord.startsWith(words[i]));
  const inName = words.filter((_, i) => name.some((nameWord) => same(nameWord, i))).length / words.length;
  const ofName = name.length
    ? name.filter((nameWord) => words.some((_, i) => same(nameWord, i))).length / name.length
    : 0;
  return { tool, inName, ofName };
}

// in full: the query holds the whole name, and the name is at least half of the query ("add a validator to my L1")
const namesInFull = (m: ToolMatch) => m.ofName === 1 && m.inName >= 0.5;
// in part: the query is a piece of the name, at least half of it ("explorer" for Explorer Setup)
const namesInPart = (m: ToolMatch) => m.inName === 1 && m.ofName >= 0.5 && m.ofName < 1;

function toolPage(tool: ToolEntry): PinnedPage {
  return { url: tool.path, title: tool.name, label: ['Console', tool.category], note: tool.description };
}

const firstPerPath = (tools: ToolEntry[]) =>
  tools.filter((tool, i) => tools.findIndex((t) => t.path === tool.path) === i);

/**
 * What the dialog shows for a query besides the found pages. A tool the query names in full goes on
 * top and one it names in part below, the way the dialog places chain rows.
 */
export function searchIntent(query: string, tools: ToolEntry[]): SearchIntent {
  const words = queryWords(query);
  const entry = words.length ? BY_TERM.get(bag(words)) : undefined;
  const site = tools.filter((tool) => !tool.external);
  const curated = (entry?.tools ?? []).flatMap((toolPath) => site.filter((tool) => tool.path === toolPath));
  const matches = words.length ? site.map((tool) => matchTool(words, tool)) : [];
  // the tool that is more of the query first, then the one the query names more of
  const full = matches.filter(namesInFull).sort((a, b) => b.inName - a.inName);
  const part = matches.filter(namesInPart).sort((a, b) => b.ofName - a.ofName);
  const top = firstPerPath([...curated, ...full.map((m) => m.tool)]).slice(0, MAX_TOOLS);
  const bottom = firstPerPath(part.map((m) => m.tool))
    .filter((tool) => !top.some((t) => t.path === tool.path))
    .slice(0, MAX_TOOLS);
  const pages = (entry?.pages ?? []).map((page, i) => (i === 0 && entry?.note ? { ...page, note: entry.note } : page));
  return { question: isQuestion(query), top: [...pages, ...top.map(toolPage)], bottom: bottom.map(toolPage) };
}
