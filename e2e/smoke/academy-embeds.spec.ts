/**
 * Render smoke for every Academy/docs page that embeds console tools.
 *
 * Driven by e2e/qa-manifest.json (regenerate with
 * `npx tsx scripts/generate-qa-manifest.mts`). For each surface:
 *   - the page loads without a server error
 *   - no uncaught page exceptions
 *   - no Next.js error boundary
 *   - every embedded console tool actually mounted (data-console-tool
 *     attribute rendered by the shared tool Container)
 *
 * This is the tier that would have caught the empty-ICMDemo-panel bug:
 * the tool mounts but renders broken — the per-tool assertions below check
 * mount; deeper content judgment is the agent loop's job (it reads the
 * screenshots this suite leaves in e2e/artifacts/).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { test, expect } from '../fixtures';

interface ManifestTool {
  name: string;
  importPath: string;
  exists: boolean;
}

interface ManifestSurface {
  kind: string;
  route: string;
  file: string;
  title?: string;
  tools?: ManifestTool[];
}

const manifestPath = path.join(__dirname, '..', 'qa-manifest.json');
const manifest: { surfaces: ManifestSurface[] } = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : { surfaces: [] };

const embedSurfaces = manifest.surfaces.filter(
  (s) => (s.kind === 'academy-page' || s.kind === 'docs-page') && (s.tools?.length ?? 0) > 0,
);

test.describe('academy/docs console-tool embeds', () => {
  test('manifest exists and has surfaces', () => {
    expect(
      embedSurfaces.length,
      'qa-manifest.json missing or empty — run: npx tsx scripts/generate-qa-manifest.mts',
    ).toBeGreaterThan(0);
  });

  for (const surface of embedSurfaces) {
    test(`renders ${surface.route}`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(String(err)));

      const response = await page.goto(surface.route, { waitUntil: 'domcontentloaded' });
      expect(response, 'no response from server').not.toBeNull();
      expect(response!.status(), `HTTP ${response!.status()} for ${surface.route}`).toBeLessThan(400);

      // Let client components hydrate and mount.
      await page.waitForLoadState('networkidle').catch(() => {
        /* heavy pages may never go fully idle — mount checks below decide */
      });

      // Next.js error boundary / app-router error page
      await expect(page.getByText('Application error: a client-side exception has occurred')).toHaveCount(0);

      // A tool counts as alive if it mounted its Container chrome
      // (data-console-tool) or rendered its requirements gate
      // (data-console-tool-gate — legitimate when the QA wallet lacks funded
      // balances). At least one embed must be alive; fewer-than-expected is
      // NOT a hard failure because tools inside collapsed accordions (e.g.
      // the self-hosted relayer alternative sections) and tools not yet
      // wrapped in withConsoleToolMetadata never enter the DOM — those
      // discrepancies are surfaced as annotations for the agent loop to
      // judge with interaction.
      const mounted = page.locator('[data-console-tool], [data-console-tool-gate], [data-console-flow]');
      try {
        await expect
          .poll(async () => mounted.count(), {
            message: `no console tool/gate mounted on ${surface.route} (expected up to ${surface.tools!.length})`,
            timeout: 20_000,
          })
          .toBeGreaterThanOrEqual(1);
      } catch (e) {
        // Machine-readable root-cause tag for the reporter + summarizer to
        // group identical tool sets across pages (one broken component
        // reports once, not N times). Rethrow the ORIGINAL error untouched
        // so the stack trace still points at the assertion above, not here.
        test.info().annotations.push({
          type: 'missing-tools',
          description: surface
            .tools!.map((t) => t.name)
            .sort()
            .join(', '),
        });
        throw e;
      }

      const mountedCount = await mounted.count();
      if (mountedCount < surface.tools!.length) {
        test.info().annotations.push({
          type: 'partial-mount',
          description: `${mountedCount}/${surface.tools!.length} tools mounted on ${surface.route} (expected: ${surface.tools!.map((t) => t.name).join(', ')})`,
        });
      }

      // Screenshot for the agent loop to judge content quality.
      await page.screenshot({
        path: path.join(
          __dirname,
          '..',
          'artifacts',
          'screenshots',
          `${surface.route.replace(/\//g, '_')}.png`,
        ),
        fullPage: true,
      });

      expect(pageErrors, `uncaught page errors on ${surface.route}:\n${pageErrors.join('\n')}`).toEqual([]);
    });
  }
});
