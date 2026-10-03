import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { Browser } from '@e2e-dev/web';
import { expect, type Locator, type Screen } from 'e2e';
import { isPhoneLayout } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';

// The course sidebar (app/academy/layout-wrapper.client.tsx) lists one course: its name, then its numbered modules.
// The truth is the course's meta.json in content/academy, so a renamed course or module changes the expected text.
const ACADEMY = new URL('../../../content/academy/', import.meta.url);

// The track folders at the top of the full Academy tree. After a client move between tracks the sidebar showed
// them in place of the course: every track tree had the same fumadocs $id, so the sidebar kept the old track's tree.
export const TRACK_FOLDERS = ['Avalanche l1', 'Blockchain', 'Team1 Academy'];

// RGI_Emoji also covers keycaps and flags, and leaves out text symbols such as the trademark sign.
const PICTOGRAPH = new RegExp('\\p{RGI_Emoji}', 'v');

export interface SidebarCourse {
  /** The course page, for example /academy/blockchain/solidity-foundry. */
  path: string;
  /** The title in the course's meta.json. The desktop sidebar shows it above the lessons. */
  title: string;
  /** The module headings in order, as the sidebar numbers them 01, 02, ... */
  modules: string[];
}

// lib/academy/course-outline.ts CERTIFICATE_SLUG: certificate pages are not lessons.
const CERTIFICATE = /^(get-)?certificate(-[a-z0-9-]+)?$/;

/** The lesson pages under a folder: every MDX file except certificates. A folder's index page is a lesson. */
function lessonsUnder(dir: URL): number {
  return readdirSync(dir, { withFileTypes: true }).reduce((count, entry) => {
    if (entry.isDirectory()) return count + lessonsUnder(new URL(`${entry.name}/`, dir));
    return count + (entry.name.endsWith('.mdx') && !CERTIFICATE.test(entry.name.slice(0, -4)) ? 1 : 0);
  }, 0);
}

/** A folder's sidebar name: its meta.json title, or fumadocs' name from the folder name. */
function folderName(dir: URL, slug: string): string {
  const meta = new URL('meta.json', dir);
  if (existsSync(meta)) {
    const title = (JSON.parse(readFileSync(meta, 'utf8')) as { title?: string }).title;
    if (title) return title;
  }
  const words = slug.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// The modules as lib/academy/course-outline.ts (step) numbers them. A "---Name---" separator opens a module and the
// pages after it join that module; "...folder" adds the folder's pages there. A folder listed by name is a module of
// its own. The index page and certificates are not lessons, and a module with no lesson gets no number: a separator
// right before another one (the tier heading FUNDAMENTALS) or Course Completion (certificate pages only).
function moduleNames(pages: string[], dir: URL): string[] {
  const modules: { name: string; lessons: number }[] = [];
  let open = -1;
  for (const entry of pages) {
    const separator = /^---(.+)---$/.exec(entry);
    if (separator) {
      open = modules.push({ name: separator[1].trim(), lessons: 0 }) - 1;
      continue;
    }
    if (entry === '---' || entry === 'index' || CERTIFICATE.test(entry)) continue;
    if (entry.startsWith('...')) {
      if (open >= 0) modules[open].lessons += lessonsUnder(new URL(`${entry.slice(3)}/`, dir));
      continue;
    }
    const folder = new URL(`${entry}/`, dir);
    if (existsSync(folder)) {
      modules.push({ name: folderName(folder, entry), lessons: lessonsUnder(folder) });
      continue;
    }
    if (open >= 0) modules[open].lessons += 1;
  }
  return modules.filter((courseModule) => courseModule.lessons > 0).map((courseModule) => courseModule.name);
}

/** Every course of the Avalanche L1 and Blockchain tracks: each folder whose meta.json is a sidebar root. */
export function sidebarCourses(): SidebarCourse[] {
  const courses: SidebarCourse[] = [];
  for (const track of ['avalanche-l1', 'blockchain']) {
    const folders = readdirSync(new URL(`${track}/`, ACADEMY), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const folder of folders) {
      const meta = JSON.parse(readFileSync(new URL(`${track}/${folder}/meta.json`, ACADEMY), 'utf8')) as {
        title: string;
        root?: boolean;
        pages: string[];
      };
      if (!meta.root) continue;
      const dir = new URL(`${track}/${folder}/`, ACADEMY);
      courses.push({ path: `/academy/${track}/${folder}`, title: meta.title, modules: moduleNames(meta.pages, dir) });
    }
  }
  return courses;
}

export function sidebarCourse(path: string): SidebarCourse {
  const course = sidebarCourses().find((candidate) => candidate.path === path);
  if (!course) throw new Error(`no course at ${path} in content/academy`);
  return course;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The numbered module heading, for example "01 Primer on Avalanche Consensus". The number is its own element. */
export const moduleHeading = (number: number, name: string) =>
  new RegExp(`^${String(number).padStart(2, '0')}\\s*${escape(name)}$`);

// Desktop: the sidebar is in view. Phone: it is a drawer that the top bar opens. An agent step can leave it open,
// and then the open drawer covers the toggle.
export async function openSidebar(screen: Screen, browser: Browser): Promise<Locator> {
  const sidebar = screen.getByRole('complementary');
  if ((await isPhoneLayout(browser)) && !(await sidebar.isVisible())) {
    await waitForHydration(browser, '#nd-nav');
    await screen.getByRole('button', 'Toggle academy sidebar').tap();
  }
  return sidebar;
}

/** The sidebar lists this course: its name (desktop), its first module, no track folders and no emoji. */
export async function expectSidebarOf(sidebar: Locator, browser: Browser, course: SidebarCourse): Promise<void> {
  // The phone drawer names the course in its course menu button instead (lesson-navigation.e2e.ts checks it).
  // components/academy/sidebar/course-sidebar-heading.tsx marks the heading. A tier heading can share its text (ERC20 Bridge).
  if (!(await isPhoneLayout(browser))) {
    await expect(browser.locator('[data-academy-part="course-heading"]')).toHaveText(course.title);
  }
  await expect(sidebar.getByText(moduleHeading(1, course.modules[0]))).toBeVisible();
  for (const folder of TRACK_FOLDERS) await expect(sidebar.getByText(folder)).toHaveCount(0);
  const text = (await sidebar.textContent()) ?? '';
  expect(text.match(PICTOGRAPH), `emoji in the sidebar of ${course.path}`).toBeNull();
}

// A part link or a course card is a client move only after hydration. Before it, the browser loads the new page
// in full, and a full load always builds the sidebar from the right tree. markPage and expectSamePage prove that the
// move under test was a client move: a full load clears the mark.
export async function markPage(browser: Browser): Promise<void> {
  await waitForHydration(browser, '#academy-subnav');
  await browser.evaluate(() => {
    (window as unknown as { __e2eSamePage?: boolean }).__e2eSamePage = true;
    return null;
  });
}

export async function expectSamePage(browser: Browser): Promise<void> {
  const same = await browser.evaluate(() => (window as unknown as { __e2eSamePage?: boolean }).__e2eSamePage === true);
  expect(same, 'the move loaded a new page; it was not a client move').toBe(true);
}
