import { test, expect, type BrowserContext } from '@playwright/test';
import { createBrowserWithCoreWallet } from './setup/core-wallet.setup';
import { importWalletWithMnemonic } from './setup/wallet-import.setup';

test.describe('Core Wallet Setup', () => {
  let context: BrowserContext;
  
  // Setup wallet ONCE before all tests
  test.beforeAll(async () => {
    console.log('\n🔧 Setting up Core Wallet for all tests...\n');
    context = await createBrowserWithCoreWallet();
    await importWalletWithMnemonic(context);
    console.log('\n✅ Core Wallet setup complete!\n');
  });
  
  // Close browser after all tests
  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });
  
  test('should have wallet imported successfully', async () => {
    // Get the wallet page
    const pages = context.pages();
    console.log(`Open pages: ${pages.length}`);
    
    const walletPage = pages[pages.length - 1]; // Get the last page (wallet page)
    
    // Take a screenshot to verify wallet is imported
    await walletPage.screenshot({ path: 'tests/screenshots/wallet-imported.png', fullPage: true });
    console.log('✓ Wallet screenshot saved');
    
    // Keep browser open for inspection
    await walletPage.waitForTimeout(5000);
  });
  
  test('should connect wallet on localhost console', async () => {
    // Create a new page and go to console
    const page = await context.newPage();
    console.log('Opening localhost:3000/console...');
    await page.goto('http://localhost:3000/console');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/console-loaded.png', fullPage: true });
    
    // Click "Connect Wallet" button
    console.log('Looking for Connect Wallet button...');
    const connectButton = page.getByRole('button', { name: /Connect Wallet/i });
    
    if (await connectButton.isVisible({ timeout: 5000 })) {
      console.log('✓ Found Connect Wallet button');
      await connectButton.click();
      console.log('✓ Clicked Connect Wallet');
      
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'tests/screenshots/wallet-connect-clicked.png', fullPage: true });
    } else {
      console.log('Connect Wallet button not found');
    }
    
    // Check if window.avalanche is available
    const hasAvalanche = await page.evaluate(() => {
      return typeof (window as any).avalanche !== 'undefined';
    });
    
    console.log(`Avalanche provider available: ${hasAvalanche}`);
    
    expect(hasAvalanche).toBe(true);
  });
});

