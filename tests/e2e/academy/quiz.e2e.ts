import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Quiz 102 is the first of two quizzes on this lesson (components/quizzes/data/courses/avalanche-fundamentals.json).
// The quiz shuffles its options, so the tests find an option by its text.
const LESSON = '/academy/avalanche-l1/avalanche-fundamentals/02-avalanche-consensus-intro/02-consensus-mechanisms';
const QUESTION = 'What is the role of validators in the event of conflicting transactions?';
const RIGHT =
  'Validators collectively decide on which of the two conflicting transactions will be accepted by all validators and determine the next state.';
const WRONG = 'Validators choose the transaction that benefits them the most.';
const NEXT_QUESTION =
  'What is the initial step a validator takes when it first encounters a conflicting set of transactions in Avalanche Consensus?';

test('right quiz answer shows the explanation', async ({ app, screen }) => {
  await app.open(LESSON);
  await expect(screen.getByRole('heading', QUESTION)).toBeVisible();

  await screen.getByText(RIGHT).tap();
  // Only the answered quiz enables its Check Answer button.
  await screen.getByRole('button', 'Check Answer', { disabled: false }).tap();

  await expect(screen.getByText('Correct')).toBeVisible();
  await expect(screen.getByText(/^In the event of conflicting transactions, validators have to collectively decide/)).toBeVisible();
  await expect(screen.getByRole('button', 'Try Again')).toBeHidden();
});

test('wrong quiz answer shows a hint and Try Again asks a new question', async ({ app, screen }) => {
  await app.open(LESSON);
  await expect(screen.getByRole('heading', QUESTION)).toBeVisible();

  await screen.getByText(WRONG).tap();
  await screen.getByRole('button', 'Check Answer', { disabled: false }).tap();

  await expect(screen.getByText('Not Quite')).toBeVisible();
  await expect(screen.getByText(/Think about how validators resolve conflicts in a blockchain network/)).toBeVisible();
  await expect(screen.getByText('Attempt 1 of 3')).toBeVisible();

  await screen.getByRole('button', 'Try Again').tap();
  await expect(screen.getByRole('heading', NEXT_QUESTION)).toBeVisible();
  await expect(screen.getByText('Attempt 2 of 3')).toBeVisible();
});

test('quiz answers are radio buttons', async ({ app, screen }) => {
  await app.open(LESSON);
  await expect(screen.getByRole('heading', QUESTION)).toBeVisible();

  const answer = screen.getByRole('radio', RIGHT);
  await answer.focus();
  await expect(answer).toBeFocused();
  await answer.press('Space');
  await expect(answer).toBeChecked();

  // The options are one radio group: an arrow key moves the focus and the choice to another option.
  await answer.press('ArrowDown');
  await expect(answer).not.toBeChecked();
  await expect(screen.getByRole('radio', { checked: true })).toBeFocused();
});
