import { chromium, type BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import AdmZip from 'adm-zip';

const CORE_WALLET_EXTENSION_ID = 'agoakfejjabomempkjlepdflaleeobhb';
const CORE_WALLET_CRX_URL = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0.0.0&acceptformat=crx2,crx3&x=id%3D${CORE_WALLET_EXTENSION_ID}%26uc`;

const EXTENSION_DIR = path.join(process.cwd(), 'tests', 'extensions');
const CORE_WALLET_DIR = path.join(EXTENSION_DIR, 'core-wallet');

/**
 * Extracts ZIP data from a CRX file by removing the CRX header
 * CRX format: [CRX header][ZIP data]
 */
function extractZipFromCrx(crxPath: string): Buffer {
  const crxBuffer = fs.readFileSync(crxPath);
  
  // Check for CRX3 format (starts with "Cr24")
  const magicNumber = crxBuffer.toString('utf8', 0, 4);
  
  if (magicNumber !== 'Cr24') {
    throw new Error('Invalid CRX file format');
  }
  
  // CRX3 format:
  // [4 bytes] Magic number ("Cr24")
  // [4 bytes] CRX format version (3)
  // [4 bytes] Header size
  // [header size bytes] Header data
  // [remaining bytes] ZIP data
  
  const version = crxBuffer.readUInt32LE(4);
  
  if (version === 3) {
    const headerSize = crxBuffer.readUInt32LE(8);
    const zipStartOffset = 12 + headerSize;
    return crxBuffer.slice(zipStartOffset);
  } else if (version === 2) {
    // CRX2 format (older)
    // [4 bytes] Magic number
    // [4 bytes] Version (2)
    // [4 bytes] Public key length
    // [4 bytes] Signature length
    // [public key length bytes] Public key
    // [signature length bytes] Signature
    // [remaining] ZIP data
    const publicKeyLength = crxBuffer.readUInt32LE(8);
    const signatureLength = crxBuffer.readUInt32LE(12);
    const zipStartOffset = 16 + publicKeyLength + signatureLength;
    return crxBuffer.slice(zipStartOffset);
  } else {
    throw new Error(`Unsupported CRX version: ${version}`);
  }
}

/**
 * Downloads the Core Wallet extension from Chrome Web Store
 */
async function downloadCoreWalletExtension(): Promise<string> {
  // Create extensions directory if it doesn't exist
  if (!fs.existsSync(EXTENSION_DIR)) {
    fs.mkdirSync(EXTENSION_DIR, { recursive: true });
  }

  const crxPath = path.join(EXTENSION_DIR, 'core-wallet.crx');
  const zipPath = path.join(EXTENSION_DIR, 'core-wallet.zip');
  
  // Skip download if already exists
  if (fs.existsSync(CORE_WALLET_DIR) && fs.readdirSync(CORE_WALLET_DIR).length > 0) {
    console.log('✓ Core Wallet extension already downloaded');
    return CORE_WALLET_DIR;
  }

  console.log('Downloading Core Wallet extension...');
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(crxPath);
    
    https.get(CORE_WALLET_CRX_URL, (response) => {
      // Follow redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect location not found'));
          return;
        }
        
        https.get(redirectUrl, (redirectResponse) => {
          redirectResponse.pipe(file);
          
          file.on('finish', () => {
            file.close();
            console.log('✓ Downloaded Core Wallet extension');
            
            try {
              // Extract ZIP data from CRX
              const zipData = extractZipFromCrx(crxPath);
              fs.writeFileSync(zipPath, zipData);
              console.log('✓ Extracted ZIP from CRX');
              
              // Extract the ZIP file
              const zip = new AdmZip(zipPath);
              zip.extractAllTo(CORE_WALLET_DIR, true);
              console.log('✓ Extracted Core Wallet extension');
              
              // Clean up temporary files
              fs.unlinkSync(crxPath);
              fs.unlinkSync(zipPath);
              
              resolve(CORE_WALLET_DIR);
            } catch (error) {
              // Clean up on error
              if (fs.existsSync(crxPath)) fs.unlinkSync(crxPath);
              if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
              reject(error);
            }
          });
        }).on('error', (err) => {
          if (fs.existsSync(crxPath)) fs.unlinkSync(crxPath);
          reject(err);
        });
      } else {
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log('✓ Downloaded Core Wallet extension');
          
          try {
            // Extract ZIP data from CRX
            const zipData = extractZipFromCrx(crxPath);
            fs.writeFileSync(zipPath, zipData);
            console.log('✓ Extracted ZIP from CRX');
            
            // Extract the ZIP file
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(CORE_WALLET_DIR, true);
            console.log('✓ Extracted Core Wallet extension');
            
            // Clean up temporary files
            fs.unlinkSync(crxPath);
            fs.unlinkSync(zipPath);
            
            resolve(CORE_WALLET_DIR);
          } catch (error) {
            // Clean up on error
            if (fs.existsSync(crxPath)) fs.unlinkSync(crxPath);
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            reject(error);
          }
        });
      }
    }).on('error', (err) => {
      if (fs.existsSync(crxPath)) fs.unlinkSync(crxPath);
      reject(err);
    });
  });
}

/**
 * Creates a browser context with Core Wallet extension loaded
 */
export async function createBrowserWithCoreWallet(): Promise<BrowserContext> {
  // Download extension if needed
  const extensionPath = await downloadCoreWalletExtension();
  
  // Launch browser with extension
  const browser = await chromium.launchPersistentContext('', {
    headless: false, // Extensions require headed mode
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--disable-blink-features=AutomationControlled',
    ],
  });

  console.log('✓ Browser launched with Core Wallet extension');
  
  return browser;
}

/**
 * Gets the extension URL for Core Wallet
 * This is useful for navigating to the extension's popup or options page
 */
export function getCoreWalletExtensionUrl(page: string = 'index.html'): string {
  return `chrome-extension://${CORE_WALLET_EXTENSION_ID}/${page}`;
}

/**
 * Setup function to be called before tests
 */
export async function setupCoreWallet() {
  console.log('Setting up Core Wallet extension for tests...');
  await downloadCoreWalletExtension();
  console.log('✓ Core Wallet setup complete');
}

