import { compareRelease } from "@/lib/validator-triage";

/* AvalancheGo's published releases, reduced to what the validators page
   needs to pick an upgrade target: the version, when it shipped, and
   whether its notes say every node must upgrade. Pre-releases and the
   Fuji-only builds are not targets, so they drop out. */

export interface AvalancheGoRelease {
  /** e.g. "1.15.0" */
  version: string;
  publishedAt: string;
  url: string;
  /** the notes say nodes must upgrade */
  mandatory: boolean;
  /** the notes' own sentence on the upgrade deadline, if they have one */
  deadline: string | null;
}

export interface GitHubRelease {
  tag_name: string;
  prerelease: boolean;
  draft?: boolean;
  body: string | null;
  published_at: string | null;
  html_url: string;
}

/* An upgrade release says "All Mainnet nodes must upgrade before ..."
   (Etna and Fortuna said "should upgrade before"; v1.8.0 said "mandatory
   security upgrade" and v1.5.3 "you must upgrade"); a patch release says
   "It is optional, but encouraged". The plugin line ("all plugins must
   update") is not an upgrade call. */
const MUST_UPGRADE =
  /\bnodes (?:must|should) (?:be )?upgraded?\b|\byou must upgrade\b|\bmandatory\b[^.\n]{0,30}\b(?:upgrade|update)\b|\bupgrade is mandatory\b|\brequired upgrade\b/i;
const DEADLINE = /\b(?:must|should) (?:be )?upgraded? (?:before|by)\b/i;

export function toReleases(raw: GitHubRelease[]): AvalancheGoRelease[] {
  return raw
    .filter((r) => !r.draft && !r.prerelease && /^v?\d+\.\d+\.\d+$/.test(r.tag_name))
    .map((r) => {
      const body = r.body ?? "";
      return {
        version: r.tag_name.replace(/^v/, ""),
        publishedAt: r.published_at ?? "",
        url: r.html_url,
        mandatory: MUST_UPGRADE.test(body),
        deadline: deadlineOf(body),
      };
    })
    .sort((a, b) => compareRelease(b.version, a.version));
}

/** the first sentence that gives the upgrade deadline, with the markdown taken out */
export function deadlineOf(body: string): string | null {
  for (const line of body.split(/\r?\n/)) {
    const plain = line.replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();
    if (!DEADLINE.test(plain)) continue;
    const sentence = plain.split(/(?<=\.)\s+(?=[A-Z])/).find((s) => DEADLINE.test(s));
    return (sentence ?? plain).trim();
  }
  return null;
}
