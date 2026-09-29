import type { Folder, Item, Node, Root, Separator } from 'fumadocs-core/page-tree';

export interface OutlineLesson { name: string; url: string }

export interface OutlineModule {
  name: string;      // the separator (or plain folder) name, as the sidebar shows it
  number: string;    // "01", "02", ... in sidebar order; Entrepreneur: the module folder prefix ("01", "01b", "02", ...)
  firstUrl: string;  // url of the module's first lesson
  lessons: OutlineLesson[];
}

export interface CourseOutline {
  track: string;     // "avalanche-l1" | "blockchain" | "entrepreneur" | "team1"
  slug: string;      // the course folder slug, e.g. "avalanche-fundamentals"
  name: string;      // the course folder title (meta.json "title")
  url: string;       // the course index url, "/academy/<track>/<slug>"
  modules: OutlineModule[];   // [] when the course has no separators (Team1)
  lessons: OutlineLesson[];   // every lesson in sidebar order; index page and certificate page excluded
  certificateUrl: string | null;
}

export interface CourseStats { modules: number; lessons: number }

/** 1-based position within the module, or within the course when module is null. */
export interface LessonPosition { module: OutlineModule | null; index: number; count: number }

/** A sidebar row that heads a module: a named separator, or a plain folder at the course root. */
export type ModuleHead = Separator | Folder;

interface Section { head: ModuleHead | null; name: string; pages: Item[] }
interface Walk { sections: Section[]; open: number }
interface BuiltCourse { outline: CourseOutline; heads: { head: ModuleHead; number: string }[] }

// Certificate pages are the course's get-certificate, certificate and certificate-<part> pages
// (18 files under content/academy, each rendering <CertificatePage>).
const CERTIFICATE_SLUG = /^(get-)?certificate(-[a-z0-9-]+)?$/;
// Entrepreneur module folders carry the programme's module number: 01-legal-foundations, 01b-security-fundamentals.
const FOLDER_NUMBER = /^(\d+)([a-z]?)-/;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const pad = (n: number): string => String(n).padStart(2, '0');
const isCertificateUrl = (url: string): boolean => CERTIFICATE_SLUG.test(url.slice(url.lastIndexOf('/') + 1));
const toLesson = (page: Item): OutlineLesson => ({ name: text(page.name), url: page.url });

function pagesOf(nodes: Node[]): Item[] {
  return nodes.flatMap((node) => {
    if (node.type === 'page') return [node];
    if (node.type === 'folder') return [...(node.index ? [node.index] : []), ...pagesOf(node.children)];
    return [];
  });
}

// A named separator opens a section; a nameless one ("---") is a spacer; a plain folder is a
// section of its own, after which the pages continue the section that was open.
function step(walk: Walk, node: Node): Walk {
  if (node.type === 'separator') {
    if (!text(node.name)) return walk;
    return { sections: [...walk.sections, { head: node, name: text(node.name), pages: [] }], open: walk.sections.length };
  }
  if (node.type === 'folder') {
    return { ...walk, sections: [...walk.sections, { head: node, name: text(node.name), pages: pagesOf([node]) }] };
  }
  return {
    ...walk,
    sections: walk.sections.map((section, i) => (i === walk.open ? { ...section, pages: [...section.pages, node] } : section)),
  };
}

function courseKey(pages: Item[]): { track: string; slug: string } | null {
  const [, base, track, slug] = pages[0]?.url.split('/') ?? [];
  return base === 'academy' && track && slug ? { track, slug } : null;
}

function moduleNumber(track: string, firstUrl: string, position: number): string {
  const match = track === 'entrepreneur' ? FOLDER_NUMBER.exec(firstUrl.split('/')[4] ?? '') : null;
  return match ? `${pad(Number(match[1]))}${match[2]}` : pad(position);
}

function buildCourse(course: Folder): BuiltCourse | null {
  const pages = pagesOf(course.children);
  const key = courseKey(pages);
  if (!key) return null;
  const url = `/academy/${key.track}/${key.slug}`;
  const isLesson = (page: Item): boolean => page.url !== url && !isCertificateUrl(page.url);
  const moduleSections = course.children
    .reduce(step, { sections: [{ head: null, name: '', pages: [] }], open: 0 })
    .sections.flatMap((section) => {
      const lessons = section.pages.filter(isLesson).map(toLesson);
      return section.head && lessons.length > 0 ? [{ head: section.head, name: section.name, lessons }] : [];
    });
  const modules = moduleSections.map((section, i) => ({
    name: section.name,
    number: moduleNumber(key.track, section.lessons[0].url, i + 1),
    firstUrl: section.lessons[0].url,
    lessons: section.lessons,
  }));
  return {
    outline: {
      ...key,
      name: text(course.name),
      url,
      modules,
      lessons: pages.filter(isLesson).map(toLesson),
      certificateUrl: pages.find((page) => isCertificateUrl(page.url))?.url ?? null,
    },
    heads: moduleSections.map((section, i) => ({ head: section.head, number: modules[i].number })),
  };
}

// Course folders are the root: true folders; a filtered tree (lib/page-tree-filter.ts) keeps
// other tracks' course folders as skeletons without pages, which yield no outline.
function courseFolders(nodes: Node[]): Folder[] {
  return nodes.flatMap((node) => {
    if (node.type !== 'folder') return [];
    return node.root ? [node] : courseFolders(node.children);
  });
}

export function getCourseOutlines(tree: Root): CourseOutline[] {
  return courseFolders(tree.children).flatMap((folder) => {
    const built = buildCourse(folder);
    return built ? [built.outline] : [];
  });
}

export function findCourseOutline(tree: Root, track: string, slug: string): CourseOutline | null {
  return getCourseOutlines(tree).find((outline) => outline.track === track && outline.slug === slug) ?? null;
}

export function getCourseStats(tree: Root, track: string): Record<string, CourseStats> {
  return Object.fromEntries(
    getCourseOutlines(tree)
      .filter((outline) => outline.track === track)
      .map((outline) => [outline.url, { modules: outline.modules.length, lessons: outline.lessons.length }]),
  );
}

export function lessonPosition(outline: CourseOutline, url: string): LessonPosition | null {
  const owner = outline.modules.find((courseModule) => courseModule.lessons.some((lesson) => lesson.url === url));
  if (owner) {
    return { module: owner, index: owner.lessons.findIndex((lesson) => lesson.url === url) + 1, count: owner.lessons.length };
  }
  const index = outline.lessons.findIndex((lesson) => lesson.url === url);
  return index === -1 ? null : { module: null, index: index + 1, count: outline.lessons.length };
}

/** The sidebar row that heads each module, with the module's number (used to number the sidebar). */
export function moduleHeads(course: Folder): { head: ModuleHead; number: string }[] {
  return buildCourse(course)?.heads ?? [];
}
