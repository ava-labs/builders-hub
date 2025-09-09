import https from 'https';
import fs from 'fs';
import path from 'path';

function readVersionsFile() {
    const versionsPath = path.join('src', 'versions.json');
    const content = fs.readFileSync(versionsPath, 'utf8');
    return JSON.parse(content);
}

function fetchTags(repoName) {
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

                    // Find semantic version tags like v0.7.1
                    const semanticTags = results
                        .map(tag => tag.name)
                        .filter(name => /^v\d+\.\d+\.\d+/.test(name))
                        .filter(name => !name.includes("-rc."));

                    if (semanticTags.length > 0) {
                        resolve(semanticTags[0]);
                    } else {
                        reject(new Error('No semantic version tags found'));
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
function fetchGithubLatestReleaseTag(owner, repo) {
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
                    if (!Array.isArray(releases)) {
                        return reject(new Error('Unexpected GitHub releases response'));
                    }

                    // Prefer first stable release (non-draft, non-prerelease)
                    const stable = releases.find(r => r && r.tag_name && !r.draft && !r.prerelease);
                    if (stable && typeof stable.tag_name === 'string') {
                        return resolve(stable.tag_name);
                    }

                    // Fallback: first release with a tag_name
                    const first = releases.find(r => r && r.tag_name);
                    if (first && typeof first.tag_name === 'string') {
                        return resolve(first.tag_name);
                    }

                    reject(new Error('No releases found'));
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

function parseSemver(tag) {
    // expects strings like 'v1.13.5'
    const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
    if (!match) return null;
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3])
    };
}

function compareSemver(a, b) {
    const pa = parseSemver(a);
    const pb = parseSemver(b);
    if (!pa || !pb) return 0;
    if (pa.major !== pb.major) return pa.major - pb.major;
    if (pa.minor !== pb.minor) return pa.minor - pb.minor;
    return pa.patch - pb.patch;
}

// Fetch the latest stable GitHub release tag that matches a predicate
function fetchGithubLatestTagMatching(owner, repo, predicate) {
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
                    if (!Array.isArray(releases)) {
                        return reject(new Error('Unexpected GitHub releases response'));
                    }
                    const match = releases.find(r => r && r.tag_name && !r.draft && !r.prerelease && predicate(r.tag_name));
                    if (match) return resolve(match.tag_name);
                    // fallback any release matching
                    const any = releases.find(r => r && r.tag_name && predicate(r.tag_name));
                    if (any) return resolve(any.tag_name);
                    reject(new Error('No matching releases found'));
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

async function main() {
    try {
        const versions = readVersionsFile();

        // Check for AvalancheGo updates via GitHub Releases (more reliable than Docker tags)
        const latestAvagoTag = await fetchGithubLatestReleaseTag('ava-labs', 'avalanchego');
        const currentAvagoVersion = versions['avaplatform/avalanchego'] || '';

        if (latestAvagoTag && latestAvagoTag !== currentAvagoVersion) {
            versions['avaplatform/avalanchego'] = latestAvagoTag;
            fs.writeFileSync('src/versions.json', JSON.stringify(versions, null, 2));
            console.error(`New version ${latestAvagoTag} is available for avalanchego. Current version is ${currentAvagoVersion}`);
        }

        // Check for Subnet-EVM updates via GitHub Releases and combine with AvalancheGo, verifying docker tag exists
        const latestSubnetEvmBaseTag = await fetchGithubLatestReleaseTag('ava-labs', 'subnet-evm');
        const intendedCombinedTag = `${latestSubnetEvmBaseTag}_${versions['avaplatform/avalanchego']}`;
        const currentSubnetEvmVersion = versions['avaplatform/subnet-evm_avalanchego'] || '';
        let combinedSubnetEvmAvagoTag = intendedCombinedTag;
        try {
            const allTags = await fetchAllTags('avaplatform/subnet-evm_avalanchego');
            if (!allTags.includes(intendedCombinedTag)) {
                // Fallback: find latest published combined tag for this subnet-evm base
                const candidates = allTags.filter(name => name.startsWith(`${latestSubnetEvmBaseTag}_`));
                if (candidates.length > 0) {
                    // sort by the AvalancheGo semver suffix descending
                    candidates.sort((a, b) => {
                        const as = a.split('_')[1] || '';
                        const bs = b.split('_')[1] || '';
                        return compareSemver(bs, as);
                    });
                    combinedSubnetEvmAvagoTag = candidates[0];
                    console.error(`Docker tag ${intendedCombinedTag} not found. Falling back to latest available ${combinedSubnetEvmAvagoTag}.`);
                } else if (allTags.length > 0) {
                    // Last resort: keep the current one if exists, else pick first available
                    combinedSubnetEvmAvagoTag = currentSubnetEvmVersion || allTags[0];
                    if (combinedSubnetEvmAvagoTag !== intendedCombinedTag) {
                        console.error(`Docker tag ${intendedCombinedTag} not found. Falling back to ${combinedSubnetEvmAvagoTag}.`);
                    }
                }
            }
        } catch (_) {
            // If Docker Hub listing fails, keep intended combined tag and hope it exists
        }

        if (combinedSubnetEvmAvagoTag && combinedSubnetEvmAvagoTag !== currentSubnetEvmVersion) {
            versions['avaplatform/subnet-evm_avalanchego'] = combinedSubnetEvmAvagoTag;
            fs.writeFileSync('src/versions.json', JSON.stringify(versions, null, 2));
            console.error(`New version ${combinedSubnetEvmAvagoTag} is available for subnet-evm_avalanchego. Current version is ${currentSubnetEvmVersion}`);
        }

        // Check for icm-relayer updates
        // Pull from GitHub releases of icm-services and extract icm-relayer-* tag
        const icmRelayerReleaseTag = await fetchGithubLatestTagMatching('ava-labs', 'icm-services', (t) => /^icm-relayer-v\d+\.\d+\.\d+/.test(t));
        let latestRelayerTag = '';
        if (icmRelayerReleaseTag) {
            latestRelayerTag = icmRelayerReleaseTag.replace(/^icm-relayer-/, '');
        } else {
            // Fallback to Docker Hub tag discovery
            latestRelayerTag = await fetchTags('avaplatform/icm-relayer');
        }
        const currentRelayerVersion = versions['avaplatform/icm-relayer'] || '';

        if (latestRelayerTag !== currentRelayerVersion) {
            versions['avaplatform/icm-relayer'] = latestRelayerTag;
            fs.writeFileSync('src/versions.json', JSON.stringify(versions, null, 2));

            console.error(`New version ${latestRelayerTag} is available for icm-relayer. Current version is ${currentRelayerVersion}`);
        }

        if (
            combinedSubnetEvmAvagoTag !== currentSubnetEvmVersion ||
            latestRelayerTag !== currentRelayerVersion ||
            latestAvagoTag !== currentAvagoVersion
        ) {
            console.error('Please run `node toolbox/update_docker_tags.js` and commit the changes');
            // process.exit(1);
        }
    } catch (error) {
        console.warn('Warning:', error.message);
        process.exit(0);
    }
}

main();
