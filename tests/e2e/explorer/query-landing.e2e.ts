import { test, type Browser, type WebRoute } from '@e2e-dev/web';
import { expect, type App } from 'e2e';
import { answerFirstVisitPrompts } from '../lib/visitor';
import { DATA, MULTI_PAGE } from './explorer-page';

// Rule: the Query page before a question leads with its suggested questions. A scan keeps, for each one, the
// headline figure of its answer and the finding that stands out most (app/api/explorer/query/scan). A card shows
// the figure, the three strongest findings stand over the cards as doors to their questions, and topic buttons
// filter the cards. The page never waits on the scan: with nothing kept, each card still shows its question.
//
// The scan route answers from a fixture, so no database runs.

const PATH = '/explorer/mainnet/c-chain/query';
const METHODS = 'Most called methods';
const FEES = 'Fees burned per 5 minutes';
const FINDING = '0x9bad26a6 reverted on 95% of its 8,646 calls.';

const CARDS = {
  [METHODS]: { figure: '26.5k', label: 'Top method calls', spark: [1, 0.6, 0.4, 0.2], shape: 'ranking', finding: { tag: 'Failures', text: FINDING, tone: 'bad', score: 0.76 } },
  [FEES]: { figure: '803.4 AVAX', label: 'Fees burned', spark: [0.2, 0.9, 0.4, 1, 0.5, 0.3], shape: 'series', finding: null },
};

/** answers the scan read with these cards, and records each question the page asks; no question is answered */
async function landing(app: App, browser: Browser, cards: object | null): Promise<{ asked: string[] }> {
  const seen = { asked: [] as string[] };
  await app.open(PATH);
  await answerFirstVisitPrompts(browser);
  await browser.route(/\/api\/explorer\/query\/scan/, (route: WebRoute) => route.fulfill({ json: cards ? { at: Date.now() - 4 * 60_000, cards: cards as Record<string, never> } : { at: null, cards: {} } }));
  await browser.route(/\/api\/explorer\/query$/, async (route: WebRoute) => {
    const body = JSON.parse(route.request.postData ?? '{}') as { prompt?: string };
    if (body.prompt) seen.asked.push(body.prompt);
    await route.fulfill({ status: 400, json: { error: 'no fixture for this call' } });
  });
  await app.open(PATH);
  return seen;
}

test('the landing page shows what a scan read of each suggestion, and leads with what stands out', MULTI_PAGE, async ({ app, screen, browser }) => {
  const seen = await landing(app, browser, CARDS);

  // a card leads with the figure of its answer
  const methods = screen.getByRole('button', new RegExp(`${METHODS}`));
  await expect(methods.getByText('26.5k')).toBeVisible(DATA);
  await expect(screen.getByRole('button', new RegExp(FEES)).getByText('803.4 AVAX')).toBeVisible();

  // topic buttons filter the cards
  const topics = screen.getByRole('group', 'Topic');
  await topics.getByRole('button', 'Contracts').click();
  await expect(screen.getByRole('button', new RegExp(FEES))).toHaveCount(0);
  await expect(screen.getByRole('button', new RegExp(`${METHODS}`)).getByText('26.5k')).toBeVisible();
  await topics.getByRole('button', 'All').click();
  await expect(screen.getByRole('button', new RegExp(FEES)).getByText('803.4 AVAX')).toBeVisible();

  // the strongest finding stands over the cards, and opens its question
  const looks = screen.getByRole('region', 'Worth a look now');
  await expect(looks.getByText(FINDING)).toBeVisible();
  await looks.getByRole('button', new RegExp(METHODS)).click();
  await expect.poll(() => seen.asked, DATA).toEqual([METHODS]);
});

test('with nothing kept by a scan, each card still shows its question', MULTI_PAGE, async ({ app, screen, browser }) => {
  await landing(app, browser, null);
  await expect(screen.getByRole('button', new RegExp(`${METHODS}`))).toBeVisible(DATA);
  await expect(screen.getByRole('group', 'Topic').getByRole('button', 'All')).toHaveAttribute('aria-pressed', 'true');
  await expect(screen.getByRole('region', 'Worth a look now')).toHaveCount(0);
  await expect(screen.getByText('26.5k')).toHaveCount(0);
});
