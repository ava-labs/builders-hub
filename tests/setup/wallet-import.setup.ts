import { type Page, type BrowserContext } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const WALLET_PASSWORD = process.env.CORE_WALLET_PASSWORD || 'TestPassword123!';
const WALLET_MNEMONIC = process.env.CORE_WALLET_MNEMONIC;

if (!WALLET_MNEMONIC) {
  throw new Error('CORE_WALLET_MNEMONIC environment variable is required');
}

/**
 * Gets the actual extension ID from the loaded extension
 */
async function getExtensionId(context: BrowserContext): Promise<string | null> {
  // Navigate to chrome://extensions to find the actual extension ID
  const page = await context.newPage();
  
  try {
    // We can't directly access chrome:// pages, so we'll check service workers
    // or look for extension pages that might have auto-opened
    const pages = context.pages();
    for (const p of pages) {
      const url = p.url();
      if (url.startsWith('chrome-extension://')) {
        // Extract the extension ID from the URL
        const match = url.match(/chrome-extension:\/\/([a-z]+)\//);
        if (match) {
          await page.close();
          return match[1];
        }
      }
    }
    
    // If no pages found, try opening a common extension path
    // and see if the extension redirects or opens
    await page.goto('chrome://extensions/', { waitUntil: 'domcontentloaded', timeout: 3000 }).catch(() => {});
    
    await page.close();
    return null;
  } catch (error) {
    await page.close();
    return null;
  }
}

/**
 * Imports a wallet into Core Wallet using a mnemonic phrase
 */
export async function importWalletWithMnemonic(
  context: BrowserContext,
  mnemonic: string = WALLET_MNEMONIC!,
  password: string = WALLET_PASSWORD
): Promise<void> {
  console.log('Starting wallet import process...');
  
  // Extension ID (detected from service worker)
  const extensionId = 'agoakfejjabomempkjlepdflaleeobhb';
  
  // Wait for Core Wallet to auto-open its page
  console.log('Waiting for Core Wallet to open...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Find the Core Wallet page that was auto-opened
  let pages = context.pages();
  let walletPage = pages.find(p => p.url().includes(extensionId));
  
  if (!walletPage) {
    console.log('Core Wallet did not auto-open, opening manually...');
    walletPage = await context.newPage();
    await walletPage.goto(`chrome-extension://${extensionId}/home.html`, {
      waitUntil: 'load',
      timeout: 10000
    });
    await walletPage.waitForTimeout(2000);
  } else {
    console.log(`✓ Found auto-opened Core Wallet page: ${walletPage.url()}`);
    await walletPage.bringToFront();
  }
  
  // Close ALL other tabs except the wallet page
  pages = context.pages();
  for (const page of pages) {
    if (page !== walletPage) {
      await page.close();
      console.log(`✓ Closed extra tab: ${page.url()}`);
    }
  }
  
  console.log(`Active tabs: ${context.pages().length}`);
  
  // Take initial screenshot
  await walletPage.screenshot({ path: 'tests/screenshots/01-onboarding.png', fullPage: true });
  console.log('✓ Screenshot: 01-onboarding.png');
  
  // Override window.open to prevent new tabs throughout the process
  await walletPage.evaluate(() => {
    // Override window.open to navigate in same tab instead
    window.open = (url?: any) => {
      if (typeof url === 'string') {
        window.location.href = url;
      }
      return null;
    };
    
    // Also override window.focus to prevent focusing other tabs
    window.focus = () => {};
  });
  console.log('✓ Intercepted window.open to prevent new tabs');
  
  // Listen for new pages and close them immediately
  context.on('page', async (page) => {
    if (page !== walletPage) {
      console.log(`✗ New tab detected: ${page.url()} - closing it`);
      await page.close();
    }
  });
  
  // Click "Access Existing Wallet" button
  console.log('Looking for "Access Existing Wallet" button...');
  const accessExistingButton = walletPage.getByRole('button', { name: 'Access Existing Wallet' });
  
  if (await accessExistingButton.isVisible({ timeout: 5000 })) {
    console.log('✓ Found "Access Existing Wallet" button');
    await accessExistingButton.click();
    console.log('✓ Clicked "Access Existing Wallet"');
    
    // Wait for the options to appear
    await walletPage.waitForTimeout(2000);
    await walletPage.screenshot({ path: 'tests/screenshots/02-access-options.png', fullPage: true });
    console.log('✓ Screenshot: 02-access-options.png');
  } else {
    throw new Error('Could not find "Access Existing Wallet" button');
  }
  
  // Click "Enter recovery phrase" option (it's a heading, not a button)
  console.log('Looking for "Enter recovery phrase" option...');
  const enterRecoveryPhrase = walletPage.getByText('Enter recovery phrase');
  
  if (await enterRecoveryPhrase.isVisible({ timeout: 5000 })) {
    console.log('✓ Found "Enter recovery phrase" option');
    await enterRecoveryPhrase.click();
    console.log('✓ Clicked "Enter recovery phrase"');
    
    // Wait for recovery phrase input to appear
    await walletPage.waitForTimeout(2000);
    await walletPage.screenshot({ path: 'tests/screenshots/03-recovery-phrase-input.png', fullPage: true });
    console.log('✓ Screenshot: 03-recovery-phrase-input.png');
  } else {
    throw new Error('Could not find "Enter recovery phrase" option');
  }
  
  // Now we should see recovery phrase import options
  console.log('Looking for recovery phrase import option...');
  
  // Look for "Recovery Phrase" or similar button/tab
  const recoveryPhrasePatterns = [
    'Recovery Phrase',
    'Use Recovery Phrase',
    'Import with Recovery Phrase',
    'Mnemonic',
    'Seed Phrase'
  ];
  
  let foundRecoveryOption = false;
  for (const pattern of recoveryPhrasePatterns) {
    try {
      const element = walletPage.getByRole('button', { name: new RegExp(pattern, 'i') }).first();
      if (await element.isVisible({ timeout: 2000 })) {
        console.log(`✓ Found recovery phrase option: "${pattern}"`);
        await element.click();
        await walletPage.waitForTimeout(2000);
        await walletPage.screenshot({ path: 'tests/screenshots/03-recovery-phrase-selected.png', fullPage: true });
        foundRecoveryOption = true;
        break;
      }
    } catch (error) {
      // Try next pattern
    }
  }
  
  if (!foundRecoveryOption) {
    console.log('Recovery phrase option may already be selected or has different text');
  }
  
  // Fill in the recovery phrase
  console.log('Looking for mnemonic input fields...');
  const words = mnemonic.trim().split(/\s+/);
  console.log(`Mnemonic has ${words.length} words`);
  
  // Wait for input fields to appear
  await walletPage.waitForTimeout(1000);
  
  // Fill each word into its corresponding field
  console.log('Filling recovery phrase word by word...');
  for (let i = 0; i < words.length; i++) {
    const wordNumber = (i + 1).toString() + '.';
    const input = walletPage.getByRole('textbox', { name: wordNumber }).first();
    
    if (await input.isVisible({ timeout: 2000 })) {
      await input.fill(words[i]);
      if (i % 6 === 0) {
        console.log(`  Filled words 1-${i + 1}...`);
      }
    } else {
      throw new Error(`Could not find input field for word ${i + 1}`);
    }
  }
  
  console.log('✓ Filled all recovery phrase words');
  
  // Blur the last input to trigger validation
  const lastInput = walletPage.getByRole('textbox', { name: `${words.length}.` }).first();
  await lastInput.blur();
  await walletPage.waitForTimeout(500);
  
  await walletPage.screenshot({ path: 'tests/screenshots/04-mnemonic-filled.png', fullPage: true });
  
  // Click continue/import button (wait for it to be enabled)
  console.log('Looking for Next button...');
  const nextButton = walletPage.getByRole('button', { name: 'Next' });
  
  // Wait for button to become enabled
  await walletPage.waitForTimeout(1000);
  
  if (await nextButton.isVisible({ timeout: 5000 })) {
    // Check if enabled, if not try clicking elsewhere first
    const isEnabled = await nextButton.isEnabled();
    
    if (!isEnabled) {
      console.log('Next button is disabled, clicking on page to trigger validation...');
      // Click on the heading to trigger focus change
      await walletPage.getByRole('heading', { name: 'Enter Recovery Phrase' }).click();
      await walletPage.waitForTimeout(1000);
    }
    
    // Try to click Next button
    await nextButton.click({ force: true });
    console.log('✓ Clicked Next button');
    await walletPage.waitForTimeout(3000);
    await walletPage.screenshot({ path: 'tests/screenshots/05-after-next.png', fullPage: true });
  } else {
    throw new Error('Could not find Next button');
  }
  
  // Remove the old continue button search patterns since we already handled it
  const continuePatterns = ['Continue', 'Import', 'Import Wallet', 'Confirm'];
  
  for (const pattern of continuePatterns) {
    try {
      const button = walletPage.getByRole('button', { name: new RegExp(pattern, 'i') }).first();
      if (await button.isVisible({ timeout: 2000 })) {
        console.log(`✓ Found continue button: "${pattern}"`);
        await button.click();
        await walletPage.waitForTimeout(3000);
        await walletPage.screenshot({ path: 'tests/screenshots/05-after-continue.png', fullPage: true });
        break;
      }
    } catch (error) {
      // Try next pattern
    }
  }
  
  // Fill wallet setup page (name, password, terms)
  console.log('Setting up wallet details...');
  
  // Fill wallet name
  const walletNameInput = walletPage.getByPlaceholder('Enter a Name');
  if (await walletNameInput.isVisible({ timeout: 5000 })) {
    console.log('✓ Found wallet name field');
    await walletNameInput.fill('Test Wallet');
    console.log('✓ Filled wallet name');
    await walletPage.waitForTimeout(500);
  }
  
  // Fill password (use placeholder to be more specific)
  const passwordInput = walletPage.getByPlaceholder('Enter a Password');
  if (await passwordInput.isVisible({ timeout: 3000 })) {
    console.log('✓ Found password field');
    await passwordInput.fill(password);
    console.log('✓ Filled password');
    await walletPage.waitForTimeout(500);
  }
  
  // Fill confirm password
  const confirmPasswordInput = walletPage.getByPlaceholder('Confirm Password');
  if (await confirmPasswordInput.isVisible({ timeout: 3000 })) {
    console.log('✓ Found confirm password field');
    await confirmPasswordInput.fill(password);
    console.log('✓ Filled confirm password');
    await walletPage.waitForTimeout(500);
  }
  
  await walletPage.waitForTimeout(1000);
  
  // Check Terms of Use checkbox
  const termsCheckbox = walletPage.getByRole('checkbox', { name: /Terms of Use/i });
  if (await termsCheckbox.isVisible({ timeout: 3000 })) {
    console.log('✓ Found Terms of Use checkbox');
    await termsCheckbox.check();
    console.log('✓ Checked Terms of Use');
  }
  
  await walletPage.screenshot({ path: 'tests/screenshots/06-wallet-setup-filled.png', fullPage: true });
  
  // Click Save button
  const saveButton = walletPage.getByRole('button', { name: 'Save' });
  await walletPage.waitForTimeout(1000);
  
  if (await saveButton.isVisible({ timeout: 5000 })) {
    console.log('✓ Found Save button');
    await saveButton.click();
    console.log('✓ Clicked Save');
    
    await walletPage.waitForTimeout(5000);
    await walletPage.screenshot({ path: 'tests/screenshots/07-after-save.png', fullPage: true });
  } else {
    throw new Error('Could not find Save button');
  }
  
  // Handle "Unlock Airdrops" screen - click "No Thanks"
  console.log('Looking for airdrop opt-in screen...');
  const noThanksButton = walletPage.getByRole('button', { name: 'No Thanks' });
  
  if (await noThanksButton.isVisible({ timeout: 5000 })) {
    console.log('✓ Found "No Thanks" button on airdrop screen');
    await noThanksButton.click();
    console.log('✓ Clicked "No Thanks"');
    await walletPage.waitForTimeout(3000);
    await walletPage.screenshot({ path: 'tests/screenshots/08-wallet-ready.png', fullPage: true });
  } else {
    console.log('No airdrop screen appeared (might have skipped)');
  }
  
  console.log('✓ Wallet import process completed (check screenshots for details)');
  console.log(`Final tab count: ${context.pages().length}`);
  
  // Remove the page listener so tests can create new pages
  context.removeAllListeners('page');
  console.log('✓ Removed page listeners - tests can now create new tabs');
}

/**
 * Helper to get the Core Wallet extension page from context
 */
export async function getWalletPage(context: BrowserContext): Promise<Page | undefined> {
  const pages = context.pages();
  
  for (const page of pages) {
    if (page.url().includes('chrome-extension://')) {
      return page;
    }
  }
  
  return undefined;
}

/**
 * Gets the extension ID dynamically from the context
 */
export async function getLoadedExtensionId(context: BrowserContext): Promise<string | null> {
  // Check pages for extension URLs
  const pages = context.pages();
  for (const page of pages) {
    const url = page.url();
    if (url.startsWith('chrome-extension://')) {
      const match = url.match(/chrome-extension:\/\/([a-z]+)\//);
      if (match) return match[1];
    }
  }
  
  // Check service workers
  const serviceWorkers = context.serviceWorkers();
  for (const worker of serviceWorkers) {
    const url = worker.url();
    if (url.includes('chrome-extension://')) {
      const match = url.match(/chrome-extension:\/\/([a-z]+)\//);
      if (match) return match[1];
    }
  }
  
  return null;
}

