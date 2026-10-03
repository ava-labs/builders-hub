import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';

// An agent test takes its fixtures as one object and reads them after needsModel().
// A fixture named in the parameter list is set up before the first line runs. Without a key,
// setting up `agent` stops the whole run (MODEL_UNAVAILABLE), so needsModel() could not skip the test.
test('agent opens the Interchain Messaging course from the Academy', async (fixtures) => {
  needsModel();
  const { app, agent, browser } = fixtures;
  await app.open('/academy');
  await waitForHydration(browser, '#nd-nav');
  await agent.act('open the Interchain Messaging course');
  await expect(browser).toHaveURL(/\/academy\/.*interchain-messaging/);
});
