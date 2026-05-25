#!/usr/bin/env tsx
/**
 * Batch flashcard pre-bake script.
 *
 * Iterates every Avalanche Academy course in the catalog and generates one
 * standard flashcard deck per course via Claude. Writes results into
 * `components/flashcards/flashcardData.json` keyed by the course slug.
 *
 * MAINTAINER-RUN ONLY. Hits Anthropic + OpenAI quotas. Roughly $0.05–0.10
 * per course (varies with source length). Estimate ~$1–3 total for the full
 * academy backfill.
 *
 * Usage:
 *   yarn generate:flashcards:batch [--dry-run]
 *                                   [--course=<slug>]   one course only
 *                                   [--include-existing] re-generate even
 *                                                       courses that already
 *                                                       have a set
 *                                   [--target-count=N]  default 40
 *
 * The script writes progressively — if one course fails the others still land.
 * Inspect the diff (`git diff components/flashcards/flashcardData.json`)
 * before committing.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { CourseItem } from '../lib/flashcards/catalog.ts';
import type { SourceAnchor } from '../lib/flashcards/types.ts';

// Runtime imports happen inside main() — tsx's ESM loader resolves named
// exports through dynamic `import()` reliably, while static named imports
// from local .ts files surface as `does not provide an export` at runtime.
type LegacyData = Awaited<ReturnType<typeof import('../lib/flashcards/legacy.ts')['parseLegacyData']>>;

const DATA_FILE = path.join(process.cwd(), 'components/flashcards/flashcardData.json');

interface CliArgs {
  dryRun: boolean;
  course?: string;
  targetCount: number;
  includeExisting: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    targetCount: 40,
    includeExisting: false,
  };
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const [keyRaw, ...valueParts] = raw.slice(2).split('=');
    const key = keyRaw.trim();
    const value = valueParts.join('=');
    switch (key) {
      case 'dry-run':
        args.dryRun = true;
        break;
      case 'course':
        args.course = value;
        break;
      case 'target-count': {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 5 || n > 60) {
          throw new Error(`Invalid --target-count=${value} (must be 5–60)`);
        }
        args.targetCount = n;
        break;
      }
      case 'include-existing':
        args.includeExisting = true;
        break;
      default:
        throw new Error(`Unknown flag --${key}`);
    }
  }
  return args;
}

interface CourseTarget {
  course: CourseItem;
  categorySlug: string;
  categoryTitle: string;
}

async function loadData(parseLegacyData: typeof import('../lib/flashcards/legacy.ts')['parseLegacyData']): Promise<LegacyData> {
  const raw = await readFile(DATA_FILE, 'utf8');
  return parseLegacyData(JSON.parse(raw));
}

async function saveData(data: LegacyData): Promise<void> {
  await writeFile(DATA_FILE, `${JSON.stringify(data, null, 4)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log('🃏 Batch flashcard generator');
  console.log(`   target cards: ${args.targetCount} per deck`);
  if (args.dryRun) console.log('   DRY RUN — no writes');

  const { getAcademyCatalog } = await import('../lib/flashcards/catalog.ts');
  const { generateDeck } = await import('../lib/flashcards/generate.ts');
  const { toLegacyItem } = await import('../lib/flashcards/types.ts');
  const { parseLegacyData } = await import('../lib/flashcards/legacy.ts');

  const catalog = await getAcademyCatalog();
  const data = await loadData(parseLegacyData);
  const existingSetIds = new Set(Object.keys(data.flashcardSets));

  const targets: CourseTarget[] = catalog.flatMap((cat) =>
    cat.courses.map((course) => ({
      course,
      categorySlug: cat.slug,
      categoryTitle: cat.title,
    })),
  );

  const todo = targets.filter(({ course }) => {
    if (args.course && course.slug !== args.course) return false;
    if (!args.includeExisting && existingSetIds.has(course.slug)) return false;
    return true;
  });

  console.log(`   ${todo.length} of ${targets.length} courses queued for generation\n`);
  if (todo.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (args.dryRun) {
    for (const { course, categorySlug } of todo) {
      console.log(`  - [${categorySlug}] ${course.slug}: ${course.chapters.length} chapters`);
    }
    return;
  }

  let successCount = 0;
  let failCount = 0;
  for (const { course, categorySlug, categoryTitle } of todo) {
    const sources: SourceAnchor[] = course.chapters.map((ch) => ({
      kind: 'academy',
      path: ch.path,
      chapterTitle: ch.title,
    }));

    process.stdout.write(`  ${course.slug} (${sources.length} chapters)... `);
    try {
      const result = await generateDeck(sources, {
        deckTitle: `Avalanche Academy — ${course.title}`,
        targetCardCount: args.targetCount,
      });

      data.flashcardSets[course.slug] = result.deck.cards.map(toLegacyItem);

      const groupKey = `academy-${categorySlug}`;
      if (!data.courses[groupKey]) {
        data.courses[groupKey] = { title: categoryTitle, flashcardSets: [] };
      }
      if (!data.courses[groupKey].flashcardSets.includes(course.slug)) {
        data.courses[groupKey].flashcardSets.push(course.slug);
      }

      // Save after each successful generation so a later crash doesn't lose work.
      await saveData(data);

      console.log(`✓ ${result.deck.cards.length} cards (${result.droppedDuplicateIds.length} dedup'd)`);
      successCount += 1;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`✗ ${msg}`);
      failCount += 1;
    }
  }

  console.log(`\nDone. ${successCount} succeeded, ${failCount} failed.`);
  console.log(`Inspect: git diff ${path.relative(process.cwd(), DATA_FILE)}`);
}

main().catch((err) => {
  console.error('❌ Batch failed:', err);
  process.exit(1);
});
