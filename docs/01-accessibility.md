# Accessibility Testing

Automated accessibility scanning powered by [axe-core](https://github.com/dequelabs/axe-core) — the industry standard engine used by governments, banks, and enterprise teams worldwide.

---

## What It Checks

By default, every scan checks against **WCAG 2.1 AA** — the standard required by:
- Section 508 (US federal law)
- ADA (Americans with Disabilities Act)
- EN 301 549 (EU accessibility standard)

This covers things like:
- Missing image alt text
- Insufficient color contrast
- Form fields without labels
- Keyboard navigation issues
- Screen reader compatibility

---

## Quick Start

```typescript
import { test, expect } from '@playwright/test';
import { assertA11y } from '../helpers/accessibility';

test('equipment form is accessible', async ({ page }, testInfo) => {
  await page.goto(process.env.MODEL_DRIVEN_APP_URL!);
  await page.waitForSelector('[role="menuitem"]');

  // Scans the full page and fails the test if any violations are found
  await assertA11y(page, testInfo);
});
```

After the test runs, open the HTML report (`npx playwright show-report`) and click the test → **Attachments** to see either a pass confirmation or a full JSON breakdown of every violation found.

---

## Scan Options

### Check specific WCAG levels

```typescript
// WCAG 2.0 A only (minimum)
await assertA11y(page, testInfo, { tags: ['wcag2a'] });

// WCAG 2.1 AA (default — federal 508 standard)
await assertA11y(page, testInfo, { tags: ['wcag2a', 'wcag2aa', 'wcag21aa'] });

// WCAG 2.1 AAA (strictest)
await assertA11y(page, testInfo, { tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag21aaa'] });
```

### Exclude elements you don't control

```typescript
// Exclude third-party widgets, iframes, or known false positives
await assertA11y(page, testInfo, {
  exclude: ['#third-party-widget', '.external-iframe'],
});
```

### Get violations without failing the test

Use `scanA11y` when you want to inspect violations without automatically throwing:

```typescript
import { scanA11y } from '../helpers/accessibility';

test('audit accessibility issues', async ({ page }, testInfo) => {
  await page.goto(process.env.MODEL_DRIVEN_APP_URL!);

  const violations = await scanA11y(page);

  // Log without failing
  console.log(`Found ${violations.length} violation(s)`);
  violations.forEach(v => {
    console.log(`  [${v.impact}] ${v.id}: ${v.description}`);
  });

  // Or assert on specific things
  const criticalViolations = violations.filter(v => v.impact === 'critical');
  expect(criticalViolations).toHaveLength(0); // only fail on critical
});
```

---

## Adding to Every Test Automatically

To scan every page without adding `assertA11y` to each test, add it to `test.afterEach` in a describe block or globally in a fixture:

```typescript
test.afterEach(async ({ page }, testInfo) => {
  // Only scan on passing tests — no point checking a page that already failed
  if (testInfo.status === 'passed') {
    await assertA11y(page, testInfo).catch(() => {
      // Log but don't fail — useful when first auditing an existing app
      console.warn('Accessibility issues detected — see report attachment');
    });
  }
});
```

---

## Understanding Violation Severity

| Impact | Meaning | Example |
|---|---|---|
| `critical` | Completely blocks users | Missing form labels, no keyboard access |
| `serious` | Major barrier for many users | Low color contrast, missing landmarks |
| `moderate` | Affects some users | Redundant ARIA roles |
| `minor` | Best practice not followed | Suboptimal but functional |

---

## Tips

- **Run accessibility scans after navigation**, not before — wait for the page to fully render first
- **MDA pages load slowly** — wait for `[role="menuitem"]` before scanning
- **Don't fail on `minor` violations** when first adopting — fix `critical` and `serious` first
- **Scan each distinct page/form**, not just the home screen — different forms have different accessibility issues
