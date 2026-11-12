/**
 * Release selection for scripts/update_docker_tags.mjs. A separate module so a
 * unit test can import it without running the updater.
 */

const STABLE = /^v(\d+)\.(\d+)\.(\d+)$/;
const FUJI = /^v(\d+)\.(\d+)\.(\d+)-fuji$/;

/**
 * Sort key for a version that the network accepts, or null.
 *
 * Mainnet accepts only a stable release (vX.Y.Z, not marked prerelease).
 *
 * Testnet accepts a stable release or a vX.Y.Z-fuji release. A -fuji tag is cut
 * only for the first release of an upgrade, before mainnet gets it; the patch
 * releases after it have no -fuji tag. So a -fuji-only rule leaves testnet
 * behind mainnet. vX.Y.Z-fuji sorts below vX.Y.Z: before an upgrade reaches
 * mainnet the -fuji tag is the highest, and after it the stable tag wins.
 *
 * Release candidates (-rc.N, also -fuji-rc.N) match neither pattern.
 */
function sortKey(release, version, isFuji) {
    const stable = STABLE.exec(version);
    if (stable && !release.prerelease) {
        return [Number(stable[1]), Number(stable[2]), Number(stable[3]), 1];
    }
    const fuji = isFuji && FUJI.exec(version);
    if (fuji) {
        return [Number(fuji[1]), Number(fuji[2]), Number(fuji[3]), 0];
    }
    return null;
}

function compareKeys(a, b) {
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
}

/**
 * Release version to pin for a network, or null.
 *
 * `prefix` is the product prefix some monorepos put on a tag, e.g.
 * "icm-relayer-v1.7.5". It is stripped before the version is inspected and
 * before the version is returned, because the image tag does not carry it.
 *
 * Drafts and release candidates are always excluded. Mainnet takes the newest
 * stable release in the order GitHub lists them (newest first). Testnet takes
 * the highest version by semver among stable and -fuji releases.
 */
export function pickReleaseVersion(releases, { isFuji, prefix = '' }) {
    let best = null;
    for (const r of releases) {
        const tag = r.tag_name;
        if (!tag || r.draft || !tag.startsWith(prefix)) continue;

        const version = tag.slice(prefix.length);
        const key = sortKey(r, version, isFuji);
        if (!key) continue;

        if (!isFuji) return version;
        if (!best || compareKeys(key, best.key) > 0) best = { key, version };
    }
    return best ? best.version : null;
}
