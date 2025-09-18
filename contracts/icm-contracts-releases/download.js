#!/usr/bin/env node
import fs from 'fs';
import { fileURLToPath } from 'url';
import https from 'https';
import path from 'path';

const DOWNLOAD_LATEST_RELEASES = 2

const currentFilePath = fileURLToPath(import.meta.url);
const thisDir = path.dirname(currentFilePath);

async function getJsonFromURL(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'avalanche-docs-version-checker',
                'Accept': 'application/json'
            }
        };

        const request = https.get(url, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        throw new Error(`HTTP ${res.statusCode}: ${data}`);
                    }
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}. Data: ${data.substring(0, 100)}...`));
                }
            });
        });

        request.setTimeout(3000, () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });

        request.on('error', reject);
    });
}

async function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadFile(response.headers.location, destPath)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    // Wrap the content in a JSON structure
                    const jsonContent = JSON.stringify({ content: data });
                    fs.writeFile(destPath, jsonContent, (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve();
                    });
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => { });
            reject(err);
        });

        request.setTimeout(3000, () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

async function downloadReleases() {
    try {
        const releases = await getJsonFromURL('https://api.github.com/repos/ava-labs/icm-contracts/releases');

        // Get only the DOWNLOAD_LATEST_RELEASES latest releases
        const latestReleases = releases.slice(0, DOWNLOAD_LATEST_RELEASES);

        for (const release of latestReleases) {
            const tagDir = path.join(thisDir, release.tag_name);

            // Create directory if it doesn't exist
            if (!fs.existsSync(tagDir)) {
                fs.mkdirSync(tagDir, { recursive: true });
            }

            // Download each asset
            for (const asset of release.assets) {
                const filename = path.basename(asset.browser_download_url) + '.json';
                const destPath = path.join(tagDir, filename);

                // Skip if file already exists
                if (fs.existsSync(destPath)) {
                    console.log(`Skipping existing file: ${destPath}`);
                    continue;
                }

                console.log(`Downloading ${filename} to ${destPath}`);
                await downloadFile(asset.browser_download_url, destPath);
            }
        }

        console.log(`${DOWNLOAD_LATEST_RELEASES} releases downloaded successfully`);
    } catch (error) {
        console.error('Error downloading releases:', error);
    }
}

// Execute the download
downloadReleases();
