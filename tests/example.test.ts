/**
 * Example MDA test — driven by qa.config.json.
 *
 * QA setup:
 *   1. Fill in .env       → app URL and login email
 *   2. Fill in qa.config.json → entity name, test users, domain
 *   3. Run: npm test
 *
 * No code changes needed.
 */

import { expect } from '@playwright/test';
import { test } from '../fixtures/mda.fixtures';
import { navigateToGridView, waitForSave, dismissDuplicateDialog } from '../helpers/mda';
import { qaConfig } from '../data/qa-config';

const MODEL_DRIVEN_APP_URL = process.env.MODEL_DRIVEN_APP_URL!;

if (!MODEL_DRIVEN_APP_URL) {
  throw new Error('MODEL_DRIVEN_APP_URL is required. Fill in .env (copy from .env.example).');
}

const ENTITY_NAME = qaConfig.entity.logicalName;

test.describe.serial('Example: Create a Record', () => {
  test.setTimeout(180_000);
  test.use({ userAlias: 'test-user-1' });

  test('create record', async ({ page, record, currentUser }) => {
    // Navigate to the entity grid view
    await navigateToGridView(page, MODEL_DRIVEN_APP_URL, ENTITY_NAME);

    console.log(`Running as QA user: ${currentUser.name} (${currentUser.alias})`);

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
