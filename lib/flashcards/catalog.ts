/**
 * Server-only academy catalog walker for the Flashcard Studio picker.
 *
 * Reads content/academy/ and emits a flat tree of categories -> courses -> chapters.
 * Chapter titles come from each MDX's frontmatter. Course titles come from each
 * course's meta.json. The result is cached in module scope (re-read on dev restart).
 *
 * NOT a fumadocs-tree consumer on purpose — fumadocs' pageTree shape mutates between
 * releases and the picker UI only needs (path, title) tuples grouped by course.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const ACADEMY_ROOT = path.join(process.cwd(), 'content', 'academy');

export interface ChapterItem {
  /** URL path used by SourceAnchor.path */
  path: string;
  /** Human-readable chapter title (frontmatter > filename heuristic) */
  title: string;
  /** Absolute file path (debug only — not exposed to client) */
  filePath: string;
}

export interface CourseItem {
  slug: string;
  title: string;
  icon?: string;
  chapters: ChapterItem[];
}

export interface CategoryItem {
  slug: string;
  title: string;
  courses: CourseItem[];
}

let cached: CategoryItem[] | null = null;

const CATEGORY_TITLES: Record<string, string> = {
  'avalanche-l1': 'Avalanche L1 Academy',
  blockchain: 'Blockchain Academy',
  entrepreneur: 'Entrepreneur Academy',
};

const SKIP_FILE_PATTERNS = [
  /flashcards?\.mdx$/i,
  /quiz\.mdx$/i,
  /^index\.mdx$/i,
  /get-certificate\.mdx$/i,
];

function shouldSkipFile(filename: string): boolean {
  return SKIP_FILE_PATTERNS.some((re) => re.test(filename));
}

function humanizeFilename(filename: string): string {
  return filename
    .replace(/\.mdx$/, '')
    .replace(/^\d+[-_]/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function readMdxTitle(absFile: string, fallback: string): Promise<string> {
  try {
    const raw = await readFile(absFile, 'utf8');
    const parsed = matter(raw);
    const title = parsed.data?.title;
    if (typeof title === 'string' && title.length > 0) return title;
  } catch {
    // fall through
  }
  return fallback;
}

async function walkChaptersIn(dir: string, relUrl: string): Promise<ChapterItem[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const chapters: ChapterItem[] = [];

  // Files first (sorted)
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.mdx') && !shouldSkipFile(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const file of files) {
    const abs = path.join(dir, file.name);
    const fallback = humanizeFilename(file.name);
    const title = await readMdxTitle(abs, fallback);
    chapters.push({
      path: `${relUrl}/${file.name.replace(/\.mdx$/, '')}`,
      title,
      filePath: abs,
    });
  }

  // Recurse into subdirectories
  const subdirs = entries
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const sub of subdirs) {
    const subAbs = path.join(dir, sub.name);
    const subUrl = `${relUrl}/${sub.name}`;
    const subChapters = await walkChaptersIn(subAbs, subUrl);
    chapters.push(...subChapters);
  }

  return chapters;
}

async function readCourseMeta(courseDir: string): Promise<{ title: string; icon?: string }> {
  const metaPath = path.join(courseDir, 'meta.json');
  try {
    const raw = await readFile(metaPath, 'utf8');
    const meta = JSON.parse(raw) as { title?: string; icon?: string };
    return { title: meta.title ?? path.basename(courseDir), icon: meta.icon };
  } catch {
    return { title: humanizeFilename(path.basename(courseDir)) };
  }
}

async function readCategoryCourses(categorySlug: string): Promise<CourseItem[]> {
  const catDir = path.join(ACADEMY_ROOT, categorySlug);
  const entries = await readdir(catDir, { withFileTypes: true });

  const courseDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const courses: CourseItem[] = [];
  for (const slug of courseDirs) {
    const courseDir = path.join(catDir, slug);
    const meta = await readCourseMeta(courseDir);
    const baseUrl = `/academy/${categorySlug}/${slug}`;
    const chapters = await walkChaptersIn(courseDir, baseUrl);
    if (chapters.length === 0) continue;
    courses.push({ slug, title: meta.title, icon: meta.icon, chapters });
  }
  return courses;
}

export async function getAcademyCatalog(): Promise<CategoryItem[]> {
  if (cached) return cached;

  const topMetaPath = path.join(ACADEMY_ROOT, 'meta.json');
  let categorySlugs: string[];
  try {
    const raw = await readFile(topMetaPath, 'utf8');
    const meta = JSON.parse(raw) as { pages?: string[] };
    categorySlugs = meta.pages ?? Object.keys(CATEGORY_TITLES);
  } catch {
    categorySlugs = Object.keys(CATEGORY_TITLES);
  }

  const categories: CategoryItem[] = [];
  for (const slug of categorySlugs) {
    const title = CATEGORY_TITLES[slug] ?? humanizeFilename(slug);
    const courses = await readCategoryCourses(slug);
    if (courses.length === 0) continue;
    categories.push({ slug, title, courses });
  }

  cached = categories;
  return categories;
}
