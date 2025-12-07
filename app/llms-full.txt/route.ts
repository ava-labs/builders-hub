import { documentation, academy, integration, blog } from "@/lib/source";
import { getLLMText } from "@/lib/llm-utils";

// Revalidate every hour to ensure fresh content
export const revalidate = 3600; // 1 hour in seconds

export async function GET() {
  const scanned: string[] = [];

  // Include documentation, academy, integrations, and blog pages
  const allPages = [
    ...documentation.getPages(),
    ...academy.getPages(),
    ...integration.getPages(),
    ...blog.getPages(),
  ];

  // Convert each page to LLM-friendly text format
  // Filter out any pages that fail to convert
  const pagePromises = allPages.map(async (page) => {
    try {
      return await getLLMText(page);
    } catch (error) {
      console.error(`Failed to process page ${page.url}:`, error);
      return null;
    }
  });

  const processedPages = await Promise.all(pagePromises);
  const validPages = processedPages.filter((p): p is string => p !== null);

  scanned.push(...validPages);

  console.log(`Generated LLM text for ${validPages.length} out of ${allPages.length} pages`);

  // Join with double newlines for clear separation
  return new Response(scanned.join("\n\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
