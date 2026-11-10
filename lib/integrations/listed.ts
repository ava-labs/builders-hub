/**
 * The integrations the directory lists, read from the integration loader's
 * pages. One filter for the /integrations header and every other page that
 * quotes its counts, so the numbers always agree.
 */

type IntegrationPage = {
  url?: string;
  data?: { title?: unknown; category?: unknown; logo?: unknown; description?: unknown };
};

/** Pages with a title, category, logo, description and url; README entries are left out. */
export function listedIntegrations<T extends IntegrationPage>(pages: readonly T[]): T[] {
  return pages.filter((page) => {
    if (!page?.data) return false;
    const { title, category, logo, description } = page.data;
    if (title === 'README') return false;
    return (
      title !== undefined &&
      category !== undefined &&
      logo !== undefined &&
      description !== undefined &&
      page.url !== undefined
    );
  });
}

/** Distinct categories across listed pages. */
export function integrationCategoryCount(listed: readonly IntegrationPage[]): number {
  return new Set(listed.map((page) => page.data?.category)).size;
}
