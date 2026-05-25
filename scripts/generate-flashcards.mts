#!/usr/bin/env tsx
/**
 * AI-powered flashcard coverage script.
 *
 * Walks one or more MDX sources under content/, calls Claude to produce
 * flashcards, dedupes them, and writes the resulting set into
 * components/flashcards/flashcardData.json so the existing in-app
 * <Flashcard flashcardSetId="..." /> component picks them up automatically.
 *
 * Usage:
 *   yarn generate:flashcards \
 *     --setId=blockchain-basics \
 *     --source=academy/blockchain/blockchain-fundamentals/02-what-is-a-blockchain \
 *     [--course=codebase-blockchain-academy] \
 *     [--course-title="Blockchain Academy"] \
 *     [--target-count=25] \
 *     [--audience="developers new to blockchain"] \
 *     [--dry-run]
 *
 *   --source can be a file (without .mdx) or a directory.
 *   --course is the LEGACY course-grouping key inside flashcardData.json
 *            (NOT the slug from content/courses.tsx).
 *   --dry-run prints what would be written without modifying disk.
 */
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { SourceAnchor, Flashcard } from '../lib/flashcards/types.ts';

// Runtime imports happen inside main() — tsx's ESM loader resolves named
// exports through dynamic `import()` reliably, while static named imports
// from local .ts files surface as `does not provide an export` at runtime.

const CONTENT_ROOT = path.join(process.cwd(), 'content');
const DATA_FILE = path.join(process.cwd(), 'components/flashcards/flashcardData.json');

interface CliArgs {
  setId: string;
  source: string;
  course?: string;
  courseTitle?: string;
  targetCount: number;
  audience?: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = {
    targetCount: 25,
    dryRun: false,
  };

  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const [keyRaw, ...valueParts] = raw.slice(2).split('=');
    const key = keyRaw.trim();
    const value = valueParts.join('=');
    switch (key) {
      case 'setId':
      case 'set-id':
        args.setId = value;
        break;
      case 'source':
        args.source = value;
        break;
      case 'course':
        args.course = value;
        break;
      case 'course-title':
        args.courseTitle = value;
        break;
      case 'target-count': {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 5 || n > 60) {
          throw new Error(`Invalid --target-count=${value} (must be between 5 and 60)`);
        }
        args.targetCount = n;
        break;
      }
      case 'audience':
        args.audience = value;
        break;
      case 'dry-run':
        args.dryRun = true;
        break;
      default:
        throw new Error(`Unknown flag --${key}`);
    }
  }

  if (!args.setId) throw new Error('--setId is required');
  if (!args.source) throw new Error('--source is required');

  return args as CliArgs;
}

async function listMdxFiles(target: string): Promise<string[]> {
  const abs = path.join(CONTENT_ROOT, target);
  const info = await stat(abs).catch(() => null);

  if (!info) {
    const withMdx = `${abs}.mdx`;
    const fileInfo = await stat(withMdx).catch(() => null);
    if (fileInfo?.isFile()) return [withMdx];
    throw new Error(`Source not found: ${target}`);
  }

  if (info.isFile()) {
    if (!abs.endsWith('.mdx')) {
      throw new Error(`Source is not an .mdx file: ${target}`);
    }
    return [abs];
  }

  const entries = await readdir(abs, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.mdx') && !entry.name.includes('flashcard')) {
      files.push(path.join(abs, entry.name));
    }
  }
  files.sort();
  return files;
}

function pathToAnchor(absPath: string): SourceAnchor {
  const rel = path.relative(CONTENT_ROOT, absPath).replace(/\\/g, '/');
  const withoutExt = rel.replace(/\.mdx$/, '');
  const segments = withoutExt.split('/');
  const root = segments[0];
  const kind: 'academy' | 'docs' = root === 'docs' ? 'docs' : 'academy';
  const url = `/${withoutExt}`;
  const chapterTitle = segments
    .at(-1)!
    .replace(/^\d+[-_]/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { kind, path: url, chapterTitle };
}

function cardsToLegacy(
  cards: Flashcard[],
  toLegacyItem: typeof import('../lib/flashcards/types.ts')['toLegacyItem'],
) {
  return cards.map((card) => toLegacyItem(card));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`📚 Generating flashcards for set "${args.setId}" from "${args.source}"`);

  const { generateDeck } = await import('../lib/flashcards/generate.ts');
  const { toLegacyItem } = await import('../lib/flashcards/types.ts');
  const { parseLegacyData } = await import('../lib/flashcards/legacy.ts');

  const files = await listMdxFiles(args.source);
  if (files.length === 0) {
    throw new Error(`No .mdx files found under ${args.source}`);
  }

  console.log(`   Sources (${files.length}):`);
  for (const f of files) console.log(`     - ${path.relative(process.cwd(), f)}`);

  const anchors = files.map(pathToAnchor);
  const deckTitle = `Avalanche Academy — ${anchors[0].chapterTitle}${anchors.length > 1 ? ' (and more)' : ''}`;

  const result = await generateDeck(anchors, {
    deckTitle,
    targetCardCount: args.targetCount,
    audience: args.audience,
  });

  console.log(`✅ Generated ${result.deck.cards.length} cards (dropped ${result.droppedDuplicateIds.length} duplicates from a starting ${result.deck.cards.length + result.droppedDuplicateIds.length}).`);
  console.log(`   Approx source tokens: ${result.totalSourceTokens}`);

  const legacyItems = cardsToLegacy(result.deck.cards, toLegacyItem);

  if (args.dryRun) {
    console.log('\n--- DRY RUN — would write ---');
    console.log(`flashcardSets["${args.setId}"] = ${legacyItems.length} items`);
    console.log(JSON.stringify(legacyItems.slice(0, 3), null, 2));
    if (legacyItems.length > 3) console.log(`... and ${legacyItems.length - 3} more`);
    return;
  }

  const raw = await readFile(DATA_FILE, 'utf8');
  const parsed = parseLegacyData(JSON.parse(raw));

  parsed.flashcardSets[args.setId] = legacyItems;

  if (args.course) {
    const courseEntry = parsed.courses[args.course] ?? {
      title: args.courseTitle ?? args.course,
      flashcardSets: [],
    };
    if (!courseEntry.flashcardSets.includes(args.setId)) {
      courseEntry.flashcardSets.push(args.setId);
    }
    if (args.courseTitle) courseEntry.title = args.courseTitle;
    parsed.courses[args.course] = courseEntry;
  }

  const next = JSON.stringify(parsed, null, 4);
  await writeFile(DATA_FILE, `${next}\n`, 'utf8');

  console.log(`📝 Wrote ${legacyItems.length} cards to ${path.relative(process.cwd(), DATA_FILE)} under set "${args.setId}".`);
  console.log(`💡 Add a chapter MDX with: <Flashcard flashcardSetId="${args.setId}" />`);
  console.log(`💡 Anki download URL: /api/flashcards/download/${args.setId}`);
}

main().catch((err) => {
  console.error('❌ Generation failed:', err);
  process.exit(1);
});
