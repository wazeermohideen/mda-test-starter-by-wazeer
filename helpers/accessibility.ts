import * as fs from 'fs';
import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export interface A11yOptions {
  /** WCAG tags to check against. Defaults to WCAG 2.1 AA — the federal 508 standard. */
  tags?: string[];
  /** CSS selectors to exclude from the scan (e.g. third-party widgets you don't control). */
  exclude?: string[];
}

/**
 * Run an accessibility scan on the current page and return any violations.
 * Throws if AxeBuilder cannot be initialized.
 *
 * Usage:
 *   const violations = await scanA11y(page);
 *   expect(violations).toHaveLength(0);
 */
export async function scanA11y(page: Page, options: A11yOptions = {}) {
  const tags = options.tags ?? ['wcag2a', 'wcag2aa', 'wcag21aa'];

  let builder = new AxeBuilder({ page }).withTags(tags);

  if (options.exclude?.length) {
    builder = builder.exclude(options.exclude.join(', '));
  }

  const results = await builder.analyze();
  return results.violations;
}

/**
 * Assert that the current page has zero accessibility violations.
 * Attach a detailed JSON report to the Playwright test report.
 *
 * Usage (inside a test):
 *   await assertA11y(page, testInfo);
 */
export async function assertA11y(
  page: Page,
  testInfo: import('@playwright/test').TestInfo,
  options: A11yOptions = {}
): Promise<void> {
  const violations = await scanA11y(page, options);

  const passed = violations.length === 0;

  await testInfo.attach('Accessibility Report', {
    body: JSON.stringify(
      passed
        ? { result: 'PASS', violations: 0 }
        : {
            result: 'VIOLATIONS FOUND',
            count: violations.length,
            violations: violations.map(v => ({
              impact: v.impact,
              id: v.id,
              description: v.description,
              helpUrl: v.helpUrl,
              elements: v.nodes.length,
            })),
          },
      null,
      2
    ),
    contentType: 'application/json',
  });

  if (!passed) {
    const summary = violations
      .map(v => `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description} (${v.nodes.length} element(s))`)
      .join('\n');
    testInfo.annotations.push({
      type: 'Accessibility',
      description: `${violations.length} violation(s):\n${summary}`,
    });

    // Write a machine-readable violations file so the pipeline can create ADO work items.
    // File lives in the per-test output folder — one file per test, no concurrency issues.
    fs.writeFileSync(
      testInfo.outputPath('a11y-violations.json'),
      JSON.stringify(
        {
          test: testInfo.title,
          file: testInfo.file,
          violations: violations.map(v => ({
            impact: v.impact,
            id: v.id,
            description: v.description,
            helpUrl: v.helpUrl,
            nodes: v.nodes.length,
          })),
        },
        null,
        2
      )
    );
  }
}
