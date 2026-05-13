import { test as base, expect } from '@playwright/test';
import { createRecord, resolveProfile, MdaRecord } from '../data/factory';
import { loadSeeded } from '../data/loader';

type MdaFixtures = {
  /** A fully-generated MDA record using the active domain profile. */
  record: MdaRecord;
};

/**
 * Extended Playwright test with MDA data fixture.
 *
 * The `record` fixture:
 *   1. Checks data/generated/ for a pre-seeded record from `npx tsx data/seed.ts`
 *   2. Falls back to generating fresh Faker data if no seed file exists
 *   3. Attaches the exact data used to the HTML report for complete visibility
 *
 * The domain is controlled by the FAKER_DOMAIN env var in .env (default: generic).
 *
 * Usage:
 *   import { test, expect } from '../fixtures/mda.fixtures';
 *
 *   test('create a record', async ({ page, record }) => {
 *     await page.getByRole('textbox', { name: 'Name' }).fill(record.name);
 *     await page.getByRole('textbox', { name: 'Unique ID' }).fill(record.uniqueId);
 *   });
 */
export const test = base.extend<MdaFixtures>({
  record: async ({}, use, testInfo) => {
    const domain  = process.env.FAKER_DOMAIN ?? 'generic';
    const seeded  = loadSeeded(domain);
    let data: MdaRecord;

    if (seeded) {
      data = seeded;
    } else {
      const profile = await resolveProfile(domain);
      data = createRecord(profile);
    }

    const source = seeded ? 'pre-generated (seed file)' : 'live (faker)';
    console.log(`\n[MDA Record — ${domain} / ${source}]`);
    console.table(data);

    await testInfo.attach(`MDA Record (${domain})`, {
      body: JSON.stringify({ _domain: domain, _source: source, ...data }, null, 2),
      contentType: 'application/json',
    });

    await use(data);
  },
});

export { expect };
