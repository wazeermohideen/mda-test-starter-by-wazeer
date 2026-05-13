# Allure Reporting

Professional, interactive test reports with history, trends, and rich attachments — built for sharing with clients and stakeholders, not just developers.

---

## What Allure Gives You

| Default Playwright Report | Allure |
|---|---|
| Pass / fail list | Pass / fail list + history trend graph |
| Screenshot on failure | Screenshots, videos, JSON attachments inline |
| Last run only | Every run, with comparison over time |
| Developer-facing | Client and stakeholder-ready |
| No categorization | Group by feature, severity, owner |

---

## Setup

Allure is already wired in — `playwright.config.ts` includes the reporter and results are written to `allure-results/` after every test run.

To generate and view the report, you need the **Allure CLI**, which requires **Java 8+**.

**Check if Java is installed:**
```bash
java -version
```

**Install Java if needed:**
- Mac: `brew install openjdk`
- Windows: download from [adoptium.net](https://adoptium.net)

**Generate and open the Allure report:**
```bash
npm run report:allure
```

This generates the HTML report in `allure-report/` and opens it in your browser automatically.

---

## What the Report Shows

### Overview page
- Total pass/fail/skip counts
- Pass rate percentage
- Trend graph across all runs (gets richer with each run)
- Suite-by-suite breakdown

### Per-test view
- Every step with timing
- Screenshots, videos, and JSON data attachments
- Full error message and stack trace on failures
- Tags, severity, and owner metadata

---

## Tagging Tests for Better Organization

Add metadata to your tests so they're easy to filter in the Allure dashboard:

```typescript
import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';

test('create equipment record', async ({ page, record }) => {
  // Tag this test with metadata Allure understands
  allure.owner('Wazeer Mohideen');
  allure.severity('critical');      // blocker | critical | normal | minor | trivial
  allure.feature('Equipment');
  allure.story('Create Record');
  allure.tag('smoke');
  allure.tag('happy-path');

  // Your test steps — wrapping in allure.step() adds them to the report timeline
  await allure.step('Navigate to Equipment grid', async () => {
    await navigateToGridView(page, MODEL_DRIVEN_APP_URL, 'usgs_equipment');
  });

  await allure.step('Fill form fields', async () => {
    await page.getByRole('textbox', { name: 'Name' }).fill(record.name);
    await page.getByRole('textbox', { name: 'Unique ID' }).fill(record.uniqueId);
  });

  await allure.step('Save and verify', async () => {
    await page.getByRole('menuitem', { name: 'Save (CTRL+S)' }).click();
    await waitForSave(page, 'usgs_equipment');
    await expect(page.getByRole('heading', { name: record.name })).toBeVisible();
  });
});
```

---

## Severity Levels

Use severity to highlight which test failures need immediate attention:

| Level | When to use |
|---|---|
| `blocker` | System is completely unusable if this fails |
| `critical` | Core business workflow is broken |
| `normal` | Important but not blocking (default) |
| `minor` | Nice-to-have, non-blocking |
| `trivial` | Cosmetic or edge case |

---

## Keeping History

Allure's trend graph only works if you keep the `allure-results/` folder between runs (or archive it in CI).

**Local:** results accumulate automatically — each run appends to `allure-results/`.

**CI (GitHub Actions example):**
```yaml
- name: Run tests
  run: npx playwright test --project=mda

- name: Upload Allure results
  uses: actions/upload-artifact@v3
  with:
    name: allure-results
    path: allure-results/

- name: Generate Allure report
  run: npm run report:allure

- name: Upload Allure report
  uses: actions/upload-artifact@v3
  with:
    name: allure-report
    path: allure-report/
```

---

## Adding to `.gitignore`

```
allure-results/
allure-report/
```

These are generated artifacts — commit your test code, not the reports.

---

## Tips

- **Run at least 5–10 times before checking trends** — the trend graph needs history to be meaningful
- **Use `allure.step()`** for long tests — it breaks the timeline into readable chunks instead of one big block
- **Share `allure-report/` as a static site** — it's just HTML/JS, you can host it on GitHub Pages or any static host to give clients a live link
- **Categories** — Allure automatically categorizes failures as "Product defects" vs "Test defects" vs "Infrastructure issues". You can customize these in `allure-results/categories.json`
