/**
 * Example MDA test — replace entity names and field labels with your own.
 *
 * This test demonstrates:
 *   - Domain-aware test data via the `record` fixture
 *   - Common MDA navigation patterns
 *   - How to save a record and confirm it was created
 *
 * Switch domains by changing FAKER_DOMAIN in .env:
 *   FAKER_DOMAIN=airline      → flight records, airports, seat classes
 *   FAKER_DOMAIN=healthcare   → patient names, MRNs, clinical departments
 *   FAKER_DOMAIN=government   → case numbers, agencies, regulatory categories
 *   FAKER_DOMAIN=generic      → default mixed data
 */

import { expect } from '@playwright/test';
import { test } from '../fixtures/mda.fixtures';
import { navigateToGridView, waitForSave, dismissDuplicateDialog } from '../helpers/mda';

const MODEL_DRIVEN_APP_URL = process.env.MODEL_DRIVEN_APP_URL!;

if (!MODEL_DRIVEN_APP_URL) {
  throw new Error('MODEL_DRIVEN_APP_URL is required. Copy .env.example → .env and fill it in.');
}

// ─── Replace with your entity's logical name ──────────────────────────────────
const ENTITY_NAME = 'your_entity_logical_name'; // e.g. 'cr123_myentity'

test.describe.serial('Example: Create a Record', () => {
  test.setTimeout(180_000);

  test('create record', async ({ page, record }) => {
    // Navigate to the entity grid view
    await navigateToGridView(page, MODEL_DRIVEN_APP_URL, ENTITY_NAME);

    // Open the New record form
    await page.getByRole('menuitem', { name: 'New', exact: true }).click();
    await page.waitForURL(new RegExp(`pagetype=entityrecord.*${ENTITY_NAME}`), { timeout: 30_000 });

    // ── Fill in your form fields using record data ──────────────────────────
    // Adapt field labels to match your MDA form.
    await page.getByRole('textbox', { name: 'Name' }).fill(record.name);

    // Use any field from the record object — all are strings
    // await page.getByRole('textbox', { name: 'Unique ID' }).fill(record.uniqueId);
    // await page.getByRole('textbox', { name: 'Description' }).fill(record.description);
    // await page.getByRole('combobox', { name: 'Category' }).click();
    // await page.getByRole('option', { name: record.category }).click();

    // ── Save ────────────────────────────────────────────────────────────────
    await page.getByRole('menuitem', { name: 'Save (CTRL+S)' }).click();
    await dismissDuplicateDialog(page);
    await waitForSave(page, ENTITY_NAME);

    // ── Assert ──────────────────────────────────────────────────────────────
    await expect(
      page.getByRole('heading', { name: record.name })
    ).toBeVisible({ timeout: 15_000 });
  });
});
