import { readFileSync, readdirSync } from 'node:fs';
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { z } from 'zod';
import { desktopOnly, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';

// Data tests: the agent reads facts off a page, and plain code compares them with the known truth.
// Here the truth is the course content, so a new lesson in content/academy changes the expected list too.

const COURSE = 'avalanche-l1/avalanche-fundamentals';
const COURSE_DIR = new URL(`../../../content/academy/${COURSE}/`, import.meta.url);

interface CourseModule {
  name: string;
  lessons: number;
}

// The course meta.json lists "---Module name---" separators, each followed by "...folder" entries and pages.
// lib/academy/course-outline.ts builds the Modules list the same way: the index and certificate pages are not
// lessons, and a module without lessons ("Course Completion") is not listed.
function courseModules(): CourseModule[] {
  const meta = JSON.parse(readFileSync(new URL('meta.json', COURSE_DIR), 'utf8')) as { pages: string[] };
  const modules: CourseModule[] = [];
  for (const entry of meta.pages) {
    const separator = /^---(.+)---$/.exec(entry);
    if (separator) {
      modules.push({ name: separator[1].trim(), lessons: 0 });
      continue;
    }
    const current = modules.at(-1);
    if (!current || entry === 'index' || /certificate/.test(entry)) continue;
    current.lessons += entry.startsWith('...')
      ? readdirSync(new URL(`${entry.slice(3)}/`, COURSE_DIR)).filter((file) => file.endsWith('.mdx')).length
      : 1;
  }
  return modules.filter((courseModule) => courseModule.lessons > 0);
}

test('fundamentals course page lists the modules and lesson counts of the course content', async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await app.open(`/academy/${COURSE}`);
  await desktopOnly(browser, 'the facts are the same at both sizes');
  await waitForHydration(browser, '#nd-nav');
  await expect(screen.getByRole('heading', 'Modules', { level: 2 })).toBeVisible();
  const facts = await agent.extract(
    'From the "Modules" section of the course page (not the sidebar), read each module tile in order: its name and its number of lessons. ' +
      'Also read the module count and the lesson count that the course header states.',
    {
      schema: z.object({
        modules: z.array(z.object({ name: z.string(), lessons: z.number().int() })),
        headerModuleCount: z.number().int(),
        headerLessonCount: z.number().int(),
      }),
    },
  );
  const expected = courseModules();
  expect(facts).toEqual({
    modules: expected,
    headerModuleCount: expected.length,
    headerLessonCount: expected.reduce((sum, courseModule) => sum + courseModule.lessons, 0),
  });
});
