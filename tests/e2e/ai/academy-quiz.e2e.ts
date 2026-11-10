import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';

// The lesson of academy/quiz.e2e.ts. Its first quiz asks about validators and conflicting transactions.
const LESSON = '/academy/avalanche-l1/avalanche-fundamentals/02-avalanche-consensus-intro/02-consensus-mechanisms';

// The agent decides which option is wrong, as a learner would. The quiz shuffles its options,
// so the replay cache finds the chosen option by its text, not by its place.
test('quiz tells a learner who picks a wrong answer that it is wrong', async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await app.open(LESSON);
  await desktopOnly(browser, 'academy/quiz.e2e.ts tests the quiz at both sizes');
  await waitForHydration(browser, '#nd-nav');
  await agent.act('answer the first quiz question on this page with a wrong option, then check the answer');
  // A wrong answer offers another attempt. A right one does not.
  await expect(screen.getByRole('button', 'Try Again')).toBeVisible();
  await agent.assert('the quiz tells the learner that the chosen answer is wrong');
});
