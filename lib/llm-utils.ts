import type { Page } from "fumadocs-core/source";

// Type assertion for getText method (available when includeProcessedMarkdown is enabled)
interface PageDataWithText {
  getText(type: "processed" | "raw"): Promise<string>;
  title: string;
  [key: string]: any;
}

export async function getLLMText(page: Page) {
  // Try to get processed markdown, fall back to raw if not available
  let content: string;
  try {
    content = await (page.data as PageDataWithText).getText("processed");
  } catch (error) {
    // Fall back to raw content if processed is not available
    try {
      content = await (page.data as PageDataWithText).getText("raw");
    } catch {
      // If neither works, use empty string
      content = "";
    }
  }

  return `# ${page.data.title} (${page.url})

${content}`;
}
