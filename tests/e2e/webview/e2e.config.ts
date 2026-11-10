import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import base, { PHONE_VIEWPORT, app, headers } from '../e2e.config';

// The login form warns a visitor in an in-app browser that Google and GitHub refuse to sign in there
// (components/login/EmbeddedBrowserWarning.tsx). The page reads the user agent, and the engine sets the user agent
// per target only. So these tests have their own targets: an iPhone in each app, with the app's own user agent.
const IN_APP_BROWSERS = [
  {
    name: 'instagram',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 Instagram 350.0.0.25.104 (iPhone15,2; iOS 18_0; en_US; en; scale=3.00; 1179x2556; 646463178)',
  },
  {
    name: 'linkedin',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 [LinkedInApp]/9.30.2341',
  },
];

export default {
  ...base,
  tests: ['**/*.e2e.ts'],
  targets: IN_APP_BROWSERS.map(({ name, userAgent }) => ({
    name,
    engine: web({ viewport: PHONE_VIEWPORT, userAgent, headers }),
    app,
  })),
} satisfies E2EConfig;
