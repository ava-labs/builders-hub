import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const versionsPath = path.join(__dirname, 'versions.json');

function readVersionsFile() {
    const content = fs.readFileSync(versionsPath, 'utf8');
    return JSON.parse(content);
}

function fetchTags(repoName, isFuji = false) {
    return new Promise((resolve, reject) => {
        const request = https.get(`https://hub.docker.com/v2/repositories/${repoName}/tags?page_size=1000`, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    const results = parsedData.results;

                    // Find semantic version tags
                    const semanticTags = results
                        .map(tag => tag.name)
                        .filter(name => {
                            if (isFuji) {
                                return /^v\d+\.\d+\.\d+-fuji/.test(name);
                            } else {
                                return /^v\d+\.\d+\.\d+$/.test(name) && !name.includes("-");
                            }
                        })
                        .filter(name => !name.includes("-rc."));

                    if (semanticTags.length > 0) {
                        resolve(semanticTags[0]);
                    } else {
                        reject(new Error(`No ${isFuji ? 'fuji ' : ''}semantic version tags found`));
                    }
                } catch (e) {
                    reject(e);
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

// Fetch all tag names from Docker Hub repo
function fetchAllTags(repoName) {
    return new Promise((resolve, reject) => {
        const request = https.get(`https://hub.docker.com/v2/repositories/${repoName}/tags?page_size=1000`, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    const results = parsedData.results;
                    const names = results.map(t => t.name);
                    resolve(names);
                } catch (e) {
                    reject(e);
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

// Fetch latest stable (non-draft, non-prerelease) GitHub release tag
function fetchGithubLatestReleaseTag(owner, repo, isFuji = false) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/releases?per_page=100`,
            headers: {
                'User-Agent': 'builders-hub-updater',
                'Accept': 'application/vnd.github+json'
            }
        };

        const request = https.get(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const releases = JSON.parse(data);

                    // Find the latest stable release (non-draft, non-prerelease)
                    const stableReleases = releases.filter(r => {
                        if (isFuji) {
                            // For fuji/testnet, look for pre-releases or releases with -fuji tag
                            return r.tag_name && r.tag_name.includes('-fuji');
                        } else {
                            // For mainnet, only stable releases
                            return !r.draft && !r.prerelease && r.tag_name && !r.tag_name.includes('-');
                        }
                    });

                    if (stableReleases.length > 0) {
                        resolve(stableReleases[0].tag_name);
                    } else {
                        reject(new Error(`No ${isFuji ? 'fuji ' : 'stable '}releases found`));
                    }
                } catch (e) {
                    reject(e);
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

// Fetch GitHub release tag matching a filter
function fetchGithubLatestTagMatching(owner, repo, filter, isFuji = false) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/releases?per_page=100`,
            headers: {
                'User-Agent': 'builders-hub-updater',
                'Accept': 'application/vnd.github+json'
            }
        };

        const request = https.get(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const releases = JSON.parse(data);

                    // Find the latest release matching the filter
                    const matchingReleases = releases.filter(r => {
                        if (!r.draft && r.tag_name && filter(r.tag_name)) {
                            if (isFuji) {
                                return r.tag_name.includes('-fuji');
                            } else {
                                return !r.prerelease && !r.tag_name.includes('-');
                            }
                        }
                        return false;
                    });

                    if (matchingReleases.length > 0) {
                        resolve(matchingReleases[0].tag_name);
                    } else {
                        resolve(null); // No matching releases
                    }
                } catch (e) {
                    reject(e);
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

// Compare semver strings
function compareSemver(a, b) {
    const ap = a.replace(/^v/, '').split(/[\.-]/);
    const bp = b.replace(/^v/, '').split(/[\.-]/);
    for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
        const anum = parseInt(ap[i] || '0');
        const bnum = parseInt(bp[i] || '0');
        if (anum !== bnum) {
            return anum - bnum;
        }
    }
    return 0;
}

async function updateNetwork(versions, network) {
    const isFuji = network === 'testnet';
    const networkVersions = versions[network];
    let hasChanges = false;

    console.log(`\nChecking ${network} versions:`);

    // Check for AvalancheGo updates
    try {
        const latestAvagoTag = await fetchGithubLatestReleaseTag('ava-labs', 'avalanchego', isFuji);
        const currentAvagoVersion = networkVersions['avaplatform/avalanchego'] || '';
        const avagoStatus = latestAvagoTag === currentAvagoVersion ? '(same as before)' : '(new)';
        console.log(`  avalanchego: ${latestAvagoTag} ${avagoStatus}`);

        if (latestAvagoTag && latestAvagoTag !== currentAvagoVersion) {
            networkVersions['avaplatform/avalanchego'] = latestAvagoTag;
            hasChanges = true;
            console.error(`  New version ${latestAvagoTag} is available for ${network} avalanchego. Current version is ${currentAvagoVersion}`);
        }

        // Check for Subnet-EVM Docker image updates.
        // The image avaplatform/subnet-evm:<avalanchego-version> bundles AvalancheGo
        // and the Subnet-EVM plugin together. The tag matches the AvalancheGo version
        // (e.g. v1.14.2). The legacy avaplatform/subnet-evm_avalanchego repo with
        // composite tags (v0.8.0_v1.14.0) is deprecated.
        const currentSubnetEvmVersion = networkVersions['avaplatform/subnet-evm'] || '';
        let subnetEvmTag = currentSubnetEvmVersion;

        try {
            const allTags = await fetchAllTags('avaplatform/subnet-evm');
            const avagoVersion = networkVersions['avaplatform/avalanchego'];

            // Prefer an exact match on the AvalancheGo version
            if (allTags.includes(avagoVersion)) {
                subnetEvmTag = avagoVersion;
            } else {
                // Fall back to the latest stable v*.*.*  (no -fuji / -rc / build hashes)
                const stable = allTags.filter(name => /^v\d+\.\d+\.\d+$/.test(name));
                if (stable.length > 0) {
                    stable.sort((a, b) => compareSemver(b, a));
                    subnetEvmTag = stable[0];
                    console.warn(`  No avaplatform/subnet-evm tag found for ${avagoVersion}. Falling back to latest stable: ${subnetEvmTag}.`);
                } else {
                    console.warn(`  No stable avaplatform/subnet-evm tags found. Keeping current: ${currentSubnetEvmVersion}.`);
                }
            }
        } catch (_) {
            // If Docker Hub listing fails, keep the current version
        }

        const subnetEvmStatus = subnetEvmTag === currentSubnetEvmVersion ? '(same as before)' : '(new)';
        console.log(`  subnet-evm: ${subnetEvmTag} ${subnetEvmStatus}`);

        if (subnetEvmTag && subnetEvmTag !== currentSubnetEvmVersion) {
            networkVersions['avaplatform/subnet-evm'] = subnetEvmTag;
            hasChanges = true;
            console.error(`  New version ${subnetEvmTag} is available for ${network} subnet-evm. Current version is ${currentSubnetEvmVersion}`);
        }
    } catch (error) {
        console.warn(`  Warning for ${network} node versions:`, error.message);
    }

    // Check for icm-relayer updates
    try {
        // Pull from GitHub releases of icm-services and extract icm-relayer-* tag
        const icmRelayerReleaseTag = await fetchGithubLatestTagMatching(
            'ava-labs',
            'icm-services',
            (t) => /^icm-relayer-v\d+\.\d+\.\d+/.test(t),
            isFuji
        );

        let latestRelayerTag = '';
        if (icmRelayerReleaseTag) {
            latestRelayerTag = icmRelayerReleaseTag.replace(/^icm-relayer-/, '');
        } else {
            // Fallback to Docker Hub tag discovery
            latestRelayerTag = await fetchTags('avaplatform/icm-relayer', isFuji);
        }

        const currentRelayerVersion = networkVersions['avaplatform/icm-relayer'] || '';
        const relayerStatus = latestRelayerTag === currentRelayerVersion ? '(same as before)' : '(new)';
        console.log(`  icm-relayer: ${latestRelayerTag} ${relayerStatus}`);

        if (latestRelayerTag && latestRelayerTag !== currentRelayerVersion) {
            networkVersions['avaplatform/icm-relayer'] = latestRelayerTag;
            hasChanges = true;
            console.error(`  New version ${latestRelayerTag} is available for ${network} icm-relayer. Current version is ${currentRelayerVersion}`);
        }
    } catch (error) {
        console.warn(`  Warning for ${network} icm-relayer:`, error.message);
    }

    return hasChanges;
}

async function main() {
    try {
        const versions = readVersionsFile();
        let hasChanges = false;

        // Update mainnet versions
        const mainnetChanged = await updateNetwork(versions, 'mainnet');
        hasChanges = hasChanges || mainnetChanged;

        // Update testnet versions  
        const testnetChanged = await updateNetwork(versions, 'testnet');
        hasChanges = hasChanges || testnetChanged;

        if (hasChanges) {
            fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2));
            console.error('\nVersions updated. Please commit the changes.');
        } else {
            console.log('\nAll versions are up to date.');
        }

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();