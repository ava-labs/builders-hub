/**
 * Chain URL aliases
 */

/** The readable half of a slug: the chain's name, lowercased and hyphenated. */
export function aliasBase(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const generateSlug = aliasBase;

/** Length of the id fragment appended to an unverified chain slug. */
const REF_LENGTH = 6;

/**
 * A short, stable, URL-safe fragment of a chain's own identifier.
 * CB58 and hex ids are both high-entropy at the head, and the fragment only
 * has to disambiguate within one network, so a prefix is sufficient.
 */
export function shortChainRef(...ids: (string | undefined | null)[]): string {
  for (const id of ids) {
    const cleaned = (id || "").replace(/^0x/i, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleaned.length >= REF_LENGTH) return cleaned.slice(0, REF_LENGTH);
    if (cleaned.length > 0) return cleaned;
  }
  return "";
}

/** The fields of a catalog entry that decide its slug. */
export interface AliasSubject {
  chainName: string;
  blockchainId?: string;
  subnetId?: string;
  chainId?: string;
  /** True only for chains we acknowledge as having a verified name */
  aliasVerified?: boolean;
}

/**
 * The slug a chain is entitled to. Verified chains keep the bare base; every
 * other chain carries its id fragment.
 */
export function canonicalChainSlug(subject: AliasSubject): string {
  const base = aliasBase(subject.chainName);
  if (subject.aliasVerified) return base || fallbackSlug(subject);
  const ref = shortChainRef(subject.blockchainId, subject.subnetId, subject.chainId);
  if (!base) return fallbackSlug(subject);
  if (!ref) return base;
  // A name that already ends in its own ref (idempotent re-run) stays put.
  return base.endsWith(`-${ref}`) ? base : `${base}-${ref}`;
}

/** For the nameless: a chain with no usable name still needs a URL. */
function fallbackSlug(subject: AliasSubject): string {
  const ref = shortChainRef(subject.subnetId, subject.blockchainId, subject.chainId);
  return ref ? `subnet-${ref}` : "subnet";
}

/**
 * Whether `slug` is the bare, unqualified form of `chainName` — i.e. the alias
 * an unverified chain asked for but did not get. Used to answer requests for a
 * demoted or squatted alias with an explanation instead of a 404.
 */
export function isBareAliasOf(slug: string, chainName: string): boolean {
  const base = aliasBase(chainName);
  return base.length > 0 && base === slug;
}

/**
 * Every id fragment this chain could legitimately be carrying.
 *
 * A catalog entry accumulates identifiers over time — a P-Chain stub arrives
 * with only a subnetId and picks up a blockchainId once Glacier lists it. Its
 * slug was minted from whichever id was available at the time, and rewriting it
 * the moment a "better" one appears would break the URL for nothing. So a slug
 * is acceptable if it carries *any* of the chain's own fragments.
 */
export function plausibleChainRefs(subject: AliasSubject): string[] {
  const refs = [subject.blockchainId, subject.subnetId, subject.chainId]
    .map(id => shortChainRef(id))
    .filter(ref => ref.length > 0);
  return Array.from(new Set(refs));
}

/**
 * Whether `slug` is qualified — carries one of the chain's id fragments rather
 * than standing as a bare, claimable alias. The invariant enforced on every
 * enrichment run: an unverified chain's slug must be qualified.
 */
export function hasChainRef(slug: string, subject: AliasSubject): boolean {
  return plausibleChainRefs(subject).some(ref => slug.endsWith(`-${ref}`));
}
