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

  if (violations.length > 0) {
    await testInfo.attach('Accessibility Violations', {
      body: JSON.stringify(violations, null, 2),
      contentType: 'application/json',
    });

    const summary = violations
      .map(v => `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description} (${v.nodes.length} element(s))`)
      .join('\n');

    throw new Error(`${violations.length} accessibility violation(s) found:\n\n${summary}`);
  }

  await testInfo.attach('Accessibility Scan', {
    body: JSON.stringify({ result: 'PASS', violations: 0 }, null, 2),
    contentType: 'application/json',
  });
}
