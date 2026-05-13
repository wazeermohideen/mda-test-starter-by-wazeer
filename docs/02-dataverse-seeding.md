# Dataverse API Seeding

Create, read, update, and delete Dynamics 365 records directly via the Dataverse REST API — no browser, no clicking, milliseconds instead of minutes.

---

## Why Use This

| | UI (Playwright) | Dataverse API |
|---|---|---|
| Create one record | ~1–2 minutes | ~200ms |
| Create 5 prerequisites | ~8–10 minutes | ~1 second |
| Can fail due to UI issues | Yes | No |
| Tests what you care about | The form itself | The record's existence |

**Rule of thumb:** use the UI when you're testing the form. Use the API when you just need data to exist so you can test something else.

---

## Prerequisites

### 1. App registration in Azure Active Directory

1. Go to [portal.azure.com](https://portal.azure.com) → **Azure Active Directory** → **App registrations** → **New registration**
2. Name it something like `playwright-test-client`
3. Note the **Application (client) ID** and **Directory (tenant) ID**
4. Go to **Certificates & secrets** → **New client secret** — copy the value immediately

### 2. Grant Dataverse access

In your Power Platform environment:
1. Go to [admin.powerplatform.microsoft.com](https://admin.powerplatform.microsoft.com)
2. Select your environment → **Settings** → **Users + permissions** → **Application users**
3. Add your app registration and assign it the **System Administrator** or a custom role with the permissions your tests need

### 3. Add to `.env`

```ini
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-app-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

---

## Basic Usage

```typescript
import { DataverseClient } from '../helpers/dataverse';

const db = new DataverseClient();

// Create a record — returns the full record including its GUID
const record = await db.create('cr123_equipments', {
  cr123_name:         'Test Equipment',
  cr123_serialnumber: 'SN-TEST-001',
  cr123_manufacturer: 'Acme Corp',
});

console.log(record.cr123_equipmentid); // the new record's GUID

// Read it back
const fetched = await db.read('cr123_equipments', record.cr123_equipmentid as string);

// Update it
await db.update('cr123_equipments', record.cr123_equipmentid as string, {
  cr123_manufacturer: 'Updated Corp',
});

// Delete it
await db.delete('cr123_equipments', record.cr123_equipmentid as string);
```

---

## The Power Pattern — API setup, UI test, API teardown

This is the game-changer. Your test only tests what it's supposed to test — the UI for activating a schedule — not the 4 minutes of setup before it:

```typescript
import { test, expect } from '@playwright/test';
import { DataverseClient } from '../helpers/dataverse';
import { createRecord } from '../data/factory';

const MODEL_DRIVEN_APP_URL = process.env.MODEL_DRIVEN_APP_URL!;
const db = new DataverseClient();

test.describe('Activate Maintenance Schedule', () => {
  let equipmentId: string;
  let scheduleId: string;

  test.beforeAll(async () => {
    // Create prerequisites via API — takes ~1 second instead of ~4 minutes
    const equipment = await db.create('usgs_equipments', {
      usgs_name:         'API-Seeded Equipment',
      usgs_serialnumber: `SN-${Date.now()}`,
      usgs_manufacturer: 'Test Corp',
    });
    equipmentId = equipment.usgs_equipmentid as string;

    const schedule = await db.create('usgs_maintenanceplans', {
      usgs_name:                    'API-Seeded Schedule',
      usgs_equipment_usgs_equipmentid: equipmentId,
      usgs_activitytype:            100000001, // Calibration option set value
    });
    scheduleId = schedule.usgs_maintenanceplanid as string;
  });

  test.afterAll(async () => {
    // Clean up — delete in reverse order (child first)
    await db.delete('usgs_maintenanceplans', scheduleId);
    await db.delete('usgs_equipments', equipmentId);
  });

  test('activate schedule via command bar', async ({ page }) => {
    // Jump straight to the record — no setup time in the test itself
    const recordUrl = `${MODEL_DRIVEN_APP_URL}&pagetype=entityrecord&etn=usgs_maintenanceplan&id=${scheduleId}`;
    await page.goto(recordUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[role="menuitem"]', { timeout: 30_000 });

    await page.getByRole('menuitem', { name: 'Schedule', exact: true }).click();
    await page.getByRole('button', { name: 'OK' }).click();

    await expect(page.getByText('Scheduled')).toBeVisible({ timeout: 15_000 });
  });
});
```

---

## Combining with Faker

Use Faker to generate the field values, the API to create the record:

```typescript
import { createRecord, resolveProfile } from '../data/factory';
import { DataverseClient } from '../helpers/dataverse';

const db      = new DataverseClient();
const profile = await resolveProfile('healthcare');
const data    = createRecord(profile);

const record = await db.create('cr123_patients', {
  cr123_name:       data.name,
  cr123_mrn:        data.uniqueId,
  cr123_department: data.category,
});
```

---

## Finding Entity Plural Names

The Dataverse API uses **plural logical names** (e.g. `accounts`, `contacts`, `cr123_equipments`).

To find yours:
1. Open Power Apps → **Tables** → select your table
2. Go to **Properties** → note the **Plural name** field
3. Or look at the MDA URL — `etn=usgs_equipment` means the plural is `usgs_equipments`

---

## Tips

- **Option set values are numbers** — dropdown choices stored as integers in Dataverse, not strings. Check the table's column definitions to find the numeric values
- **Lookup fields use `@odata.bind`** — to set a lookup: `"usgs_equipment@odata.bind": "/usgs_equipments(guid-here)"`
- **Always clean up** — use `afterAll` to delete test records so your environment stays clean
- **Check your API call limits** — Dataverse licenses include daily API entitlements; testing volume is well within limits for normal usage
