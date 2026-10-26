import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly } from '../lib/skip';
import { openAsReturningVisitor } from '../site/helpers';

// acad-credential-reveal (components/quizzes/certificate-credential.tsx, certificates.tsx): when a quiz passed on the
// certificate page completes the course, the credential prints in once, its top brought below the sticky header if
// the shorter page left it above. A page that opens on a finished course shows the credential at rest.
//
// The page needs no database: quiz answers live in the browser's IndexedDB (utils/quizzes/indexedDB.ts), so the test
// writes 13 of the course's 14 passes there and answers the last quiz on the page.

const PAGE = '/academy/avalanche-l1/avalanche-fundamentals/get-certificate';

/** Avalanche Fundamentals' quizzes (components/quizzes/data/courses/avalanche-fundamentals.json), all but 1204. */
const PASSED = ['101', '102', '103', '104', '105', '106', '107', '108', '309', '310', '1201', '1202', '1203'];
/** Quiz 1204 and its right answer. The options show in a shuffled order, so the test picks by text. */
const LAST_QUESTION = /What’s the P-Chain’s main purpose\?/;
const LAST_ANSWER = 'Have a registry of all validators in the Avalanche network';

/** Writes the passes, as the quiz saves them, in the store the page reads. */
function seedPasses(browser: Browser) {
  return browser.evaluate(
    (ids) =>
      new Promise<null>((resolve, reject) => {
        const request = indexedDB.open('QuizDatabase', 2);
        request.onupgradeneeded = () => {
          for (const store of ['quizResponses', 'flashcardProgress']) {
            if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const write = db.transaction('quizResponses', 'readwrite');
          for (const id of ids) {
            write.objectStore('quizResponses').put({ selectedAnswers: [], isAnswerChecked: true, isCorrect: true }, id);
          }
          write.oncomplete = () => {
            db.close();
            resolve(null);
          };
          write.onerror = () => reject(write.error);
        };
      }),
    PASSED,
  );
}

/**
 * Init script: every animation that starts on the credential card or inside it (the card holds the Generate button),
 * by name. It goes by place, not name: the reveal's fades are the site's shared vs-fade-in, so a replay of any part
 * of the reveal shows.
 */
function recordReveal(): void {
  const names: string[] = [];
  (window as unknown as { __e2eReveal: string[] }).__e2eReveal = names;
  document.addEventListener(
    'animationstart',
    (event) => {
      const generate = [...document.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('Generate My Certificate'),
      );
      const card = generate?.parentElement;
      if (card && event.target instanceof Node && card.contains(event.target)) names.push(event.animationName);
    },
    true,
  );
}

const revealRuns = (browser: Browser) =>
  browser.evaluate(() => (window as unknown as { __e2eReveal: string[] }).__e2eReveal);

/** The credential card's top (the card holds the Generate button), and the bottom of the bars fixed at the top. */
function cardPlace(browser: Browser) {
  return browser.evaluate(() => {
    const generate = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Generate My Certificate'),
    );
    const card = generate?.parentElement;
    const bars = [...document.querySelectorAll('body *')].filter((node) => {
      const position = getComputedStyle(node).position;
      if (position !== 'fixed' && position !== 'sticky') return false;
      const box = node.getBoundingClientRect();
      return box.top <= 1 && box.bottom > 0 && box.height < 200 && box.width > innerWidth / 2;
    });
    return {
      top: card ? Math.round(card.getBoundingClientRect().top) : null,
      headerBottom: Math.max(0, ...bars.map((bar) => Math.round(bar.getBoundingClientRect().bottom))),
      viewport: innerHeight,
    };
  });
}

test('the last quiz passed on the page reveals the credential below the header, once', async ({
  app,
  screen,
  browser,
}) => {
  await app.open('/small-logo.png');
  await desktopOnly(browser, 'the reveal is checked at the desktop size');
  await seedPasses(browser);
  await browser.addInitScript(recordReveal);
  await openAsReturningVisitor(app, browser, PAGE);
  const page = browser.locator('[data-certificate-page]');
  await expect(screen.getByText('13 of 14 quizzes completed.')).toBeVisible();
  await expect(page).toHaveAttribute('data-certificate', 'progress');

  await screen.getByRole('button', LAST_QUESTION).tap();
  await screen.getByText(LAST_ANSWER, { exact: true }).tap();
  await screen.getByRole('button', 'Check Answer', { disabled: false }).tap();

  await expect(page).toHaveAttribute('data-certificate', 'complete');
  await expect(screen.getByRole('button', 'Generate My Certificate')).toBeVisible();
  await expect.poll(() => revealRuns(browser)).toContain('acad-cred-print');
  const { top, headerBottom, viewport } = await cardPlace(browser);
  expect(headerBottom, 'the navbar is at the top of the screen').toBeGreaterThan(0);
  expect(top, 'the credential card').not.toBeNull();
  expect(top!, 'the card top, below the header').toBeGreaterThanOrEqual(headerBottom);
  expect(top!, 'the card top, on screen').toBeLessThan(viewport);

  // A later visit shows the credential at rest.
  await browser.reload();
  await expect(page).toHaveAttribute('data-certificate', 'complete');
  await expect(screen.getByRole('button', 'Generate My Certificate')).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  expect(await revealRuns(browser)).toEqual([]);
});
