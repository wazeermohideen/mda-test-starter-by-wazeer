import { Page } from '@playwright/test';

/**
 * Navigate to an entity list (grid) view inside the MDA.
 * Waits for the app shell and the grid to fully load.
 */
export async function navigateToGridView(page: Page, mdaUrl: string, entityName: string): Promise<void> {
  const url = new URL(mdaUrl);
  url.searchParams.set('pagetype', 'entitylist');
  url.searchParams.set('etn', entityName);

  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForURL(new RegExp(`entitylist.*${entityName}`), { timeout: 30_000 });
  await page.waitForSelector('[role="menuitem"]', { timeout: 30_000 });
}

/**
 * Wait for a record save to complete.
 * Detects the record GUID appearing in the URL — the reliable save signal.
 */
export async function waitForSave(page: Page, entityName: string, timeout = 30_000): Promise<void> {
  await page.waitForURL(
    new RegExp(`pagetype=entityrecord.*${entityName}.*[&?]id=`),
    { timeout }
  );
}

/**
 * Dismiss the Dynamics 365 duplicate detection dialog if it appears.
 * Safe to call even when no dialog is present.
 */
export async function dismissDuplicateDialog(page: Page): Promise<void> {
  const btn = page
    .getByRole('button', { name: /save anyway|ignore and save/i })
    .or(page.getByLabel(/save anyway|ignore and save/i));

  const visible = await btn.isVisible({ timeout: 4_000 }).catch(() => false);
  if (visible) await btn.click();
}

/**
 * Hover over a subgrid tab to force the command bar to render.
 * MDA only renders subgrid toolbar buttons after hovering the tab.
 */
export async function revealSubgridToolbar(page: Page, tabName: string): Promise<void> {
  const tab = page.getByRole('tab', { name: tabName });
  await tab.click();
  await tab.hover();
  await page.waitForTimeout(800);
}
