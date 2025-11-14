# Automated QA Testing with Core Wallet

This directory contains automated end-to-end tests using Playwright with the Core Wallet extension preinstalled.

## Setup

1. Install dependencies:
```bash
yarn install
```

2. Install Playwright browsers (first time only):
```bash
yarn playwright install chromium
```

3. Configure your wallet (in project root `.env`):
```bash
# NEVER use a wallet with real funds for testing!
CORE_WALLET_MNEMONIC="your twelve or twenty four word recovery phrase goes here"
CORE_WALLET_PASSWORD="TestPassword123!"
```

See `tests/.env.example` for the template.

## Running Tests

### Run all tests (headless):
```bash
yarn test
```

### Run tests with visible browser:
```bash
yarn test:headed
```

### Run tests with Playwright UI (interactive):
```bash
yarn test:ui
```

### Debug tests step-by-step:
```bash
yarn test:debug
```

## Core Wallet Setup

The Core Wallet extension is automatically downloaded and configured the first time you run the tests. The extension files are cached in `tests/extensions/core-wallet/` and will be reused for subsequent test runs.

### How it works:

1. **Automatic Download**: The setup script downloads Core Wallet from the Chrome Web Store
2. **Extension Loading**: Playwright launches Chrome with the extension pre-installed
3. **Persistent Context**: Tests run with the extension active

## Test Structure

```
tests/
├── setup/
│   └── core-wallet.setup.ts  # Extension download and setup utilities
├── core-wallet.spec.ts        # Example test file
└── README.md                  # This file
```

## Writing Tests

Example test with Core Wallet:

```typescript
import { test, expect } from '@playwright/test';
import { createBrowserWithCoreWallet } from './setup/core-wallet.setup';

test('my test', async () => {
  const context = await createBrowserWithCoreWallet();
  const page = await context.newPage();
  
  // Your test code here
  await page.goto('https://your-app.com');
  
  // Core Wallet is now available in the browser
  
  await context.close();
});
```

## GitHub Actions

To run tests in CI/CD, add this workflow configuration (the extension will be automatically downloaded in CI):

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: yarn install
      - run: yarn playwright install --with-deps chromium
      - run: yarn test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Troubleshooting

### Extension not loading
- Make sure you're running in headed mode for debugging: `yarn test:headed`
- Check that the extension directory exists: `tests/extensions/core-wallet/`
- Delete the extensions folder and re-run to force a fresh download

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Extensions may take longer to initialize, add `await page.waitForTimeout(5000)` after opening pages

### Can't find Core Wallet in window
- The extension may inject different global variables depending on the page
- Check browser console for what's actually injected
- Some extensions only inject on specific domains

## Notes

- Tests run with `headless: false` by default because Chrome extensions require a visible browser window
- The Core Wallet extension files are gitignored and will be downloaded automatically
- Each test gets a fresh browser context with the extension pre-loaded

