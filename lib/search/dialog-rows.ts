import type { SortedResult } from 'fumadocs-core/search';

// The rows of the docs search dialog (components/search.tsx), from the hits of
// its Algolia request: each page once, the sections under it that contain the
// query, and a label above the page that says where it lives.

/** A record of the docs index (utils/update-index.ts), as the dialog's request returns it. */
export interface AlgoliaHit {
  objectID: string;
  title: string;
  url: string;
  section?: string;
  section_id?: string;
  content: string;
  /** the words around the match, matched words in <em> */
  _snippetResult?: { content?: { value: string } };
  /** `none` when the query matched the title or the section heading, not this record's text */
  _highlightResult?: { content?: { matchLevel: 'none' | 'partial' | 'full' } };
}

const MAX_PAGES = 12;
const MAX_SECTIONS = 2;
// shorter text rows are table cells and labels, not sentences
const MIN_TEXT_LENGTH = 25;
// the explorer's Accounts pages, one per chain, crowd out the docs
const ACCOUNTS_PAGE = /^\/explorer\/[^/]+\/[^/]+\/accounts$/;

const SOURCES = new Map([
  ['docs', 'Docs'],
  ['academy', 'Academy'],
  ['integrations', 'Integrations'],
  ['blog', 'Blog'],
  ['explorer', 'Explorer'],
  ['stats', 'Explorer'],
]);

// slugs and slug words that keep their own spelling
const SPELLINGS = new Map(
  [
    ...'API APIs RPC RPCs ACP ACPs ICM ICTT EVM L1 L1s ERC ERC20 eERC x402 Team1 AVAX SDK SDKs CLI PoA PoS'.split(' '),
    ...'VM VMs NFT NFTs dApp dApps ID IDs tmpnet BLS KMS AWS GCP JSON ABI FAQ FAQs AI LLM C P X'.split(' '),
    ...'Cross-Chain C-Chain P-Chain X-Chain'.split(' '),
  ].map((spelling) => [spelling.toLowerCase(), spelling]),
);

const SMALL_WORDS = new Set('to and of for on in the a an vs with via by at or'.split(' '));

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const pathParts = (url: string) => url.split('#')[0].split('/').filter(Boolean);

/** A URL slug as words: "04-creating-an-l1" reads "Creating an L1". */
export function humanizeSlug(slug: string): string {
  const bare = slug.replace(/^\d+[a-z]?[-_]/, '');
  return (
    SPELLINGS.get(bare.toLowerCase()) ??
    bare
      .split('-')
      .map((word, i) => {
        const lower = word.toLowerCase();
        if (i > 0 && SMALL_WORDS.has(lower)) return lower;
        return SPELLINGS.get(lower) ?? word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ')
  );
}

/**
 * The folders a page sits in: a docs section, then its subsection when the
 * page sits below it; an Academy course, then its chapter when the page sits
 * below it (the track only when there is no course). Other sources: none.
 */
function folders(source: string, rest: string[]): string[] {
  if (source === 'docs') return rest.slice(0, rest.length >= 3 ? 2 : 1);
  if (source === 'academy') return rest.length === 1 ? rest : rest.slice(1, rest.length >= 4 ? 3 : 2);
  return [];
}

/** Where a page lives, such as Docs › Cross-Chain › ICM Contracts. The last part goes when it repeats the title. */
export function sectionLabel(url: string, title: string): string[] {
  const [source, ...rest] = pathParts(url);
  if (!source) return [];
  const label = [SOURCES.get(source) ?? humanizeSlug(source), ...folders(source, rest).map(humanizeSlug)];
  return label.length > 1 && normalize(label[label.length - 1]) === normalize(title) ? label.slice(0, -1) : label;
}

/**
 * A hit adds a row under its page when the query matched its text, and the
 * text is a heading or a sentence: not the title again, a component attribute
 * (Callout, TypeTable), or a table cell.
 */
function addsContext(hit: AlgoliaHit): boolean {
  if (hit.content === hit.title || hit.content.startsWith('type:')) return false;
  if ((hit._highlightResult?.content?.matchLevel ?? 'none') === 'none') return false;
  return hit.content === hit.section || hit.content.length >= MIN_TEXT_LENGTH;
}

function sectionRow(hit: AlgoliaHit): SortedResult {
  const heading = hit.content === hit.section;
  const snippet = hit._snippetResult?.content?.value ?? hit.content;
  return {
    id: hit.objectID,
    type: heading ? 'heading' : 'text',
    url: hit.section_id ? `${hit.url}#${hit.section_id}` : hit.url,
    // plain text only: Algolia does not escape snippets, so a row must never render as HTML
    content: heading ? hit.content : snippet.replace(/<\/?em>/g, ''),
  };
}

/** The first sections of a page that add context, each text once. */
function sectionRows(pageHits: AlgoliaHit[]): SortedResult[] {
  const candidates = pageHits.filter(addsContext);
  const texts = candidates.map((hit) => normalize(hit.content));
  return candidates
    .filter((_, i) => texts.indexOf(texts[i]) === i)
    .slice(0, MAX_SECTIONS)
    .map(sectionRow);
}

interface Page {
  url: string;
  title: string;
}

/** Each page's label. Pages with the same title and label gain the first URL part where they differ. */
function pageLabels(pages: Page[]): string[][] {
  const labels = pages.map((page) => sectionLabel(page.url, page.title));
  const key = (i: number) => JSON.stringify([pages[i].title, labels[i]]);
  return labels.map((label, i) => {
    const twins = pages.filter((_, j) => key(j) === key(i)).map((page) => pathParts(page.url));
    if (twins.length < 2) return label;
    const shortest = Math.min(...twins.map((parts) => parts.length));
    const at = Array.from({ length: shortest }, (_, k) => k).find((k) => new Set(twins.map((p) => p[k])).size > 1);
    return at === undefined ? label : [...label, humanizeSlug(pathParts(pages[i].url)[at])];
  });
}

const sameLabel = (a: string[], b: string[]) => a.length === b.length && a.every((part, i) => part === b[i]);

/**
 * The dialog's rows: the first 12 pages, leaving out the explorer's Accounts
 * pages, each with up to 2 sections. A page row carries its label as
 * breadcrumbs when the label differs from the page row above, so a run of
 * results from one section shares one label.
 */
export function dialogRows(hits: AlgoliaHit[]): SortedResult[] {
  const listed = hits.filter((hit) => !ACCOUNTS_PAGE.test(hit.url));
  const pages = [...new Set(listed.map((hit) => hit.url))].slice(0, MAX_PAGES).map((url) => {
    const pageHits = listed.filter((hit) => hit.url === url);
    return { url, title: pageHits[0].title, sections: sectionRows(pageHits) };
  });
  const labels = pageLabels(pages);
  return pages.flatMap((page, i): SortedResult[] => [
    {
      id: page.url,
      type: 'page',
      url: page.url,
      content: page.title,
      breadcrumbs: i > 0 && sameLabel(labels[i], labels[i - 1]) ? undefined : labels[i],
    },
    ...page.sections,
  ]);
}
