import { describe, expect, it } from "vitest";
import { replaceRelativeLinks } from "@/utils/remote-content/shared.mts";
import { MOVED_LINKS, rewriteMovedLinks } from "@/utils/remote-content/moved-links.mts";

const BASE = "https://raw.githubusercontent.com/avalanche-foundation/ACPs/main/README.md";

describe("replaceRelativeLinks img handling", () => {
  it("rewrites a plain html img tag to an absolute self-closing tag with no stray bracket", () => {
    const out = replaceRelativeLinks('<img width="80%" src="LOGO.png">', BASE);
    expect(out).toBe(
      '<img width="80%" src="https://raw.githubusercontent.com/avalanche-foundation/ACPs/main/LOGO.png" />',
    );
    expect(out).not.toContain(">>");
  });

  it("keeps attributes that follow src and does not double the self-closing slash", () => {
    const out = replaceRelativeLinks('<img src="x.png" alt="a logo" />', BASE);
    expect(out).toBe(
      '<img alt="a logo" src="https://raw.githubusercontent.com/avalanche-foundation/ACPs/main/x.png" />',
    );
    expect(out.match(/\/>/g)).toHaveLength(1);
  });

  it("leaves markdown links to absolute urls untouched", () => {
    const md = "[docs](https://build.avax.network/docs)";
    expect(replaceRelativeLinks(md, BASE)).toBe(md);
  });

  it("consumes a multi-line img tag whole", () => {
    const out = replaceRelativeLinks('<img\n  width="80%"\n  src="LOGO.png"\n/>', BASE);
    expect(out).toBe('<img width="80%" src="https://raw.githubusercontent.com/avalanche-foundation/ACPs/main/LOGO.png" />');
  });
});

describe("replaceRelativeLinks markdown destinations", () => {
  const ACP = "https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/285-reduce-minimum-consumption-rate/";
  const RAW = "https://raw.githubusercontent.com/avalanche-foundation/ACPs/main/ACPs/285-reduce-minimum-consumption-rate/";

  it("unwraps an angle-bracket image destination and encodes its spaces", () => {
    expect(replaceRelativeLinks("![ARR Spread](<ARR Spread.png>)", ACP)).toBe(`![ARR Spread](${RAW}ARR%20Spread.png)`);
  });

  it("points a relative image at the raw file, not the blob page", () => {
    expect(replaceRelativeLinks("![chart](chart.jpeg)", ACP)).toBe(`![chart](${RAW}chart.jpeg)`);
  });

  it("keeps a relative link to a page on the blob URL", () => {
    expect(replaceRelativeLinks("[ACP-77](<../77-reinventing-subnets/README.md>)", ACP)).toBe(
      "[ACP-77](https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/77-reinventing-subnets/README.md)",
    );
  });

  it("keeps an angle-bracket absolute destination as written", () => {
    expect(replaceRelativeLinks("[docs](<https://build.avax.network/docs>)", ACP)).toBe(
      "[docs](<https://build.avax.network/docs>)",
    );
  });
});

describe("rewriteMovedLinks", () => {

  it("rewrites a moved upstream link to its current page", () => {
    expect(rewriteMovedLinks("[Foundry Book](https://book.getfoundry.sh/reference/cast/cast-send)")).toBe(
      "[Foundry Book](https://www.getfoundry.sh/reference/cast/send)",
    );
  });

  it("rewrites a key in a link, in angle brackets, in a quoted attribute and as bare text", () => {
    expect(rewriteMovedLinks("[Avalanche Network](https://www.avax.com).")).toBe(
      "[Avalanche Network](https://www.avalanche.com).",
    );
    expect(rewriteMovedLinks("<https://www.avax.com>")).toBe("<https://www.avalanche.com>");
    expect(rewriteMovedLinks('<a href="https://www.avax.com">')).toBe('<a href="https://www.avalanche.com">');
    expect(rewriteMovedLinks("see https://www.avax.com\n")).toBe("see https://www.avalanche.com\n");
  });

  it("matches a whole URL only", () => {
    const longer =
      "[ACP-194](https://github.com/avalanche-foundation/ACPs/tree/main/ACPs/194-streaming-asynchronous-execution/README.md)";
    expect(rewriteMovedLinks(longer)).toBe(longer);
    const archived = "[old](https://web.archive.org/web/2024/https://www.avax.com)";
    expect(rewriteMovedLinks(archived)).toBe(archived);
    expect(rewriteMovedLinks("[site](https://www.avax.com/about)")).toBe("[site](https://www.avax.com/about)");
  });

  it("points no entry at another dead URL", () => {
    for (const target of Object.values(MOVED_LINKS)) {
      expect(MOVED_LINKS[target]).toBeUndefined();
    }
  });
});
