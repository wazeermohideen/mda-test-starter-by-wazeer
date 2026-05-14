# mda-test-starter-by-wazeer

A Playwright starter kit for end-to-end testing of **Microsoft Power Platform Model-Driven Apps** (Dynamics 365), with domain-aware test data powered by [Faker.js](https://fakerjs.dev).

Built by **Wazeer Mohideen**.

---

## Table of Contents

- [What This Is](#what-this-is)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Authentication Methods](#authentication-methods)
- [Recording a Test Case](#recording-a-test-case)
- [Writing Your First Test](#writing-your-first-test)
- [Adding Faker Data to Your Test](#adding-faker-data-to-your-test)
- [Test Conditions — Happy Path & Edge Cases](#test-conditions--happy-path--edge-cases)
- [Running Tests](#running-tests)
- [Viewing Results](#viewing-results)
- [Adding a New Domain](#adding-a-new-domain)
- [Troubleshooting & Things to Know](#troubleshooting--things-to-know)

---

## What This Is

This starter kit gives you everything you need to write automated end-to-end tests against any Power Platform Model-Driven App (MDA) without having to build the infrastructure from scratch.

**What's included out of the box:**

- Microsoft authentication with MFA support
- Domain-aware test data via Faker.js — swap one env var to match your industry
- Pre-seed script — generate N records, inspect them, then run tests against that exact data
- HTML report with JSON data attachments so you can see exactly what was tested
- Helper utilities for common MDA patterns (navigate grids, save records, dismiss dialogs)

---

## Prerequisites

| Requirement | Version | How to check |
|---|---|---|
| Node.js | 18+ | `node --version` |
| npm | 8+ | `npm --version` |
| Git | Any | `git --version` |
| Microsoft 365 account | — | Access to your MDA environment |

---

## Installation

**Step 1 — Clone the repository**

```bash
git clone https://github.com/your-username/mda-test-starter-by-wazeer.git
cd mda-test-starter-by-wazeer
```

**Step 2 — Install dependencies**

```bash
npm install
```

**Step 3 — Install the Chromium browser**

```bash
npm run install:browsers
```

That's it. No monorepo setup, no build step required.

---

## Configuration

**Step 1 — Copy the environment template**

```bash
cp .env.example .env
```

**Step 2 — Open `.env` and fill in your values**

```ini
# The full URL of your Model-Driven App
# How to find it: open your MDA in the browser and copy the entire URL including ?appid=
MODEL_DRIVEN_APP_URL=https://your-org.crm.dynamics.com/main.aspx?appid=00000000-0000-0000-0000-000000000000

# Your Microsoft account
MS_AUTH_EMAIL=you@yourorg.com
MS_AUTH_CREDENTIAL_TYPE=password
MS_AUTH_CREDENTIAL_PROVIDER=environment
MS_USER_PASSWORD=your-password

# Browser settings
MS_AUTH_HEADLESS=false
HEADLESS=false
WORKERS=1

# Faker domain — controls what kind of test data is generated
# Options: generic | airline | healthcare | government
FAKER_DOMAIN=generic
```

> **Never commit `.env`** — it contains your credentials. It is already in `.gitignore`.

---

## Authentication Methods

Authentication runs once and saves your browser session to disk. Tests reuse that session so they never have to sign in again. Sessions last **24 hours**.

Four methods are supported — pick the one that fits your setup.

---

### Method 1 — Password (local development)

The simplest option. Add your email and password to `.env` and run:

```bash
npm run auth      # Power Apps base session
npm run auth:mda  # Dynamics 365 / MDA session
```

A browser window opens, you sign in, approve MFA, and the session is saved. The script waits up to 2 minutes for MFA.

```ini
MS_AUTH_CREDENTIAL_TYPE=password
MS_AUTH_CREDENTIAL_PROVIDER=environment
MS_USER_PASSWORD=your-password
```

---

### Method 2 — Certificate via local .pfx file (CI/CD, shared teams)

Best when you can't share a password — uses a certificate registered in Azure Active Directory instead. No browser prompt, no MFA.

**Prerequisites:**
1. Register an app in [Azure Active Directory](https://portal.azure.com) → App registrations
2. Generate a `.pfx` certificate and upload the public key to the app registration
3. Grant the app access to your Power Platform environment

```ini
MS_AUTH_CREDENTIAL_TYPE=certificate
MS_AUTH_CREDENTIAL_PROVIDER=local-file
MS_AUTH_LOCAL_FILE_PATH=./certs/your-cert.pfx
MS_AUTH_CERTIFICATE_PASSWORD=           # leave blank if the cert has no password
```

```bash
npm run auth
npm run auth:mda
```

> Keep your `.pfx` file out of source control — add `certs/` to `.gitignore`.

---

### Method 3 — Certificate via Azure Key Vault (enterprise CI/CD)

Best for Azure DevOps pipelines or any team that centralizes secrets in Key Vault. The certificate never touches the file system.

```ini
MS_AUTH_CREDENTIAL_TYPE=certificate
MS_AUTH_CREDENTIAL_PROVIDER=azure-keyvault
AZURE_KEYVAULT_URI=https://your-vault.vault.azure.net
AZURE_KEYVAULT_SECRET_NAME=your-cert-secret-name
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

The pipeline service principal needs `Key Vault Secrets User` access on the vault.

---

### Method 4 — Certificate via GitHub Secrets (GitHub Actions)

Best for open-source or GitHub-hosted CI. Store the base64-encoded certificate as a GitHub secret and reference it by name.

```ini
MS_AUTH_CREDENTIAL_TYPE=certificate
MS_AUTH_CREDENTIAL_PROVIDER=github-secrets
GITHUB_CERT_SECRET_NAME=PLAYWRIGHT_CERT
```

To encode your cert for GitHub:
```bash
base64 -i your-cert.pfx | pbcopy   # macOS — copies to clipboard
# Paste as the value of the PLAYWRIGHT_CERT secret in GitHub → Settings → Secrets
```

---

### Where sessions are stored

All methods save to the same location:

```
.playwright-ms-auth/
  state-you@yourorg.com.json          ← Power Apps session
  state-mda-you@yourorg.com.json      ← Dynamics 365 / MDA session
```

### Re-authenticating after 24 hours

```bash
rm -rf .playwright-ms-auth/
npm run auth
npm run auth:mda
```

---

## Recording a Test Case

The fastest way to write a test is to record it — Playwright opens a browser with your saved session and captures every click, fill, and navigation as TypeScript code in real time.

### Step 1 — Make sure your MDA session is valid

Sessions expire after 24 hours. Re-authenticate if needed:

```bash
npm run auth:mda
```

### Step 2 — Launch the recorder

```bash
npx playwright codegen \
  --browser=chromium \
  --load-storage=".playwright-ms-auth/state-mda-you@yourorg.com.json" \
  "YOUR_MODEL_DRIVEN_APP_URL"
```

Replace `you@yourorg.com` with your `MS_AUTH_EMAIL` and `YOUR_MODEL_DRIVEN_APP_URL` with the value from your `.env` file.

Two windows open:
- **Browser** — your MDA, already signed in
- **Playwright Inspector** — generated TypeScript code appears here as you interact

### Step 3 — Perform your workflow

Click through your workflow normally in the browser. Every action is captured:
- Clicking buttons and menu items
- Filling text fields
- Selecting dropdown options
- Navigating between pages

### Step 4 — Copy the generated code

When done, copy all the code from the **Playwright Inspector** panel on the right.

### Step 5 — Refactor into a proper test

The raw codegen output works but needs a few changes before it's production-ready. Here's what to update:

| Codegen output | What to change |
|---|---|
| Hardcoded strings (`"Test Equipment 123"`) | Replace with `record.name`, `record.uniqueId`, etc. from the `record` fixture |
| `page.goto('...')` | Add `{ waitUntil: 'domcontentloaded' }` — MDA pages are slow |
| Raw `test(...)` | Wrap in `test.describe.serial(...)` if steps depend on each other |
| No save confirmation | Add `await waitForSave(page, ENTITY_NAME)` after saving |
| No duplicate handling | Add `await dismissDuplicateDialog(page)` after the save click |

**Before (raw codegen):**
```typescript
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://yourorg.crm.dynamics.com/main.aspx?...');
  await page.getByRole('menuitem', { name: 'New' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Test Equipment 001');
  await page.getByRole('menuitem', { name: 'Save (CTRL+S)' }).click();
});
```

**After (production-ready):**
```typescript
import { expect } from '@playwright/test';
import { test } from '../fixtures/mda.fixtures';
import { waitForSave, dismissDuplicateDialog } from '../helpers/mda';

const MODEL_DRIVEN_APP_URL = process.env.MODEL_DRIVEN_APP_URL!;
const ENTITY_NAME = 'your_entity_name';

test.describe.serial('My Workflow', () => {
  test.setTimeout(180_000);

  test('create record', async ({ page, record }) => {
    await page.goto(MODEL_DRIVEN_APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[role="menuitem"]', { timeout: 30_000 });

    await page.getByRole('menuitem', { name: 'New' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill(record.name); // ← Faker data
    await page.getByRole('menuitem', { name: 'Save (CTRL+S)' }).click();
    await dismissDuplicateDialog(page);
    await waitForSave(page, ENTITY_NAME);

    await expect(page.getByRole('heading', { name: record.name })).toBeVisible();
  });
});
```

---

## Writing Your First Test

Tests live in the `tests/` folder. Each test file ends in `.test.ts`.

**Step 1 — Copy the example test**

```bash
cp tests/example.test.ts tests/my-first-test.test.ts
```

**Step 2 — Set your entity name**

Open `tests/my-first-test.test.ts` and change the `ENTITY_NAME` constant to your MDA entity's logical name.

```typescript
// The logical name of your entity — found in Power Apps > Tables > [Your Table] > Properties
const ENTITY_NAME = 'cr123_myentity';
```

> **How to find an entity's logical name:** Open your MDA → navigate to the entity list → look at the URL. It will contain `etn=your_entity_name`.

**Step 3 — Map form fields**

Replace the placeholder field labels with the actual labels from your MDA form:

```typescript
// Before (placeholder)
await page.getByRole('textbox', { name: 'Name' }).fill(record.name);

// After (your actual form fields)
await page.getByRole('textbox', { name: 'Case Title' }).fill(record.name);
await page.getByRole('textbox', { name: 'Case Number' }).fill(record.uniqueId);
await page.getByRole('textbox', { name: 'Description' }).fill(record.description);
await page.getByRole('combobox', { name: 'Status' }).click();
await page.getByRole('option', { name: record.status }).click();
```

> **Tip — find exact field labels:** Run `npx playwright codegen --browser=chromium --load-storage=".playwright-ms-auth/state-mda-you@yourorg.com.json" "YOUR_MDA_URL"` and interact with the form. The recorder shows the exact selectors to use.

**Full test file structure**

```typescript
import { expect } from '@playwright/test';
import { test } from '../fixtures/mda.fixtures';
import { navigateToGridView, waitForSave, dismissDuplicateDialog } from '../helpers/mda';

const MODEL_DRIVEN_APP_URL = process.env.MODEL_DRIVEN_APP_URL!;
const ENTITY_NAME = 'cr123_myentity';

test.describe.serial('My Entity: Create Record', () => {
  test.setTimeout(180_000); // MDA navigation is slow — 3 min per test is safe

  test('create a record', async ({ page, record }) => {
    // 1. Navigate to the entity grid
    await navigateToGridView(page, MODEL_DRIVEN_APP_URL, ENTITY_NAME);

    // 2. Open the New record form
    await page.getByRole('menuitem', { name: 'New', exact: true }).click();
    await page.waitForURL(new RegExp(`pagetype=entityrecord.*${ENTITY_NAME}`), { timeout: 30_000 });

    // 3. Fill in form fields
    await page.getByRole('textbox', { name: 'Name' }).fill(record.name);
    await page.getByRole('textbox', { name: 'Unique ID' }).fill(record.uniqueId);

    // 4. Save
    await page.getByRole('menuitem', { name: 'Save (CTRL+S)' }).click();
    await dismissDuplicateDialog(page);
    await waitForSave(page, ENTITY_NAME);

    // 5. Assert
    await expect(page.getByRole('heading', { name: record.name })).toBeVisible();
  });
});
```

---

## Adding Faker Data to Your Test

### Option A — Use the `record` fixture (recommended)

Import `test` from the fixture instead of `@playwright/test`. This automatically injects a `record` object with generated data.

```typescript
import { test, expect } from '../fixtures/mda.fixtures'; // ← not @playwright/test

test('create a record', async ({ page, record }) => {
  //                                      ↑ record is injected automatically
  console.log(record.name);       // e.g. "Calibration - X7K4PL"
  console.log(record.uniqueId);   // e.g. "REC-A3KF92XP"
  console.log(record.category);   // e.g. "Laboratory"
});
```

**Every `record` has these fields — all strings, ready to fill into form inputs:**

| Field | Example (generic) | Example (airline) | Example (healthcare) |
|---|---|---|---|
| `record.name` | `"Refined Granite Chair"` | `"Delta Flight DL0421"` | `"Patient: James Harrington"` |
| `record.uniqueId` | `"REC-A3KF92XP"` | `"XKPL9R"` | `"MRN-58291043"` |
| `record.description` | `"Vel perferendis..."` | `"JFK → LAX"` | `"Cardiology — Routine checkup"` |
| `record.category` | `"Electronics"` | `"widebody"` | `"Cardiology"` |
| `record.date` | `"07/15/2025"` | `"06/14/2026"` | `"05/17/2026"` |
| `record.status` | `"Active"` | `"Delayed"` | `"Discharged"` |
| `record.owner` | `"Jane Smith"` | `"Vivian Deckow"` | `"Dr. Wiegand, DO"` |
| `record.notes` | `"Lorem ipsum..."` | `"Seat 14F — widebody"` | `"Hassium (Hs). Units: °C"` |

**Switch domains by changing `.env`:**

```ini
FAKER_DOMAIN=airline      # aviation data
FAKER_DOMAIN=healthcare   # clinical data
FAKER_DOMAIN=government   # case/agency data
FAKER_DOMAIN=generic      # default
```

### Option B — Pre-seed data and inspect it before running

Generate a batch of records upfront, review them in the terminal, then run your tests against that exact data.

```bash
# Generate 10 records for the airline domain
npx tsx data/seed.ts --count=10 --domain=airline

# Output — you can see every record before it's used:
# ┌─────────┬──────────────────────────┬──────────┬─────────────┬──────────┐
# │ (index) │ name                     │ uniqueId │ description │ category │
# ├─────────┼──────────────────────────┼──────────┼─────────────┼──────────┤
# │ 0       │ 'Delta Flight DL0421'    │ 'XKPL9R' │ 'JFK → LAX' │ regional │
# │ 1       │ 'United Flight UA8832'   │ 'AHMVZK' │ 'ORD → SFO' │ widebody │
# └─────────┴──────────────────────────┴──────────┴─────────────┴──────────┘

# Run tests — each run consumes one record from the queue
npx playwright test --project=mda
```

**Reproducible data** — use `--seed` to get the same records every time:

```bash
npx tsx data/seed.ts --count=10 --domain=healthcare --seed=42
# Same 10 records every time you run this
```

### Option C — Generate data inline (no fixture)

If you want full control over the exact fields, import the factory directly:

```typescript
import { createRecord, resolveProfile } from '../data/factory';

test('create a record', async ({ page }) => {
  const profile = await resolveProfile('healthcare');
  const record  = createRecord(profile, {
    category: 'Cardiology',   // force a specific category
    status: 'Active',         // force a specific status
    // all other fields are still randomized
  });

  await page.getByRole('textbox', { name: 'Name' }).fill(record.name);
});
```

---

## Test Conditions — Happy Path & Edge Cases

### Happy path

The happy path tests the normal, expected flow — valid data, all required fields filled, successful save.

```typescript
test.describe.serial('Happy Path — Create and Verify Record', () => {
  test.setTimeout(180_000);

  test('fill all fields and save successfully', async ({ page, record }) => {
    await navigateToGridView(page, MODEL_DRIVEN_APP_URL, ENTITY_NAME);

    await page.getByRole('menuitem', { name: 'New', exact: true }).click();
    await page.waitForURL(new RegExp(`pagetype=entityrecord.*${ENTITY_NAME}`), { timeout: 30_000 });

    // Fill every required field
    await page.getByRole('textbox', { name: 'Name' }).fill(record.name);
    await page.getByRole('textbox', { name: 'Unique ID' }).fill(record.uniqueId);
    await page.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'Active' }).click();

    await page.getByRole('menuitem', { name: 'Save (CTRL+S)' }).click();
    await dismissDuplicateDialog(page);
    await waitForSave(page, ENTITY_NAME);

    // Confirm the record was created with the correct name
    await expect(page.getByRole('heading', { name: record.name })).toBeVisible();
  });
});
```

### Edge cases

Edge cases test what happens when something goes wrong or inputs are unusual.

**1. Required field left blank (validation error)**

```typescript
test('shows error when required field is missing', async ({ page }) => {
  await navigateToGridView(page, MODEL_DRIVEN_APP_URL, ENTITY_NAME);
  await page.getByRole('menuitem', { name: 'New', exact: true }).click();
  await page.waitForURL(new RegExp(`pagetype=entityrecord.*${ENTITY_NAME}`), { timeout: 30_000 });

  // Leave the Name field blank — attempt save
  await page.getByRole('menuitem', { name: 'Save (CTRL+S)' }).click();

  // MDA shows an error notification for required fields
  await expect(
    page.getByText(/required|cannot be empty|field is required/i)
  ).toBeVisible({ timeout: 10_000 });
});
```

**2. Long text input (boundary condition)**

```typescript
test('handles maximum-length input', async ({ page, record }) => {
  await navigateToGridView(page, MODEL_DRIVEN_APP_URL, ENTITY_NAME);
  await page.getByRole('menuitem', { name: 'New', exact: true }).click();
  await page.waitForURL(new RegExp(`pagetype=entityrecord.*${ENTITY_NAME}`), { timeout: 30_000 });

  const longText = 'A'.repeat(255); // max field length for most MDA text fields
  await page.getByRole('textbox', { name: 'Name' }).fill(longText);
  await page.getByRole('menuitem', { name: 'Save (CTRL+S)' }).click();
  await dismissDuplicateDialog(page);
  await waitForSave(page, ENTITY_NAME);

  // Record should save — MDA truncates or rejects at the field limit
  await expect(page.getByRole('heading')).toBeVisible({ timeout: 15_000 });
});
```

**3. Duplicate record detection**

```typescript
test('handles duplicate detection gracefully', async ({ page, record }) => {
  // Save once
  await navigateToGridView(page, MODEL_DRIVEN_APP_URL, ENTITY_NAME);
  await page.getByRole('menuitem', { name: 'New', exact: true }).click();
  await page.waitForURL(new RegExp(`pagetype=entityrecord.*${ENTITY_NAME}`), { timeout: 30_000 });
  await page.getByRole('textbox', { name: 'Name' }).fill(record.name);
  await page.getByRole('menuitem', { name: 'Save (CTRL+S)' }).click();
  await dismissDuplicateDialog(page);
  await waitForSave(page, ENTITY_NAME);

  // Attempt to save again with the same name — should trigger duplicate dialog
  await navigateToGridView(page, MODEL_DRIVEN_APP_URL, ENTITY_NAME);
  await page.getByRole('menuitem', { name: 'New', exact: true }).click();
  await page.waitForURL(new RegExp(`pagetype=entityrecord.*${ENTITY_NAME}`), { timeout: 30_000 });
  await page.getByRole('textbox', { name: 'Name' }).fill(record.name);
  await page.getByRole('menuitem', { name: 'Save (CTRL+S)' }).click();

  // Duplicate dialog should appear
  await expect(
    page.getByRole('button', { name: /save anyway|ignore and save/i })
  ).toBeVisible({ timeout: 10_000 });
});
```

**4. Multi-step workflow (serial tests)**

For workflows where each step depends on the previous one (create → update → deactivate), use `test.describe.serial` and share state between tests:

```typescript
let recordUrl: string;

test.describe.serial('Full Lifecycle — Create, Update, Deactivate', () => {
  test.setTimeout(180_000);

  // Step 1: Create
  test('create record', async ({ page, record }) => {
    await navigateToGridView(page, MODEL_DRIVEN_APP_URL, ENTITY_NAME);
    await page.getByRole('menuitem', { name: 'New', exact: true }).click();
    await page.waitForURL(new RegExp(`pagetype=entityrecord.*${ENTITY_NAME}`), { timeout: 30_000 });
    await page.getByRole('textbox', { name: 'Name' }).fill(record.name);
    await page.getByRole('menuitem', { name: 'Save (CTRL+S)' }).click();
    await dismissDuplicateDialog(page);
    await waitForSave(page, ENTITY_NAME);

    recordUrl = page.url(); // save URL for next test
    await expect(page.getByRole('heading', { name: record.name })).toBeVisible();
  });

  // Step 2: Update
  test('update record', async ({ page, record }) => {
    await page.goto(recordUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('[role="menuitem"]', { timeout: 30_000 });

    await page.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'In Progress' }).click();
    await page.getByRole('menuitem', { name: 'Save (CTRL+S)' }).click();
    await waitForSave(page, ENTITY_NAME);

    await expect(page.getByText('In Progress')).toBeVisible();
  });

  // Step 3: Deactivate
  test('deactivate record', async ({ page }) => {
    await page.goto(recordUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('[role="menuitem"]', { timeout: 30_000 });

    // Most MDAs have a Deactivate button in the command bar
    await page.getByRole('menuitem', { name: 'Deactivate' }).click();
    await page.getByRole('button', { name: 'Deactivate' }).click(); // confirm dialog

    await expect(page.getByText('Inactive')).toBeVisible({ timeout: 15_000 });
  });
});
```

---

## Running Tests

All commands run from the repo root.

```bash
# Run all tests (headless)
npx playwright test --project=mda

# Watch the browser as tests run
npx playwright test --project=mda --headed

# Run a specific test file
npx playwright test tests/my-first-test.test.ts --project=mda --headed

# Step through a test interactively
npx playwright test tests/my-first-test.test.ts --project=mda --debug

# Interactive UI — best for active development
npx playwright test --project=mda --ui
```

---

## Viewing Results

**HTML report** — opens in your browser, shows screenshots, videos, and data attachments:

```bash
npx playwright show-report
```

In the report, click any test → **Attachments** tab → `MDA Record (domain)` to see the exact JSON data that was used in that test run.

**Trace viewer** — step-by-step replay of a failed test:

```bash
npx playwright show-trace test-results/artifacts/<test-folder>/trace.zip
```

---

## Adding a New Domain

**Step 1 — Create a domain file in `data/domains/`**

```typescript
// data/domains/finance.ts
import { faker } from '@faker-js/faker';
import { DomainProfile } from '../factory';

export const financeProfile: DomainProfile = {
  name:        () => `${faker.finance.accountName()} — ${faker.string.alphanumeric(6).toUpperCase()}`,
  uniqueId:    () => faker.finance.accountNumber(),
  description: () => faker.finance.transactionDescription(),
  category:    () => faker.finance.transactionType(),
  date:        () => faker.date.recent().toLocaleDateString('en-US'),
  status:      () => faker.helpers.arrayElement(['Pending', 'Settled', 'Reversed']),
  owner:       () => faker.person.fullName(),
  notes:       () => `${faker.finance.currency().name} — ${faker.finance.amount()} USD`,
};
```

**Step 2 — Register it in `data/factory.ts`**

```typescript
case 'finance': return (await import('./domains/finance')).financeProfile;
```

**Step 3 — Use it**

```ini
# .env
FAKER_DOMAIN=finance
```

```bash
npx tsx data/seed.ts --count=5 --domain=finance
npx playwright test --project=mda
```

---

## Troubleshooting & Things to Know

### Installation

| Problem | Fix |
|---|---|
| `SELF_SIGNED_CERT_IN_CHAIN` when running `npm install` or `npm run install:browsers` | Corporate network SSL inspection — see fix below |
| `npm install` hangs or times out | Try `npm install --prefer-offline` or connect outside the VPN |
| `npx playwright install` fails with a certificate error | Same root cause — use the `NODE_EXTRA_CA_CERTS` fix below |

**`SELF_SIGNED_CERT_IN_CHAIN` — Corporate Network Fix**

Your company's network proxy intercepts HTTPS traffic and presents a self-signed certificate. Node.js rejects it because the root isn't in its built-in trust store.

**Step 1 — Export your corporate root certificate**

On Windows, run in PowerShell:
```powershell
# List trusted roots and find your company's CA
Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*YourCompany*" }

# Export it (replace THUMBPRINT with the value shown above)
$cert = Get-ChildItem Cert:\LocalMachine\Root\THUMBPRINT
$pem  = [Convert]::ToBase64String($cert.Export('Cert'), [System.Base64FormattingOptions]::InsertLineBreaks)
"-----BEGIN CERTIFICATE-----`n$pem`n-----END CERTIFICATE-----" | Out-File -FilePath C:\corp-root-ca.pem
```

If you're unsure which cert to export, ask IT — they can hand you `corp-root-ca.pem` directly.

**Step 2 — Point Node.js at it**

```powershell
# Set for the current PowerShell session
$env:NODE_EXTRA_CA_CERTS = "C:\corp-root-ca.pem"
npm install
npm run install:browsers
```

To make it permanent (survives reboots):
```powershell
[System.Environment]::SetEnvironmentVariable("NODE_EXTRA_CA_CERTS", "C:\corp-root-ca.pem", "User")
```

**Quick workaround (unblock yourself now — not for permanent use)**

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
npm install
npm run install:browsers
# Remove this variable after the install — do not leave it set
```

---

### Authentication

| Problem | Fix |
|---|---|
| `Authentication tokens have expired` | `rm -rf .playwright-ms-auth/` then re-run both auth commands |
| Browser opens but MFA prompt disappears too fast | Script waits 2 minutes — approve MFA before the window closes |
| `MODEL_DRIVEN_APP_URL is required` | Make sure you copied `.env.example` to `.env` and filled in the URL |
| MDA shows "An error has occurred" during auth | Your `MODEL_DRIVEN_APP_URL` app ID is wrong, or your account doesn't have access |
| `Certificate validation failed` | Your `.pfx` file is invalid, the wrong password was set, or the cert isn't registered in Azure AD |
| `Key Vault secret not found` | Check `AZURE_KEYVAULT_SECRET_NAME` and that the service principal has `Key Vault Secrets User` role |
| Certificate auth works locally but fails in CI | The cert may have expired, or the CI service principal doesn't have Power Platform access |
| GitHub Actions cert not loading | Make sure the secret is base64-encoded (not the raw binary) and the secret name matches `GITHUB_CERT_SECRET_NAME` |

### Test failures

| Problem | Fix |
|---|---|
| `Timeout waiting for URL` | MDA is slow — increase `test.setTimeout(180_000)` or the specific `timeout` value |
| `page.goto` timeout | Always use `{ waitUntil: 'domcontentloaded' }` — MDA pages never fire the `load` event reliably |
| Button or field not found | Use `npx playwright codegen` to re-record and get the exact selector |
| Subgrid toolbar button missing | Hover over the subgrid tab first — MDA only renders toolbar buttons on hover |
| Duplicate detection dialog blocks save | `dismissDuplicateDialog(page)` handles this — call it after every save click |
| Test passes but wrong record is shown | Add `await waitForSave(page, ENTITY_NAME)` — this waits for the record GUID in the URL |

### Test data

| Problem | Fix |
|---|---|
| Domain data doesn't match your dropdown options | Use `overrides` in `createRecord(profile, { category: 'Your Option' })` to force specific values |
| Seed queue is empty | Re-run `npx tsx data/seed.ts --count=10 --domain=your-domain` to refill |
| Want the same data every run | Add `--seed=42` (any number) to the seed command |
| Need a field the record doesn't have | Add a custom generator to your domain file and access it via `record.yourField` |

### Things to know

- **`test.describe.serial`** — use this whenever tests depend on each other (e.g. create → update → delete). Without it, Playwright may run tests in parallel and out of order.
- **MDA is slow** — page loads take 10–30 seconds. Always wait for `[role="menuitem"]` after navigation to confirm the app shell has rendered before interacting with it.
- **Sessions last 24 hours** — re-run both auth commands each day before testing.
- **Never commit `.env`** — it's in `.gitignore`. Share credentials securely through your team's password manager or environment variable system.
- **Data generated at test time** — unless you use the seed script, Faker generates fresh data each run. This means no two runs use the same names or IDs, which prevents duplicate detection errors automatically.
- **HTML report attachments** — every test automatically attaches a JSON file showing the exact data used. This is your audit trail for what was tested.
