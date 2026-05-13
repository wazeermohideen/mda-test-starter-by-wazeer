# Microsoft Graph API

Access SharePoint, OneDrive, Teams, and more from your tests using the Microsoft Graph API — without opening a browser.

---

## What You Can Test With This

| Scenario | Graph API call |
|---|---|
| Word document was generated and exists in SharePoint | `GET /sites/{id}/drive/root:/path/to/file.docx` |
| File is the right size (not empty/corrupt) | Check `size` property |
| Correct users have access to a file | `GET /sites/{id}/drive/items/{id}/permissions` |
| Email notification was sent | `GET /users/{id}/messages` |
| Teams message was posted | `GET /teams/{id}/channels/{id}/messages` |

---

## Prerequisites

### 1. App registration (same one used for Dataverse, or a separate one)

If you already set up an app registration for Dataverse seeding, you can reuse it. Otherwise, create one in **Azure Active Directory** → **App registrations**.

### 2. Grant Graph API permissions

In your app registration → **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**:

| Permission | What it unlocks |
|---|---|
| `Files.Read.All` | Read files in SharePoint / OneDrive |
| `Sites.Read.All` | Read SharePoint site metadata |
| `Mail.Read` | Read emails (for notification testing) |
| `ChannelMessage.Read.All` | Read Teams messages |

Click **Grant admin consent** after adding permissions.

### 3. Add to `.env`

```ini
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-app-client-id
AZURE_CLIENT_SECRET=your-client-secret

# The SharePoint site ID — found in the URL or via Graph Explorer
SHAREPOINT_SITE_ID=your-site-id
```

**How to find your SharePoint site ID:**
```
https://graph.microsoft.com/v1.0/sites/yourorg.sharepoint.com:/sites/your-site
```
Use [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer) (free, browser-based) to run this and copy the `id` from the response.

---

## Basic Usage

```typescript
import { createGraphClient, getSharePointFile } from '../helpers/graph';

const graph = createGraphClient();

// Check if a file exists
const file = await getSharePointFile(graph, process.env.SHAREPOINT_SITE_ID!, '/documents/report.docx');

if (file) {
  console.log('File found:', file.name);
  console.log('Size:', file.size, 'bytes');
  console.log('URL:', file.webUrl);
} else {
  console.log('File not found');
}
```

---

## Testing Word Document Generation

This is the full pattern for testing a workflow that generates a Word document in SharePoint:

```typescript
import { test, expect } from '@playwright/test';
import { createGraphClient, waitForSharePointFile, getFilePermissions } from '../helpers/graph';

const SITE_ID = process.env.SHAREPOINT_SITE_ID!;
const graph   = createGraphClient();

test.describe.serial('Word Document Generation', () => {
  test.setTimeout(180_000);

  let documentPath: string;

  test('trigger document generation from MDA', async ({ page }) => {
    // Navigate to the record that generates the document
    await page.goto(`${process.env.MODEL_DRIVEN_APP_URL}&pagetype=entityrecord&etn=your_entity&id=record-guid`);
    await page.waitForSelector('[role="menuitem"]', { timeout: 30_000 });

    // Click whatever button/command triggers the Word doc
    await page.getByRole('menuitem', { name: 'Generate Report' }).click();
    await page.getByRole('button', { name: 'OK' }).click();

    // Confirm the MDA shows a success message
    await expect(page.getByText('Report generated')).toBeVisible({ timeout: 30_000 });

    // Set the expected file path (adjust to match your app's naming convention)
    documentPath = `/reports/report-${new Date().toISOString().slice(0, 10)}.docx`;
  });

  test('document exists in SharePoint', async () => {
    // Poll SharePoint until the file appears — generation may take a few seconds
    const file = await waitForSharePointFile(graph, SITE_ID, documentPath, 60_000);

    expect(file).not.toBeNull();
    expect(Number(file!.size)).toBeGreaterThan(0); // file is not empty
  });

  test('document is accessible to correct users', async () => {
    // Get the file first to retrieve its ID
    const file = await getSharePointFile(graph, SITE_ID, documentPath);
    expect(file).not.toBeNull();

    const permissions = await getFilePermissions(graph, SITE_ID, file!.id as string);

    // Check that at least one permission exists
    expect(permissions.length).toBeGreaterThan(0);

    // Check for a specific user or group having access
    const roles = permissions.flatMap((p: any) => p.roles ?? []);
    expect(roles).toContain('read'); // or 'write', 'owner'
  });
});
```

---

## Other Useful Graph Calls

### Check if an email was sent

```typescript
const messages = await graph
  .api(`/users/${process.env.MS_AUTH_EMAIL}/messages`)
  .filter(`subject eq 'Your Report is Ready'`)
  .top(1)
  .get();

expect(messages.value.length).toBeGreaterThan(0);
```

### List files in a SharePoint folder

```typescript
const files = await graph
  .api(`/sites/${SITE_ID}/drive/root:/reports:/children`)
  .select('name,size,lastModifiedDateTime')
  .get();

console.table(files.value);
```

### Download a file and check its content

```typescript
const stream = await graph
  .api(`/sites/${SITE_ID}/drive/root:/documents/report.docx:/content`)
  .getStream();

// Check the file is a valid Office document (starts with PK magic bytes)
const buffer = await streamToBuffer(stream);
expect(buffer.slice(0, 2).toString('hex')).toBe('504b'); // PK header = valid .docx
```

---

## Tips

- **Graph Explorer** is your best friend — test any API call at [developer.microsoft.com/en-us/graph/graph-explorer](https://developer.microsoft.com/en-us/graph/graph-explorer) before writing test code
- **Use `waitForSharePointFile` for async generation** — documents generated by Power Automate flows may take 5–30 seconds to appear in SharePoint
- **File paths in Graph are case-sensitive** — `/Documents/Report.docx` ≠ `/documents/report.docx`
- **Check `size > 0`** — a generated file can exist but be empty if the generation failed partway through
