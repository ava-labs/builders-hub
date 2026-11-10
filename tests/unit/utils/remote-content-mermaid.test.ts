import { describe, expect, it } from "vitest";
import { crossChainParser, parsers } from "@/utils/remote-content/parsers/index.mts";
import { convertMermaidBlocks } from "@/utils/remote-content/parsers/pipelines.mts";

const meta = { title: "T", description: "D", sourceBaseUrl: "https://github.com/ava-labs/avalanchego/blob/master/" };

describe("convertMermaidBlocks", () => {
  it("turns a mermaid code block into a Mermaid component", () => {
    const out = convertMermaidBlocks('## Flow\n\n```mermaid\nflowchart TD\n  a["A<br/>B"] --> b\n```\n', meta);
    expect(out).toBe('## Flow\n\n<Mermaid chart={`flowchart TD\n  a["A<br/>B"] --> b`} />\n');
  });

  it("keeps backslashes, backticks and ${ literal in the chart", () => {
    const out = convertMermaidBlocks("```mermaid\na[\"x\\ny `z` ${w}\"]\n```", meta);
    expect(out).toBe('<Mermaid chart={`a["x\\\\ny \\`z\\` \\${w}"]`} />');
  });

  it("matches CRLF line endings and indented fences", () => {
    expect(convertMermaidBlocks("```mermaid\r\ngraph LR\r\n```\r\n", meta)).toBe("<Mermaid chart={`graph LR`} />\r\n");
    expect(convertMermaidBlocks("- step\n\n  ```mermaid\n  graph LR\n  ```", meta)).toBe(
      "- step\n\n<Mermaid chart={`  graph LR`} />",
    );
  });

  it("leaves other code blocks alone", () => {
    const md = "```go\nfmt.Println(1)\n```";
    expect(convertMermaidBlocks(md, meta)).toBe(md);
  });
});

describe("remote content parsers", () => {
  it("convert mermaid blocks in every section", () => {
    for (const [section, parser] of Object.entries(parsers)) {
      const out = parser("Intro\n\n```mermaid\ngraph LR\n  a --> b\n```\n", meta);
      expect(out, section).toContain("<Mermaid chart={`graph LR\n  a --> b`} />");
      expect(out, section).not.toContain("```mermaid");
    }
  });

  it("keep the chart source as the README wrote it", () => {
    const out = crossChainParser('```mermaid\nflowchart TD\n  tx["Tx<br>list"]\n```', meta);
    expect(out).toContain('<Mermaid chart={`flowchart TD\n  tx["Tx<br>list"]`} />');
  });
});
