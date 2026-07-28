import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Updates the container image pins in versions.json.
 *
 * Rule: the version number always comes from a GitHub release. Docker Hub is
 * consulted only to confirm that the matching image tag exists, and never to
 * choose a version.
 *
 * "Latest Docker image" is not "latest release". The newest tag in a Docker
 * repo is routinely a CI build (a bare commit hash), a release candidate, or a
 * branch tag with no release behind it. Docker Hub also caps tag listings at
 * 100 per page regardless of the requested page_size, so the first page is not
 * even reliably the newest set. Picking a version by listing tags therefore
 * risks pinning the console to something that was never released; we look up
 * one exact tag instead.
 *
 * Release candidates are never pinned, on mainnet or fuji.
 *
 * Set GITHUB_TOKEN to avoid unauthenticated API rate limits (needed in CI).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const versionsPath = path.join(__dirname, 'versions.json');

const REQUEST_TIMEOUT_MS = 10000;

function readVersionsFile() {
    const content = fs.readFileSync(versionsPath, 'utf8');
    return JSON.parse(content);
}

// Resolves { status, body }. Never rejects on a non-2xx; callers decide.
function request(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'builders-hub-updater', ...headers } }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });

        req.setTimeout(REQUEST_TIMEOUT_MS, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.on('error', reject);
    });
}

async function fetchGithubReleases(owner, repo) {
    const headers = { 'Accept': 'application/vnd.github+json' };
    if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const { status, body } = await request(
        `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`,
        headers
    );

    if (status !== 200) {
        throw new Error(`GitHub returned ${status} for ${owner}/${repo}`);
    }

    const releases = JSON.parse(body);
    if (!Array.isArray(releases)) {
        throw new Error(`Unexpected GitHub response for ${owner}/${repo}`);
    }
    return releases;
}

/**
 * Newest release version for a network, or null. Releases come back
 * newest-first.
 *
 * `prefix` is the product prefix some monorepos put on a tag, e.g.
 * "icm-relayer-v1.7.5". It is stripped before the version is inspected and
 * before the version is returned, because the image tag does not carry it.
 * Inspecting the raw tag would be wrong: the mainnet rule rejects a version
 * carrying any suffix, and the hyphen inside "icm-relayer-" would trip it.
 *
 * Drafts and release candidates are always excluded. Mainnet additionally
 * excludes prereleases and suffixed versions; fuji requires -fuji.
 */
function pickReleaseVersion(releases, { isFuji, prefix = '' }) {
    const candidate = releases.find((r) => {
        const tag = r.tag_name;
        if (!tag || r.draft || !tag.startsWith(prefix)) return false;

        const version = tag.slice(prefix.length);
        if (!/^v\d+\.\d+\.\d+/.test(version) || version.includes('-rc.')) return false;

        return isFuji
            ? version.includes('-fuji')
            : !r.prerelease && !version.includes('-');
    });
    return candidate ? candidate.tag_name.slice(prefix.length) : null;
}

/**
 * True only if the exact tag exists. Anything else (404, an outage, a
 * timeout) returns false so the caller keeps the current pin rather than
 * publishing an image nobody can pull.
 */
async function dockerTagExists(repoName, tag) {
    try {
        const { status } = await request(`https://hub.docker.com/v2/repositories/${repoName}/tags/${encodeURIComponent(tag)}`);
        return status === 200;
    } catch (_) {
        return false;
    }
}

/**
 * Pins `image` to `version` if the image tag exists. Returns true if changed.
 */
async function applyPin(networkVersions, image, version, label) {
    const current = networkVersions[image] || '';

    if (!version) {
        console.warn(`  ${label}: no release found. Keeping ${current}.`);
        return false;
    }

    if (version === current) {
        console.log(`  ${label}: ${version} (same as before)`);
        return false;
    }

    if (!(await dockerTagExists(image, version))) {
        console.warn(`  ${label}: release ${version} has no ${image}:${version} image yet. Keeping ${current}.`);
        return false;
    }

    networkVersions[image] = version;
    console.log(`  ${label}: ${version} (new, was ${current})`);
    return true;
}

async function updateNetwork(versions, network) {
    const isFuji = network === 'testnet';
    const networkVersions = versions[network];
    let hasChanges = false;

    console.log(`\nChecking ${network} versions:`);

    // AvalancheGo, and the Subnet-EVM image that bundles it. The
    // avaplatform/subnet-evm tag matches the AvalancheGo version (e.g.
    // v1.14.2), so both pins follow the same release.
    try {
        const releases = await fetchGithubReleases('ava-labs', 'avalanchego');
        const avagoVersion = pickReleaseVersion(releases, { isFuji });

        if (await applyPin(networkVersions, 'avaplatform/avalanchego', avagoVersion, 'avalanchego')) {
            hasChanges = true;
        }

        // Track whatever avalanchego is actually pinned to, which may still be
        // the previous version if the bump above was held back.
        const pinnedAvago = networkVersions['avaplatform/avalanchego'];
        if (await applyPin(networkVersions, 'avaplatform/subnet-evm', pinnedAvago, 'subnet-evm')) {
            hasChanges = true;
        }
    } catch (error) {
        console.warn(`  Warning for ${network} node versions:`, error.message);
    }

    // ICM relayer, released from icm-services as icm-relayer-vX.Y.Z; the image
    // tag drops the prefix.
    try {
        const releases = await fetchGithubReleases('ava-labs', 'icm-services');
        const relayerVersion = pickReleaseVersion(releases, { isFuji, prefix: 'icm-relayer-' });

        if (await applyPin(networkVersions, 'avaplatform/icm-relayer', relayerVersion, 'icm-relayer')) {
            hasChanges = true;
        }
    } catch (error) {
        console.warn(`  Warning for ${network} icm-relayer:`, error.message);
    }

    return hasChanges;
}

async function main() {
    try {
        const versions = readVersionsFile();

        const mainnetChanged = await updateNetwork(versions, 'mainnet');
        const testnetChanged = await updateNetwork(versions, 'testnet');

        if (mainnetChanged || testnetChanged) {
            fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + '\n');
            console.log('\nVersions updated. Please commit the changes.');
        } else {
            console.log('\nAll versions are up to date.');
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
