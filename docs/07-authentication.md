# Authentication

How signed-in sessions are created, stored, and reused across tests — including running as multiple different accounts.

---

## The Short Version

1. `npm run auth:mda` opens a real browser window, you sign in by hand (SSO, MFA, Windows Hello — whatever your org uses), and the resulting cookies/storage are saved to a JSON file on disk.
2. Every test run reuses that file instead of signing in again — no credentials live in `.env`, no password flow to maintain.
3. Sessions last **24 hours**. Re-run the auth command when they expire.
4. Define multiple accounts as named aliases in `qa.config.json`, authenticate each one separately, and switch between them per test with `test.use({ userAlias: '...' })`.

There is no password- or certificate-based auth path in this repo — `auth/authenticate.ts` only does interactive sign-in. (If you've read an older version of the main README that mentions certificate/Key Vault/GitHub Secrets methods, that was a different design that was replaced — the script now always opens a browser and waits for you to sign in manually.)

---

## Where Sessions Are Stored

Every session is a [Playwright storage state](https://playwright.dev/docs/auth) JSON file — cookies + local storage — under `.playwright-ms-auth/` (already in `.gitignore`, never commit these):

```
.playwright-ms-auth/
  state-powerapps-<email>.json   ← from `npm run auth` / `auth:headful`
  state-mda-<email>.json         ← from `npm run auth:mda` / `auth:mda:headful`
```

`<email>` is sanitized (non `[a-zA-Z0-9._-]` characters replaced with `_`) so it's filesystem-safe. `tag` (`powerapps` or `mda`) keeps the two app surfaces separate since they're different origins with different sessions.

The filename is **not** tied to who you actually clicked "sign in" as in the browser — it's tied to the email identifier the script was told to use. That distinction matters for multi-account setups; see below.

---

## Single-Account Setup

If you only ever test as one user, this is all you need:

```ini
# .env
MS_AUTH_EMAIL=you@yourorg.com
MODEL_DRIVEN_APP_URL=https://your-org.crm.dynamics.com/main.aspx?appid=...
```

```bash
npm run auth:mda
```

The script reads `MS_AUTH_EMAIL`, opens `MODEL_DRIVEN_APP_URL`, waits for you to complete sign-in, and saves `.playwright-ms-auth/state-mda-you@yourorg.com.json`. Every test picks this file up automatically via `playwright.config.ts` → `fixtures/mda.fixtures.ts` (see [How the pieces fit together](#how-the-pieces-fit-together)).

---

## Multi-Account Setup

**Step 1 — name your accounts in `qa.config.json`**

```json
{
  "users": [
    { "alias": "test-user-1", "name": "Test User 1", "email": "test.user.1@yourorg.com" },
    { "alias": "manager",     "name": "Manager User", "email": "manager.user@yourorg.com" }
  ]
}
```

**Step 2 — authenticate each one by alias**

This is the step that's easy to get wrong: npm swallows extra flags unless you pass `--` first.

```bash
npm run auth:mda -- --user test-user-1
npm run auth:mda -- --user manager
```

Each run opens the browser fresh — sign in as the matching real account when prompted. The script looks up the alias in `qa.config.json`, uses **that entry's email** (not `MS_AUTH_EMAIL`) to name the file, and saves:

```
.playwright-ms-auth/state-mda-test.user.1@yourorg.com.json
.playwright-ms-auth/state-mda-manager.user@yourorg.com.json
```

> ⚠️ If you forget `--user <alias>`, the script falls back to `MS_AUTH_EMAIL` from `.env` — which is the same value every time. Running `npm run auth:mda` twice and signing in as two different people in the browser does **not** give you two sessions; the second run just overwrites the first one's file, because both runs resolve to the same filename. Always pass `--user` explicitly when you have more than one account.

**Step 3 — pick a user per test**

```ts
import { test, expect } from '../fixtures/mda.fixtures';

test.describe('Manager approval flow', () => {
  test.use({ userAlias: 'manager' });   // loads state-mda-manager.user@yourorg.com.json

  test('approves a request', async ({ page, currentUser }) => {
    console.log(currentUser.name); // "Manager User"
    // ...
  });
});
```

Any test or `describe` block that doesn't call `test.use({ userAlias })` defaults to `qaConfig.users[0]` — the first entry in `qa.config.json`. This is the second common trap: having valid session files for every account on disk doesn't matter if nothing in the test tells Playwright which one to load.

---

## How the Pieces Fit Together

```
qa.config.json                  auth/authenticate.ts
  users[].alias/email    ──►      --user <alias>  ──►  findQaUser()  ──►  resolves email
       │                                                     │
       │                                                     ▼
       │                                     signs in, saves storageState to
       │                                     buildStorageStatePath('mda', email)
       │                                     = .playwright-ms-auth/state-mda-<email>.json
       │
       ▼
fixtures/mda.fixtures.ts
  userAlias option (default: qaConfig.users[0].alias, override with test.use)
       │
       ▼
  storageState fixture ──► resolveStorageStatePath('mda', userAlias)
       │                     - looks up the alias in qa.config.json
       │                     - falls back to treating userAlias itself as an email
       │                     - falls back to MS_AUTH_EMAIL if nothing else matches
       ▼
  same file path the auth script wrote to ──► loaded into the test's browser context
```

Key files:

| File | Responsibility |
|---|---|
| `qa.config.json` | Source of truth for named test users (`alias`, `name`, `email`). |
| `data/qa-config.ts` | Loads/validates `qa.config.json` (via Zod), exposes `findQaUser`, `resolveQaUser`, `getDefaultQaUser`. |
| `helpers/test-users.ts` | Builds/resolves the storage-state file path for a given `(tag, alias-or-email)` pair. `buildStorageStatePath` writes it; `resolveStorageStatePath` reads it back the same way, so the two always agree on a filename. |
| `auth/authenticate.ts` | The interactive sign-in script (`npm run auth`, `auth:mda`, and their `--headful` aliases). Opens a browser, waits for you to leave the Microsoft login domain, then persists `context.storageState()`. |
| `fixtures/mda.fixtures.ts` | Overrides Playwright's built-in `storageState` fixture to resolve per-test from the `userAlias` option instead of a static config value. Also exposes `currentUser` (the resolved `QaUser` object) to tests. |
| `playwright.config.ts` | Deliberately does **not** set `use.storageState` on the `mda` project — that would hardcode a single session and defeat per-test user switching. The fixture above is the only thing that decides which file loads. |

Because `storageState` is overridden as a fixture rather than left as a static config value, `test.use({ userAlias: '...' })` at the `describe` or `test` level is enough to swap accounts — no project duplication, no separate config files per user.

---

## Session Expiry & Re-authentication

Sessions last **24 hours**. When one expires, tests will fail at the Microsoft login redirect (or land on a sign-in page instead of the MDA). Re-run auth for the affected user(s):

```bash
npm run auth:mda -- --user test-user-1
npm run auth:mda -- --user manager
```

Or wipe everything and start clean:

```bash
rm -rf .playwright-ms-auth/
npm run auth:mda -- --user test-user-1
npm run auth:mda -- --user manager
```

---

## Two App Surfaces

The scripts target two different origins, saved with different `tag` values:

| Command | Signs into | Tag | Used by |
|---|---|---|---|
| `npm run auth` / `auth:headful` | `POWER_APPS_BASE_URL` (default `make.powerapps.com`) | `powerapps` | Canvas app / maker-portal testing |
| `npm run auth:mda` / `auth:mda:headful` | `MODEL_DRIVEN_APP_URL` | `mda` | Model-driven app tests (`fixtures/mda.fixtures.ts`) |

Both accept `--user <alias>` the same way.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Only one account ever seems to be signed in, even after running auth multiple times | Ran `npm run auth:mda` without `-- --user <alias>` — every run keyed off the same `MS_AUTH_EMAIL`, overwriting the same file | Re-run with `-- --user <alias>` for each account |
| Session files for every user exist, but a test always runs as the wrong one | Test/describe block doesn't call `test.use({ userAlias })` | Add `test.use({ userAlias: 'the-alias' })` to the block |
| `Unknown QA user "..."` error from the auth script | Alias passed to `--user` doesn't match any `alias`/`name` in `qa.config.json` | Check spelling, or add the user to `qa.config.json` |
| Test hits a Microsoft sign-in page instead of the app | Session expired (>24h) or was never created | Re-run `npm run auth:mda -- --user <alias>` |
| `MS_AUTH_EMAIL is required in .env, or provide --user ...` | Neither `.env`'s `MS_AUTH_EMAIL` nor `--user` resolved to an email | Set `MS_AUTH_EMAIL`, or pass a valid `--user <alias>` that has an `email` in `qa.config.json` |
